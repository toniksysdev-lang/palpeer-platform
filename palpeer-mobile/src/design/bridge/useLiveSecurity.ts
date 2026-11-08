import { useCallback, useMemo, useState } from 'react';

import { markDeviceVerifiedForSession } from '@/features/security/deviceSession';
import { SECURITY_QUESTION_CATALOGUE } from '@/features/security/questionCatalogue';
import { securityErrorMessage } from '@/features/security/errors';
import {
  JOB_OPTIONS,
  MONTHLY_TX_OPTIONS,
  SOURCE_OF_INCOME_OPTIONS,
} from '@/features/profile/profileOptions';
import { toIsoDate } from '@/features/profile/schemas';
import { baseApi } from '@/services/api/baseApi';
import {
  useGetPublicInstantRatesQuery,
  useGetPublicP2PRatesQuery,
} from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { useUpdateMyProfileMutation } from '@/services/api/profileApi';
import { buildRegistration } from '@/services/biometrics/deviceRegistration';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch, useAppSelector } from '@/store';
import type { UpdateProfileRequest } from '@/types/api/profile';
import { formatMoney, formatRate } from '@/utils/money';

type OkErr = { ok: true } | { ok: false; error: string };

const COUNTRY_ID_TO_ISO: Record<string, string> = {
  ca: 'CA',
  ng: 'NG',
  us: 'US',
  gb: 'GB',
  gh: 'GH',
  ke: 'KE',
  za: 'ZA',
};

function leftSeconds(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 3600;
  return Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
}

/**
 * PIN, security questions, profile save, and public rates for the Start onboarding flow.
 */
export function useLiveSecurity() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.session.userId);
  const [updateProfile] = useUpdateMyProfileMutation();
  const p2pRates = useGetPublicP2PRatesQuery();
  const instantRates = useGetPublicInstantRatesQuery();
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  const onSetPin = useCallback(async (pin: string): Promise<OkErr> => {
    setSecurityError(null);
    setSecurityBusy(true);
    try {
      const result = await securityCommands.setPin({ pin });
      if (!result.ok) {
        const msg = securityErrorMessage(toAppError(result.error));
        setSecurityError(msg);
        return { ok: false, error: msg };
      }
      // First-time PIN on this install counts as device confirmation for this session,
      // so RequireNewDevicePin does not bounce StartQuestions back to ConfirmPin.
      if (userId) markDeviceVerifiedForSession(userId);
      try {
        const registration = await buildRegistration();
        await securityCommands.registerDevice(registration);
      } catch {
        // Device register is best-effort after PIN is saved; setup can continue.
      }
      dispatch(baseApi.util.invalidateTags(['Security']));
      return { ok: true };
    } catch (raw) {
      const msg = securityErrorMessage(toAppError(raw));
      setSecurityError(msg);
      return { ok: false, error: msg };
    } finally {
      setSecurityBusy(false);
    }
  }, [dispatch, userId]);

  const onSetQuestions = useCallback(
    async (input: {
      q1Index: number;
      q2Index: number;
      a1: string;
      a2: string;
    }): Promise<OkErr> => {
      setSecurityError(null);
      const q1 = SECURITY_QUESTION_CATALOGUE[input.q1Index];
      const q2 = SECURITY_QUESTION_CATALOGUE[input.q2Index];
      if (!q1 || !q2) {
        const msg = 'Choose two security questions.';
        setSecurityError(msg);
        return { ok: false, error: msg };
      }
      setSecurityBusy(true);
      try {
        const result = await securityCommands.setQuestions({
          questions: [
            {
              questionKey: q1.questionKey,
              questionText: q1.questionText,
              answer: input.a1.trim(),
            },
            {
              questionKey: q2.questionKey,
              questionText: q2.questionText,
              answer: input.a2.trim(),
            },
          ],
        });
        if (!result.ok) {
          const msg = securityErrorMessage(toAppError(result.error));
          setSecurityError(msg);
          return { ok: false, error: msg };
        }
        // Optimistic cache so RequireSecurityQuestions does not bounce back during refetch.
        dispatch(
          baseApi.util.upsertQueryData('getSecurityQuestions', undefined, [
            {
              id: '00000000-0000-4000-8000-000000000001',
              questionKey: q1.questionKey,
              questionText: q1.questionText,
            },
            {
              id: '00000000-0000-4000-8000-000000000002',
              questionKey: q2.questionKey,
              questionText: q2.questionText,
            },
          ]),
        );
        dispatch(baseApi.util.invalidateTags(['Security']));
        return { ok: true };
      } catch (raw) {
        const msg = securityErrorMessage(toAppError(raw));
        setSecurityError(msg);
        return { ok: false, error: msg };
      } finally {
        setSecurityBusy(false);
      }
    },
    [dispatch],
  );

  const onSaveProfile = useCallback(
    async (input: {
      fname: string;
      lname: string;
      dob: string;
      job: string;
      income: string;
      month: number;
      live: string;
      prov: string;
      addr1: string;
      addr2: string;
      city: string;
      postal: string;
    }): Promise<OkErr> => {
      setSecurityError(null);
      const isoDob = toIsoDate(input.dob);
      if (!isoDob) {
        const msg = 'Enter a valid date of birth (DD/MM/YYYY).';
        setSecurityError(msg);
        return { ok: false, error: msg };
      }
      const country =
        COUNTRY_ID_TO_ISO[input.live] ?? input.live.trim().toUpperCase().slice(0, 2);
      const incomeKey =
        SOURCE_OF_INCOME_OPTIONS.find((o) => o.title === input.income)?.key ??
        JOB_OPTIONS.find((o) => o.title === input.job)?.key ??
        SOURCE_OF_INCOME_OPTIONS.find((o) => o.title === input.job)?.key ??
        (input.income.trim() || input.job.trim() || 'OTHER');
      const monthKey =
        MONTHLY_TX_OPTIONS[input.month]?.key ?? MONTHLY_TX_OPTIONS[0]?.key ?? '0_2000';
      const body: UpdateProfileRequest = {
        firstName: input.fname.trim(),
        lastName: input.lname.trim(),
        dateOfBirth: isoDob,
        countryOfResidence: country,
        stateTerritory: input.prov.trim(),
        addressLine1: input.addr1.trim(),
        addressLine2: input.addr2.trim() || null,
        city: input.city.trim(),
        postalCode: input.postal.trim(),
        sourceOfIncome: incomeKey,
        monthlyTransactionEstimate: monthKey,
      };
      setSecurityBusy(true);
      try {
        await updateProfile(body).unwrap();
        return { ok: true };
      } catch (raw) {
        const msg = toAppError(raw).message ?? 'Could not save profile.';
        setSecurityError(msg);
        return { ok: false, error: msg };
      } finally {
        setSecurityBusy(false);
      }
    },
    [updateProfile],
  );

  const liveOffers = useMemo(() => {
    return (p2pRates.data ?? []).map((r) => {
      const rate = Number.parseFloat(r.rate) || 0;
      const amt = Number.parseFloat(r.amount) || 0;
      return {
        id: r.id,
        rate: Math.round(rate),
        amt: Math.round(amt),
        left: leftSeconds(r.expiresAt),
        expiresAt: r.expiresAt,
        ca: r.baseCurrencyCode === 'CAD' || (r.side === 'SELL' && r.quoteCurrencyCode === 'NGN'),
        priceLabel: `CA$1 = ₦${formatRate(r.rate, 0)}`,
        amountLabel:
          r.baseCurrencyCode === 'CAD'
            ? `Selling CA$${formatMoney(r.amount, { precision: 0, showCurrency: false })}`
            : `Selling ₦${formatMoney(r.amount, { precision: 0, showCurrency: false })}`,
      };
    });
  }, [p2pRates.data]);

  const adminRate = useMemo(() => {
    const pair = (instantRates.data ?? []).find(
      (r) =>
        (r.baseCurrencyCode === 'CAD' && r.quoteCurrencyCode === 'NGN') ||
        (r.baseCurrencyCode === 'NGN' && r.quoteCurrencyCode === 'CAD'),
    );
    if (!pair) {
      return { getNgn: '₦—', getCad: 'CA$—' };
    }
    const buy = Number.parseFloat(pair.buyRate) || 0;
    const sell = Number.parseFloat(pair.sellRate) || 0;
    if (pair.baseCurrencyCode === 'CAD') {
      const ngnPerCad = buy || sell;
      const cadPerThousandNgn = 1000 / (sell || buy || 1);
      return {
        getNgn: `₦${formatRate(String(ngnPerCad), 0)}`,
        getCad: `CA$${cadPerThousandNgn.toFixed(2)}`,
      };
    }
    return {
      getNgn: `₦${(1 / (buy || 1)).toFixed(0)}`,
      getCad: `CA$${formatRate(pair.buyRate, 2)}`,
    };
  }, [instantRates.data]);

  return {
    onSetPin,
    onSetQuestions,
    onSaveProfile,
    securityError,
    securityBusy,
    clearSecurityError: () => setSecurityError(null),
    liveOffers,
    ratesEmpty: !p2pRates.isLoading && liveOffers.length === 0,
    adminRate,
  };
}

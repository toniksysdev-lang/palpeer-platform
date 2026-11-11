import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

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
import { apiRequest } from '@/services/api/client';
import { publicApiErrorMessage, toAppError } from '@/services/api/errors';
import { useUpdateMyProfileMutation } from '@/services/api/profileApi';
import { sessionManager } from '@/services/auth/session';
import { buildRegistration } from '@/services/biometrics/deviceRegistration';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppDispatch, useAppSelector } from '@/store';
import type { PublicInstantRateResponse, PublicP2PRateResponse } from '@/types/api/exchange';
import type { UpdateProfileRequest } from '@/types/api/profile';
import { leftSeconds } from '@/newui/features/start/data';
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

/**
 * PIN, security questions, profile save, and public rates for the Start onboarding flow.
 */
export function useLiveSecurity() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.session.userId);
  const [updateProfile] = useUpdateMyProfileMutation();
  /**
   * Guest Best-rate boards. Plain fetch (not RTK) — refetchOnFocus was aborting these
   * mid-flight on web, leaving the Palpeer rate tab stuck on "Loading…".
   */
  const [instantRatesData, setInstantRatesData] = useState<PublicInstantRateResponse[] | undefined>(
    undefined,
  );
  const [p2pRatesData, setP2pRatesData] = useState<PublicP2PRateResponse[] | undefined>(undefined);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  const loadPublicRates = useCallback(async () => {
    setRatesLoading(true);
    const [instant, p2p] = await Promise.all([
      apiRequest<PublicInstantRateResponse[]>('/public/instant-rates'),
      apiRequest<PublicP2PRateResponse[]>('/public/p2p-rates'),
    ]);
    let nextError: string | null = null;
    if (instant.ok) {
      setInstantRatesData(Array.isArray(instant.data) ? instant.data : []);
    } else {
      nextError = publicApiErrorMessage(toAppError(instant.error));
      setInstantRatesData((prev) => prev ?? []);
    }
    if (p2p.ok) {
      setP2pRatesData(Array.isArray(p2p.data) ? p2p.data : []);
    } else {
      nextError = nextError || publicApiErrorMessage(toAppError(p2p.error));
      setP2pRatesData((prev) => prev ?? []);
    }
    setRatesError(nextError);
    setRatesLoading(false);
  }, []);

  useEffect(() => {
    void loadPublicRates();
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') void loadPublicRates();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [loadPublicRates]);

  const onSetPin = useCallback(async (pin: string): Promise<OkErr> => {
    setSecurityError(null);
    setSecurityBusy(true);
    try {
      // Ensure we have a bearer token before PIN write (refresh once if memory token was dropped).
      if (!sessionManager.getAccessToken()) {
        const refreshed = await sessionManager.refreshAccessToken();
        if (!refreshed) {
          const msg = 'Please log in again to set your PIN.';
          setSecurityError(msg);
          return { ok: false, error: msg };
        }
      }
      const result = await securityCommands.setPin({ pin });
      if (!result.ok) {
        const msg = securityErrorMessage(toAppError(result.error));
        setSecurityError(msg);
        return { ok: false, error: msg };
      }
      // First-time PIN on this install counts as device confirmation for this session,
      // so RequireNewDevicePin does not bounce StartQuestions back to ConfirmPin.
      if (userId) markDeviceVerifiedForSession(userId);
      // Fire-and-forget — awaiting device register used to hold the PIN screen until timeout.
      void buildRegistration()
        .then((registration) => securityCommands.registerDevice(registration))
        .catch(() => undefined);
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
    return (p2pRatesData ?? []).map((r) => {
      const rate = Number.parseFloat(r.rate) || 0;
      const amt = Number.parseFloat(r.amount) || 0;
      const cadBase = r.baseCurrencyCode === 'CAD';
      const ngnBase = r.baseCurrencyCode === 'NGN';
      return {
        id: r.id,
        rate: Math.round(rate),
        amt: Math.round(amt),
        left: leftSeconds(r.expiresAt) || 3600,
        expiresAt: r.expiresAt,
        ca: cadBase || (r.side === 'SELL' && r.quoteCurrencyCode === 'NGN'),
        priceLabel: `CA$1 = ₦${formatRate(r.rate, 0)}`,
        amountLabel: cadBase
          ? `Selling CA$${formatMoney(r.amount, { precision: 0, showCurrency: false })}`
          : ngnBase
            ? `Selling ₦${formatMoney(r.amount, { precision: 0, showCurrency: false })}`
            : `Selling ${formatMoney(r.amount, { currencyCode: r.baseCurrencyCode, precision: 0 })}`,
      };
    });
  }, [p2pRatesData]);

  /**
   * InstantEX board for guests. Platform buy/sell: user buy NGN = platform sell,
   * user sell NGN = platform buy (same as ViewRatesScreen).
   */
  const adminRate = useMemo(() => {
    const pair = (instantRatesData ?? []).find(
      (r) =>
        (r.baseCurrencyCode === 'CAD' && r.quoteCurrencyCode === 'NGN') ||
        (r.baseCurrencyCode === 'NGN' && r.quoteCurrencyCode === 'CAD'),
    );
    if (!pair) {
      return { ready: false as const, getNgn: '₦—', getCad: 'CA$—' };
    }
    const buy = Number.parseFloat(pair.buyRate) || 0;
    const sell = Number.parseFloat(pair.sellRate) || 0;
    if (pair.baseCurrencyCode === 'CAD') {
      const userBuyNgnPerCad = sell || buy;
      const userSellNgnPerCad = buy || sell;
      const cadPerThousandNgn = 1000 / (userSellNgnPerCad || 1);
      return {
        ready: true as const,
        getNgn: `₦${formatRate(String(userBuyNgnPerCad), 0)}`,
        getCad: `CA$${cadPerThousandNgn.toFixed(2)}`,
      };
    }
    const ngnPerCad = 1 / (sell || buy || 1);
    const cadPerThousandNgn = 1000 * (buy || sell || 0);
    return {
      ready: true as const,
      getNgn: `₦${ngnPerCad.toFixed(0)}`,
      getCad: `CA$${cadPerThousandNgn.toFixed(2)}`,
    };
  }, [instantRatesData]);

  const refetchRates = useCallback(() => {
    void loadPublicRates();
  }, [loadPublicRates]);

  return {
    onSetPin,
    onSetQuestions,
    onSaveProfile,
    securityError,
    securityBusy,
    clearSecurityError: () => setSecurityError(null),
    liveOffers,
    ratesEmpty: !ratesLoading && liveOffers.length === 0,
    ratesLoading,
    ratesError,
    refetchRates,
    adminRate,
  };
}

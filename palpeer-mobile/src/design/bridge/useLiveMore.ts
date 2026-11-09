import Constants from 'expo-constants';
import { useCallback, useMemo } from 'react';
import { router, type Href } from 'expo-router';

import { findWorldCountry } from '@/features/auth/signupCountries';
import { appConfig } from '@/config/env';
import { cardStatusLabel } from '@/features/cards/logic';
import {
  JOB_OPTIONS,
  MONTHLY_TX_OPTIONS,
  SOURCE_OF_INCOME_OPTIONS,
  STATES_BY_COUNTRY,
  optionTitle,
} from '@/features/profile/profileOptions';
import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { openExternal, supportMailto, telUrl } from '@/features/support/appInfo';
import { FAQ_SECTIONS, type FaqSection } from '@/features/support/faq';
import { useAppearance } from '@/hooks/useAppearance';
import { useLanguage } from '@/hooks/useLanguage';
import { formatPoints } from '@/features/loyalty/logic';
import { useToast } from '@/providers/ToastProvider';
import { useGetFeatureFlagsQuery } from '@/services/api/authApi';
import {
  useGetCardsQuery,
  useIssueCardMutation,
} from '@/services/api/cardApi';
import { badgeLabel } from '@/features/notifications/logic';
import { toAppError } from '@/services/api/errors';
import { useGetKycStatusQuery } from '@/services/api/kycApi';
import { useGetUnreadCountQuery } from '@/services/api/notificationApi';
import {
  useGetActivePromotionsQuery,
  useGetMyBonusSummaryQuery,
  useGetMyLoyaltyPointsBalanceQuery,
  useGetMyReferralCodeQuery,
  useGetMyReferralsQuery,
} from '@/services/api/promotionApi';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import { sessionManager } from '@/services/auth/session';
import { useAppSelector } from '@/store';
import type { AppLanguage } from '@/store/slices/preferencesSlice';
import type { ProfileResponse } from '@/types/api/profile';
import { formatMoney } from '@/utils/money';

export type MoreSheetRow = {
  title: string;
  note: string;
  action?: string;
};

const DEFAULT_SUPPORT_EMAIL = 'support@palpeer.com';
const EMPTY = 'Not filled in yet';

function identityNote(status: string | undefined): string {
  switch (status) {
    case 'APPROVED':
      return 'Checked and approved';
    case 'REJECTED':
      return 'Not approved — try again';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'IN_PROGRESS':
      return 'Checking now';
    default:
      return 'Not checked yet';
  }
}

/** Profile DOB is YYYY-MM-DD; show day/month/year like the design forms. */
function formatDob(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatAddress(profile: ProfileResponse): string {
  const iso = profile.countryOfResidence?.trim().toUpperCase() ?? '';
  const country =
    findWorldCountry(iso)?.name ??
    (iso || '');
  const stateOptions = STATES_BY_COUNTRY[iso] ?? [];
  const state =
    optionTitle(stateOptions, profile.stateTerritory) ||
    profile.stateTerritory?.trim() ||
    '';
  const cityState = [profile.city?.trim(), state].filter(Boolean).join(', ');
  return [
    profile.addressLine1?.trim(),
    profile.addressLine2?.trim(),
    cityState,
    profile.postalCode?.trim(),
    country,
  ]
    .filter(Boolean)
    .join(' · ');
}

function buildMeRows(input: {
  profile: ProfileResponse | null;
  loading: boolean;
  sessionEmail: string | null;
  kycStatus: string | undefined;
}): MoreSheetRow[] {
  const { profile, loading, sessionEmail, kycStatus } = input;
  if (loading && !profile) {
    return [{ title: 'My details', note: 'Loading…' }];
  }

  const first = profile?.firstName?.trim() ?? '';
  const last = profile?.lastName?.trim() ?? '';
  const fullName = `${first} ${last}`.trim();
  const incomplete = profile ? !profile.complete : true;
  const address = profile ? formatAddress(profile) : '';
  const job =
    optionTitle(JOB_OPTIONS, profile?.sourceOfIncome) ||
    optionTitle(SOURCE_OF_INCOME_OPTIONS, profile?.sourceOfIncome) ||
    profile?.sourceOfIncome?.trim() ||
    '';
  const monthly = optionTitle(MONTHLY_TX_OPTIONS, profile?.monthlyTransactionEstimate);
  const dob = formatDob(profile?.dateOfBirth);

  const rows: MoreSheetRow[] = [
    {
      title: 'My name',
      note: fullName || (incomplete ? `${EMPTY} — tap to add` : EMPTY),
      action: incomplete ? 'editProfile' : undefined,
    },
    {
      title: 'My email',
      note: sessionEmail?.trim() || EMPTY,
    },
    {
      title: 'Date of birth',
      note: dob || (incomplete ? EMPTY : '—'),
      action: incomplete && !dob ? 'editProfile' : undefined,
    },
    {
      title: 'Where I live',
      note: address || (incomplete ? EMPTY : '—'),
      action: incomplete && !address ? 'editProfile' : undefined,
    },
    {
      title: 'My job',
      note: job || (incomplete ? EMPTY : '—'),
      action: incomplete && !job ? 'editProfile' : undefined,
    },
  ];
  if (monthly) {
    rows.push({ title: 'Money you move each month', note: monthly });
  }
  rows.push({
    title: 'My identity',
    note: identityNote(kycStatus),
    action: kycStatus === 'APPROVED' ? undefined : 'openKyc',
  });
  if (incomplete) {
    rows.unshift({
      title: 'Complete your profile',
      note: 'Add your name, address and money details',
      action: 'editProfile',
    });
  }
  return rows;
}

const LANG_LABEL: Record<AppLanguage, string> = { en: 'English', fr: 'French' };
const LANG_FROM_LABEL: Record<string, AppLanguage> = { English: 'en', French: 'fr' };

/**
 * Live More screen: profile, KYC, unread, cards, referrals, bonuses, promotions,
 * language preference, and sign-out.
 */
export function useLiveMore() {
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const sessionEmail = useAppSelector((s) => s.session.email);
  const profile = useEnsureProfile();
  const { language, setLanguage } = useLanguage();
  const { scheme, setAppearance } = useAppearance();
  const toast = useToast();
  const kyc = useGetKycStatusQuery(undefined, { skip: !authenticated });
  const notifUnread = useGetUnreadCountQuery(undefined, { skip: !authenticated });
  const flags = useGetFeatureFlagsQuery();
  const cardsQ = useGetCardsQuery(undefined, { skip: !authenticated });
  const walletsQ = useGetWalletsQuery(undefined, { skip: !authenticated });
  const referralCodeQ = useGetMyReferralCodeQuery(undefined, { skip: !authenticated });
  const referralsQ = useGetMyReferralsQuery(undefined, { skip: !authenticated });
  const bonusSummaryQ = useGetMyBonusSummaryQuery(undefined, { skip: !authenticated });
  const pointsBalanceQ = useGetMyLoyaltyPointsBalanceQuery(undefined, { skip: !authenticated });
  const promotionsQ = useGetActivePromotionsQuery(undefined, { skip: !authenticated });
  const [issueCard] = useIssueCardMutation();

  const supportEmail = appConfig.support.email ?? DEFAULT_SUPPORT_EMAIL;
  const supportPhone = appConfig.support.phone ?? '';
  const faqSections: readonly FaqSection[] = FAQ_SECTIONS;

  const displayName = useMemo(() => {
    const first = profile.profile?.firstName?.trim() ?? '';
    const last = profile.profile?.lastName?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full || sessionEmail || 'My account';
  }, [profile.profile?.firstName, profile.profile?.lastName, sessionEmail]);

  const identityChecked = kyc.data?.status === 'APPROVED';
  const identityLabel = identityChecked ? 'Identity checked' : identityNote(kyc.data?.status);
  const emailNote = sessionEmail?.trim() || EMPTY;

  const unreadCount = notifUnread.data ?? 0;
  const msgBadge = badgeLabel(unreadCount) ?? '';

  const cardsEnabled = flags.data?.virtualCardsEnabled !== false;
  const cards = cardsQ.data ?? [];
  const activeCard = cards.find((c) => c.status === 'ACTIVE') ?? cards[0];

  const referralCode = referralCodeQ.data?.referralCode ?? '';
  const invitedCount = (referralsQ.data ?? []).filter((r) => r.status === 'COMPLETED').length;
  const invitedOpen = (referralsQ.data ?? []).filter((r) => r.status === 'OPEN').length;

  const pointsNote = useMemo(() => {
    const bal = pointsBalanceQ.data;
    if (!bal || bal.balancePoints <= 0) {
      return 'Earned when friends join. Use them to cut your P2P fee.';
    }
    const cad = formatMoney(bal.balanceCad, {
      currencyCode: bal.currencyCode || 'CAD',
      precision: 2,
    });
    return `${formatPoints(bal.balancePoints)} · worth ${cad}`;
  }, [pointsBalanceQ.data]);

  const bonusNote = useMemo(() => {
    const rows = bonusSummaryQ.data ?? [];
    if (!rows.length) return 'See what you have and what you used';
    return rows
      .map((r) => {
        const unused = formatMoney(r.unusedAmount, {
          currencyCode: r.currencyCode,
          precision: r.currencyCode === 'NGN' ? 0 : 2,
        });
        return `${unused} unused`;
      })
      .join(' · ');
  }, [bonusSummaryQ.data]);

  const activePromos = promotionsQ.data ?? [];
  const promoNote =
    activePromos.length === 0
      ? 'No offers right now'
      : activePromos.length === 1
        ? activePromos[0]!.title
        : `${activePromos.length} offers you can use`;

  const appVersion =
    Constants.expoConfig?.version ??
    (Constants as { nativeAppVersion?: string }).nativeAppVersion ??
    '—';

  const meRows = useMemo(
    () =>
      buildMeRows({
        profile: profile.profile,
        loading: profile.loading,
        sessionEmail,
        kycStatus: kyc.data?.status,
      }),
    [kyc.data?.status, profile.loading, profile.profile, sessionEmail],
  );

  const sheetRows = useMemo((): Record<string, MoreSheetRow[]> => {
    const cardRows: MoreSheetRow[] = [];
    if (!cardsEnabled) {
      cardRows.push({ title: 'Cards', note: 'Cards are not available right now' });
    } else if (!cards.length) {
      cardRows.push({
        title: 'Get a card',
        note: 'A card for paying online',
        action: 'issueCard',
      });
    } else {
      for (const card of cards) {
        const label = `${card.brand} ···· ${card.lastFour}`;
        cardRows.push({
          title: label,
          note: `${cardStatusLabel(card.status)} · ${card.currencyCode}`,
          action: `openCard:${card.id}`,
        });
      }
      if (activeCard && (activeCard.status === 'ACTIVE' || activeCard.status === 'BLOCKED')) {
        cardRows.push({
          title: activeCard.status === 'BLOCKED' ? 'Unfreeze a card' : 'Freeze a card',
          note:
            activeCard.status === 'BLOCKED'
              ? 'Turn spending back on'
              : 'Stop a card for now',
          action: `openCard:${activeCard.id}`,
        });
      }
      cardRows.push({
        title: 'Card history',
        note: 'See what I paid',
        action: activeCard ? `openCard:${activeCard.id}` : undefined,
      });
      if (cards.every((c) => c.status === 'CLOSED' || c.status === 'BLOCKED')) {
        cardRows.push({
          title: 'Get another card',
          note: 'A card for paying online',
          action: 'issueCard',
        });
      }
    }

    return {
      me: meRows,
      help: [
        {
          title: 'Chat with us',
          note: 'Our helper answers. A person joins if needed.',
          action: 'liveChat',
        },
        {
          title: 'Common questions',
          note: 'Quick answers',
          action: 'commonQuestions',
        },
        {
          title: 'Contact us',
          note: 'How to reach us',
          action: 'contactUs',
        },
      ],
      cards: cardRows,
      invite: [
        {
          title: 'My invite code',
          note: referralCode || 'Tap to create your code',
          action: 'shareInvite',
        },
        {
          title: 'People I invited',
          note:
            invitedCount > 0
              ? `${invitedCount} joined` + (invitedOpen ? ` · ${invitedOpen} waiting` : '')
              : invitedOpen > 0
                ? `${invitedOpen} waiting to join`
                : 'Nobody has joined yet',
          action: 'viewReferrals',
        },
      ],
      rewards: [
        {
          title: 'My points',
          note: pointsNote,
          action: 'viewPoints',
        },
        {
          title: 'My bonuses',
          note: bonusNote,
          action: 'viewBonuses',
        },
        {
          title: 'Promotions',
          note: promoNote,
          action: 'viewPromotions',
        },
      ],
      settings: [
        {
          title: 'Notifications',
          note: 'Push alerts on this phone and your other devices',
          action: 'notificationSettings',
        },
        {
          title: 'Face or Fingerprint',
          note: 'Open the app with your face or finger',
          action: 'biometricSettings',
        },
        { title: 'Privacy', note: 'Your data, permissions and policies' },
        {
          title: 'App look',
          note: scheme === 'dark' ? 'Dark screen' : 'Light screen',
          action: 'look',
        },
        { title: 'App version', note: appVersion },
      ],
      safe: [
        { title: 'My PIN', note: 'Change your 4 numbers', action: 'pinReset' },
        { title: 'My password', note: 'Change your password' },
        {
          title: 'Security questions',
          note: 'Change your 2 questions',
          action: 'securityQuestions',
        },
        {
          title: 'Face or Fingerprint',
          note: 'Open the app with your face or finger',
          action: 'biometricSettings',
        },
        { title: 'Signed-in phones', note: 'See where you are signed in' },
      ],
    };
  }, [
    activeCard,
    appVersion,
    bonusNote,
    cards,
    cardsEnabled,
    invitedCount,
    invitedOpen,
    meRows,
    pointsNote,
    promoNote,
    referralCode,
    scheme,
  ]);

  const onSignOut = useCallback(async () => {
    await sessionManager.signOut();
    router.replace('/');
  }, []);

  const openPinReset = useCallback(() => {
    router.push('/PinReset');
  }, []);

  const openSupportChannel = useCallback(
    async (url: string, fallback: string) => {
      if (!(await openExternal(url))) {
        toast.show({ type: 'error', title: fallback });
      }
    },
    [toast],
  );

  const runSheetAction = useCallback(
    async (action?: string) => {
      if (!action) return;
      if (action === 'pinReset') {
        router.push('/PinReset');
        return;
      }
      if (action === 'securityQuestions') {
        router.push('/StartQuestions');
        return;
      }
      if (action === 'look') return; // handled in screen state
      if (action === 'contactUs') return; // handled in More.js sheet state
      if (action === 'commonQuestions') {
        router.push('/support/common-questions' as Href);
        return;
      }
      if (action === 'liveChat') {
        router.push('/support/live-chat' as Href);
        return;
      }
      if (action === 'supportEmail') {
        await openSupportChannel(
          supportMailto(supportEmail, 'PALPEER support request'),
          `No email app found. Write to ${supportEmail}.`,
        );
        return;
      }
      if (action === 'supportPhone') {
        if (!supportPhone) return;
        await openSupportChannel(
          telUrl(supportPhone),
          `Calling isn't available. Call ${supportPhone}.`,
        );
        return;
      }
      if (action === 'shareInvite') {
        router.push('/InviteFriends' as Href);
        return;
      }
      if (action === 'viewReferrals') {
        router.push('/InviteFriends?tab=people' as Href);
        return;
      }
      if (action === 'viewPoints') {
        router.push('/MyPoints' as Href);
        return;
      }
      if (action === 'viewBonuses') {
        router.push('/MyBonuses' as Href);
        return;
      }
      if (action === 'viewPromotions') {
        router.push('/MyPromotions' as Href);
        return;
      }
      if (action === 'alerts' || action === 'notificationSettings') {
        router.push('/NotificationSettings' as Href);
        return;
      }
      if (action === 'biometricSettings') {
        router.push('/security/biometrics' as Href);
        return;
      }
      if (action === 'editProfile') {
        router.push('/StartDetails' as Href);
        return;
      }
      if (action === 'openKyc') {
        router.push('/StartIdChoose' as Href);
        return;
      }
      if (action === 'issueCard') {
        const cad = walletsQ.data?.find((w) => w.currencyCode === 'CAD');
        const wallet = cad ?? walletsQ.data?.[0];
        if (!wallet) return;
        try {
          await issueCard({
            currencyCode: wallet.currencyCode,
            walletId: wallet.id,
            cardholderName: displayName !== 'My account' ? displayName : undefined,
          }).unwrap();
        } catch (raw) {
          console.warn('issue card failed', toAppError(raw).message);
        }
        return;
      }
      if (action.startsWith('openCard:') || action.startsWith('history:')) {
        const id = action.includes(':') ? action.slice(action.indexOf(':') + 1) : '';
        if (id) router.push(`/Card?id=${encodeURIComponent(id)}` as Href);
      }
    },
    [
      displayName,
      issueCard,
      openSupportChannel,
      supportEmail,
      supportPhone,
      walletsQ.data,
    ],
  );

  const setAppLanguage = useCallback(
    (label: string) => {
      const next = LANG_FROM_LABEL[label];
      if (next) setLanguage(next);
    },
    [setLanguage],
  );

  const setAppLook = useCallback(
    (look: 'light' | 'dark') => {
      setAppearance(look);
    },
    [setAppearance],
  );

  return {
    backend: true as const,
    displayName,
    identityChecked,
    identityLabel,
    identityNote: identityNote(kyc.data?.status),
    emailNote,
    unreadCount,
    msgBadge,
    sheetRows,
    faqSections,
    supportEmail,
    supportPhone,
    languageLabel: LANG_LABEL[language] ?? 'English',
    setAppLanguage,
    appLook: scheme,
    setAppLook,
    onSignOut,
    openPinReset,
    openChangePin: openPinReset,
    runSheetAction,
  };
}

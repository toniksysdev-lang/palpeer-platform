import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';

export type PalpeerRateOfferSummary = {
  id: string;
  /** Seller's posted rate, e.g. NGN per CAD. */
  sellerRate: number;
  /** Admin Palpeer rate for the same pair. */
  palpeerRate: number;
  /** Unsold amount in source currency. */
  amountLeft: number;
  sourceCurrency: string;
  targetCurrency: string;
  /** Offer end time (ISO). Popup shows once when ≤ 30 minutes remain. */
  expiresAt: string;
};

type Props = {
  offer: PalpeerRateOfferSummary | null;
  /** Offer ids the user already dismissed or accepted this session. */
  seenOfferIds: ReadonlySet<string>;
  onSeen: (offerId: string) => void;
  /** Return false to keep the offer eligible (PIN cancel / settle failure). */
  onAccept: (offer: PalpeerRateOfferSummary) => boolean | void | Promise<boolean | void>;
};

const THIRTY_MIN_MS = 30 * 60 * 1000;

/** Shows once per offer at ≤ 30 minutes before expiry (design change map). */
export function PalpeerRatePopup({ offer, seenOfferIds, onSeen, onAccept }: Props) {
  const theme = useTheme();
  const t = useT();
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    if (!offer) return false;
    if (seenOfferIds.has(offer.id)) return false;
    const ends = Date.parse(offer.expiresAt);
    if (!Number.isFinite(ends)) return false;
    const left = ends - Date.now();
    return left > 0 && left <= THIRTY_MIN_MS;
  }, [offer, seenOfferIds]);

  if (!offer || !visible) return null;

  const receive = offer.palpeerRate > 0 ? offer.amountLeft / offer.palpeerRate : 0;

  const wait = () => {
    onSeen(offer.id);
  };

  const accept = async () => {
    setBusy(true);
    try {
      const ok = await onAccept(offer);
      if (ok !== false) onSeen(offer.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal
      visible
      onClose={wait}
      title={t('palpeerRate.title')}
      dismissible={!busy}
      testID="palpeer-rate-popup"
    >
      <View style={{ gap: theme.spacing.md }}>
        <AppText>{t('palpeerRate.body')}</AppText>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="caption" tone="muted">
            {t('palpeerRate.yourRate')}
          </AppText>
          <AppText variant="bodyStrong">
            {offer.targetCurrency}1 = {offer.sourceCurrency}
            {offer.sellerRate.toLocaleString()}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t('palpeerRate.adminRate')}
          </AppText>
          <AppText variant="bodyStrong">
            {offer.targetCurrency}1 = {offer.sourceCurrency}
            {offer.palpeerRate.toLocaleString()}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t('palpeerRate.giveGet')}
          </AppText>
          <AppText variant="bodyStrong">
            {offer.sourceCurrency}
            {offer.amountLeft.toLocaleString()} → {offer.targetCurrency}
            {receive.toFixed(2)}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t('palpeerRate.noFee')}
          </AppText>
        </View>
        <Button
          label={t('palpeerRate.accept')}
          onPress={() => void accept()}
          loading={busy}
          testID="palpeer-rate-accept"
        />
        <Button
          label={t('palpeerRate.wait')}
          variant="outline"
          onPress={wait}
          disabled={busy}
          testID="palpeer-rate-wait"
        />
      </View>
    </AppModal>
  );
}

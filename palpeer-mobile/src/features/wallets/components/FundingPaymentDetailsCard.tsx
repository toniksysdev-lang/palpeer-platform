import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import type { FundingPaymentDetails } from '@/types/api/wallet';

import { useMoneyFormat } from '../useMoneyFormat';

function CopyRow({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  const theme = useTheme();
  const toast = useToast();

  const copy = async () => {
    await Clipboard.setStringAsync(value);
    toast.show({ type: 'success', title: `${label} copied` });
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <AppText tone="secondary" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText
        variant="bodyStrong"
        align="right"
        selectable
        style={{ flex: 2 }}
        testID={testID}
      >
        {value}
      </AppText>
      <Pressable
        onPress={() => void copy()}
        accessibilityRole="button"
        accessibilityLabel={`Copy ${label}`}
        hitSlop={8}
        testID={testID ? `${testID}-copy` : undefined}
      >
        <Icon icon={Copy} color={theme.colors.primary} size="sm" />
      </Pressable>
    </View>
  );
}

/** Payment step while funding is PENDING/PROCESSING (Kuda VA or Apaylo Instant Interac). */
export function FundingPaymentDetailsCard({ details }: { details: FundingPaymentDetails }) {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const isInterac = details.method === 'INTERAC_INSTANT' || details.currencyCode === 'CAD';

  return (
    <Card variant="outlined" padding="md" testID="funding-payment-details">
      <AppText variant="overline" tone="muted">
        {isInterac ? 'Send Instant Interac' : 'Transfer to this account'}
      </AppText>
      <AppText variant="caption" tone="secondary" style={{ marginTop: theme.spacing.xxs }}>
        {isInterac
          ? `From your banking app, send exactly ${format(details.amount, details.currencyCode)} via Interac e-Transfer. Search for the payee name below — we do not email you a request. Your wallet updates after Apaylo confirms.`
          : `Send exactly ${format(details.amount, details.currencyCode)} from your bank. Your wallet updates after Kuda confirms the credit.`}
      </AppText>
      <View style={{ marginTop: theme.spacing.sm }}>
        {isInterac ? (
          <>
            {details.accountName ? (
              <CopyRow
                label="Payee name"
                value={details.accountName}
                testID="funding-interac-payee"
              />
            ) : null}
            {details.collectionEmail ? (
              <CopyRow
                label="Send to email"
                value={details.collectionEmail}
                testID="funding-interac-collection-email"
              />
            ) : null}
            <CopyRow
              label="Amount"
              value={format(details.amount, details.currencyCode)}
              testID="funding-interac-amount"
            />
            {details.trackingReference ? (
              <CopyRow
                label="Reference"
                value={details.trackingReference}
                testID="funding-interac-ref"
              />
            ) : null}
            {details.aplReference ? (
              <CopyRow
                label="Memo / APL"
                value={details.aplReference}
                testID="funding-interac-apl"
              />
            ) : null}
            {details.interacEmail ? (
              <CopyRow
                label="Your Interac email"
                value={details.interacEmail}
                testID="funding-interac-email"
              />
            ) : null}
          </>
        ) : (
          <>
            {details.bankName ? (
              <CopyRow label="Bank" value={details.bankName} testID="funding-va-bank" />
            ) : null}
            {details.accountName ? (
              <CopyRow label="Account name" value={details.accountName} testID="funding-va-name" />
            ) : null}
            {details.accountNumber ? (
              <CopyRow
                label="Account number"
                value={details.accountNumber}
                testID="funding-va-number"
              />
            ) : null}
            <CopyRow
              label="Amount"
              value={format(details.amount, details.currencyCode)}
              testID="funding-va-amount"
            />
            {details.trackingReference ? (
              <CopyRow
                label="Reference"
                value={details.trackingReference}
                testID="funding-va-tracking"
              />
            ) : null}
          </>
        )}
      </View>
    </Card>
  );
}

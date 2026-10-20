import { router, useLocalSearchParams } from 'expo-router';
import { Building2, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useCreateFundingMutation, useGetWalletQuery } from '@/services/api/walletApi';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { ReviewRow } from '../components/ReviewRow';
import { isIdempotencyConflict, walletErrorMessage } from '../errors';
import { hasPaymentRail, railFor } from '../rails';
import { useIdempotencyKey } from '../useIdempotencyKey';
import { useMoneyFormat } from '../useMoneyFormat';

/** CAD Apaylo funds only via Instant Interac deposit (no other CAD methods). */
const CAD_FUNDING_METHOD = {
  label: 'Interac, Instant deposit via Interac',
  title: 'Interac',
  subtitle: 'Instant deposit via Interac',
  hint: 'We’ll send an Interac request to your account email. Accept it in your banking app to fund your CAD wallet instantly.',
} as const;

const METHOD_COPY = {
  APAYLO: CAD_FUNDING_METHOD.label,
  KUDA: 'Bank transfer to your PALPEER virtual account. The account details are shown next.',
  KORAPAY: 'Bank transfer to a one-time Korapay account. Account details are shown after you confirm.',
} as const;

/** Amount → review → `POST /funding`. The method follows the wallet currency (R-W-3). */
export function FundWalletScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const wallet = useGetWalletQuery(id);
  const { format, precision } = useMoneyFormat();
  const [createFunding, createState] = useCreateFundingMutation();
  const idempotency = useIdempotencyKey();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'amount' | 'review'>('amount');
  const [error, setError] = useState<string | null>(null);

  if (wallet.error && !wallet.data) {
    return (
      <Screen>
        <StackHeader title="Fund wallet" />
        <ErrorState error={toAppError(wallet.error)} onRetry={() => void wallet.refetch()} />
      </Screen>
    );
  }
  if (!wallet.data) {
    return (
      <Screen>
        <StackHeader title="Fund wallet" />
        <Skeleton height={72} />
      </Screen>
    );
  }

  const walletId = wallet.data.id;
  const code = wallet.data.currencyCode;
  const rail = railFor(code);
  if (!hasPaymentRail(code) || !rail) {
    return (
      <Screen>
        <StackHeader title={`Fund ${code}`} />
        <FormAlert
          tone="info"
          message={`Funding isn't available for ${code} yet.`}
          testID="fund-no-rail"
        />
      </Screen>
    );
  }

  const decimals = precision(code) ?? 2;
  const normalizedAmount =
    amount && !amount.endsWith('.')
      ? (() => {
          const [i = '0', f = ''] = amount.split('.');
          return decimals > 0 ? `${i}.${f.padEnd(decimals, '0').slice(0, decimals)}` : i;
        })()
      : amount;
  const valid = isPositiveMoney(normalizedAmount || '0');
  const isCadApaylo = rail === 'APAYLO';

  const submit = async () => {
    setError(null);
    const result = await createFunding({
      walletId,
      amount: toMoney(normalizedAmount),
      idempotencyKey: idempotency.current(),
    });
    if ('error' in result) {
      const appError = toAppError(result.error);
      if (isIdempotencyConflict(appError)) idempotency.reset();
      setError(walletErrorMessage(appError));
      return;
    }
    toast.show({ type: 'info', title: 'Funding request sent' });
    router.replace({
      pathname: '/wallet/funding/[fundingId]',
      params: { fundingId: result.data.id },
    });
  };

  if (step === 'review') {
    return (
      <Screen
        scroll
        footer={
          <Button
            label="Confirm funding"
            onPress={() => void submit()}
            loading={createState.isLoading}
            loadingLabel="Starting…"
            testID="fund-confirm"
          />
        }
      >
        <StackHeader
          title="Review"
          onBack={() => {
            idempotency.reset();
            setError(null);
            setStep('amount');
          }}
        />
        <FormAlert message={error} testID="fund-error" />
        <Card variant="outlined" padding="md">
          <ReviewRow label="Wallet" value={`${code} wallet`} />
          <ReviewRow
            label="Amount"
            value={format(toMoney(normalizedAmount), code)}
            testID="fund-review-amount"
          />
          <ReviewRow
            label="Method"
            value={METHOD_COPY[rail]}
            testID="fund-review-method"
          />
        </Card>
        {isCadApaylo ? (
          <AppText variant="caption" tone="secondary">
            {CAD_FUNDING_METHOD.hint}
          </AppText>
        ) : (
          <AppText variant="caption" tone="secondary">
            Any fees are shown by your bank or the payment provider. Your balance only changes once
            the payment is confirmed.
          </AppText>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label="Continue"
          onPress={() => {
            if (normalizedAmount && normalizedAmount !== amount) setAmount(normalizedAmount);
            setStep('review');
          }}
          disabled={!valid}
          testID="fund-continue"
        />
      }
    >
      <StackHeader title={`Fund ${code}`} />
      <AmountInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        precision={decimals}
        currencyCode={code}
        placeholder={`0.${''.padEnd(decimals, '0')}`}
        autoFocus
        testID="fund-amount"
      />

      {isCadApaylo ? (
        <View style={{ gap: theme.spacing.sm }} testID="fund-method-apaylo">
          <AppText variant="overline" tone="muted">
            Funding method
          </AppText>
          <Card
            variant="outlined"
            padding="md"
            accessibilityLabel={CAD_FUNDING_METHOD.label}
            style={{
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Icon icon={Zap} color={theme.colors.primary} />
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <AppText variant="bodyStrong">{CAD_FUNDING_METHOD.title}</AppText>
                <AppText variant="caption" tone="secondary">
                  {CAD_FUNDING_METHOD.subtitle}
                </AppText>
              </View>
            </View>
          </Card>
          <AppText variant="caption" tone="secondary">
            {CAD_FUNDING_METHOD.hint}
          </AppText>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
          <Icon icon={Building2} color={theme.colors.textMuted} size="sm" />
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
            {METHOD_COPY[rail]}
          </AppText>
        </View>
      )}
    </Screen>
  );
}

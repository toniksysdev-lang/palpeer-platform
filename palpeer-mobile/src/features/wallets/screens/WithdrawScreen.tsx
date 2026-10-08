import { router, useLocalSearchParams } from 'expo-router';
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
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import { useCreateWithdrawalMutation, useGetWalletQuery } from '@/services/api/walletApi';
import { compareMoney, isPositiveMoney, toMoney } from '@/utils/money';

import { ReviewRow } from '../components/ReviewRow';
import {
  cadReference,
  describeDestination,
  ngnReference,
  validateCad,
  validateNgn,
  type CadMethod,
  type DestinationErrors,
} from '../destination';
import { isIdempotencyConflict, walletErrorMessage } from '../errors';
import { railFor } from '../rails';
import { useIdempotencyKey } from '../useIdempotencyKey';
import { useMoneyFormat } from '../useMoneyFormat';

const CAD_METHODS = [
  { value: 'email', label: 'Interac e-mail' },
  { value: 'phone', label: 'Interac phone' },
  { value: 'eft', label: 'Bank (EFT)' },
] as const satisfies readonly { value: CadMethod; label: string }[];

const digitsOnly = (text: string) => text.replace(/\D/g, '');

/**
 * Amount + destination → review → PIN (if set) → `POST /withdrawals`. The PIN step is a client
 * safeguard only; the backend doesn't require a PIN (R-SEC-2, contract-pending S-1).
 */
export function WithdrawScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallet = useGetWalletQuery(id);
  const pinStatus = useGetPinStatusQuery();
  const { requestPin } = usePinPrompt();
  const { format, precision } = useMoneyFormat();
  const [createWithdrawal, createState] = useCreateWithdrawalMutation();
  const idempotency = useIdempotencyKey();

  const [step, setStep] = useState<'form' | 'review'>('form');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [cadMethod, setCadMethod] = useState<CadMethod>('email');
  const [fields, setFields] = useState({
    email: '',
    phone: '',
    institution: '',
    transit: '',
    account: '',
    bankCode: '',
    accountNumber: '',
  });
  const [fieldErrors, setFieldErrors] = useState<DestinationErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const title = 'Withdraw';

  if (wallet.error && !wallet.data) {
    return (
      <Screen>
        <StackHeader title={title} />
        <ErrorState error={toAppError(wallet.error)} onRetry={() => void wallet.refetch()} />
      </Screen>
    );
  }
  if (!wallet.data) {
    return (
      <Screen>
        <StackHeader title={title} />
        <Skeleton height={72} />
      </Screen>
    );
  }

  const data = wallet.data;
  const code = data.currencyCode;
  const rail = railFor(code);
  if (!rail) {
    return (
      <Screen>
        <StackHeader title={`Withdraw ${code}`} />
        <FormAlert
          tone="info"
          message={`Withdrawals aren't available for ${code} yet.`}
          testID="withdraw-no-rail"
        />
      </Screen>
    );
  }

  const setField = (name: keyof typeof fields, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
  };

  const cadDestination = () => {
    switch (cadMethod) {
      case 'email':
        return { method: 'email' as const, email: fields.email };
      case 'phone':
        return { method: 'phone' as const, phone: fields.phone };
      case 'eft':
        return {
          method: 'eft' as const,
          institution: fields.institution,
          transit: fields.transit,
          account: fields.account,
        };
    }
  };
  const ngnDestination = () => ({ bankCode: fields.bankCode, accountNumber: fields.accountNumber });
  const reference =
    rail === 'APAYLO' ? cadReference(cadDestination()) : ngnReference(ngnDestination());

  const toReview = () => {
    setError(null);
    let nextAmountError: string | null = null;
    if (!isPositiveMoney(amount)) {
      nextAmountError = 'Enter an amount greater than zero.';
    } else if (compareMoney(amount, data.availableBalance) > 0) {
      // Mirrors 422 INSUFFICIENT_AVAILABLE_BALANCE; the backend still decides.
      nextAmountError = `You can withdraw up to ${format(data.availableBalance, code)}.`;
    }
    const nextFieldErrors =
      rail === 'APAYLO' ? validateCad(cadDestination()) : validateNgn(ngnDestination());
    setAmountError(nextAmountError);
    setFieldErrors(nextFieldErrors);
    if (nextAmountError || Object.keys(nextFieldErrors).length > 0) return;
    setStep('review');
  };

  const submit = async () => {
    setError(null);
    if (!pinStatus.data) {
      setError("We couldn't check your PIN status. Try again.");
      void pinStatus.refetch();
      return;
    }
    if (!pinStatus.data.pinSet) {
      setError('Set up a transaction PIN before withdrawing.');
      return;
    }
    setConfirming(true);
    const confirmed = await requestPin({
      title: 'Confirm withdrawal',
      message: `Enter your PIN to withdraw ${format(toMoney(amount), code)}.`,
    });
    if (!confirmed) {
      setConfirming(false);
      return;
    }
    const result = await createWithdrawal({
      walletId: data.id,
      amount: toMoney(amount),
      destinationReference: reference,
      idempotencyKey: idempotency.current(),
    });
    setConfirming(false);
    if ('error' in result) {
      const appError = toAppError(result.error);
      if (isIdempotencyConflict(appError)) idempotency.reset();
      setError(walletErrorMessage(appError));
      return;
    }
    toast.show({ type: 'info', title: 'Withdrawal submitted' });
    router.replace({
      pathname: '/wallet/withdrawal/[withdrawalId]',
      params: { withdrawalId: result.data.id },
    });
  };

  if (step === 'review') {
    return (
      <Screen
        scroll
        footer={
          <Button
            label="Confirm withdrawal"
            onPress={() => void submit()}
            loading={confirming || createState.isLoading}
            loadingLabel="Submitting…"
            testID="withdraw-confirm"
          />
        }
      >
        <StackHeader
          title="Review"
          onBack={() => {
            idempotency.reset();
            setError(null);
            setStep('form');
          }}
        />
        <FormAlert message={error} testID="withdraw-error" />
        <Card variant="outlined" padding="md">
          <ReviewRow label="From" value={`${code} wallet`} />
          <ReviewRow
            label="Amount"
            value={format(toMoney(amount), code)}
            testID="withdraw-review-amount"
          />
          <ReviewRow
            label="To"
            value={describeDestination(code, reference) ?? reference}
            testID="withdraw-review-destination"
          />
        </Card>
        <AppText variant="caption" tone="secondary">
          The amount moves from available to pending straight away and stays there until the
          withdrawal completes. If it fails, it goes back to your available balance.
        </AppText>
        {pinStatus.data && !pinStatus.data.pinSet ? (
          <View style={{ gap: theme.spacing.xs }}>
            <FormAlert
              tone="info"
              message="A transaction PIN is required to withdraw."
              testID="withdraw-no-pin"
            />
            <TextLink label="Set up a PIN" onPress={() => router.push('/security/pin/set')} />
          </View>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      keyboardAware
      footer={<Button label="Continue" onPress={toReview} testID="withdraw-continue" />}
    >
      <StackHeader title={`Withdraw ${code}`} />
      <AppText tone="secondary" testID="withdraw-available">
        Available {format(data.availableBalance, code)}
      </AppText>
      <AmountInput
        label="Amount"
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setAmountError(null);
        }}
        precision={precision(code) ?? 2}
        currencyCode={code}
        error={amountError}
        testID="withdraw-amount"
      />

      {rail === 'APAYLO' ? (
        <View style={{ gap: theme.spacing.md }}>
          <SegmentedControl
            options={CAD_METHODS}
            value={cadMethod}
            onChange={(value) => {
              setCadMethod(value);
              setFieldErrors({});
            }}
            accessibilityLabel="Withdrawal method"
          />
          {cadMethod === 'email' ? (
            <Input
              label="Interac e-mail"
              value={fields.email}
              onChangeText={(text) => setField('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={fieldErrors.email}
              testID="withdraw-email"
            />
          ) : cadMethod === 'phone' ? (
            <Input
              label="Interac phone number"
              value={fields.phone}
              onChangeText={(text) => setField('phone', text)}
              numberPad="phone"
              numberPadMaxLength={20}
              error={fieldErrors.phone}
              testID="withdraw-phone"
            />
          ) : (
            <>
              <Input
                label="Institution number"
                value={fields.institution}
                onChangeText={(text) => setField('institution', digitsOnly(text).slice(0, 3))}
                numberPad="digits"
                numberPadMaxLength={3}
                error={fieldErrors.institution}
                testID="withdraw-institution"
              />
              <Input
                label="Transit number"
                value={fields.transit}
                onChangeText={(text) => setField('transit', digitsOnly(text).slice(0, 5))}
                numberPad="digits"
                numberPadMaxLength={5}
                error={fieldErrors.transit}
                testID="withdraw-transit"
              />
              <Input
                label="Account number"
                value={fields.account}
                onChangeText={(text) => setField('account', digitsOnly(text))}
                numberPad="digits"
                numberPadMaxLength={20}
                error={fieldErrors.account}
                testID="withdraw-account"
              />
            </>
          )}
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Input
            label="Bank code"
            value={fields.bankCode}
            onChangeText={(text) => setField('bankCode', digitsOnly(text))}
            numberPad="digits"
            numberPadMaxLength={12}
            error={fieldErrors.bankCode}
            testID="withdraw-bank-code"
          />
          <Input
            label="Account number"
            value={fields.accountNumber}
            onChangeText={(text) => setField('accountNumber', digitsOnly(text))}
            numberPad="digits"
            numberPadMaxLength={20}
            error={fieldErrors.accountNumber}
            hint="The account name is checked with the bank before the transfer."
            testID="withdraw-account-number"
          />
        </View>
      )}
    </Screen>
  );
}

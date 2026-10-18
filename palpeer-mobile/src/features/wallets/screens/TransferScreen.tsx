import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { ErrorState } from '@/components/feedback/StateViews';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import {
  useCreateWalletTransferMutation,
  useGetWalletQuery,
  useLazyLookupTransferRecipientQuery,
} from '@/services/api/walletApi';
import type { TransferRecipientResponse } from '@/types/api/wallet';
import { compareMoney, isPositiveMoney, toMoney } from '@/utils/money';

import { ReviewRow } from '../components/ReviewRow';
import { isIdempotencyConflict, walletErrorMessage } from '../errors';
import { useIdempotencyKey } from '../useIdempotencyKey';
import { useMoneyFormat } from '../useMoneyFormat';

/**
 * Send funds from this wallet to another user's matching-currency wallet.
 * Looks up the recipient before review so the sender confirms the full name.
 * Requires a transaction PIN.
 */
export function TransferScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallet = useGetWalletQuery(id);
  const pinStatus = useGetPinStatusQuery();
  const { requestPin } = usePinPrompt();
  const { format, precision } = useMoneyFormat();
  const [createTransfer, createState] = useCreateWalletTransferMutation();
  const [lookupRecipient, lookupState] = useLazyLookupTransferRecipientQuery();
  const idempotency = useIdempotencyKey();

  const [step, setStep] = useState<'form' | 'review'>('form');
  const [recipient, setRecipient] = useState('');
  const [resolved, setResolved] = useState<TransferRecipientResponse | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const title = 'Transfer';

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

  const toReview = async () => {
    const trimmed = recipient.trim();
    let nextRecipientError: string | null = null;
    let nextAmountError: string | null = null;
    if (!trimmed) nextRecipientError = 'Enter the recipient email or phone number';
    if (!isPositiveMoney(amount)) nextAmountError = 'Enter an amount greater than zero';
    else if (compareMoney(toMoney(amount), data.availableBalance) > 0) {
      nextAmountError = 'Amount is more than your available balance';
    }
    setRecipientError(nextRecipientError);
    setAmountError(nextAmountError);
    setError(null);
    if (nextRecipientError || nextAmountError) return;

    const result = await lookupRecipient({ q: trimmed, currencyCode: code });
    if (result.error || !result.data) {
      setRecipientError(walletErrorMessage(toAppError(result.error)));
      setResolved(null);
      return;
    }
    if (result.data.hasWallet === false) {
      setRecipientError(
        `${result.data.displayName} doesn't have a ${code} wallet yet. Ask them to create one first.`,
      );
      setResolved(null);
      return;
    }
    setResolved(result.data);
    setStep('review');
  };

  const submit = async () => {
    setError(null);
    if (!resolved) {
      setError('Confirm the recipient again before transferring.');
      setStep('form');
      return;
    }
    if (!pinStatus.data) {
      setError("We couldn't check your PIN status. Try again.");
      void pinStatus.refetch();
      return;
    }
    if (!pinStatus.data.pinSet) {
      setError('Set up a transaction PIN before transferring.');
      return;
    }
    setConfirming(true);
    const confirmed = await requestPin({
      title: 'Confirm transfer',
      message: `Enter your PIN to send ${format(toMoney(amount), code)} to ${resolved.displayName}.`,
    });
    if (!confirmed) {
      setConfirming(false);
      return;
    }
    const result = await createTransfer({
      sourceWalletId: data.id,
      recipient: resolved.recipient,
      amount: toMoney(amount),
      note: note.trim() || undefined,
      idempotencyKey: idempotency.current(),
    });
    setConfirming(false);
    if ('error' in result) {
      const appError = toAppError(result.error);
      if (isIdempotencyConflict(appError)) idempotency.reset();
      setError(walletErrorMessage(appError));
      return;
    }
    toast.show({ type: 'success', title: 'Transfer sent' });
    router.replace({ pathname: '/wallet/[id]', params: { id: data.id } });
  };

  if (step === 'review' && resolved) {
    return (
      <Screen
        scroll
        footer={
          <Button
            label="Confirm transfer"
            onPress={() => void submit()}
            loading={confirming || createState.isLoading}
            loadingLabel="Sending…"
            testID="transfer-confirm"
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
        <FormAlert message={error} testID="transfer-error" />
        <FormAlert
          tone="info"
          message="Confirm this is the person you intend to pay before continuing."
          testID="transfer-confirm-name"
        />
        <Card variant="outlined" padding="md">
          <ReviewRow label="From" value={`${code} Wallet`} />
          <ReviewRow
            label="Recipient"
            value={resolved.displayName}
            testID="transfer-review-name"
          />
          <ReviewRow
            label={resolved.matchedBy === 'PHONE' ? 'Phone' : 'Email'}
            value={resolved.recipient}
            testID="transfer-review-recipient"
          />
          <ReviewRow
            label="Amount"
            value={format(toMoney(amount), code)}
            testID="transfer-review-amount"
          />
          {note.trim() ? <ReviewRow label="Note" value={note.trim()} /> : null}
        </Card>
        {pinStatus.data && !pinStatus.data.pinSet ? (
          <View style={{ gap: theme.spacing.xs }}>
            <FormAlert
              tone="info"
              message="A transaction PIN is required to transfer."
              testID="transfer-no-pin"
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
      footer={
        <Button
          label="Continue"
          onPress={() => void toReview()}
          loading={lookupState.isFetching}
          loadingLabel="Checking…"
          testID="transfer-continue"
        />
      }
    >
      <StackHeader title={`Transfer ${code}`} />
      <AppText tone="secondary" testID="transfer-available">
        Available {format(data.availableBalance, code)}
      </AppText>
      <Input
        label="Recipient"
        appearance="elevated"
        value={recipient}
        onChangeText={(text) => {
          setRecipient(text);
          setRecipientError(null);
          setResolved(null);
        }}
        placeholder="Email or phone (+E.164)"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        error={recipientError}
        testID="transfer-recipient"
      />
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
        testID="transfer-amount"
      />
      <Input
        label="Note (optional)"
        appearance="elevated"
        value={note}
        onChangeText={setNote}
        placeholder="What's this for?"
        testID="transfer-note"
      />
      <FormAlert message={error} testID="transfer-form-error" />
    </Screen>
  );
}

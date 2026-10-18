import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useNow } from '@/hooks/useNow';
import { toAppError } from '@/services/api/errors';
import { useGetRequestQuery, useUpdateRequestMutation } from '@/services/api/p2pApi';
import type { P2PRequestResponse } from '@/types/api/p2p';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { requestActionErrorMessage } from '../errors';
import {
  canManage,
  changesFor,
  EXPIRY_OPTIONS,
  NOTES_MAX,
  RATE_INPUT_DECIMALS,
  sideLabel,
  type ExpiryChoice,
} from '../logic';

function EditForm({ request }: { request: P2PRequestResponse }) {
  const { precision } = useMoneyFormat();
  const [update, updateState] = useUpdateRequestMutation();
  const [amount, setAmount] = useState<string>(() => toMoney(request.amount));
  const [rate, setRate] = useState<string>(() => toMoney(request.rate));
  const [notes, setNotes] = useState(request.notes ?? '');
  const [expiry, setExpiry] = useState<ExpiryChoice>('KEEP');
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const base = request.baseCurrencyCode;
  const quote = request.quoteCurrencyCode;
  const amountError = isPositiveMoney(amount) ? null : 'Enter an amount above zero.';
  const rateError = isPositiveMoney(rate) ? null : 'Enter a rate above zero.';
  const form = { amount, rate, notes, expiry };
  const pending = Object.keys(changesFor(request, form, 0)).length > 0;

  // Without an expiry there is nothing to keep; the backend can't clear one once set.
  const keepTitle = request.expiresAt ? `Keep (${formatDateTime(request.expiresAt)})` : 'No expiry';
  const expiryOptions = [
    { key: 'KEEP', title: keepTitle },
    ...EXPIRY_OPTIONS.filter((option) => option.key !== 'NONE'),
  ];

  const save = async () => {
    if (amountError || rateError || !pending) return;
    setError(null);
    setFieldErrors({});
    const result = await update({ id: request.id, changes: changesFor(request, form, Date.now()) });
    if ('error' in result) {
      const appError = toAppError(result.error);
      setFieldErrors(appError.fieldErrors);
      setError(requestActionErrorMessage(appError));
      return;
    }
    router.back();
  };

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label="Save changes"
          onPress={() => void save()}
          disabled={!pending || !!amountError || !!rateError}
          loading={updateState.isLoading}
          loadingLabel="Saving…"
          testID="p2p-edit-submit"
        />
      }
    >
      <StackHeader title="Edit request" />
      <AppText variant="h2">
        {base}/{quote}
      </AppText>
      <AppText tone="secondary">{sideLabel(request.side, base, quote, 'self')}</AppText>
      <AmountInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        precision={precision(base) ?? 2}
        currencyCode={base}
        error={amountError ?? fieldErrors.amount}
        testID="p2p-edit-amount"
      />
      <AmountInput
        label={`Rate (${quote} for 1 ${base})`}
        value={rate}
        onChangeText={setRate}
        precision={RATE_INPUT_DECIMALS}
        currencyCode={quote}
        padOnBlur={false}
        error={rateError ?? fieldErrors.rate}
        testID="p2p-edit-rate"
      />
      <PickerField
        label="Expires"
        value={expiryOptions.find((option) => option.key === expiry)?.title ?? ''}
        onPress={() => setPicker(true)}
        testID="p2p-edit-expiry"
      />
      <Input
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        maxLength={NOTES_MAX}
        multiline
        hint={`${notes.length}/${NOTES_MAX}`}
        error={fieldErrors.notes}
        testID="p2p-edit-notes"
      />
      <FormAlert message={error} testID="p2p-edit-error" />
      <PickerSheet
        visible={picker}
        title="Expires"
        options={expiryOptions}
        selectedKey={expiry}
        onSelect={(key) => setExpiry(key as ExpiryChoice)}
        onClose={() => setPicker(false)}
        testID="p2p-edit-expiry-sheet"
      />
    </Screen>
  );
}

export function EditRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const now = useNow();
  const userId = useAppSelector((state) => state.session.userId);
  const request = useGetRequestQuery(id);
  const header = <StackHeader title="Edit request" />;

  if (request.error && !request.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(request.error)} onRetry={() => void request.refetch()} />
      </Screen>
    );
  }
  if (!request.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={240} />
      </Screen>
    );
  }
  if (!canManage(request.data, userId, now)) {
    return (
      <Screen>
        {header}
        <FormAlert
          tone="info"
          message="Only your open requests can be changed."
          testID="p2p-edit-locked"
        />
      </Screen>
    );
  }
  return <EditForm key={request.data.id} request={request.data} />;
}

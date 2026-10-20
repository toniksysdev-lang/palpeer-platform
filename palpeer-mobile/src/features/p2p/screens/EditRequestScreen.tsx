import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetRequestQuery, useUpdateRequestMutation } from '@/services/api/p2pApi';
import type { P2PRequestResponse } from '@/types/api/p2p';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { requestActionErrorMessage } from '../errors';
import {
  apiRateFromUnit,
  applyRateDisplayEdit,
  canManage,
  changesFor,
  currencyDisplayName,
  currencyFlag,
  displayRateForUnit,
  displayRateFromApi,
  EXPIRY_OPTIONS,
  NOTES_MAX,
  otherOfPair,
  preferredRateUnit,
  rateEntryHint,
  RATE_INPUT_DECIMALS,
  sideLabel,
  type ExpiryChoice,
  type RateEntryAnchor,
} from '../logic';

type Picker = 'expiry' | 'rateUnit';

function EditForm({ request }: { request: P2PRequestResponse }) {
  const theme = useTheme();
  const { precision } = useMoneyFormat();
  const numberPad = useOptionalNumberPad();
  const [update, updateState] = useUpdateRequestMutation();
  const base = request.baseCurrencyCode;
  const quote = request.quoteCurrencyCode;
  const initialUnit = preferredRateUnit(base, quote);
  const initialDisplay = displayRateFromApi(base, quote, initialUnit, request.rate);
  const [amount, setAmount] = useState<string>(() => toMoney(request.amount));
  const [rateUnit, setRateUnit] = useState(initialUnit);
  const [rateAnchor, setRateAnchor] = useState<RateEntryAnchor | null>(() =>
    isPositiveMoney(initialDisplay)
      ? { unitCode: initialUnit, value: initialDisplay }
      : null,
  );
  const [notes, setNotes] = useState(request.notes ?? '');
  const [expiry, setExpiry] = useState<ExpiryChoice>('KEEP');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const rateOther = otherOfPair(rateUnit, base, quote);
  const displayRate = displayRateForUnit(rateAnchor, rateUnit);
  const mathUnit = rateAnchor?.unitCode ?? rateUnit;
  const mathRate = rateAnchor?.value ?? displayRate;
  const apiRate = isPositiveMoney(mathRate)
    ? apiRateFromUnit(base, quote, mathUnit, mathRate)
    : '';
  const amountError = isPositiveMoney(amount) ? null : 'Enter an amount above zero.';
  const rateError = isPositiveMoney(mathRate) ? null : 'Enter a rate above zero.';
  const form = { amount, rate: apiRate, notes, expiry };
  const pending = Object.keys(changesFor(request, form, 0)).length > 0;

  // Without an expiry there is nothing to keep; the backend can't clear one once set.
  const keepTitle = request.expiresAt ? `Keep (${formatDateTime(request.expiresAt)})` : 'No expiry';
  const expiryOptions = [
    { key: 'KEEP', title: keepTitle },
    ...EXPIRY_OPTIONS.filter((option) => option.key !== 'NONE'),
  ];

  const chooseRateUnit = (code: string) => {
    if (code.toUpperCase() === rateUnit.toUpperCase()) return;
    numberPad?.close();
    setRateUnit(code);
  };

  const onDisplayRateChange = (value: string) => {
    setRateAnchor((current) => applyRateDisplayEdit(current, rateUnit, value));
  };

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
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="body" style={{ fontWeight: '600' }}>
          Set your exchange rate
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="bodyStrong">1</AppText>
          <Pressable
            onPress={() => setPicker('rateUnit')}
            accessibilityRole="button"
            accessibilityLabel={`Rate unit: ${rateUnit}`}
            testID="p2p-edit-rate-unit"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.surface,
              minHeight: 52,
            }}
          >
            <AppText variant="bodyStrong">{rateUnit}</AppText>
            <AppText tone="muted">▾</AppText>
          </Pressable>
          <AppText variant="bodyStrong">=</AppText>
          <View style={{ flex: 1, minWidth: 120 }}>
            <AmountInput
              label=""
              value={displayRate}
              onChangeText={onDisplayRateChange}
              precision={RATE_INPUT_DECIMALS}
              currencyCode={rateOther}
              placeholder="0.00"
              padOnBlur={false}
              error={rateError ?? fieldErrors.rate}
              testID="p2p-edit-rate"
            />
          </View>
        </View>
        <AppText variant="caption" tone="muted" testID="p2p-edit-rate-hint">
          {rateEntryHint(rateUnit, rateOther)}
        </AppText>
      </View>
      <PickerField
        label="Expires"
        value={expiryOptions.find((option) => option.key === expiry)?.title ?? ''}
        onPress={() => setPicker('expiry')}
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
        visible={picker === 'rateUnit'}
        title="Rate for 1"
        options={[
          {
            key: base,
            title: `${currencyFlag(base)}  ${base}`,
            subtitle: currencyDisplayName(base),
          },
          {
            key: quote,
            title: `${currencyFlag(quote)}  ${quote}`,
            subtitle: currencyDisplayName(quote),
          },
        ]}
        selectedKey={rateUnit}
        onSelect={chooseRateUnit}
        onClose={() => setPicker(null)}
        testID="p2p-edit-rate-unit-sheet"
      />
      <PickerSheet
        visible={picker === 'expiry'}
        title="Expires"
        options={expiryOptions}
        selectedKey={expiry}
        onSelect={(key) => setExpiry(key as ExpiryChoice)}
        onClose={() => setPicker(null)}
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

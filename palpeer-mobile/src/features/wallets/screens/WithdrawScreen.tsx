import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Plus, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import {
  useCreateWithdrawalMutation,
  useGetWalletQuery,
  useGetWithdrawalBanksQuery,
} from '@/services/api/walletApi';
import {
  interacAddressesStorage,
  type InteracAddress,
} from '@/services/storage/interacAddressesStorage';
import { useAppSelector } from '@/store';
import { compareMoney, isPositiveMoney, toMoney } from '@/utils/money';

import { ReviewRow } from '../components/ReviewRow';
import {
  cadReference,
  describeNgnDestination,
  ngnReference,
  validateCad,
  validateNgn,
  type DestinationErrors,
} from '../destination';
import { isIdempotencyConflict, walletErrorMessage } from '../errors';
import { railFor } from '../rails';
import { useIdempotencyKey } from '../useIdempotencyKey';
import { useMoneyFormat } from '../useMoneyFormat';

const digitsOnly = (text: string) => text.replace(/\D/g, '');

function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length >= 5 && email.includes('@') && !email.includes(' ');
}

function displayName(address: InteracAddress): string {
  return `${address.firstName} ${address.lastName}`.trim() || address.email;
}

/**
 * Amount + destination → review → PIN (if set) → `POST /withdrawals`. The PIN step is a client
 * safeguard only; the backend doesn't require a PIN (R-SEC-2, contract-pending S-1).
 * CAD Interac email reuses addresses saved during CAD funding (`interacAddressesStorage`).
 */
export function WithdrawScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAppSelector((state) => state.session.userId) ?? '';
  const wallet = useGetWalletQuery(id);
  const pinStatus = useGetPinStatusQuery();
  const { requestPin } = usePinPrompt();
  const { format, precision } = useMoneyFormat();
  const [createWithdrawal, createState] = useCreateWithdrawalMutation();
  const idempotency = useIdempotencyKey();

  const [step, setStep] = useState<'form' | 'addInterac' | 'review'>('form');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    email: '',
    bankCode: '',
    bankName: '',
    accountNumber: '',
  });
  const [fieldErrors, setFieldErrors] = useState<DestinationErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [addresses, setAddresses] = useState<InteracAddress[]>([]);
  const [selectedInterac, setSelectedInterac] = useState<InteracAddress | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [interacEmail, setInteracEmail] = useState('');

  const isNgn = wallet.data?.currencyCode?.toUpperCase() === 'NGN';
  const banksQuery = useGetWithdrawalBanksQuery('NG', { skip: !isNgn });

  const reloadAddresses = useCallback(async () => {
    if (!userId) return;
    const list = await interacAddressesStorage.list(userId);
    setAddresses(list);
    setSelectedInterac((current) => {
      if (current) {
        const match = list.find((item) => item.id === current.id);
        if (match) return match;
      }
      return list[0] ?? null;
    });
  }, [userId]);

  useEffect(() => {
    void reloadAddresses();
  }, [reloadAddresses]);

  useEffect(() => {
    if (!selectedInterac) return;
    setFields((current) =>
      current.email === selectedInterac.email
        ? current
        : { ...current, email: selectedInterac.email },
    );
  }, [selectedInterac]);

  const bankOptions = useMemo(
    () =>
      (banksQuery.data ?? []).map((bank) => ({
        key: bank.code,
        title: bank.name,
        subtitle: bank.code,
      })),
    [banksQuery.data],
  );

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

  const selectInterac = (address: InteracAddress) => {
    setSelectedInterac(address);
    setFields((current) => ({ ...current, email: address.email }));
    setFieldErrors((current) => ({ ...current, email: '' }));
  };

  const addFormValid =
    firstName.trim().length > 0 && lastName.trim().length > 0 && isValidEmail(interacEmail);

  const saveAndSelectAddress = async () => {
    if (!userId || !addFormValid) return;
    const saved = await interacAddressesStorage.save(userId, {
      firstName,
      lastName,
      email: interacEmail,
    });
    selectInterac(saved);
    await reloadAddresses();
    setStep('form');
  };

  const cadDestination = () => ({ method: 'email' as const, email: fields.email });
  const ngnDestination = () => ({ bankCode: fields.bankCode, accountNumber: fields.accountNumber });
  const reference =
    rail === 'APAYLO' ? cadReference(cadDestination()) : ngnReference(ngnDestination());
  const reviewDestination =
    rail === 'APAYLO'
      ? selectedInterac
        ? `${displayName(selectedInterac)} · ${selectedInterac.email}`
        : fields.email
      : describeNgnDestination(fields.bankName, fields.bankCode, fields.accountNumber);

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
    if (rail === 'APAYLO' && !fields.email.trim()) {
      nextFieldErrors.email = 'Select or add an Interac email.';
    }
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

  if (step === 'addInterac') {
    return (
      <Screen
        scroll
        keyboardAware
        footer={
          <Button
            label="Continue"
            onPress={() => void saveAndSelectAddress()}
            disabled={!addFormValid}
            testID="withdraw-interac-continue"
          />
        }
      >
        <StackHeader title="Enter Interac email" onBack={() => setStep('form')} />
        <AppText variant="body" tone="secondary">
          We are verifying your Interac email address. We will not have access to your Interac
          account. Addresses saved here are also available when you fund CAD.
        </AppText>
        <Input
          appearance="elevated"
          label="First name"
          placeholder="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          textContentType="givenName"
          testID="withdraw-interac-first"
        />
        <Input
          appearance="elevated"
          label="Last name"
          placeholder="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          textContentType="familyName"
          testID="withdraw-interac-last"
        />
        <Input
          appearance="elevated"
          label="Interac email"
          placeholder="Enter your Interac email"
          value={interacEmail}
          onChangeText={setInteracEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          testID="withdraw-interac-email"
        />
      </Screen>
    );
  }

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
            value={reviewDestination}
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
        <View style={{ gap: theme.spacing.sm }} testID="withdraw-interac-picker">
          <AppText variant="bodyStrong">Pay to Interac email</AppText>
          <AppText variant="caption" tone="secondary">
            Choose an Interac email saved from CAD funding, or add a new one.
          </AppText>
          {fieldErrors.email ? (
            <FormAlert tone="danger" message={fieldErrors.email} testID="withdraw-email-error" />
          ) : null}
          <Pressable
            onPress={() => {
              setFirstName('');
              setLastName('');
              setInteracEmail('');
              setStep('addInterac');
            }}
            accessibilityRole="button"
            accessibilityLabel="Add Interac address"
            testID="withdraw-add-interac"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Icon icon={Plus} color={theme.colors.primary} />
            </View>
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              Add Interac address
            </AppText>
            <Icon icon={ChevronRight} color={theme.colors.textMuted} size="sm" />
          </Pressable>

          {addresses.map((address) => {
            const selected = selectedInterac?.id === address.id;
            return (
              <Pressable
                key={address.id}
                onPress={() => selectInterac(address)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${displayName(address)}, ${address.email}`}
                testID={`withdraw-interac-${address.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.colors.surface,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.warningSoft,
                  }}
                >
                  <Icon icon={Zap} color={theme.colors.warning} />
                </View>
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="bodyStrong">{displayName(address)}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {address.email}
                  </AppText>
                </View>
                <Icon icon={ChevronRight} color={theme.colors.textMuted} size="sm" />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {banksQuery.isError && !banksQuery.data ? (
            <FormAlert
              tone="danger"
              message="Couldn't load banks. Pull to retry or try again shortly."
              testID="withdraw-banks-error"
            />
          ) : null}
          <PickerField
            label="Banks"
            value={fields.bankName}
            placeholder={banksQuery.isLoading ? 'Loading banks…' : 'Select a bank'}
            onPress={() => {
              if (!banksQuery.isLoading) setBankPickerOpen(true);
            }}
            error={fieldErrors.bankCode}
            testID="withdraw-bank"
          />
          <Input
            label="Account number"
            value={fields.accountNumber}
            onChangeText={(text) => setField('accountNumber', digitsOnly(text).slice(0, 10))}
            numberPad="digits"
            numberPadMaxLength={10}
            error={fieldErrors.accountNumber}
            hint="Enter the 10-digit NUBAN account number."
            testID="withdraw-account-number"
          />
          <PickerSheet
            visible={bankPickerOpen}
            title="Select bank"
            options={bankOptions}
            selectedKey={fields.bankCode || null}
            searchable
            searchPlaceholder="Search banks"
            onSelect={(bankCode) => {
              const bank = banksQuery.data?.find((item) => item.code === bankCode);
              setFields((current) => ({
                ...current,
                bankCode,
                bankName: bank?.name ?? bankCode,
              }));
              setFieldErrors((current) => ({ ...current, bankCode: '' }));
            }}
            onClose={() => setBankPickerOpen(false)}
            testID="withdraw-bank-sheet"
          />
        </View>
      )}
    </Screen>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { Building2, ChevronRight, Plus, Trash2, UserRound, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
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
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useAppSelector } from '@/store';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import { useCreateFundingMutation, useGetWalletQuery } from '@/services/api/walletApi';
import {
  interacAddressesStorage,
  type InteracAddress,
} from '@/services/storage/interacAddressesStorage';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { ReviewRow } from '../components/ReviewRow';
import { isIdempotencyConflict, walletErrorMessage } from '../errors';
import { hasPaymentRail, railFor } from '../rails';
import { useIdempotencyKey } from '../useIdempotencyKey';
import { useMoneyFormat } from '../useMoneyFormat';

/** CAD Apaylo Instant Interac deposit (customer sends to Palpeer account — no request email). */
const CAD_FUNDING_METHOD = {
  label: 'Interac, Instant deposit via Interac',
  title: 'Interac',
  subtitle: 'Instant deposit via Interac',
} as const;

const METHOD_COPY = {
  APAYLO: CAD_FUNDING_METHOD.label,
  KUDA: 'Bank transfer to your PALPEER virtual account. After you confirm, we show the account number to pay.',
  KORAPAY: 'Bank transfer to a one-time Korapay account. Account details are shown after you confirm.',
} as const;

type CadStep = 'amount' | 'payWith' | 'addAddress' | 'review';

function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length >= 5 && email.includes('@') && !email.includes(' ');
}

function displayName(address: InteracAddress): string {
  return `${address.firstName} ${address.lastName}`.trim() || address.email;
}

/** Amount → (CAD: Interac address) → review → `POST /funding`. Method follows wallet currency (R-W-3). */
export function FundWalletScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { requestPin } = usePinPrompt();
  const pinStatus = useGetPinStatusQuery();
  const userId = useAppSelector((state) => state.session.userId) ?? '';
  const wallet = useGetWalletQuery(id);
  const { format, precision } = useMoneyFormat();
  const [createFunding, createState] = useCreateFundingMutation();
  const idempotency = useIdempotencyKey();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<CadStep | 'rail-review'>('amount');
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<InteracAddress[]>([]);
  const [selected, setSelected] = useState<InteracAddress | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [interacEmail, setInteracEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reloadAddresses = useCallback(async () => {
    if (!userId) return;
    const list = await interacAddressesStorage.list(userId);
    setAddresses(list);
    if (list.length === 0) setDeleting(false);
  }, [userId]);

  useEffect(() => {
    void reloadAddresses();
  }, [reloadAddresses]);

  const deleteAddress = async (address: InteracAddress) => {
    if (!userId || deletingId) return;
    setError(null);
    if (!pinStatus.data) {
      setError("We couldn't check your PIN status. Try again.");
      void pinStatus.refetch();
      return;
    }
    if (!pinStatus.data.pinSet) {
      setError('Set up a transaction PIN before deleting a saved Interac address.');
      return;
    }
    setDeletingId(address.id);
    const confirmed = await requestPin({
      title: 'Delete Interac address',
      message: `Enter your PIN to delete ${displayName(address)} (${address.email}).`,
    });
    if (!confirmed) {
      setDeletingId(null);
      return;
    }
    try {
      await interacAddressesStorage.remove(userId, address.id);
      if (selected?.id === address.id) setSelected(null);
      await reloadAddresses();
      toast.show({ type: 'success', title: 'Interac address deleted' });
    } catch {
      setError("Couldn't delete this Interac address. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (wallet.error && !wallet.data) {
    return (
      <Screen>
        <StackHeader title="Add money" />
        <ErrorState error={toAppError(wallet.error)} onRetry={() => void wallet.refetch()} />
      </Screen>
    );
  }
  if (!wallet.data) {
    return (
      <Screen>
        <StackHeader title="Add money" />
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
  const validAmount = isPositiveMoney(normalizedAmount || '0');
  const isCadApaylo = rail === 'APAYLO';
  const addFormValid =
    firstName.trim().length > 0 && lastName.trim().length > 0 && isValidEmail(interacEmail);

  const submit = async (payer: InteracAddress | null) => {
    setError(null);
    const result = await createFunding({
      walletId,
      amount: toMoney(normalizedAmount),
      idempotencyKey: idempotency.current(),
      ...(isCadApaylo && payer
        ? {
            interacEmail: payer.email,
            interacFirstName: payer.firstName,
            interacLastName: payer.lastName,
          }
        : null),
    });
    if ('error' in result) {
      const appError = toAppError(result.error);
      if (isIdempotencyConflict(appError)) idempotency.reset();
      setError(walletErrorMessage(appError));
      return;
    }
    toast.show({ type: 'info', title: 'Funding started' });
    router.replace({
      pathname: '/wallet/funding/[fundingId]',
      params: { fundingId: result.data.id },
    });
  };

  const goAmountContinue = () => {
    if (normalizedAmount && normalizedAmount !== amount) setAmount(normalizedAmount);
    if (isCadApaylo) {
      setStep('payWith');
      return;
    }
    setStep('rail-review');
  };

  const saveAndSelectAddress = async () => {
    if (!userId || !addFormValid) return;
    setError(null);
    try {
      const saved = await interacAddressesStorage.save(userId, {
        firstName,
        lastName,
        email: interacEmail,
      });
      setSelected(saved);
      await reloadAddresses();
      setStep('review');
    } catch {
      setError("Couldn't save this Interac address. Try again.");
    }
  };

  if (isCadApaylo && step === 'payWith') {
    return (
      <Screen scroll>
        <StackHeader
          title="Pay with"
          onBack={() => {
            setDeleting(false);
            setError(null);
            setStep('amount');
          }}
          right={
            addresses.length > 0 ? (
              <TextLink
                label={deleting ? 'Done' : 'Delete'}
                tone="info"
                onPress={() => {
                  setError(null);
                  setDeleting((value) => !value);
                }}
                testID="fund-pay-with-delete-toggle"
              />
            ) : undefined
          }
        />
        <FormAlert message={error} testID="fund-pay-with-error" />
        {deleting ? (
          <AppText tone="secondary" testID="fund-pay-with-delete-hint">
            Tap the trash icon, then enter your PIN to remove a saved Interac address.
          </AppText>
        ) : null}
        <View style={{ gap: theme.spacing.sm }} testID="fund-pay-with">
          {!deleting ? (
            <Pressable
              onPress={() => {
                setFirstName('');
                setLastName('');
                setInteracEmail('');
                setStep('addAddress');
              }}
              accessibilityRole="button"
              accessibilityLabel="Add Interac address"
              testID="fund-add-interac"
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
          ) : null}

          {addresses.map((address) => {
            const rowStyle = {
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              opacity: deletingId === address.id ? 0.6 : 1,
            };
            const body = (
              <>
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
                {deleting ? (
                  <IconButton
                    icon={Trash2}
                    accessibilityLabel={`Delete ${displayName(address)}`}
                    onPress={() => void deleteAddress(address)}
                    disabled={deletingId !== null}
                    testID={`fund-interac-delete-${address.id}`}
                  />
                ) : (
                  <Icon icon={ChevronRight} color={theme.colors.textMuted} size="sm" />
                )}
              </>
            );
            if (deleting) {
              return (
                <View key={address.id} style={rowStyle} testID={`fund-interac-${address.id}`}>
                  {body}
                </View>
              );
            }
            return (
              <Pressable
                key={address.id}
                onPress={() => {
                  setSelected(address);
                  setStep('review');
                }}
                accessibilityRole="button"
                accessibilityLabel={`${displayName(address)}, ${address.email}`}
                testID={`fund-interac-${address.id}`}
                style={rowStyle}
              >
                {body}
              </Pressable>
            );
          })}
        </View>
      </Screen>
    );
  }

  if (isCadApaylo && step === 'addAddress') {
    return (
      <Screen
        scroll
        keyboardAware
        footer={
          <Button
            label="Continue"
            onPress={() => void saveAndSelectAddress()}
            disabled={!addFormValid}
            testID="fund-interac-continue"
          />
        }
      >
        <StackHeader title="Enter Interac email" onBack={() => setStep('payWith')} />
        <AppText variant="body" tone="secondary">
          We are verifying your Interac email address. We will not have access to your Interac
          account.
        </AppText>
        <Input
          appearance="elevated"
          label="First name"
          placeholder="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          textContentType="givenName"
          testID="fund-interac-first"
        />
        <Input
          appearance="elevated"
          label="Last name"
          placeholder="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          textContentType="familyName"
          testID="fund-interac-last"
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
          testID="fund-interac-email"
        />
      </Screen>
    );
  }

  if ((isCadApaylo && step === 'review' && selected) || step === 'rail-review') {
    const title = isCadApaylo ? 'Review details' : 'Review';
    return (
      <Screen
        scroll
        footer={
          <Button
            label={isCadApaylo ? 'Continue' : 'Confirm funding'}
            onPress={() => void submit(isCadApaylo ? selected : null)}
            loading={createState.isLoading}
            loadingLabel="Starting…"
            testID="fund-confirm"
          />
        }
      >
        <StackHeader
          title={title}
          onBack={() => {
            idempotency.reset();
            setError(null);
            setStep(isCadApaylo ? 'payWith' : 'amount');
          }}
        />
        <FormAlert message={error} testID="fund-error" />

        {isCadApaylo && selected ? (
          <View style={{ alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Icon icon={UserRound} color={theme.colors.primary} />
            </View>
            <AppText variant="h2" testID="fund-review-amount">
              {format(toMoney(normalizedAmount), code)}
            </AppText>
          </View>
        ) : null}

        <Card variant="outlined" padding="md">
          {isCadApaylo ? (
            <>
              <ReviewRow label="Fee" value={format(toMoney('0'), code)} />
              <ReviewRow
                label="You will receive"
                value={format(toMoney(normalizedAmount), code)}
                testID="fund-review-receive"
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </Card>

        {isCadApaylo && selected ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <AppText variant="overline" tone="muted">
              Pay with
            </AppText>
            <Card variant="outlined" padding="md" testID="fund-review-interac">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Icon icon={Zap} color={theme.colors.warning} />
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="bodyStrong">{displayName(selected)}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {selected.email}
                  </AppText>
                </View>
              </View>
            </Card>
            <AppText variant="caption" tone="secondary">
              Next you will send Interac e-Transfer from your banking app to Palpeer’s Interac
              account. We do not email you a request to accept.
            </AppText>
          </View>
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
          onPress={goAmountContinue}
          disabled={!validAmount}
          testID="fund-continue"
        />
      }
    >
      <StackHeader title={isCadApaylo ? 'Add money' : `Fund ${code}`} />
      <AmountInput
        label={isCadApaylo ? 'Amount to add' : 'Amount'}
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
            Pay with
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

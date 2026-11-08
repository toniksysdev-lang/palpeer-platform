import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  PickerField,
  PickerSheet,
} from '@/features/exchange/components/PickerSheet';
import { iso2FromE164 } from '@/features/auth/signupCountries';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useUpdateMyProfileMutation } from '@/services/api/profileApi';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { signupDraftStorage } from '@/services/storage/signupDraftStorage';

import { AddressAutocomplete } from '../AddressAutocomplete';
import type { StructuredAddress } from '../addressLookup';
import { DateOfBirthField } from '../DateOfBirthField';
import {
  JOB_OPTIONS,
  MONTHLY_TX_OPTIONS,
  SOURCE_OF_INCOME_OPTIONS,
  STATES_BY_COUNTRY,
  optionTitle,
  profileCountriesWith,
} from '../profileOptions';
import {
  defaultDateOfBirth,
  maximumDateOfBirth,
  personalInfoSchema,
  profileToFormDefaults,
  toUpdateProfileRequest,
  type PersonalInfoForm,
} from '../schemas';
import { useEnsureProfile } from '../useEnsureProfile';

/** Phone-signup country used to seed Country of residence when profile has none. */
async function resolvePhoneSignupCountryIso2(): Promise<string | null> {
  const fromPref = await preferencesStorage.getSignupCountryIso2();
  if (fromPref) return fromPref;

  const draft = await signupDraftStorage.load();
  const fromDraft = draft?.countryIso2?.trim().toUpperCase() ?? '';
  if (fromDraft.length === 2) {
    await preferencesStorage.setSignupCountryIso2(fromDraft);
    return fromDraft;
  }

  const inferred = iso2FromE164(draft?.phone);
  if (inferred) {
    await preferencesStorage.setSignupCountryIso2(inferred);
    return inferred;
  }
  return null;
}

type SheetKey = 'country' | 'state' | 'job' | null;
type WizardStep = 0 | 1 | 2;

const STEP_FIELDS: Record<WizardStep, (keyof PersonalInfoForm)[]> = {
  0: ['firstName', 'lastName', 'dateOfBirth', 'sourceOfIncome'],
  1: [
    'countryOfResidence',
    'stateTerritory',
    'addressLine1',
    'addressLine2',
    'city',
    'postalCode',
  ],
  2: ['sourceOfIncome', 'monthlyTransactionEstimate'],
};

const aboutMeSchema = personalInfoSchema.pick({
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sourceOfIncome: true,
});
const whereILiveSchema = personalInfoSchema.pick({
  countryOfResidence: true,
  stateTerritory: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  postalCode: true,
});
const myMoneySchema = personalInfoSchema.pick({
  sourceOfIncome: true,
  monthlyTransactionEstimate: true,
});

export function PersonalInformationScreen() {
  const theme = useTheme();
  const toast = useToast();
  const t = useT();
  const { profile, loading, error, retry } = useEnsureProfile();
  const [update, { isLoading: saving }] = useUpdateMyProfileMutation();
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>(0);
  const defaultDobDate = useMemo(() => defaultDateOfBirth(), []);
  const maxDobDate = useMemo(() => maximumDateOfBirth(), []);

  const { control, handleSubmit, reset, setValue, setError, trigger, getValues } =
    useForm<PersonalInfoForm>({
      resolver: zodResolver(personalInfoSchema),
      defaultValues: profileToFormDefaults(null),
      mode: 'onSubmit',
    });
  const [signupCountryIso2, setSignupCountryIso2] = useState<string | null>(null);

  useEffect(() => {
    void resolvePhoneSignupCountryIso2().then(setSignupCountryIso2);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const defaults = profileToFormDefaults(profile);
    if (!defaults.countryOfResidence && signupCountryIso2) {
      defaults.countryOfResidence = signupCountryIso2;
    }
    reset(defaults);
  }, [profile, reset, signupCountryIso2]);

  const country = useWatch({ control, name: 'countryOfResidence' });
  const stateTerritory = useWatch({ control, name: 'stateTerritory' });
  const sourceOfIncome = useWatch({ control, name: 'sourceOfIncome' });
  const readOnly = profile?.complete === true;
  const countryOptions = useMemo(
    () => profileCountriesWith(country || signupCountryIso2),
    [country, signupCountryIso2],
  );
  const stateOptions = useMemo(
    () => STATES_BY_COUNTRY[country] ?? [{ key: 'N/A', title: 'Not applicable' }],
    [country],
  );

  const stepTitle =
    step === 0 ? t('profile.aboutMe') : step === 1 ? t('profile.whereILive') : t('profile.myMoney');

  const applyStructuredAddress = (address: StructuredAddress) => {
    setValue('addressLine1', address.addressLine1, { shouldValidate: true, shouldDirty: true });
    setValue('addressLine2', address.addressLine2, { shouldValidate: true, shouldDirty: true });
    setValue('city', address.city, { shouldValidate: true, shouldDirty: true });
    setValue('postalCode', address.postalCode, { shouldValidate: true, shouldDirty: true });
    if (address.countryCode) {
      setValue('countryOfResidence', address.countryCode, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    if (address.stateTerritory) {
      setValue('stateTerritory', address.stateTerritory, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else if (address.countryCode && address.countryCode !== country) {
      setValue('stateTerritory', '', { shouldValidate: false, shouldDirty: true });
    }
  };

  const validateStep = async (current: WizardStep): Promise<boolean> => {
    setFormError(null);
    const values = getValues();
    const schema =
      current === 0 ? aboutMeSchema : current === 1 ? whereILiveSchema : myMoneySchema;
    const parsed = schema.safeParse(
      Object.fromEntries(STEP_FIELDS[current].map((field) => [field, values[field]])),
    );
    if (!parsed.success) {
      const ageIssue = parsed.error.issues.find((issue) =>
        /years old|at least \d+/i.test(issue.message),
      );
      const ageMessage = t('profile.under18');
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && field in values) {
          const message =
            ageIssue && field === 'dateOfBirth' ? ageMessage : issue.message;
          setError(field as keyof PersonalInfoForm, { type: 'manual', message });
        }
      }
      if (ageIssue) setFormError(ageMessage);
      await trigger(STEP_FIELDS[current]);
      return false;
    }
    return trigger(STEP_FIELDS[current]);
  };

  const goNext = async () => {
    const ok = await validateStep(step);
    if (!ok) return;
    if (step < 2) {
      setStep((current) => (current + 1) as WizardStep);
      return;
    }
    await saveAndShowId();
  };

  const saveAndShowId = handleSubmit(async (values) => {
    setFormError(null);
    const result = await update(toUpdateProfileRequest(values));
    if ('data' in result && result.data) {
      await preferencesStorage.clearSignupCountryIso2();
      toast.show({ type: 'success', title: t('profile.saved') });
      router.push('/kyc');
      return;
    }
    const appError = toAppError(result.error);
    let fieldHandled = false;
    for (const [field, message] of Object.entries(appError.fieldErrors)) {
      if (field in values) {
        setError(field as keyof PersonalInfoForm, { type: 'server', message });
        fieldHandled = true;
      }
    }
    if (!fieldHandled) setFormError(appError.message);
  });

  if (loading && !profile) {
    return (
      <Screen>
        <StackHeader title={t('home.completeProfile')} />
        <View style={{ gap: theme.spacing.md }} testID="personal-info-loading">
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      </Screen>
    );
  }

  if (error && !profile) {
    return (
      <Screen>
        <StackHeader title={t('home.completeProfile')} />
        <FormAlert message={error.message} testID="personal-info-error" />
        <Button label="Try again" variant="outline" onPress={retry} />
      </Screen>
    );
  }

  if (readOnly) {
    return (
      <Screen scroll>
        <StackHeader title={t('home.completeProfile')} />
        <FormAlert
          tone="info"
          message="Your details are on file. Show my ID is under My identity in More."
        />
        <Button label={t('profile.showMyId')} onPress={() => router.push('/kyc')} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label={step === 2 ? t('profile.saveContinue') : t('profile.continue')}
          shape="pill"
          onPress={() => void goNext()}
          loading={saving}
          loadingLabel="Saving…"
          testID="personal-info-continue"
        />
      }
    >
      <StackHeader
        title={stepTitle}
        onBack={
          step > 0
            ? () => setStep((current) => (current - 1) as WizardStep)
            : undefined
        }
      />
      <AppText variant="caption" tone="muted" testID="personal-info-step">
        {t('profile.stepOf', { step: step + 1 })}
      </AppText>

      {formError ? <FormAlert message={formError} testID="personal-info-alert" /> : null}

      {step === 0 ? (
        <>
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <Input
                appearance="elevated"
                label={t('profile.firstName')}
                placeholder={t('profile.firstName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                autoComplete="given-name"
                textContentType="givenName"
                autoCapitalize="words"
                testID="personal-first-name"
              />
            )}
          />
          <Controller
            control={control}
            name="lastName"
            render={({ field, fieldState }) => (
              <Input
                appearance="elevated"
                label={t('profile.lastName')}
                placeholder={t('profile.lastName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                autoComplete="family-name"
                textContentType="familyName"
                autoCapitalize="words"
                testID="personal-last-name"
              />
            )}
          />
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field, fieldState }) => (
              <DateOfBirthField
                label={t('profile.dob')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                defaultPickerDate={defaultDobDate}
                maximumDate={maxDobDate}
                testID="personal-dob"
              />
            )}
          />
          <Controller
            control={control}
            name="sourceOfIncome"
            render={({ field, fieldState }) => (
              <PickerField
                appearance="elevated"
                label={t('profile.myJob')}
                value={optionTitle(JOB_OPTIONS, field.value)}
                placeholder={t('profile.myJob')}
                error={fieldState.error?.message}
                onPress={() => setSheet('job')}
                testID="personal-job"
              />
            )}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Controller
            control={control}
            name="countryOfResidence"
            render={({ field, fieldState }) => (
              <PickerField
                appearance="elevated"
                label={t('profile.country')}
                value={optionTitle(countryOptions, field.value)}
                placeholder="Select"
                error={fieldState.error?.message}
                onPress={() => setSheet('country')}
                testID="personal-country"
              />
            )}
          />
          <Controller
            control={control}
            name="stateTerritory"
            render={({ field, fieldState }) => (
              <PickerField
                appearance="elevated"
                label={t('profile.province')}
                value={optionTitle(stateOptions, field.value)}
                placeholder={t('profile.province')}
                error={fieldState.error?.message}
                onPress={() => setSheet('state')}
                testID="personal-state"
              />
            )}
          />
          <Controller
            control={control}
            name="addressLine1"
            render={({ field, fieldState }) => (
              <AddressAutocomplete
                label={t('profile.street')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                countryCode={country}
                onPick={applyStructuredAddress}
                onPickupMessage={(message, type) => toast.show({ type, title: message })}
                testID="personal-address1"
              />
            )}
          />
          <Pressable
            onPress={() => {
              /* AddressAutocomplete “use location” is on the field; keep explicit CTA for design. */
              toast.show({
                type: 'info',
                title: t('profile.useLocation'),
                message: 'Use the location control on the street field.',
              });
            }}
            testID="personal-use-location"
          >
            <AppText variant="bodyStrong" style={{ color: theme.colors.info }}>
              {t('profile.useLocation')}
            </AppText>
          </Pressable>
          <Controller
            control={control}
            name="addressLine2"
            render={({ field, fieldState }) => (
              <Input
                appearance="elevated"
                label={t('profile.apartment')}
                placeholder={t('profile.apartment')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                autoComplete="address-line2"
                textContentType="streetAddressLine2"
                testID="personal-address2"
              />
            )}
          />
          <Controller
            control={control}
            name="city"
            render={({ field, fieldState }) => (
              <Input
                appearance="elevated"
                label={t('profile.city')}
                placeholder={t('profile.city')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                autoComplete="postal-address"
                textContentType="addressCity"
                autoCapitalize="words"
                testID="personal-city"
              />
            )}
          />
          <Controller
            control={control}
            name="postalCode"
            render={({ field, fieldState }) => (
              <Input
                appearance="elevated"
                label={t('profile.postal')}
                placeholder={t('profile.postal')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                autoComplete="postal-code"
                textContentType="postalCode"
                autoCapitalize="characters"
                testID="personal-postal"
              />
            )}
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <AppText variant="bodyStrong">{t('profile.moneyFrom')}</AppText>
          <Controller
            control={control}
            name="sourceOfIncome"
            render={({ field, fieldState }) => (
              <View style={{ gap: theme.spacing.sm }}>
                {SOURCE_OF_INCOME_OPTIONS.map((option) => {
                  const selected = field.value === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() =>
                        setValue('sourceOfIncome', option.key, { shouldValidate: true })
                      }
                      style={{
                        padding: theme.spacing.md,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected
                          ? theme.colors.primarySoft
                          : theme.colors.surface,
                      }}
                      testID={`personal-income-${option.key}`}
                    >
                      <AppText variant="bodyStrong">{option.title}</AppText>
                    </Pressable>
                  );
                })}
                {fieldState.error?.message ? (
                  <AppText variant="caption" style={{ color: theme.colors.danger }}>
                    {fieldState.error.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />
          <AppText variant="bodyStrong" style={{ marginTop: theme.spacing.md }}>
            {t('profile.howMuch')}
          </AppText>
          <Controller
            control={control}
            name="monthlyTransactionEstimate"
            render={({ field, fieldState }) => (
              <View style={{ gap: theme.spacing.sm }}>
                {MONTHLY_TX_OPTIONS.map((option) => {
                  const selected = field.value === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() =>
                        setValue('monthlyTransactionEstimate', option.key, {
                          shouldValidate: true,
                        })
                      }
                      style={{
                        padding: theme.spacing.md,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected
                          ? theme.colors.primarySoft
                          : theme.colors.surface,
                      }}
                      testID={`personal-monthly-${option.key}`}
                    >
                      <AppText variant="bodyStrong">{option.title}</AppText>
                    </Pressable>
                  );
                })}
                {fieldState.error?.message ? (
                  <AppText variant="caption" style={{ color: theme.colors.danger }}>
                    {fieldState.error.message}
                  </AppText>
                ) : null}
              </View>
            )}
          />
        </>
      ) : null}

      <PickerSheet
        visible={sheet === 'job'}
        title={t('profile.myJob')}
        options={JOB_OPTIONS}
        selectedKey={sourceOfIncome || null}
        onSelect={(key) => {
          setValue('sourceOfIncome', key, { shouldValidate: true });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        testID="personal-job-sheet"
      />
      <PickerSheet
        visible={sheet === 'country'}
        title={t('profile.country')}
        options={countryOptions}
        selectedKey={country || null}
        onSelect={(key) => {
          setValue('countryOfResidence', key, { shouldValidate: true });
          setValue('stateTerritory', '', { shouldValidate: false });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        testID="personal-country-sheet"
      />
      <PickerSheet
        visible={sheet === 'state'}
        title={t('profile.province')}
        options={stateOptions}
        selectedKey={stateTerritory || null}
        onSelect={(key) => {
          setValue('stateTerritory', key, { shouldValidate: true });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        testID="personal-state-sheet"
      />
    </Screen>
  );
}

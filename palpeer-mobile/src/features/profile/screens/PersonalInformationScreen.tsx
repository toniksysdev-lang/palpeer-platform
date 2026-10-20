import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  PickerField,
  PickerSheet,
} from '@/features/exchange/components/PickerSheet';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useUpdateMyProfileMutation } from '@/services/api/profileApi';

import { AddressAutocomplete } from '../AddressAutocomplete';
import type { StructuredAddress } from '../addressLookup';
import { DateOfBirthField } from '../DateOfBirthField';
import { preferencesStorage } from '@/services/storage/preferencesStorage';

import {
  MONTHLY_TX_OPTIONS,
  SOURCE_OF_INCOME_OPTIONS,
  STATES_BY_COUNTRY,
  optionTitle,
  profileCountriesWith,
} from '../profileOptions';
import {
  defaultDateOfBirth,
  personalInfoSchema,
  profileToFormDefaults,
  toUpdateProfileRequest,
  type PersonalInfoForm,
} from '../schemas';
import { useEnsureProfile } from '../useEnsureProfile';

type SheetKey =
  | 'country'
  | 'state'
  | 'income'
  | 'monthly'
  | null;

export function PersonalInformationScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { profile, loading, error, retry } = useEnsureProfile();
  const [update, { isLoading: saving }] = useUpdateMyProfileMutation();
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const defaultDobDate = useMemo(() => defaultDateOfBirth(15), []);
  const today = useMemo(() => new Date(), []);

  const { control, handleSubmit, reset, setValue, setError } = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: profileToFormDefaults(null),
  });
  const [signupCountryIso2, setSignupCountryIso2] = useState<string | null>(null);

  useEffect(() => {
    void preferencesStorage.getSignupCountryIso2().then(setSignupCountryIso2);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const defaults = profileToFormDefaults(profile);
    // Phone-verification country seeds Country when the profile has none yet.
    if (!defaults.countryOfResidence && signupCountryIso2) {
      defaults.countryOfResidence = signupCountryIso2;
    }
    reset(defaults);
  }, [profile, reset, signupCountryIso2]);

  const country = useWatch({ control, name: 'countryOfResidence' });
  const stateTerritory = useWatch({ control, name: 'stateTerritory' });
  const sourceOfIncome = useWatch({ control, name: 'sourceOfIncome' });
  const monthlyEstimate = useWatch({ control, name: 'monthlyTransactionEstimate' });
  const countryOptions = useMemo(
    () => profileCountriesWith(country || signupCountryIso2),
    [country, signupCountryIso2],
  );
  const stateOptions = useMemo(
    () => STATES_BY_COUNTRY[country] ?? [{ key: 'N/A', title: 'Not applicable' }],
    [country],
  );

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

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await update(toUpdateProfileRequest(values));
    if ('data' in result && result.data) {
      await preferencesStorage.clearSignupCountryIso2();
      toast.show({ type: 'success', title: 'Profile saved' });
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
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
        <StackHeader title="Personal information" />
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
        <StackHeader title="Personal information" />
        <FormAlert message={error.message} testID="personal-info-error" />
        <Button label="Try again" variant="outline" onPress={retry} />
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
          shape="pill"
          onPress={onSubmit}
          loading={saving}
          loadingLabel="Saving…"
          testID="personal-info-continue"
        />
      }
    >
      <StackHeader title="Personal information" />

      {formError ? <FormAlert message={formError} testID="personal-info-alert" /> : null}

      <Controller
        control={control}
        name="firstName"
        render={({ field, fieldState }) => (
          <Input
            appearance="elevated"
            label="First name *"
            placeholder="first name"
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
            label="Last name *"
            placeholder="last name"
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
            label="Date of Birth"
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            defaultPickerDate={defaultDobDate}
            maximumDate={today}
            testID="personal-dob"
          />
        )}
      />

      <Controller
        control={control}
        name="countryOfResidence"
        render={({ field, fieldState }) => (
          <PickerField
            appearance="elevated"
            label="Country of residence"
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
            label="State/Territory"
            value={optionTitle(stateOptions, field.value)}
            placeholder="State/territory"
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
            label="Address line 1"
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
      <Controller
        control={control}
        name="addressLine2"
        render={({ field, fieldState }) => (
          <Input
            appearance="elevated"
            label="Address line 2"
            placeholder="Address line 2"
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
            label="City"
            placeholder="city"
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
            label="Postal/Zip Code"
            placeholder="Postal"
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

      <Controller
        control={control}
        name="sourceOfIncome"
        render={({ field, fieldState }) => (
          <PickerField
            appearance="elevated"
            label="Source of income"
            value={optionTitle(SOURCE_OF_INCOME_OPTIONS, field.value)}
            placeholder="Source of income"
            error={fieldState.error?.message}
            onPress={() => setSheet('income')}
            testID="personal-income"
          />
        )}
      />
      <Controller
        control={control}
        name="monthlyTransactionEstimate"
        render={({ field, fieldState }) => (
          <PickerField
            appearance="elevated"
            label="Monthly transaction estimate"
            value={optionTitle(MONTHLY_TX_OPTIONS, field.value)}
            placeholder="0 - 2000"
            error={fieldState.error?.message}
            onPress={() => setSheet('monthly')}
            testID="personal-monthly"
          />
        )}
      />

      <PickerSheet
        visible={sheet === 'country'}
        title="Country of residence"
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
        title="State / territory"
        options={stateOptions}
        selectedKey={stateTerritory || null}
        onSelect={(key) => {
          setValue('stateTerritory', key, { shouldValidate: true });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        testID="personal-state-sheet"
      />
      <PickerSheet
        visible={sheet === 'income'}
        title="Source of income"
        options={SOURCE_OF_INCOME_OPTIONS}
        selectedKey={sourceOfIncome || null}
        onSelect={(key) => {
          setValue('sourceOfIncome', key, { shouldValidate: true });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        testID="personal-income-sheet"
      />
      <PickerSheet
        visible={sheet === 'monthly'}
        title="Monthly transaction estimate"
        options={MONTHLY_TX_OPTIONS}
        selectedKey={monthlyEstimate || null}
        onSelect={(key) => {
          setValue('monthlyTransactionEstimate', key, { shouldValidate: true });
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        testID="personal-monthly-sheet"
      />
    </Screen>
  );
}

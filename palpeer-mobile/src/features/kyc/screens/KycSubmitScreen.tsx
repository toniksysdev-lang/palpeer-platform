import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type TextInput } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { FormAlert } from '@/components/feedback/FormAlert';
import { ErrorState } from '@/components/feedback/StateViews';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useGetKycProgressQuery, useStartKycVerificationMutation } from '@/services/api/kycApi';

import { isVerificationUnavailable, kycErrorMessage } from '../errors';
import { canUpload } from '../kycState';
import { kycSubmitSchema, toStartVerificationRequest, type KycSubmitForm } from '../schemas';

type Alert = { tone: 'danger' | 'info'; message: string; addDocument?: boolean };

const FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'issuingCountry'] as const;

export function KycSubmitScreen() {
  const theme = useTheme();
  const toast = useToast();
  const progress = useGetKycProgressQuery();
  const { profile } = useEnsureProfile();
  const [start, { isLoading }] = useStartKycVerificationMutation();
  const [alert, setAlert] = useState<Alert | null>(null);
  const lastNameRef = useRef<TextInput>(null);
  const dobRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);

  const { control, handleSubmit, setError, reset } = useForm<KycSubmitForm>({
    resolver: zodResolver(kycSubmitSchema),
    defaultValues: { firstName: '', lastName: '', dateOfBirth: '', issuingCountry: '' },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      issuingCountry: profile.countryOfResidence ?? '',
    });
  }, [profile, reset]);

  const goToHub = () => router.dismissTo('/kyc');

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    const result = await start(toStartVerificationRequest(values));
    if ('data' in result && result.data) {
      toast.show({ type: 'success', title: 'Submitted for review' });
      goToHub();
      return;
    }
    const error = toAppError(result.error);
    let fieldHandled = false;
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      if ((FIELDS as readonly string[]).includes(field)) {
        setError(field as (typeof FIELDS)[number], { type: 'server', message });
        fieldHandled = true;
      }
    }
    if (fieldHandled) return;
    if (isVerificationUnavailable(error)) {
      setAlert({ tone: 'info', message: kycErrorMessage(error) });
    } else if (error.code === 'KYC_DOCUMENT_REQUIRED') {
      setAlert({ tone: 'danger', message: kycErrorMessage(error), addDocument: true });
    } else if (error.code === 'KYC_UPLOAD_NOT_ALLOWED') {
      setAlert({ tone: 'info', message: kycErrorMessage(error) });
      void progress.refetch();
    } else {
      setAlert({ tone: 'danger', message: kycErrorMessage(error) });
    }
  });

  const header = <StackHeader title="Submit for review" onBack={goToHub} />;

  if (progress.error && !progress.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(progress.error)} onRetry={() => void progress.refetch()} />
      </Screen>
    );
  }

  if (!progress.data) {
    return (
      <Screen>
        {header}
        <View style={{ gap: theme.spacing.md }} testID="kyc-submit-loading">
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      </Screen>
    );
  }

  if (!canUpload(progress.data.status)) {
    return (
      <Screen footer={<Button label="Back to verification" onPress={goToHub} />}>
        {header}
        <FormAlert
          tone="info"
          message="Your verification has already been submitted. We'll show the result on the verification page."
          testID="kyc-submit-closed"
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label="Submit for review"
          onPress={onSubmit}
          loading={isLoading}
          loadingLabel="Submitting…"
          disabled={!progress.data.hasDocument}
          testID="kyc-submit"
        />
      }
    >
      {header}
      <AppText tone="secondary">
        Enter your name exactly as it appears on your document. We&apos;ll send it with your photos
        for review.
      </AppText>

      {!progress.data.hasDocument ? (
        <View style={{ gap: theme.spacing.xs }}>
          <FormAlert
            message="Upload a photo of your identity document before submitting."
            testID="kyc-submit-no-document"
          />
          <TextLink
            label="Add identity document"
            onPress={() => router.push('/kyc/document-type')}
          />
        </View>
      ) : null}
      {progress.data.hasDocument && !progress.data.hasSelfie ? (
        <View style={{ gap: theme.spacing.xs }}>
          <FormAlert
            tone="warning"
            message="You haven't added a selfie yet."
            testID="kyc-submit-no-selfie"
          />
          <TextLink label="Take a selfie" onPress={() => router.push('/kyc/selfie')} />
        </View>
      ) : null}

      {alert ? (
        <View style={{ gap: theme.spacing.xs }}>
          <FormAlert tone={alert.tone} message={alert.message} testID="kyc-submit-alert" />
          {alert.addDocument ? (
            <TextLink
              label="Add identity document"
              onPress={() => router.push('/kyc/document-type')}
            />
          ) : null}
        </View>
      ) : null}

      <Controller
        control={control}
        name="firstName"
        render={({ field, fieldState }) => (
          <Input
            label="First name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="given-name"
            textContentType="givenName"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => lastNameRef.current?.focus()}
            testID="kyc-first-name"
          />
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field, fieldState }) => (
          <Input
            ref={lastNameRef}
            label="Last name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="family-name"
            textContentType="familyName"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => dobRef.current?.focus()}
            testID="kyc-last-name"
          />
        )}
      />
      <Controller
        control={control}
        name="dateOfBirth"
        render={({ field, fieldState }) => (
          <Input
            ref={dobRef}
            label="Date of birth (optional)"
            placeholder="YYYY-MM-DD"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="numbers-and-punctuation"
            autoComplete="birthdate-full"
            maxLength={10}
            returnKeyType="next"
            onSubmitEditing={() => countryRef.current?.focus()}
            testID="kyc-dob"
          />
        )}
      />
      <Controller
        control={control}
        name="issuingCountry"
        render={({ field, fieldState }) => (
          <Input
            ref={countryRef}
            label="Issuing country (optional)"
            placeholder="e.g. NG"
            hint="The 2-letter code of the country that issued your document."
            value={field.value}
            onChangeText={(text) => field.onChange(text.toUpperCase())}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={2}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            testID="kyc-country"
          />
        )}
      />
    </Screen>
  );
}

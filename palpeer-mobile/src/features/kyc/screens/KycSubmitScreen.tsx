import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextInput as TextInputType,
} from 'react-native';

import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { useToast } from '@/providers/ToastProvider';
import { toAppError } from '@/services/api/errors';
import { useGetKycProgressQuery, useStartKycVerificationMutation } from '@/services/api/kycApi';

import { DesignKycShell } from '../components/DesignKycShell';
import { KYC_D as D } from '../components/designTokens';
import { isLivePhotoRejected, isVerificationUnavailable, kycErrorMessage } from '../errors';
import { canUpload } from '../kycState';
import { safeKycReturnTo } from '../returnTo';
import { kycSubmitSchema, toStartVerificationRequest, type KycSubmitForm } from '../schemas';

type Alert = {
  tone: 'danger' | 'info';
  message: string;
  addDocument?: boolean;
  retakeSelfie?: boolean;
};

const FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'issuingCountry'] as const;

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  testID?: string;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur' | 'style' | 'placeholderTextColor'>;

const Field = React.forwardRef<TextInputType, FieldProps>(function Field(
  { label, value, onChangeText, onBlur, error, hint, placeholder, testID, ...rest },
  ref,
) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={D.muted}
        style={[styles.input, error ? styles.inputError : null]}
        testID={testID}
        {...rest}
      />
      {error ? (
        <Text style={styles.warn}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

export function KycSubmitScreen() {
  const toast = useToast();
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeKycReturnTo(returnToParam, '');
  const progress = useGetKycProgressQuery();
  const { profile } = useEnsureProfile();
  const [start, { isLoading }] = useStartKycVerificationMutation();
  const [alert, setAlert] = useState<Alert | null>(null);
  const lastNameRef = useRef<TextInputType>(null);
  const dobRef = useRef<TextInputType>(null);
  const countryRef = useRef<TextInputType>(null);

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

  const goToHub = () => {
    if (returnTo) {
      router.replace(returnTo as Href);
      return;
    }
    router.dismissTo('/kyc');
  };

  const goAfterStart = () => {
    if (returnTo) {
      router.replace(returnTo as Href);
      return;
    }
    router.dismissTo('/kyc');
  };

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    const result = await start(toStartVerificationRequest(values));
    if ('data' in result && result.data) {
      toast.show({ type: 'success', title: 'Live verification started' });
      goAfterStart();
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
    } else if (isLivePhotoRejected(error) || error.code === 'KYC_SELFIE_REQUIRED') {
      setAlert({ tone: 'danger', message: kycErrorMessage(error), retakeSelfie: true });
    } else if (error.code === 'KYC_UPLOAD_NOT_ALLOWED') {
      setAlert({ tone: 'info', message: kycErrorMessage(error) });
      void progress.refetch();
    } else {
      setAlert({ tone: 'danger', message: kycErrorMessage(error) });
    }
  });

  if (progress.error && !progress.data) {
    return (
      <DesignKycShell
        onBack={goToHub}
        title="Start live verification"
        subtitle={toAppError(progress.error).message}
        centered
        footer={[{ label: 'Try again', onPress: () => void progress.refetch() }]}
      />
    );
  }

  if (!progress.data) {
    return (
      <DesignKycShell
        onBack={goToHub}
        title="Start live verification"
        subtitle="Loading…"
        centered
        testID="kyc-submit-loading"
      >
        <ActivityIndicator color={D.green} size="large" />
      </DesignKycShell>
    );
  }

  if (!canUpload(progress.data.status)) {
    return (
      <DesignKycShell
        onBack={goToHub}
        title="Start live verification"
        subtitle="Your verification has already been submitted. We'll show the result on the verification page."
        centered
        testID="kyc-submit-closed"
        footer={[{ label: 'Back', onPress: goToHub }]}
      />
    );
  }

  const ready = progress.data.hasDocument && progress.data.hasSelfie;

  return (
    <DesignKycShell
      onBack={goToHub}
      title="Start live verification"
      subtitle="Enter your name exactly as it appears on your document. We'll send your ID and live photo to ComplyCube for identity verification."
      footer={[
        {
          label: 'Start live verification',
          onPress: onSubmit,
          loading: isLoading,
          disabled: !ready,
          testID: 'kyc-submit',
        },
      ]}
    >
      {!progress.data.hasDocument ? (
        <View style={styles.alertBlock}>
          <Text style={styles.warn} testID="kyc-submit-no-document">
            Upload a photo of your identity document before submitting.
          </Text>
          <Pressable onPress={() => router.push('/kyc/document-type')}>
            <Text style={styles.link}>Add identity document</Text>
          </Pressable>
        </View>
      ) : null}
      {progress.data.hasDocument && !progress.data.hasSelfie ? (
        <View style={styles.alertBlock}>
          <Text style={styles.warn} testID="kyc-submit-no-selfie">
            A live photo of your face is required for identity verification.
          </Text>
          <Pressable onPress={() => router.push('/kyc/selfie')}>
            <Text style={styles.link}>Take a live photo</Text>
          </Pressable>
        </View>
      ) : null}

      {alert ? (
        <View style={styles.alertBlock}>
          <Text
            style={alert.tone === 'info' ? styles.info : styles.warn}
            testID="kyc-submit-alert"
            accessibilityRole="alert"
          >
            {alert.message}
          </Text>
          {alert.addDocument ? (
            <Pressable onPress={() => router.push('/kyc/document-type')}>
              <Text style={styles.link}>Add identity document</Text>
            </Pressable>
          ) : null}
          {alert.retakeSelfie ? (
            <Pressable onPress={() => router.push('/kyc/selfie')}>
              <Text style={styles.link}>Retake live photo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Controller
        control={control}
        name="firstName"
        render={({ field, fieldState }) => (
          <Field
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
          <Field
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
          <Field
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
          <Field
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
    </DesignKycShell>
  );
}

const styles = StyleSheet.create({
  alertBlock: { gap: 8 },
  field: { gap: 6 },
  label: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '700',
    color: D.secondary,
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: D.white,
    paddingHorizontal: 14,
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '600',
    color: D.ink,
  },
  inputError: {
    borderWidth: 2,
    borderColor: D.danger,
  },
  hint: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 14,
    fontWeight: '600',
    color: D.muted,
  },
  warn: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '700',
    color: D.danger,
    lineHeight: 22,
  },
  info: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '700',
    color: D.secondary,
    lineHeight: 22,
  },
  link: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '800',
    color: D.green,
  },
});

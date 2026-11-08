import { router, useLocalSearchParams, type Href } from 'expo-router';
import { CheckCircle2, IdCard } from 'lucide-react-native';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useGetKycProgressQuery } from '@/services/api/kycApi';

import { DesignKycShell } from '../components/DesignKycShell';
import { KYC_D as D } from '../components/designTokens';
import { KYC_DOCUMENT_TYPES } from '../kycState';
import { safeKycReturnTo } from '../returnTo';

export function DocumentTypeScreen() {
  const { returnTo: returnToParam } = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeKycReturnTo(returnToParam, '');
  const progress = useGetKycProgressQuery();
  const uploadedTypes = new Set(
    (progress.data?.documentTypes ?? []).map((type) => type.trim().toUpperCase()),
  );

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace((returnTo || '/kyc') as Href);
  };

  const pick = (type: string) => {
    router.push({
      pathname: '/kyc/document',
      params: returnTo ? { type, returnTo } : { type },
    } as Href);
  };

  return (
    <DesignKycShell
      onBack={onBack}
      title="Choose your document"
      subtitle="Use a valid, government-issued document that shows your photo."
      listenText="Choose your document. Use a valid, government-issued document that shows your photo."
    >
      {progress.isLoading && !progress.data ? (
        <View style={styles.loading} testID="doc-type-loading">
          <ActivityIndicator color={D.green} size="large" />
        </View>
      ) : (
        KYC_DOCUMENT_TYPES.map((type) => {
          const uploaded = uploadedTypes.has(type.value);
          return (
            <Pressable
              key={type.value}
              accessibilityRole="button"
              accessibilityLabel={
                uploaded
                  ? `${type.label}. Document uploaded. ${type.hint}`
                  : `${type.label}. ${type.hint}`
              }
              onPress={() => pick(type.value)}
              testID={`doc-type-${type.value}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.iconWrap}>
                <IdCard color={D.green} size={28} strokeWidth={2.2} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{type.label}</Text>
                {uploaded ? (
                  <View style={styles.uploadedRow}>
                    <CheckCircle2 color={D.green} size={16} strokeWidth={2.4} />
                    <Text style={styles.uploaded} testID={`doc-type-uploaded-${type.value}`}>
                      Document uploaded
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.hint}>{type.hint}</Text>
                )}
              </View>
              {uploaded ? (
                <CheckCircle2 color={D.green} size={24} strokeWidth={2.4} accessibilityLabel="Uploaded" />
              ) : null}
            </Pressable>
          );
        })
      )}
    </DesignKycShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 76,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: D.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { opacity: 0.88 },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 20,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 24,
  },
  hint: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '600',
    color: D.secondary,
    lineHeight: 21,
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploaded: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 15,
    fontWeight: '700',
    color: D.green,
  },
});

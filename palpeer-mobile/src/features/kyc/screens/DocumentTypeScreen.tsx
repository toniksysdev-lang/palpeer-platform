import { router } from 'expo-router';
import { CheckCircle2, ChevronRight, IdCard } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetKycProgressQuery } from '@/services/api/kycApi';

import { KYC_DOCUMENT_TYPES } from '../kycState';

export function DocumentTypeScreen() {
  const theme = useTheme();
  const progress = useGetKycProgressQuery();
  const uploadedTypes = new Set(
    (progress.data?.documentTypes ?? []).map((type) => type.trim().toUpperCase()),
  );

  return (
    <Screen scroll>
      <StackHeader />
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="h1" accessibilityRole="header">
          Choose your document
        </AppText>
        <AppText tone="secondary">
          Use a valid, government-issued document that shows your photo.
        </AppText>
      </View>
      {progress.isLoading && !progress.data ? (
        <View style={{ gap: theme.spacing.sm }} testID="doc-type-loading">
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {KYC_DOCUMENT_TYPES.map((type) => {
            const uploaded = uploadedTypes.has(type.value);
            return (
              <Card
                key={type.value}
                variant="outlined"
                padding="md"
                onPress={() =>
                  router.push({ pathname: '/kyc/document', params: { type: type.value } })
                }
                accessibilityLabel={
                  uploaded
                    ? `${type.label}. Document uploaded. ${type.hint}`
                    : `${type.label}. ${type.hint}`
                }
                testID={`doc-type-${type.value}`}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Icon icon={IdCard} color={theme.colors.primary} />
                  <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                    <AppText variant="bodyStrong">{type.label}</AppText>
                    {uploaded ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: theme.spacing.xs,
                        }}
                      >
                        <Icon icon={CheckCircle2} size="sm" color={theme.colors.success} />
                        <AppText
                          variant="caption"
                          style={{ color: theme.colors.success }}
                          testID={`doc-type-uploaded-${type.value}`}
                        >
                          Document uploaded
                        </AppText>
                      </View>
                    ) : (
                      <AppText variant="caption" tone="secondary">
                        {type.hint}
                      </AppText>
                    )}
                  </View>
                  {uploaded ? (
                    <Icon
                      icon={CheckCircle2}
                      color={theme.colors.success}
                      accessibilityLabel="Uploaded"
                    />
                  ) : (
                    <Icon icon={ChevronRight} color={theme.colors.textMuted} />
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

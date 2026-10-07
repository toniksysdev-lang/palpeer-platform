import { router } from 'expo-router';
import { ChevronRight, IdCard } from 'lucide-react-native';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';

import { KYC_DOCUMENT_TYPES } from '../kycState';

export function DocumentTypeScreen() {
  const theme = useTheme();
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
      <View style={{ gap: theme.spacing.sm }}>
        {KYC_DOCUMENT_TYPES.map((type) => (
          <Card
            key={type.value}
            variant="outlined"
            padding="md"
            onPress={() => router.push({ pathname: '/kyc/document', params: { type: type.value } })}
            accessibilityLabel={`${type.label}. ${type.hint}`}
            testID={`doc-type-${type.value}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Icon icon={IdCard} color={theme.colors.primary} />
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <AppText variant="bodyStrong">{type.label}</AppText>
                <AppText variant="caption" tone="secondary">
                  {type.hint}
                </AppText>
              </View>
              <Icon icon={ChevronRight} color={theme.colors.textMuted} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

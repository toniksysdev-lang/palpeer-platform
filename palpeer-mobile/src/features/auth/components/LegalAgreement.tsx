import { Linking, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { appConfig } from '@/config/env';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';

type Props = {
  prefix?: string;
  testID?: string;
};

/**
 * Terms / privacy line under auth CTAs. Links open configured HTTPS URLs when present.
 */
export function LegalAgreement({
  prefix = 'By proceeding you agree to our',
  testID = 'legal-agreement',
}: Props) {
  const theme = useTheme();
  const toast = useToast();
  const { termsUrl, privacyPolicyUrl } = appConfig.support;

  const open = async (url: string | null, label: string) => {
    if (!url) {
      toast.show({ type: 'info', title: `${label} is not available yet` });
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      toast.show({ type: 'error', title: `Couldn't open ${label}` });
    }
  };

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        columnGap: 4,
        rowGap: 2,
      }}
    >
      <AppText tone="secondary" variant="caption">
        {prefix}
      </AppText>
      <Pressable
        accessibilityRole="link"
        onPress={() => void open(termsUrl, 'Terms of use')}
        testID={`${testID}-terms`}
      >
        <AppText variant="caption" tone="info" style={{ textDecorationLine: 'underline' }}>
          Terms of use
        </AppText>
      </Pressable>
      <AppText tone="secondary" variant="caption">
        and
      </AppText>
      <Pressable
        accessibilityRole="link"
        onPress={() => void open(privacyPolicyUrl, 'Privacy Policy')}
        testID={`${testID}-privacy`}
      >
        <AppText variant="caption" tone="info" style={{ textDecorationLine: 'underline' }}>
          Privacy Policy
        </AppText>
      </Pressable>
    </View>
  );
}

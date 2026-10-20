import { Image, StyleSheet, View } from 'react-native';

import { PALPEER_LOGO_URI } from '@/components/brand/logo';

type Props = { width?: number };

/**
 * Official PALPEER logo lockup (same asset as the admin console).
 */
export function PalpeerLogo({ width = 180 }: Props) {
  const height = Math.round(width * 0.42);
  return (
    <View
      style={{ width, alignItems: 'center' }}
      accessibilityRole="image"
      accessibilityLabel="PALPEER"
    >
      <Image
        source={{ uri: PALPEER_LOGO_URI }}
        style={[styles.logo, { width, height }]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { maxWidth: '100%' },
});

import { Image, StyleSheet, View } from 'react-native';

import { PALPEER_LOGO } from '@/components/brand/logo';

type Props = { width?: number };

/**
 * Official PALPEER logo lockup (bundled asset).
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
        source={PALPEER_LOGO}
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

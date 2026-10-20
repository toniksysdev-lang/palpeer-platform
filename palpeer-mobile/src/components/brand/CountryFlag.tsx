import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';

type Props = {
  iso2: string;
  /** Optional emoji fallback when the image fails to load. */
  emoji?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Renders an ISO country flag as an image (works on web/Windows where emoji flags often fail).
 */
export function CountryFlag({ iso2, emoji, size = 24, style }: Props) {
  const code = iso2.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) {
    return (
      <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <AppText style={{ fontSize: size * 0.7, lineHeight: size }}>{emoji || '🏳️'}</AppText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <Image
        source={{ uri: `https://flagcdn.com/w80/${code}.png` }}
        accessibilityLabel={`${code.toUpperCase()} flag`}
        style={{ width: size * 0.85, height: size * 0.6, borderRadius: 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

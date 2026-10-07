import type { TextStyle } from 'react-native';

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: fontWeights.extrabold, letterSpacing: -0.5 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: fontWeights.bold, letterSpacing: -0.3 },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: fontWeights.semibold },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: fontWeights.semibold },
  body: { fontSize: 15, lineHeight: 22, fontWeight: fontWeights.regular },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: fontWeights.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: fontWeights.regular },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fontWeights.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  mono: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

export const shadows = {
  none: {},
  card: {
    shadowColor: '#07140F',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#07140F',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  pressScale: 0.97,
} as const;

export const touchTarget = 44;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

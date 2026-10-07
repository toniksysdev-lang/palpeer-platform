export const palette = {
  emerald50: '#E8F7F0',
  emerald100: '#C8EDDC',
  emerald200: '#95DCBD',
  emerald300: '#5BC89A',
  emerald400: '#2DB47E',
  emerald500: '#0E9F6E',
  emerald600: '#0A8259',
  emerald700: '#086647',
  emerald800: '#064D36',
  emerald900: '#043626',
  teal400: '#2DD4BF',
  teal500: '#14B8A6',
  teal600: '#0D9488',
  neutral0: '#FFFFFF',
  neutral25: '#FAFAFA',
  neutral50: '#F4F6F5',
  neutral100: '#E7EBE9',
  neutral200: '#D2D9D5',
  neutral300: '#AEB8B3',
  neutral400: '#86928C',
  neutral500: '#63706A',
  neutral600: '#47534D',
  neutral700: '#2F3934',
  neutral800: '#1B2420',
  neutral900: '#0F1714',
  neutral950: '#07140F',
  red500: '#E5484D',
  red600: '#CE2C31',
  amber500: '#F5A524',
  amber600: '#D48806',
  blue500: '#3B82F6',
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  gradientStart: string;
  gradientEnd: string;
  /** Hero surfaces such as the balance card: deep green into brand green. */
  heroStart: string;
  heroEnd: string;
};

export const lightColors: ThemeColors = {
  background: palette.neutral25,
  surface: palette.neutral0,
  surfaceElevated: palette.neutral0,
  surfaceMuted: palette.neutral50,
  border: palette.neutral100,
  borderStrong: palette.neutral200,
  textPrimary: palette.neutral900,
  textSecondary: palette.neutral600,
  textMuted: palette.neutral400,
  textInverse: palette.neutral0,
  primary: palette.emerald500,
  primaryPressed: palette.emerald600,
  primarySoft: palette.emerald50,
  onPrimary: palette.neutral0,
  accent: palette.teal500,
  success: palette.emerald600,
  successSoft: palette.emerald50,
  warning: palette.amber600,
  warningSoft: '#FEF4E2',
  danger: palette.red600,
  dangerSoft: '#FDECEC',
  info: palette.blue500,
  infoSoft: '#EAF2FE',
  overlay: 'rgba(7, 20, 15, 0.45)',
  gradientStart: palette.emerald600,
  gradientEnd: palette.teal500,
  heroStart: palette.emerald900,
  heroEnd: palette.emerald400,
};

export const darkColors: ThemeColors = {
  background: palette.neutral950,
  surface: palette.neutral900,
  surfaceElevated: palette.neutral800,
  surfaceMuted: '#12201A',
  border: '#1F2B26',
  borderStrong: palette.neutral700,
  textPrimary: '#F2F6F4',
  textSecondary: palette.neutral300,
  textMuted: palette.neutral500,
  textInverse: palette.neutral900,
  primary: palette.emerald400,
  primaryPressed: palette.emerald500,
  primarySoft: 'rgba(45, 180, 126, 0.14)',
  onPrimary: palette.neutral950,
  accent: palette.teal400,
  success: palette.emerald400,
  successSoft: 'rgba(45, 180, 126, 0.14)',
  warning: palette.amber500,
  warningSoft: 'rgba(245, 165, 36, 0.14)',
  danger: palette.red500,
  dangerSoft: 'rgba(229, 72, 77, 0.14)',
  info: '#60A5FA',
  infoSoft: 'rgba(96, 165, 250, 0.14)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  gradientStart: palette.emerald700,
  gradientEnd: palette.teal600,
  heroStart: palette.emerald900,
  heroEnd: palette.emerald600,
};

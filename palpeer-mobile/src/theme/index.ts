import { darkColors, lightColors, type ThemeColors } from './colors';
import { iconSize, motion, radius, shadows, spacing, touchTarget, typography } from './tokens';

export type ColorSchemeName = 'light' | 'dark';

export type Theme = {
  scheme: ColorSchemeName;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: typeof shadows;
  motion: typeof motion;
  touchTarget: typeof touchTarget;
  iconSize: typeof iconSize;
};

export function buildTheme(scheme: ColorSchemeName): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    shadows,
    motion,
    touchTarget,
    iconSize,
  };
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

/** Foreground/background pair for a semantic tone. */
export function toneColors(theme: Theme, tone: Tone): { fg: string; bg: string } {
  const c = theme.colors;
  switch (tone) {
    case 'success':
      return { fg: c.success, bg: c.successSoft };
    case 'warning':
      return { fg: c.warning, bg: c.warningSoft };
    case 'danger':
      return { fg: c.danger, bg: c.dangerSoft };
    case 'info':
      return { fg: c.info, bg: c.infoSoft };
    case 'primary':
      return { fg: c.primary, bg: c.primarySoft };
    case 'neutral':
      return { fg: c.textSecondary, bg: c.surfaceMuted };
  }
}

export { darkColors, lightColors, palette } from './colors';
export type { ThemeColors } from './colors';
export { iconSize, motion, radius, shadows, spacing, touchTarget, typography } from './tokens';

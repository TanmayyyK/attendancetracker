import { useColorScheme } from 'react-native';

import { palette, type ColorTokens } from './tokens';

export type Scheme = 'light' | 'dark';

export interface Theme {
  colors: ColorTokens;
  isDark: boolean;
  scheme: Scheme;
}

/**
 * Resolves the active palette. The app's identity is dark-first, so an
 * undetermined scheme resolves to dark; a device explicitly in light mode
 * still gets the coherent light palette.
 */
export function useTheme(): Theme {
  const system = useColorScheme();
  const isDark = system !== 'light';
  return {
    colors: isDark ? palette.dark : palette.light,
    isDark,
    scheme: isDark ? 'dark' : 'light',
  };
}

/** Status → semantic color, the one place attendance state maps to hue. */
export function zoneColor(colors: ColorTokens, percentage: number): string {
  if (percentage < 60) return colors.danger;
  if (percentage < 75) return colors.warning;
  return colors.success;
}

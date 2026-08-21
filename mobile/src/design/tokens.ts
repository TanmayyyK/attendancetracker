import { StyleSheet, type TextStyle } from 'react-native';

/**
 * Clinical Instrument — the single source of design truth.
 *
 * Everything visual in the app resolves to a token here: color, space, radius,
 * type, motion. No screen hardcodes a hex, a radius, or a magic pixel value.
 * The look is dark-first, near-black neutral canvas, hairline borders, and
 * numerals treated as the hero (JetBrains Mono, tabular). Violet is a brand
 * accent reserved for primary actions and focus — status is carried by
 * green / amber / red only.
 */

// ---------------------------------------------------------------------------
// Fonts — loaded in app/_layout.tsx via @expo-google-fonts.
// JetBrains Mono = numerals + labels (the hero of a data app). Headings and
// body prose use the platform system sans (SF on iOS / Roboto on Android),
// which renders crisp and even at display weights — a wide display face read
// as "stretched", so the native UI font carries the headings instead.
// ---------------------------------------------------------------------------
export const fonts = {
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

// ---------------------------------------------------------------------------
// Spacing — strict 4pt grid. Named by role, never by raw number at call sites.
// ---------------------------------------------------------------------------
export const space = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
} as const;

/** Non-component dimensions shared by screen layouts. */
export const layout = {
  stickyCtaClearance: 128,
} as const;

// Horizontal gutter every screen shares — keeps content on one vertical rhythm.
export const GUTTER = space.xl; // 20

// ---------------------------------------------------------------------------
// Radii — one restrained scale. No 28 / 32 / arbitrary rounding.
// ---------------------------------------------------------------------------
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Color — two coherent palettes, identical semantic keys.
// ---------------------------------------------------------------------------
export type ColorTokens = {
  canvas: string;
  surface: string;
  surfaceElevated: string;
  surfacePressed: string;
  hairline: string;
  hairlineStrong: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;

  accent: string;
  accentPressed: string;
  accentOn: string;
  accentSubtle: string;
  accentBorder: string;
  dangerOn: string;

  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  danger: string;
  dangerSubtle: string;

  overlay: string;
  skeleton: string;
  skeletonSheen: string;
};

export const palette: { dark: ColorTokens; light: ColorTokens } = {
  dark: {
    canvas: '#0A0B0F',
    surface: '#14161D',
    surfaceElevated: '#1B1E27',
    surfacePressed: '#20242F',
    hairline: 'rgba(255,255,255,0.08)',
    hairlineStrong: 'rgba(255,255,255,0.14)',

    textPrimary: '#F3F4F6',
    textSecondary: '#A1A7B3',
    textMuted: '#6C7280',
    textFaint: '#4A4F5C',

    accent: '#8B5CF6',
    accentPressed: '#7C3AED',
    accentOn: '#FFFFFF',
    accentSubtle: 'rgba(139,92,246,0.14)',
    accentBorder: 'rgba(139,92,246,0.34)',
    dangerOn: '#FFFFFF',

    success: '#34D399',
    successSubtle: 'rgba(52,211,153,0.13)',
    warning: '#FBBF24',
    warningSubtle: 'rgba(251,191,36,0.13)',
    danger: '#F87171',
    dangerSubtle: 'rgba(248,113,113,0.13)',

    overlay: 'rgba(0,0,0,0.62)',
    skeleton: 'rgba(255,255,255,0.05)',
    skeletonSheen: 'rgba(255,255,255,0.07)',
  },
  light: {
    canvas: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfacePressed: '#EEF0F3',
    hairline: 'rgba(17,20,28,0.08)',
    hairlineStrong: 'rgba(17,20,28,0.14)',

    textPrimary: '#0F1117',
    textSecondary: '#565D6B',
    textMuted: '#868D9B',
    textFaint: '#AAB0BC',

    accent: '#7C3AED',
    accentPressed: '#6D28D9',
    accentOn: '#FFFFFF',
    accentSubtle: 'rgba(124,58,237,0.10)',
    accentBorder: 'rgba(124,58,237,0.24)',
    dangerOn: '#FFFFFF',

    success: '#059669',
    successSubtle: 'rgba(5,150,105,0.10)',
    warning: '#D97706',
    warningSubtle: 'rgba(217,119,6,0.10)',
    danger: '#DC2626',
    dangerSubtle: 'rgba(220,38,38,0.10)',

    overlay: 'rgba(15,17,23,0.35)',
    skeleton: 'rgba(17,20,28,0.05)',
    skeletonSheen: 'rgba(17,20,28,0.07)',
  },
};

// ---------------------------------------------------------------------------
// Elevation — used sparingly (sheets, sticky bars). Cards define depth with
// hairlines, not shadows. Dark shadows stay near-invisible by design.
// ---------------------------------------------------------------------------
export function shadow(level: 'sm' | 'md' | 'lg', isDark: boolean) {
  const map = {
    sm: { radius: 8, y: 3, opacityDark: 0.3, opacityLight: 0.06, elevation: 2 },
    md: { radius: 16, y: 8, opacityDark: 0.4, opacityLight: 0.1, elevation: 6 },
    lg: { radius: 28, y: 16, opacityDark: 0.5, opacityLight: 0.16, elevation: 14 },
  }[level];
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: map.y },
    shadowOpacity: isDark ? map.opacityDark : map.opacityLight,
    shadowRadius: map.radius,
    elevation: map.elevation,
  };
}

// ---------------------------------------------------------------------------
// Motion — snappy springs, fast timings. No slow linear fades, no idle loops.
// ---------------------------------------------------------------------------
export const motion = {
  spring: { damping: 18, stiffness: 240, mass: 0.9 },
  springSnappy: { damping: 20, stiffness: 340, mass: 0.8 },
  springSoft: { damping: 22, stiffness: 160, mass: 1 },
  timing: { fast: 150, base: 220, slow: 360, enter: 400, progress: 900, metric: 1100, skeleton: 1150 },
} as const;

// ---------------------------------------------------------------------------
// Type — color-agnostic presets. Pair with a color from useTheme().colors.
// tabular-nums keeps metrics from reflowing while counting up.
// ---------------------------------------------------------------------------
const tabular = ['tabular-nums'] as TextStyle['fontVariant'];

export const type = StyleSheet.create({
  // Numerals — JetBrains Mono, the hero of a data app.
  metricHero: { fontFamily: fonts.monoBold, fontSize: 52, lineHeight: 56, letterSpacing: -1.5, fontVariant: tabular },
  metricLg: { fontFamily: fonts.monoBold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, fontVariant: tabular },
  metricMd: { fontFamily: fonts.monoMedium, fontSize: 18, lineHeight: 22, letterSpacing: -0.2, fontVariant: tabular },
  metricSm: { fontFamily: fonts.monoMedium, fontSize: 14, lineHeight: 18, fontVariant: tabular },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, fontVariant: tabular },

  // Display headings — platform system sans at heavy weight, tight tracking.
  // SF / Roboto stay optically even here; a wide display face read as
  // "stretched", so headings deliberately ride the native UI font.
  h1: { fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontWeight: '800' },
  h2: { fontSize: 20, lineHeight: 26, letterSpacing: -0.4, fontWeight: '700' },
  h3: { fontSize: 16, lineHeight: 22, letterSpacing: -0.3, fontWeight: '700' },

  // Eyebrow / micro-label — mono, uppercase, tracked wide.
  eyebrow: { fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: 14, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Body prose — system sans, crisp per platform.
  body: { fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  bodySm: { fontSize: 13, lineHeight: 18 },
  bodySmMedium: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '600' },
});

// Standard Lucide icon stroke — consistency across the whole app.
export const ICON_STROKE = 2;

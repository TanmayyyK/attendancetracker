import { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

import { radius, space, shadow } from '@/design/tokens';
import { useTheme } from '@/design/theme';

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Inner padding. Defaults to 16 (space.lg). Pass 0 for edge-to-edge content. */
  padding?: number;
  /** Raised surface + a soft shadow. Use for sheets and sticky bars, not lists. */
  elevated?: boolean;
  /** Draws a 3px status rule down the left edge (e.g. notification state). */
  accentColor?: string;
}

/**
 * The workhorse surface. Solid fill + 1px hairline border, one restrained
 * radius. Replaces the old glassmorphism card entirely — definition comes from
 * the hairline, not blur.
 */
export function Card({ children, style, padding = space.lg, elevated = false, accentColor }: CardProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.hairline,
          padding,
        },
        elevated && shadow('md', isDark),
        style,
      ]}
    >
      {accentColor ? <View style={[styles.accentRule, { backgroundColor: accentColor }]} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentRule: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
});

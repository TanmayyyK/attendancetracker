/**
 * Subject Intelligence Badge Component
 *
 * Displays a compact status chip for subject attendance:
 * - "No data" (neutral)
 * - "Safe to miss N" (success)
 * - "On boundary" (warning)
 * - "Need N classes" (danger)
 * - "Unreachable" / "Exceeds limit" / "Invalid data" (danger)
 */

import { View, StyleSheet, type ViewStyle } from 'react-native';

import { radius, space, type } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { AppText } from '@/components/ui/Text';
import type { SubjectIntelligenceItem } from '@/types/attendanceIntelligence';
import { resolveBadgeDisplay, type BadgeDisplayModel } from '@/utils/badgePolicy';

export { resolveBadgeDisplay, type BadgeDisplayModel };

export interface SubjectIntelligenceBadgeProps {
  item: SubjectIntelligenceItem;
  style?: ViewStyle;
}

export function SubjectIntelligenceBadge({ item, style }: SubjectIntelligenceBadgeProps) {
  const { colors } = useTheme();
  const { label, tone, accessibilityLabel } = resolveBadgeDisplay(item);

  const toneConfig = {
    neutral: {
      color: colors.textMuted,
      bg: colors.surfaceElevated,
      border: colors.hairline,
    },
    success: {
      color: colors.success,
      bg: colors.successSubtle,
      border: colors.hairline,
    },
    warning: {
      color: colors.warning,
      bg: colors.warningSubtle,
      border: colors.hairline,
    },
    danger: {
      color: colors.danger,
      bg: colors.dangerSubtle,
      border: colors.hairline,
    },
  }[tone];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: toneConfig.bg, borderColor: toneConfig.border },
        style,
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.dot, { backgroundColor: toneConfig.color }]} />
      <AppText style={[type.bodySmMedium, { color: toneConfig.color }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
});

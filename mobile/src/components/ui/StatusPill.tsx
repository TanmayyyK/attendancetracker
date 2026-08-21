import { View, StyleSheet, type ViewStyle } from 'react-native';

import { radius, space, type } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { AppText } from './Text';

export interface StatusPillProps {
  status: 'Present' | 'Absent';
  style?: ViewStyle;
}

/** A compact status tag: a filled dot + label, tinted by semantic color. */
export function StatusPill({ status, style }: StatusPillProps) {
  const { colors } = useTheme();
  const isPresent = status === 'Present';
  const color = isPresent ? colors.success : colors.danger;
  const bg = isPresent ? colors.successSubtle : colors.dangerSubtle;

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: colors.hairline }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText style={[type.bodySmMedium, { color }]}>{status}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
});

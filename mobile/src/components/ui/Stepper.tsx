import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Minus, Plus } from 'lucide-react-native';

import { radius, space, motion, type, ICON_STROKE } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { AppText } from './Text';

export interface StepperProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  tone: 'success' | 'danger';
}

/** A tinted +/- counter with 44pt targets and a spring bump on value change. */
export function Stepper({ value, onIncrement, onDecrement, tone }: StepperProps) {
  const { colors } = useTheme();
  const color = tone === 'success' ? colors.success : colors.danger;
  const bg = tone === 'success' ? colors.successSubtle : colors.dangerSubtle;

  const bump = useSharedValue(1);
  useEffect(() => {
    bump.value = withSpring(1.18, motion.springSnappy, () => {
      bump.value = withSpring(1, motion.springSnappy);
    });
  }, [value, bump]);

  const valueStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: colors.hairline }]}>
      <Pressable
        onPress={onDecrement}
        hitSlop={6}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
      >
        <Minus size={18} color={color} strokeWidth={ICON_STROKE} style={value === 0 ? styles.dim : undefined} />
      </Pressable>

      <View style={styles.valueWrap}>
        <Animated.View style={valueStyle}>
          <AppText style={[type.metricMd, { color }]}>{value}</AppText>
        </Animated.View>
      </View>

      <Pressable
        onPress={onIncrement}
        hitSlop={6}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Increase"
      >
        <Plus size={18} color={color} strokeWidth={ICON_STROKE} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    height: 48,
    paddingHorizontal: space.xs,
  },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  valueWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
});

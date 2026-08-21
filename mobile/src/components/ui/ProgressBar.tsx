import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion, radius } from '@/design/tokens';
import { useTheme } from '@/design/theme';

interface ProgressBarProps {
  progress: number; // 0..100
  color: string;
  trackColor?: string;
  height?: number;
}

/** A flat, animated track fill. No glow, no shadow — just a clean bar. */
export function ProgressBar({ progress, color, trackColor, height = 6 }: ProgressBarProps) {
  const { colors } = useTheme();
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withTiming(Math.max(0, Math.min(100, progress)), {
      duration: motion.timing.progress,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value}%` }));

  return (
    <View style={[styles.track, { backgroundColor: trackColor ?? colors.hairlineStrong, height, borderRadius: radius.pill }]}>
      <Animated.View style={[fillStyle, { backgroundColor: color, height, borderRadius: radius.pill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});

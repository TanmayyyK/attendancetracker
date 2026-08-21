import { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { fonts, motion } from '@/design/tokens';
import { useTheme, zoneColor } from '@/design/theme';
import { AppText } from './Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  style?: ViewStyle;
}

/** Circular gauge. Track is a hairline; the arc + centred numeral share the zone color. */
export function ProgressRing({ percentage, size = 56, strokeWidth = 4, showLabel = true, style }: ProgressRingProps) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const color = zoneColor(colors, percentage);

  const offset = useSharedValue(circumference);
  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, percentage));
    offset.value = withTiming(circumference - (clamped / 100) * circumference, { duration: motion.timing.progress });
  }, [percentage, circumference, offset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.hairlineStrong} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showLabel ? (
        <View style={[StyleSheet.absoluteFillObject, styles.center]}>
          <AppText
            color={colors.textPrimary}
            style={{ fontFamily: fonts.monoBold, fontSize: size * 0.26, letterSpacing: -0.5 }}
          >
            {Math.round(percentage)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center' },
  center: { justifyContent: 'center', alignItems: 'center' },
});

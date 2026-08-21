import { useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle, type LayoutChangeEvent, type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { motion, radius as R } from '@/design/tokens';
import { useTheme } from '@/design/theme';

export interface ShimmerPlaceholderProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A skeleton block with a sweeping sheen. Compose these to mirror final geometry. */
export function ShimmerPlaceholder({ width = '100%', height = 20, borderRadius = R.sm, style }: ShimmerPlaceholderProps) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    if (measured && measured !== w) {
      setW(measured);
      x.value = 0;
      x.value = withRepeat(withTiming(1, { duration: motion.timing.skeleton, easing: Easing.inOut(Easing.ease) }), -1, false);
    }
  };

  const sheenW = Math.max(w * 0.5, 60);
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -sheenW + x.value * (w + sheenW) }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={[{ width, height, borderRadius, backgroundColor: colors.skeleton, overflow: 'hidden' }, style]}
    >
      {w > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, { width: sheenW }, sheenStyle]}>
          <LinearGradient
            colors={['transparent', colors.skeletonSheen, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export const ShimmerCard = (props: ShimmerPlaceholderProps) => (
  <ShimmerPlaceholder {...props} height={props.height ?? 120} borderRadius={props.borderRadius ?? R.md} />
);
export const ShimmerLine = (props: ShimmerPlaceholderProps) => (
  <ShimmerPlaceholder {...props} height={props.height ?? 14} borderRadius={props.borderRadius ?? R.sm} />
);
export const ShimmerCircle = ({ size = 40, ...props }: ShimmerPlaceholderProps & { size?: number }) => (
  <ShimmerPlaceholder {...props} width={size} height={size} borderRadius={size / 2} />
);

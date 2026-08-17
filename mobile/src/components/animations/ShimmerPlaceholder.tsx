import React, { useEffect } from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export interface ShimmerPlaceholderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const ShimmerPlaceholder: React.FC<ShimmerPlaceholderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const translateX = useSharedValue(-100);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(100, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: `${translateX.value}%` as any }],
    };
  });

  return (
    <View
      style={[
        styles.base,
        { width: width as any, height, borderRadius },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.highlight, animatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  highlight: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    width: '100%',
    height: '100%',
  },
});

export const ShimmerCard: React.FC<ShimmerPlaceholderProps> = (props) => (
  <ShimmerPlaceholder {...props} height={props.height ?? 120} borderRadius={props.borderRadius ?? 20} />
);

export const ShimmerLine: React.FC<ShimmerPlaceholderProps> = (props) => (
  <ShimmerPlaceholder {...props} height={props.height ?? 16} borderRadius={props.borderRadius ?? 8} />
);

export const ShimmerCircle: React.FC<ShimmerPlaceholderProps & { size?: number }> = ({ size = 40, ...props }) => (
  <ShimmerPlaceholder {...props} width={size} height={size} borderRadius={size / 2} />
);


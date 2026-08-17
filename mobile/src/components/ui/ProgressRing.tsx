import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Text, useColorScheme } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  style?: ViewStyle;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  percentage,
  size = 48,
  strokeWidth = 4,
  style,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const progressValue = useSharedValue(circumference);

  useEffect(() => {
    const validPercentage = Math.max(0, Math.min(100, percentage));
    const targetOffset = circumference - (validPercentage / 100) * circumference;
    // Animate progress on mount and when percentage changes
    progressValue.value = withTiming(targetOffset, { duration: 1000 });
  }, [percentage, circumference, progressValue]);

  const animatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: progressValue.value,
    };
  });

  const getProgressColor = () => {
    if (percentage < 60) return '#EF4444'; // Red
    if (percentage < 75) return '#EAB308'; // Amber
    return '#22C55E'; // Green
  };

  const bgColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getProgressColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/* Centered percentage text */}
      <View style={[StyleSheet.absoluteFillObject, styles.textContainer]}>
        <Text style={[styles.text, { color: textColor, fontSize: size * 0.28 }]}>
          {Math.round(percentage)}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: 'bold',
  },
});

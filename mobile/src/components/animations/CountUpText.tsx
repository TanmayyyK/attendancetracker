import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import {
  useSharedValue,
  withTiming,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

export interface CountUpTextProps {
  value: number;
  duration?: number;
  decimals?: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
  prefix?: string;
}

export const CountUpText: React.FC<CountUpTextProps> = ({
  value,
  duration = 1200,
  decimals = 1,
  style,
  suffix = '',
  prefix = '',
}) => {
  const animatedValue = useSharedValue(0);
  const [displayText, setDisplayText] = useState(`${prefix}0${suffix}`);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration });
  }, [value, duration]);

  useAnimatedReaction(
    () => animatedValue.value,
    (currentValue) => {
      const formatted = currentValue.toFixed(decimals);
      runOnJS(setDisplayText)(`${prefix}${formatted}${suffix}`);
    },
    [decimals, prefix, suffix]
  );

  return <Text style={style}>{displayText}</Text>;
};

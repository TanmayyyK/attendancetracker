import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, useColorScheme } from 'react-native';
import Animated, { 
  FadeIn, 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withSequence, 
  withTiming 
} from 'react-native-reanimated';

export interface StatusPillProps {
  status: 'Present' | 'Absent';
  style?: ViewStyle;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, style }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isPresent = status === 'Present';
  
  const glowOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (isPresent) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.4, { duration: 800 })
        ),
        -1,
        true // Reverse animation direction for smooth pulse
      );
    }
  }, [isPresent, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  const bgColor = isPresent ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
  const textColor = isPresent ? '#22C55E' : '#EF4444';
  const glowColor = isPresent ? 'rgba(34,197,94,0.4)' : 'transparent';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  return (
    <Animated.View 
      entering={FadeIn.springify()} 
      style={[styles.container, style]}
    >
      {/* Outer pulsing glow for 'Present' */}
      {isPresent && (
        <Animated.View 
          style={[
            StyleSheet.absoluteFillObject, 
            styles.glow, 
            { backgroundColor: glowColor },
            glowStyle
          ]} 
        />
      )}
      
      {/* Main Pill */}
      <View style={[styles.pill, { backgroundColor: bgColor, borderColor }]}>
        <Text style={[styles.text, { color: textColor }]}>
          {status}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  glow: {
    borderRadius: 20,
    transform: [{ scale: 1.15 }],
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: {
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.3,
  }
});

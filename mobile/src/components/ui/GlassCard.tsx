import React from 'react';
import { View, StyleSheet, ViewStyle, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';

export interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  accentColor?: string;
  animated?: boolean;
  delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 20,
  tint,
  accentColor, // Useful if you want to add a subtle colored border or accent later
  animated = true,
  delay = 0,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const defaultTint = isDark ? 'dark' : 'light';
  const resolvedTint = tint || defaultTint;

  const containerStyle: ViewStyle = {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: accentColor || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
  };

  const content = (
    <View style={[containerStyle, style]}>
      {/* 
        The BlurView is absolutely positioned behind the content.
        For Expo Go on Android where BlurView might act up, a fallback can be 
        applied, but expo-blur usually works well when positioned like this.
      */}
      <BlurView intensity={intensity} tint={resolvedTint} style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );

  if (animated) {
    return (
      <Animated.View entering={FadeInDown.delay(delay).springify()}>
        {content}
      </Animated.View>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
  }
});

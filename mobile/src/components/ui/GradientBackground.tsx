import React from 'react';
import { View, StyleSheet, ViewStyle, useColorScheme, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

const { width, height: screenHeight } = Dimensions.get('window');

export const GradientBackground: React.FC<GradientBackgroundProps> = ({ children, style }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const gradientColors = isDark 
    ? (['#030712', '#081026', '#030712'] as const) // Deeper Pitch Black & Midnight Navy
    : (['#FFFFFF', '#F8FAFC', '#F1F5F9'] as const); // Crisp, Pearl White

  const violetBlobColor = isDark ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.15)';
  const cyanBlobColor = isDark ? 'rgba(6,182,212,0.3)' : 'rgba(6,182,212,0.1)';

  return (
    <View style={[styles.container, style]}>
      {/* Base Dark/Light Layer */}
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Mesh Color Blobs */}
      <View style={[styles.blob, styles.violetBlob, { backgroundColor: violetBlobColor }]} />
      <View style={[styles.blob, styles.cyanBlob, { backgroundColor: cyanBlobColor }]} />
      
      {/* Heavy Frosting layer to create true Mesh Gradient effect */}
      <BlurView
        intensity={isDark ? 100 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Main Content */}
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999, // Perfect circle
  },
  violetBlob: {
    width: width * 1.5,
    height: width * 1.5,
    top: -width * 0.5,
    right: -width * 0.5,
  },
  cyanBlob: {
    width: width * 1.8,
    height: width * 1.8,
    bottom: -width * 0.6,
    left: -width * 0.6,
  }
});

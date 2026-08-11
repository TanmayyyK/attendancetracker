import React, { useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Theme } from '../theme';

interface AnimeButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger';
}

export const AnimeButton: React.FC<AnimeButtonProps> = ({ title, onPress, style, textStyle, icon, variant = 'primary' }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const isDanger = variant === 'danger';
  
  const accentColor = isDanger ? Theme.colors.accentRed : Theme.colors.accentGlow;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.98,
      duration: Theme.animation.animeSnap.duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: Theme.animation.animeSnap.duration,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          pressed && { backgroundColor: accentColor, borderColor: accentColor },
        ]}
      >
        {({ pressed }) => (
          <>
            {icon}
            <Text style={[
              styles.text, 
              textStyle,
              pressed && { color: Theme.colors.bgPrimary }
            ]}>
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    ...Theme.paperStack,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: Theme.colors.textPrimary,
    fontFamily: Theme.typography.fontFamily.display,
    fontSize: Theme.typography.sizes.base,
    letterSpacing: Theme.typography.letterSpacing.widest,
    textTransform: 'uppercase',
  },
});

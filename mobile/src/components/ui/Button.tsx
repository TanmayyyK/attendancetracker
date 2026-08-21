import { type ReactNode } from 'react';
import { Pressable, StyleSheet, ActivityIndicator, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { radius, space, motion, type } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { AppText } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const inert = disabled || loading;

  const fills: Record<Variant, { bg: string; bgPressed: string; border: string; label: string }> = {
    primary: { bg: colors.accent, bgPressed: colors.accentPressed, border: 'transparent', label: colors.accentOn },
    secondary: { bg: colors.surface, bgPressed: colors.surfacePressed, border: colors.hairlineStrong, label: colors.textPrimary },
    ghost: { bg: 'transparent', bgPressed: colors.accentSubtle, border: 'transparent', label: colors.accent },
    danger: { bg: colors.danger, bgPressed: colors.danger, border: 'transparent', label: colors.dangerOn },
  };
  const v = fills[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: pressed.value ? v.bgPressed : v.bg,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      disabled={inert}
      onPressIn={() => {
        scale.value = withSpring(0.97, motion.springSnappy);
        pressed.value = 1;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.springSnappy);
        pressed.value = 0;
      }}
      onPress={onPress}
      style={[
        styles.base,
        { height: size === 'lg' ? 52 : 44, borderColor: v.border },
        fullWidth && styles.fullWidth,
        inert && !loading && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.label} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon}
          <AppText style={[type.label, styles.label, { color: v.label }]}>{title}</AppText>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.4 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontSize: 15, letterSpacing: 0.2 },
});

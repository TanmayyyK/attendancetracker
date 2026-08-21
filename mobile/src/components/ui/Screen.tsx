import { type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/design/theme';

export interface ScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  /** Apply the top safe-area inset as padding. Screens own their own scroll. */
  topInset?: boolean;
}

/**
 * The app canvas. A solid near-black (or pearl) surface — no decorative
 * gradients, no blur, no mesh blobs. Depth comes from content, not the
 * background.
 */
export function Screen({ children, style, topInset = true }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }, style]}>
      <View style={[styles.content, topInset && { paddingTop: insets.top }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});

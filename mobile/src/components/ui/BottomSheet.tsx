import { type ReactNode } from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { AppText } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

/** A slide-up sheet: dimmed backdrop, grab handle, safe-area aware, hairline top. */
export function BottomSheet({ visible, onClose, title, subtitle, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.hairline,
              paddingBottom: Math.max(insets.bottom, space.xl),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.hairlineStrong }]} />
          {title ? (
            <View style={styles.header}>
              <AppText variant="h2">{title}</AppText>
              {subtitle ? (
                <AppText variant="bodySm" tone="muted" style={styles.subtitle}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: space.xl,
  },
  header: { marginBottom: space.xl },
  subtitle: { marginTop: space.xs },
});

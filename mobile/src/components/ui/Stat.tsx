import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { space } from '@/design/tokens';
import { AppText } from './Text';

export interface StatProps {
  label: string;
  /** The metric value node — pass a CountUpText or AppText so callers control animation. */
  children: ReactNode;
  align?: 'center' | 'flex-start';
}

/** A single labelled metric: eyebrow label above a mono value. */
export function Stat({ label, children, align = 'center' }: StatProps) {
  return (
    <View style={[styles.col, { alignItems: align }]}>
      <AppText variant="eyebrow" tone="muted" style={styles.label}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, gap: space.sm },
  label: {},
});

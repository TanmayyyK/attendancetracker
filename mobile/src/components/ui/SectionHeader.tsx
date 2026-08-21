import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { space } from '@/design/tokens';
import { AppText } from './Text';

export interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  /** Optional trailing element (a count, an action) aligned to the baseline. */
  trailing?: ReactNode;
}

/** A titled section boundary. Eyebrow (mono, tracked) sits above a display title. */
export function SectionHeader({ title, eyebrow, trailing }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        {eyebrow ? (
          <AppText variant="eyebrow" tone="muted" style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="h2">{title}</AppText>
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  textCol: { flex: 1 },
  eyebrow: { marginBottom: space.xs },
});

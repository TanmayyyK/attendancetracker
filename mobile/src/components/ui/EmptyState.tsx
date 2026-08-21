import { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { space, radius } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { AppText } from './Text';
import { Button } from './Button';

export interface EmptyStateProps {
  /** A Lucide icon element, e.g. <SearchX ... />. */
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}

/**
 * Context-aware empty state — never a bare "No Data". A framed icon, a real
 * headline, a sentence of guidance, and (optionally) a way out.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconFrame, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        {icon}
      </View>
      <AppText variant="h3" align="center" style={styles.title}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodySm" tone="muted" align="center" style={styles.description}>
          {description}
        </AppText>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Button title={action.label} variant="secondary" size="md" fullWidth={false} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.giant,
    paddingHorizontal: space.xxl,
  },
  iconFrame: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  title: { marginBottom: space.xs },
  description: { maxWidth: 280 },
  action: { marginTop: space.xl },
});

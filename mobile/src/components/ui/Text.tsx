import { Text, type TextProps, type TextStyle } from 'react-native';

import { type } from '@/design/tokens';
import { useTheme } from '@/design/theme';

type Variant = keyof typeof type;
type Tone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'onAccent';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /** Explicit color wins over `tone`. */
  color?: string;
  align?: TextStyle['textAlign'];
}

/**
 * The only Text you should reach for. Enforces the type scale and resolves
 * color from the active palette, so no screen re-derives text colors.
 */
export function AppText({ variant = 'body', tone = 'primary', color, align, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();

  const toneColor: Record<Tone, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    faint: colors.textFaint,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    onAccent: colors.accentOn,
  };

  return (
    <Text
      style={[type[variant], { color: color ?? toneColor[tone] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}

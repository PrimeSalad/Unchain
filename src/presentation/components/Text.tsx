import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

type Variant = keyof typeof type;

interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
  dim?: boolean;
}

/** Typed, theme-aware text. Uses the rounded display family from tokens. */
export function Text({ variant = 'body', color, dim, center, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        type[variant],
        { color: color ?? (dim ? theme.color.textDim : theme.color.text) },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

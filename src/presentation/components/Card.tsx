import { View, type ViewStyle, type ViewProps } from 'react-native';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps extends ViewProps {
  raised?: boolean;
  tone?: 'surface' | 'primarySoft' | 'accentSoft' | 'celebrateSoft' | 'successSoft';
  padding?: number;
  style?: ViewStyle;
}

/** Grouped card - 20pt radius, soft e1 elevation (or lightened surface in dark). */
export function Card({ raised, tone = 'surface', padding = spacing.lg, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  const bg =
    tone === 'surface'
      ? theme.color.surface
      : tone === 'primarySoft'
        ? theme.color.primarySoft
        : tone === 'accentSoft'
          ? theme.color.accentSoft
          : tone === 'celebrateSoft'
            ? theme.color.celebrateSoft
            : theme.color.successSoft;

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.card,
          padding,
        },
        theme.mode === 'light' && (raised ? elevation.e2 : elevation.e1),
        style,
      ]}
    >
      {children}
    </View>
  );
}

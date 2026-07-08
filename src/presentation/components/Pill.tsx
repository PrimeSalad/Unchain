import { Pressable } from 'react-native';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

/** Selectable chip (habit switcher, mood chips, HALT states). */
export function Pill({ label, active, onPress }: PillProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.round,
        backgroundColor: active ? theme.color.primary : theme.color.surfaceAlt,
      }}
    >
      <Text variant="callout" color={active ? theme.color.onPrimary : theme.color.text}>
        {label}
      </Text>
    </Pressable>
  );
}

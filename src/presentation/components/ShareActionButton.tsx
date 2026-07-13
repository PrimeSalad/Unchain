import { Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type ShareActionKind = 'primary' | 'secondary';

interface ShareActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  kind?: ShareActionKind;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}

export function ShareActionButton({
  icon,
  label,
  onPress,
  accessibilityLabel,
  kind = 'primary',
  disabled,
  busy,
  style,
}: ShareActionButtonProps) {
  const theme = useTheme();
  const primary = kind === 'primary';
  const bg = primary ? theme.color.primary : theme.color.surfaceAlt;
  const fg = primary ? theme.color.onPrimary : theme.color.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        {
          minHeight: 54,
          borderRadius: radius.button,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          opacity: disabled ? 0.5 : pressed ? 0.86 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={20} color={fg} />
      <Text variant="headline" color={fg} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
        {label}
      </Text>
    </Pressable>
  );
}

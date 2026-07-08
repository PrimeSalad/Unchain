import { useCallback } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Kind = 'primary' | 'secondary' | 'tertiary' | 'destructive';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  kind?: Kind;
  disabled?: boolean;
  full?: boolean;
  style?: ViewStyle;
}

/**
 * iOS-native button. Filled primary, tinted secondary, plain text tertiary,
 * text-red destructive. Subtle opacity/scale on press — no playful 3D. One
 * primary per screen.
 */
export function Button({ label, onPress, kind = 'primary', disabled, full, style }: ButtonProps) {
  const theme = useTheme();
  const press = useSharedValue(0);

  const anim = useAnimatedStyle(() => ({
    opacity: 1 - press.value * 0.25,
    transform: [{ scale: 1 - press.value * 0.02 }],
  }));

  const onIn = useCallback(() => (press.value = withTiming(1, { duration: 80 })), [press]);
  const onOut = useCallback(() => (press.value = withTiming(0, { duration: 120 })), [press]);
  const handle = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  }, [disabled, onPress]);

  const c = theme.color;
  const tone: Record<Kind, { bg: string; text: string }> = {
    primary: { bg: c.primary, text: c.onPrimary },
    secondary: { bg: c.primarySoft, text: c.primary },
    tertiary: { bg: 'transparent', text: c.primary },
    destructive: { bg: 'transparent', text: c.danger },
  };
  const t = tone[kind];

  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={handle}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[full && { alignSelf: 'stretch' }, style]}
    >
      <Animated.View
        style={[
          {
            height: 50,
            minWidth: 100,
            paddingHorizontal: spacing.xl,
            borderRadius: radius.button,
            backgroundColor: t.bg,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.35 : 1,
          },
          anim,
        ]}
      >
        <Text style={[type.headline, { color: t.text }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

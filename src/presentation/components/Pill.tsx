import { useCallback } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius, spacing, motion } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  emoji?: string;
}

/**
 * Selectable chip — animated scale + colour spring on press.
 * Larger tap target (minimum 44pt), smooth active/inactive transitions.
 */
export function Pill({ label, active, onPress, emoji }: PillProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.94 : 1, motion.spring) }],
    opacity: withTiming(pressed.value ? 0.85 : 1, { duration: 80 }),
  }));

  const onIn  = useCallback(() => { pressed.value = 1; }, [pressed]);
  const onOut = useCallback(() => { pressed.value = 0; }, [pressed]);
  const handle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
  }, [onPress]);

  const bg   = active ? theme.color.primary : theme.color.surfaceAlt;
  const fg   = active ? theme.color.onPrimary : theme.color.text;

  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={handle}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={4}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm + 3,
            borderRadius: radius.round,
            backgroundColor: bg,
            // Active glow
            ...(active && {
              shadowColor: theme.color.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 4,
            }),
          },
          animStyle,
        ]}
      >
        {emoji ? (
          <Text style={{ fontSize: 14, lineHeight: 18 }}>{emoji}</Text>
        ) : null}
        <Text
          variant="callout"
          color={fg}
          style={{ fontFamily: 'Nunito_700Bold' }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

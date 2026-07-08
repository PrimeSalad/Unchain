import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface HoldButtonProps {
  label: string;
  onComplete: () => void;
  durationMs?: number;
}

/**
 * Press-and-hold commitment ritual (docs/plan.md §6.1). A deliberate, slightly
 * effortful act ("hold to help Maria break the first link") — a memory anchor
 * that leverages commitment/consistency.
 */
export function HoldButton({ label, onComplete, durationMs = 2200 }: HoldButtonProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  const done = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onComplete();
  }, [onComplete]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    progress.value = withTiming(1, { duration: durationMs, easing: Easing.linear }, (f) => {
      if (f) runOnJS(done)();
    });
  };
  const cancel = () => {
    progress.value = withTiming(0, { duration: 200 });
  };

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Press and hold.`}
      style={{
        height: 60,
        borderRadius: radius.button,
        backgroundColor: theme.color.primary,
        overflow: 'hidden',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: theme.color.accent },
          fill,
        ]}
      />
      <View style={{ alignItems: 'center', paddingHorizontal: spacing.lg }}>
        <Text variant="headline" color={theme.color.onPrimary}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

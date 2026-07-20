import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  color?: string;
  track?: string;
  height?: number;
  accessibilityLabel?: string;
}

export function ProgressBar({ progress, color, track, height = 10, accessibilityLabel = 'Progress' }: ProgressBarProps) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const w = useSharedValue(0);
  useEffect(() => {
    const t = Math.max(0, Math.min(1, progress));
    w.value = reduce ? t : withTiming(t, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, reduce, w]);

  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(1, progress)) * 100) }}
      style={{
        height,
        borderRadius: radius.round,
        backgroundColor: track ?? theme.color.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[{ height, borderRadius: radius.round, backgroundColor: color ?? theme.color.primary }, fill]}
      />
    </View>
  );
}

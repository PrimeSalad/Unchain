import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { palette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TimerRingProps {
  /** 0..1 — fraction of the session remaining (ring drains as time passes). */
  progress: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

/**
 * Circular countdown ring for timed recovery sessions. The arc animates
 * smoothly between ticks (1s linear) so the drain looks continuous; center
 * content (time remaining, status) is passed as children.
 */
export function TimerRing({ progress, size = 220, stroke = 14, children }: TimerRingProps) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const gradId = useRef(`tr-grad-${Math.random().toString(36).slice(2)}`).current;

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, progress));

  const anim = useSharedValue(pct);
  useEffect(() => {
    anim.value = reduce ? pct : withTiming(pct, { duration: 1000, easing: Easing.linear });
  }, [pct, reduce, anim]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - anim.value),
  }));

  const gradStart = theme.mode === 'dark' ? palette.grape300 : palette.grape;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradStart} stopOpacity="1" />
            <Stop offset="1" stopColor={palette.coral} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.color.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

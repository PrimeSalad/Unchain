import { useEffect, useRef } from 'react';
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
import { Text } from './Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RecoveryRingProps {
  current: number;
  target: number;
  size?: number;
  caption?: string;
}

/** Progress ring toward the next milestone. Center shows current day count. */
export function RecoveryRing({ current, target, size = 200, caption }: RecoveryRingProps) {
  const theme = useTheme();
  const reduce = useReducedMotion();

  // Each mounted instance gets its own gradient ID so multiple SVGs on the
  // same screen never share / clobber each other's <defs>.
  const gradId = useRef(
    `rr-grad-${Math.random().toString(36).slice(2)}`,
  ).current;

  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = target > 0 ? Math.max(0, Math.min(1, current / target)) : 0;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduce
      ? pct
      : withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct, reduce, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  // Gradient colours — swap for dark mode readability
  const gradStart = theme.mode === 'dark' ? palette.grape300 : palette.grape;
  const gradEnd   = palette.coral;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${current} of ${target} days toward next milestone`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0"   stopColor={gradStart} stopOpacity="1" />
            <Stop offset="1"   stopColor={gradEnd}   stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Track (background ring) */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.color.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />

        {/* Progress arc */}
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

      {/* Center text */}
      <Text
        variant="display"
        style={{ fontSize: size * 0.24, lineHeight: size * 0.27 }}
      >
        {current}
      </Text>
      <Text variant="footnote" dim>
        {caption ?? `of ${target} days`}
      </Text>
    </View>
  );
}

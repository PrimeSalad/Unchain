import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
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

/** Progress ring toward the next milestone. Center shows "current / target". */
export function RecoveryRing({ current, target, size = 200, caption }: RecoveryRingProps) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.max(0, Math.min(1, current / target)) : 0;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduce ? pct : withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct, reduce, progress]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${current} of ${target} days toward next milestone`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="recovery" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.mode === 'dark' ? palette.grape300 : palette.grape} />
            <Stop offset="1" stopColor={palette.coral} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.color.surfaceAlt} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#recovery)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="display" style={{ fontSize: size * 0.24, lineHeight: size * 0.27 }}>
        {current}
      </Text>
      <Text variant="footnote" dim>
        {caption ?? `of ${target} days`}
      </Text>
    </View>
  );
}

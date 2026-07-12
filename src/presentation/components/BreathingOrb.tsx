import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { palette, motion } from '../theme/tokens';
import { Text } from './Text';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Phase = 'Breathe in' | 'Hold' | 'Breathe out';

/**
 * Paced-breathing orb - inhale 4s / hold 2s / exhale 6s (exhale-biased to lower
 * arousal via the parasympathetic response). Haptic-synced so it works
 * eyes-closed / phone-in-pocket. Falls back to an opacity pulse under Reduce Motion.
 */
export function BreathingOrb({ size = 220 }: { size?: number }) {
  const scale = useSharedValue(0.6);
  const glow = useSharedValue(0.5);
  const [phase, setPhase] = useState<Phase>('Breathe in');
  const reduce = useReducedMotion();

  useEffect(() => {
    const setP = (p: Phase) => {
      setPhase(p);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
    };

    if (reduce) {
      glow.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
      return;
    }

    scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: motion.inhale, easing: Easing.inOut(Easing.quad) }, (f) => {
          if (f) runOnJS(setP)('Hold');
        }),
        withTiming(1, { duration: motion.hold }, (f) => {
          if (f) runOnJS(setP)('Breathe out');
        }),
        withTiming(0.6, { duration: motion.exhale, easing: Easing.inOut(Easing.quad) }, (f) => {
          if (f) runOnJS(setP)('Breathe in');
        }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: motion.inhale }),
        withTiming(1, { duration: motion.hold }),
        withTiming(0.4, { duration: motion.exhale }),
      ),
      -1,
      false,
    );
  }, [scale, glow, reduce]);

  const orb = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 0.85 : scale.value }],
    opacity: 0.55 + glow.value * 0.45,
  }));
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 0.9 : scale.value * 1.25 }],
    opacity: glow.value * 0.25,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: palette.grape300 },
          halo,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: size,
            backgroundColor: palette.grape,
            borderWidth: 2,
            borderColor: palette.grape300,
            alignItems: 'center',
            justifyContent: 'center',
          },
          orb,
        ]}
      >
        <Text variant="title2" color={palette.fog}>
          {reduce ? 'Breathe slowly' : phase}
        </Text>
      </Animated.View>
    </View>
  );
}

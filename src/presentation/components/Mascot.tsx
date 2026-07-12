import { useEffect } from 'react';
import { type ImageStyle, type ImageSourcePropType } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Unchainly - the sheep. State-driven, with a gentle idle bob for life (calm, not
 * hyperactive). Honors Reduce Motion. Ethics (docs/plan.md §3.4): Unchainly mirrors
 * the user's state with compassion - she never shames or drives re-engagement.
 */

export type MascotState = 'happy' | 'celebrate' | 'comfort' | 'braced';

const SOURCES: Record<MascotState, ImageSourcePropType> = {
  happy: require('../../../assets/images/mascot-happy.png'),
  celebrate: require('../../../assets/images/mascot-celebrate.png'),
  comfort: require('../../../assets/images/mascot-comfort.png'),
  braced: require('../../../assets/images/mascot-braced.png'),
};

interface MascotProps {
  state?: MascotState;
  size?: number;
  style?: ImageStyle;
  /** Disable animation for the "minimal mascot" accessibility/discretion setting. */
  still?: boolean;
}

export function Mascot({ state = 'happy', size = 132, style, still }: MascotProps) {
  const reduceMotion = useReducedMotion();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (still || reduceMotion) {
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [bob, still, reduceMotion]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * 4 }, { rotate: `${bob.value * 1.2}deg` }],
  }));

  return (
    <Animated.Image
      source={SOURCES[state]}
      accessibilityRole="image"
      accessibilityLabel={`Unchainly the lamb, ${state}`}
      resizeMode="contain"
      style={[{ width: size, height: size }, anim, style]}
    />
  );
}

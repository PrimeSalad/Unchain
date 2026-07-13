import { useCallback, useEffect } from 'react';
import {
  Platform,
  Pressable,
  View,
  type ImageSourcePropType,
  type ImageStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { palette } from '../theme/tokens';

/**
 * Unchainly - the sheep. State-driven, with calm dimensional motion that gives
 * the flat artwork depth without a 3D renderer. Honors Reduce Motion. Ethics
 * (docs/plan.md section 3.4): Unchainly mirrors the user's state with compassion
 * and never shames or drives re-engagement.
 */

export type MascotState = 'happy' | 'celebrate' | 'comfort' | 'braced';
export type MascotMotion = 'gentle' | 'hero' | 'celebrate';

const SOURCES: Record<MascotState, ImageSourcePropType> = {
  happy: require('../../../assets/images/mascot-happy.png'),
  celebrate: require('../../../assets/images/mascot-celebrate.png'),
  comfort: require('../../../assets/images/mascot-comfort.png'),
  braced: require('../../../assets/images/mascot-braced.png'),
};

const MOTION: Record<
  MascotMotion,
  {
    float: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    floatDuration: number;
    swayDuration: number;
  }
> = {
  gentle: {
    float: 4,
    rotateX: 1.2,
    rotateY: 2.4,
    rotateZ: 1,
    floatDuration: 1800,
    swayDuration: 2400,
  },
  hero: {
    float: 6,
    rotateX: 2,
    rotateY: 4,
    rotateZ: 1.6,
    floatDuration: 1550,
    swayDuration: 2100,
  },
  celebrate: {
    float: 8,
    rotateX: 3,
    rotateY: 5,
    rotateZ: 2.2,
    floatDuration: 1050,
    swayDuration: 1450,
  },
};

const STATE_POSE: Record<MascotState, { rotateX: number; rotateY: number; rotateZ: number }> = {
  happy: { rotateX: 0, rotateY: 0, rotateZ: 0 },
  celebrate: { rotateX: -0.8, rotateY: 1.2, rotateZ: -1.1 },
  comfort: { rotateX: 1.2, rotateY: -0.8, rotateZ: 1.1 },
  braced: { rotateX: -1, rotateY: 0.6, rotateZ: -0.7 },
};

interface MascotProps {
  state?: MascotState;
  size?: number;
  style?: ImageStyle;
  /** Disable animation for the "minimal mascot" accessibility/discretion setting. */
  still?: boolean;
  /** Makes the mascot a labeled button with tactile press feedback. */
  interactive?: boolean;
  /** Controls the energy of the dimensional idle movement. */
  motion?: MascotMotion;
  /** Hides purely supportive mascot art from the accessibility tree. */
  decorative?: boolean;
  /** Contextual alternative text for meaningful, non-interactive instances. */
  accessibilityLabel?: string;
}

export function Mascot({
  state = 'happy',
  size = 132,
  style,
  still,
  interactive = false,
  motion = 'gentle',
  decorative = false,
  accessibilityLabel,
}: MascotProps) {
  const reduceMotion = useReducedMotion();
  const float = useSharedValue(0);
  const sway = useSharedValue(0);
  const pressed = useSharedValue(0);
  const motionEnabled = !still && !reduceMotion;
  const profile = MOTION[motion];
  const pose = STATE_POSE[state];

  useEffect(() => {
    cancelAnimation(float);
    cancelAnimation(sway);
    cancelAnimation(pressed);

    if (!motionEnabled) {
      float.value = 0;
      sway.value = 0;
      pressed.value = 0;
      return;
    }

    if (motion === 'celebrate') {
      float.value = withSequence(
        withTiming(0.18, { duration: 90, easing: Easing.in(Easing.quad) }),
        withSpring(-1.35, { damping: 10, stiffness: 180, mass: 0.65 }),
        withSpring(0, { damping: 12, stiffness: 150, mass: 0.75 }),
      );
      sway.value = withSequence(
        withTiming(-0.8, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0.65, { duration: 220, easing: Easing.inOut(Easing.quad) }),
        withSpring(0, { damping: 13, stiffness: 160, mass: 0.7 }),
      );
    } else {
      float.value = withRepeat(
        withSequence(
          withTiming(-1, {
            duration: profile.floatDuration,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(1, {
            duration: profile.floatDuration,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      );
      sway.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: profile.swayDuration,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-1, {
            duration: profile.swayDuration,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      );
    }

    return () => {
      cancelAnimation(float);
      cancelAnimation(sway);
      cancelAnimation(pressed);
    };
  }, [float, motion, motionEnabled, pressed, profile, sway]);

  const imageAnimation = useAnimatedStyle(() => ({
    transform: [
      { perspective: Math.max(420, size * 4) },
      { translateY: float.value * profile.float + pressed.value * 2 },
      { rotateX: `${pose.rotateX + float.value * profile.rotateX}deg` },
      { rotateY: `${pose.rotateY + sway.value * profile.rotateY}deg` },
      { rotateZ: `${pose.rotateZ + float.value * profile.rotateZ}deg` },
      { scale: 1 - pressed.value * 0.055 },
    ],
  }));

  const shadowAnimation = useAnimatedStyle(() => {
    const lift = (1 - float.value) / 2;
    return {
      opacity: 0.12 - lift * 0.045 + pressed.value * 0.025,
      transform: [
        { scaleX: 1 - lift * 0.14 + pressed.value * 0.08 },
        { scaleY: 1 - lift * 0.08 + pressed.value * 0.05 },
      ],
    };
  });

  const handlePressIn = useCallback(() => {
    if (!motionEnabled) return;
    pressed.value = withSpring(1, { damping: 16, stiffness: 300, mass: 0.55 });
  }, [motionEnabled, pressed]);

  const handlePressOut = useCallback(() => {
    if (!motionEnabled) return;
    pressed.value = withSpring(0, { damping: 8, stiffness: 220, mass: 0.65 });
  }, [motionEnabled, pressed]);

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const label = accessibilityLabel ?? 'Unchainly, your recovery companion';
  const visual = (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            bottom: Math.max(2, size * 0.035),
            width: size * 0.46,
            height: Math.max(4, size * 0.045),
            borderRadius: size,
            backgroundColor: palette.ink,
          },
          shadowAnimation,
        ]}
      />
      <Animated.Image
        source={SOURCES[state]}
        accessible={false}
        resizeMode="contain"
        style={[{ width: size, height: size }, style, imageAnimation]}
      />
    </>
  );

  const frameStyle = {
    width: size,
    height: size,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (interactive) {
    return (
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? 'Play with Unchainly'}
        accessibilityHint="Gives Unchainly a little bounce"
        style={frameStyle}
      >
        {visual}
      </Pressable>
    );
  }

  return (
    <View
      accessible={!decorative}
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={frameStyle}
    >
      {visual}
    </View>
  );
}

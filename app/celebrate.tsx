import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Mascot } from '@/presentation/components/Mascot';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { palette, spacing } from '@/presentation/theme/tokens';
import { useReducedMotion } from '@/presentation/hooks/useReducedMotion';

/**
 * Peak-end celebration (docs/plan.md §12, §16). Full-screen, ≤2.5s, skippable,
 * once. Unchainly celebrates; a chain-link "forges"; one line of forward-arming.
 * Calm afterwards - never a badge storm.
 */
export default function Celebrate() {
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string; arm?: string }>();
  const reduce = useReducedMotion();

  const title = params.title ?? 'You made your commitment.';
  const arm = params.arm ?? 'This is the beginning. One day at a time - no shame.';

  const burst = useSharedValue(0);
  const mascotScale = useSharedValue(reduce ? 1 : 0.4);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (reduce) {
      burst.value = 1;
      return;
    }
    mascotScale.value = withSpring(1, { damping: 10, stiffness: 120 });
    burst.value = withSequence(
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
      withDelay(400, withTiming(0.85, { duration: 400 })),
    );
  }, [burst, mascotScale, reduce]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + burst.value * 1.4 }],
    opacity: 0.5 * (1 - burst.value * 0.7),
  }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ scale: mascotScale.value }] }));

  const done = () => router.replace('/(tabs)/home');

  return (
    <View style={{ flex: 1, backgroundColor: palette.grapeDeep }}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 240 }}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 220,
                height: 220,
                borderRadius: 220,
                borderWidth: 3,
                borderColor: palette.honey,
              },
              ringStyle,
            ]}
          />
          <Animated.View style={mascotStyle}>
            <Mascot state="celebrate" size={190} still />
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(200)} style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <Text variant="title1" color={palette.white} center>
            {title}
          </Text>
          <Text variant="body" color={palette.fog} center style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
            {arm}
          </Text>
        </Animated.View>

        <View style={{ alignSelf: 'stretch', marginTop: spacing.xxxl }}>
          <Button label="Continue" onPress={done} full />
        </View>
      </SafeAreaView>
    </View>
  );
}

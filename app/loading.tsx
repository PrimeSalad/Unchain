import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { Text } from '@/presentation/components/Text';
import { spacing } from '@/presentation/theme/tokens';

/**
 * Shown briefly after "Delete all local data" so the user sees a clear
 * transition before being sent to onboarding. Auto-advances after 2 s.
 */
export default function LoadingScreen() {
  const theme = useTheme();
  const router = useRouter();

  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade the whole screen in
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Bounce the three dots in a loop
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ]),
      );

    const anim = Animated.parallel([pulse(dot1, 0), pulse(dot2, 160), pulse(dot3, 320)]);
    anim.start();

    // After 2 s navigate to onboarding
    const timer = setTimeout(() => {
      router.replace('/onboarding');
    }, 2000);

    return () => {
      clearTimeout(timer);
      anim.stop();
    };
  }, []);

  const Dot = ({ anim }: { anim: Animated.Value }) => (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: theme.color.primary,
        marginHorizontal: 5,
        opacity: anim,
        transform: [{ scale: anim }],
      }}
    />
  );

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: theme.color.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
      }}
    >
      <Text variant="title2" color={theme.color.primary} style={{ marginBottom: spacing.xl }}>
        Clearing data…
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Dot anim={dot1} />
        <Dot anim={dot2} />
        <Dot anim={dot3} />
      </View>
    </Animated.View>
  );
}

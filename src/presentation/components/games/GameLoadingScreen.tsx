import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../Text';
import { radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

export function useGameLoading(delayMs = 420) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return loading;
}

export function GameLoadingScreen({
  title,
  subtitle = 'Preparing the round',
}: {
  title: string;
  subtitle?: string;
}) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 760, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, pulse]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <Animated.View
          style={{
            width: 74,
            height: 74,
            borderRadius: 37,
            backgroundColor: theme.color.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
            ],
          }}
        >
          <Ionicons name="game-controller" size={31} color={theme.color.primary} />
        </Animated.View>
        <Text variant="headline" center>{title}</Text>
        <Text variant="footnote" dim center style={{ marginTop: spacing.xs, lineHeight: 19 }}>
          {subtitle}
        </Text>
        <View
          style={{
            width: 172,
            height: 6,
            borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            marginTop: spacing.xl,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['18%', '100%'] }),
              height: '100%',
              borderRadius: radius.round,
              backgroundColor: theme.color.primary,
            }}
          />
        </View>
        <Text variant="caption" dim center style={{ marginTop: spacing.sm }}>
          Loading offline session
        </Text>
      </SafeAreaView>
    </View>
  );
}

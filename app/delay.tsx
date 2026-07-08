import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BreathingOrb } from '@/presentation/components/BreathingOrb';
import { Text } from '@/presentation/components/Text';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useStore, useProfile } from '@/application/store';
import { moneySaved, formatMoney } from '@/domain/gambling';
import { BREATHING_TIPS, randomFrom } from '@/domain/content';

const OPTIONS = [5, 10, 15];

export default function Delay() {
  const router = useRouter();
  const profile = useProfile();
  const pushTimeline = useStore((s) => s.pushTimeline);
  const addPoints = useStore((s) => s.addPoints);

  const [minutes, setMinutes] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [finished, setFinished] = useState(false);
  const [tip] = useState(() => randomFrom(BREATHING_TIPS));
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const money = profile ? moneySaved(profile) : { total: 0 } as ReturnType<typeof moneySaved>;
  const currency = profile?.currency ?? '₱';

  const start = (m: number) => {
    setMinutes(m);
    setRemaining(m * 60);
  };

  useEffect(() => {
    if (minutes == null || finished) return;
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          setFinished(true);
          pushTimeline('badge', `Rode out a ${minutes}-minute delay`);
          addPoints(10);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [minutes, finished, pushTimeline, addPoints]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <View style={{ flex: 1, backgroundColor: palette.night }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={palette.fogDim} />
          </Pressable>
        </View>

        {minutes == null ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
            <Text variant="title1" center color={palette.fog}>Delay the urge</Text>
            <Text variant="body" center color={palette.fogDim} style={{ marginTop: spacing.md, marginBottom: spacing.xxl }}>
              Give the wave time to pass. Choose how long.
            </Text>
            <View style={{ gap: spacing.md }}>
              {OPTIONS.map((m) => (
                <Pressable key={m} onPress={() => start(m)} style={{ height: 56, borderRadius: radius.button, backgroundColor: palette.nightRaised, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="headline" color={palette.fog}>{m} minutes</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : finished ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
            <Ionicons name="checkmark-circle" size={64} color={palette.grape300} />
            <Text variant="title1" center color={palette.fog} style={{ marginTop: spacing.lg }}>You made it through.</Text>
            <Text variant="body" center color={palette.fogDim} style={{ marginTop: spacing.md }}>The urge passed — and you didn't act on it. That's the whole skill.</Text>
            <Pressable onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: spacing.xxxl, alignSelf: 'stretch', height: 50, borderRadius: radius.button, backgroundColor: palette.grape, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="headline" color="#FFFFFF">Back to Home</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
            <BreathingOrb size={200} />
            <Text variant="display" color={palette.fog} style={{ marginTop: spacing.xl, fontVariant: ['tabular-nums'] }}>{mm}:{ss}</Text>
            <Text variant="body" center color={palette.fogDim} style={{ marginTop: spacing.md }}>{tip}</Text>
            <Text variant="callout" center color={palette.fogDim} style={{ marginTop: spacing.lg }}>Money saved so far: {formatMoney(money.total, currency)}</Text>
            {profile?.reason ? <Text variant="callout" center color={palette.fog} style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }}>“{profile.reason}”</Text> : null}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

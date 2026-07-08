import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BreathingOrb } from '@/presentation/components/BreathingOrb';
import { Text } from '@/presentation/components/Text';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useStore } from '@/application/store';
import { BREATHING_TIPS, randomFrom } from '@/domain/content';

export default function Breathing() {
  const router = useRouter();
  const pushTimeline = useStore((s) => s.pushTimeline);
  const addPoints = useStore((s) => s.addPoints);
  const [tip] = useState(() => randomFrom(BREATHING_TIPS));

  const done = () => {
    pushTimeline('breathing', 'Finished a breathing exercise');
    addPoints(5);
    router.replace('/(tabs)/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.night }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={palette.fogDim} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <BreathingOrb size={240} />
          <Text variant="body" center color={palette.fogDim} style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.md }}>{tip}</Text>
        </View>
        <View style={{ padding: spacing.lg }}>
          <Pressable onPress={done} style={{ height: 50, borderRadius: radius.button, backgroundColor: palette.grape, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="headline" color="#FFFFFF">I feel calmer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

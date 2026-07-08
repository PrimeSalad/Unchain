import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/presentation/components/Text';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useProfile } from '@/application/store';
import { recoveryTimer, moneySaved, formatMoney } from '@/domain/gambling';
import { HEALTHY_ALTERNATIVES, MOTIVATION, randomFrom } from '@/domain/content';

export default function Sos() {
  const router = useRouter();
  const profile = useProfile();
  const [panel, setPanel] = useState<'alt' | 'motiv' | null>(null);

  const timer = profile ? recoveryTimer(profile.startedAt) : { days: 0, hours: 0, minutes: 0 };
  const money = profile ? moneySaved(profile) : { today: 0, week: 0, month: 0, total: 0 };
  const currency = profile?.currency ?? '₱';

  const tools: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { icon: 'leaf', label: 'Start Breathing', onPress: () => router.replace('/breathing') },
    { icon: 'time', label: '10-Minute Delay', onPress: () => router.replace('/delay') },
    { icon: 'book', label: 'Read Journal', onPress: () => router.replace('/(tabs)/journal') },
    { icon: 'walk', label: 'Healthy Alternatives', onPress: () => setPanel(panel === 'alt' ? null : 'alt') },
    { icon: 'heart', label: 'Recovery Motivation', onPress: () => setPanel(panel === 'motiv' ? null : 'motiv') },
    { icon: 'create', label: 'Emergency Reflection', onPress: () => router.replace('/(tabs)/journal') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: palette.night }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={palette.fogDim} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <Text variant="display" center color={palette.fog} style={{ fontSize: 44 }}>STOP</Text>
          <Text variant="title2" center color={palette.fog} style={{ marginTop: spacing.md }}>Take a deep breath.</Text>
          <Text variant="body" center color={palette.fogDim} style={{ marginTop: spacing.sm }}>Don't make any decisions yet.</Text>

          {/* Anchors */}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <Anchor label="Recovery" value={`${timer.days}d ${timer.hours}h`} />
            <Anchor label="Money Saved" value={formatMoney(money.total, currency)} />
          </View>
          {profile?.reason ? (
            <View style={{ backgroundColor: palette.nightRaised, borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.md }}>
              <Text variant="footnote" color={palette.fogDim}>Your reason for quitting</Text>
              <Text variant="body" color={palette.fog} style={{ marginTop: 4 }}>“{profile.reason}”</Text>
            </View>
          ) : null}

          {/* Tools */}
          <Text variant="headline" color={palette.fog} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Recovery Tools</Text>
          <View style={{ gap: spacing.sm }}>
            {tools.map((t) => (
              <Pressable
                key={t.label}
                onPress={t.onPress}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.nightRaised, borderRadius: radius.button, padding: spacing.lg }}
              >
                <Ionicons name={t.icon} size={22} color={palette.grape300} />
                <Text variant="headline" color={palette.fog} style={{ flex: 1, marginLeft: spacing.md }}>{t.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={palette.fogDim} />
              </Pressable>
            ))}
          </View>

          {panel === 'alt' && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {HEALTHY_ALTERNATIVES.map((a) => (
                <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="ellipse" size={6} color={palette.grape300} />
                  <Text variant="callout" color={palette.fog}>{a}</Text>
                </View>
              ))}
            </View>
          )}
          {panel === 'motiv' && (
            <View style={{ marginTop: spacing.md, backgroundColor: palette.nightRaised, borderRadius: radius.card, padding: spacing.lg }}>
              <Text variant="body" color={palette.fog}>{randomFrom(MOTIVATION)}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Anchor({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.nightRaised, borderRadius: radius.card, padding: spacing.lg }}>
      <Text variant="footnote" color={palette.fogDim}>{label}</Text>
      <Text variant="title2" color={palette.fog} style={{ marginTop: 2 }}>{value}</Text>
    </View>
  );
}

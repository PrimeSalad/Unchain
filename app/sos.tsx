import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/presentation/components/Text';
import { Collapsible } from '@/presentation/components/Collapsible';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useProfile, useStore } from '@/application/store';
import { recoveryTimer, moneySaved, formatMoney, currentStreakStart } from '@/domain/gambling';
import { QUOTES } from '@/domain/quotes';

export default function Sos() {
  const router = useRouter();
  const safeBack = useSafeBack();
  const profile = useProfile();
  const [panel, setPanel] = useState<'motiv' | null>(null);
  // The same daily quote shown on Home — consistent all day, offline.
  const dailyQuote = useStore((s) => s.dailyQuote);
  const ensureDailyQuote = useStore((s) => s.ensureDailyQuote);
  useEffect(() => {
    ensureDailyQuote();
  }, [ensureDailyQuote]);
  // A persisted index can outlive a shrunken quote pool after an update —
  // never index blindly.
  const motivation = (QUOTES[dailyQuote?.index ?? 0] ?? QUOTES[0]).text;

  // ── Focus Protection ──────────────────────────────────────────────────────
  // The blocklist is permanent — every website the user added is always
  // protected, so in a moment of crisis this is simply a reassurance.
  const protectedCount = useStore((s) => s.blockedSites.length);

  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);
  // Streak start comes from the event log (same as Home) so the anchors here
  // never overstate recovery after a relapse — honesty matters most in crisis.
  const streakStart = profile ? currentStreakStart(profile.startedAt, relapses, journal) : 0;
  const timer = profile ? recoveryTimer(streakStart) : { days: 0, hours: 0, minutes: 0 };
  const money = profile
    ? moneySaved({ ...profile, startedAt: streakStart })
    : { today: 0, week: 0, month: 0, total: 0 };
  const currency = profile?.currency ?? '₱';

  const tools: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    /** Rows with a panel expand in place instead of navigating. */
    panelKey?: 'motiv';
  }[] = [
    { icon: 'flower', label: 'Mindful Pause', onPress: () => router.replace('/mindful-pause' as Href) },
    { icon: 'game-controller', label: 'Recreational Games', onPress: () => router.push('/games' as Href) },
    { icon: 'book', label: 'Read Journal', onPress: () => router.replace('/(tabs)/journal') },
    { icon: 'walk', label: 'Healthy Alternatives', onPress: () => router.push('/alternatives' as Href) },
    { icon: 'shield-checkmark', label: 'Focus Protection', onPress: () => router.push('/protection' as Href) },
    { icon: 'heart', label: 'Recovery Motivation', panelKey: 'motiv', onPress: () => setPanel(panel === 'motiv' ? null : 'motiv') },
    { icon: 'create', label: 'Emergency Reflection', onPress: () => router.replace('/reflection') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: palette.night }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.lg }}>
          <Pressable onPress={safeBack} hitSlop={16} accessibilityRole="button" accessibilityLabel="Close">
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
          {/* Focus Protection status — the user's permanent blocklist. */}
          {protectedCount > 0 && (
            <View
              accessibilityLabel={`Focus Protection on, ${protectedCount} websites permanently protected`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: palette.nightRaised, borderRadius: radius.card,
                padding: spacing.lg, marginTop: spacing.md,
                borderLeftWidth: 3, borderLeftColor: '#77B58A',
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color="#77B58A" />
              <View style={{ flex: 1 }}>
                <Text variant="callout" color={palette.fog}>Focus Protection is on</Text>
                <Text variant="caption" color={palette.fogDim} style={{ marginTop: 1 }}>
                  {protectedCount} website{protectedCount === 1 ? '' : 's'} permanently protected
                </Text>
              </View>
            </View>
          )}
          {profile?.reason ? (
            <View style={{ backgroundColor: palette.nightRaised, borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.md }}>
              <Text variant="footnote" color={palette.fogDim}>Your reason for quitting</Text>
              <Text variant="body" color={palette.fog} style={{ marginTop: 4 }}>“{profile.reason}”</Text>
            </View>
          ) : null}

          {/* Tools */}
          <Text variant="headline" color={palette.fog} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Recovery Tools</Text>
          <View style={{ gap: spacing.sm }}>
            {tools.map((t) => {
              const expanded = t.panelKey != null && panel === t.panelKey;
              return (
                <View key={t.label}>
                  <Pressable
                    onPress={t.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                    accessibilityState={t.panelKey ? { expanded } : undefined}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', backgroundColor: palette.nightRaised,
                      borderRadius: radius.button, padding: spacing.lg, opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Ionicons name={t.icon} size={22} color={palette.grape300} />
                    <Text variant="headline" color={palette.fog} style={{ flex: 1, marginLeft: spacing.md }}>{t.label}</Text>
                    <Ionicons
                      name={t.panelKey ? (expanded ? 'chevron-up' : 'chevron-down') : 'chevron-forward'}
                      size={18}
                      color={palette.fogDim}
                    />
                  </Pressable>

                  {/* Expandable content lives directly beneath its own row. */}
                  {t.panelKey === 'motiv' && (
                    <Collapsible open={expanded}>
                      <View style={{ paddingTop: spacing.sm }}>
                        <View style={{ backgroundColor: palette.nightRaised, borderRadius: radius.card, padding: spacing.lg, marginLeft: spacing.lg }}>
                          <Text variant="body" color={palette.fog}>{motivation}</Text>
                        </View>
                      </View>
                    </Collapsible>
                  )}
                </View>
              );
            })}
          </View>
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

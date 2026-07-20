import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { useStore } from '@/application/store';
import { addictionMeta } from '@/domain/gambling';
import {
  isSyntheticInsightUrge,
  localDateKey,
  topInsightTriggers,
  projectDailyInsightSamples,
} from '@/domain/patternInsights';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { radius, spacing } from '@/presentation/theme/tokens';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

const TIME_BUCKETS = ['Morning', 'Afternoon', 'Evening', 'Overnight'] as const;

function currentWeekStart(now = new Date()): number {
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday).getTime();
}

function urgeTimeBucket(at: number): typeof TIME_BUCKETS[number] {
  const hour = new Date(at).getHours();
  if (hour >= 6 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  if (hour >= 18) return 'Evening';
  return 'Overnight';
}

function intensityColor(value: number, theme: ReturnType<typeof useTheme>) {
  if (value >= 7) return theme.color.danger;
  if (value >= 4) return theme.color.celebrateText;
  return theme.color.success;
}

export default function UrgePatterns() {
  const theme = useTheme();
  const safeBack = useSafeBack();
  const profile = useStore((state) => state.profile);
  const urges = useStore((state) => state.urges);
  const journal = useStore((state) => state.journal);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [recentLimit, setRecentLimit] = useState(5);
  const track = profile?.addictionType;
  const trackLabel = track ? addictionMeta(track).label : 'Recovery';

  const manualUrges = useMemo(
    () => urges
      .filter((urge) => !isSyntheticInsightUrge(urge, journal))
      .sort((a, b) => b.at - a.at),
    [journal, urges],
  );
  const recentUrges = useMemo(() => {
    const cutoff = currentWeekStart();
    return manualUrges.filter((urge) => urge.at >= cutoff);
  }, [manualUrges]);

  const dayTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index));
      const key = localDateKey(date.getTime());
      const matching = manualUrges.filter((urge) => localDateKey(urge.at) === key);
      return {
        key: key ?? String(index),
        label: date.toLocaleDateString([], { weekday: 'short' }).slice(0, 2),
        peak: matching.reduce((peak, urge) => Math.max(peak, urge.intensity), 0),
        count: matching.length,
      };
    });
  }, [manualUrges]);

  const timeCounts = useMemo(() => manualUrges.reduce<Record<string, number>>((counts, urge) => {
    const bucket = urgeTimeBucket(urge.at);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    return counts;
  }, {}), [manualUrges]);

  const maxTimeCount = Math.max(1, ...TIME_BUCKETS.map((bucket) => timeCounts[bucket] ?? 0));
  const samples = useMemo(
    () => track ? projectDailyInsightSamples({ track, journal, urges: manualUrges }) : [],
    [journal, manualUrges, track],
  );
  const topTriggers = topInsightTriggers(samples, 3);
  const averageIntensity = manualUrges.length
    ? manualUrges.reduce((sum, urge) => sum + urge.intensity, 0) / manualUrges.length
    : 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
        <Pressable
          onPress={safeBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={21} color={theme.color.primary} />
        </Pressable>
        <Text variant="title2" numberOfLines={1} style={{ flex: 1, marginLeft: spacing.sm, fontFamily: 'Nunito_900Black' }}>
          Urge patterns
        </Text>
      </View>

      <Text variant="headline">{trackLabel} records</Text>
      <Text variant="body" dim style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Patterns from SOS and manually logged urges.
      </Text>

      {manualUrges.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.huge }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pulse-outline" size={28} color={theme.color.primary} />
          </View>
          <Text variant="headline" center style={{ marginTop: spacing.lg }}>
            No urge records yet
          </Text>
          <Text variant="footnote" dim center style={{ marginTop: spacing.xs }}>
            Use “I’m having an urge” in SOS to begin seeing patterns here.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Metric value={manualUrges.length} label="Urges logged" icon="pulse-outline" />
            <Metric value={averageIntensity.toFixed(1)} label="Avg intensity" icon="speedometer-outline" />
          </View>

          <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg, marginBottom: spacing.md }}>
            <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold' }}>7-day intensity</Text>
            <Text variant="caption" dim style={{ marginTop: 2 }}>Highest urge logged each day</Text>
            <View style={{ height: 128, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.lg }}>
              {dayTrend.map((day) => (
                <View key={day.key} style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Text variant="caption" dim style={{ fontSize: 10 }}>{day.peak || '—'}</Text>
                  <View style={{
                    width: '65%',
                    minWidth: 12,
                    height: day.peak ? Math.max(12, day.peak * 8) : 5,
                    marginTop: spacing.xs,
                    borderRadius: radius.round,
                    backgroundColor: day.peak ? intensityColor(day.peak, theme) : theme.color.hairline,
                  }} />
                  <Text variant="caption" dim style={{ marginTop: spacing.xs }}>{day.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg, marginBottom: spacing.md }}>
            <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.lg }}>When urges happen</Text>
            <View style={{ gap: spacing.md }}>
              {TIME_BUCKETS.map((bucket) => {
                const count = timeCounts[bucket] ?? 0;
                return (
                  <View key={bucket}>
                    <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
                      <Text variant="footnote" style={{ flex: 1 }}>{bucket}</Text>
                      <Text variant="caption" dim>{count}</Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.color.surfaceAlt, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${(count / maxTimeCount) * 100}%`, borderRadius: 4, backgroundColor: theme.color.primary }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {topTriggers.length ? (
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg, marginBottom: spacing.md }}>
              <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.md }}>Top triggers</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {topTriggers.map(({ tag, count }) => (
                  <View key={tag} style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.round, backgroundColor: theme.color.primarySoft, paddingHorizontal: spacing.md }}>
                    <Text variant="footnote" color={theme.color.primary}>{tag}</Text>
                    <Text variant="caption" color={theme.color.primary}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.sm, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, backgroundColor: theme.color.surface, overflow: 'hidden' }}>
            <Pressable
              onPress={() => {
                setRecentExpanded((value) => {
                  if (value) setRecentLimit(5);
                  return !value;
                });
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: recentExpanded }}
              accessibilityLabel={`${recentExpanded ? 'Collapse' : 'Expand'} recent urges`}
              style={({ pressed }) => ({
                minHeight: 64,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="time-outline" size={19} color={theme.color.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="callout" style={{ fontFamily: 'Nunito_800ExtraBold' }}>Recent urges</Text>
                <Text variant="caption" dim>{recentUrges.length} record{recentUrges.length === 1 ? '' : 's'} this week</Text>
              </View>
              <Ionicons name={recentExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.color.textDim} />
            </Pressable>

            {recentExpanded ? (
              <View style={{ borderTopWidth: 1, borderTopColor: theme.color.hairline, padding: spacing.md, gap: spacing.sm }}>
                {recentUrges.length === 0 ? (
                  <Text variant="footnote" dim center style={{ paddingVertical: spacing.md }}>
                    No urges logged this week.
                  </Text>
                ) : null}
                {recentUrges.slice(0, recentLimit).map((urge) => {
                  const triggers = urge.triggers?.length ? urge.triggers : urge.trigger ? [urge.trigger] : [];
                  return (
                    <View key={urge.id} style={{ backgroundColor: theme.color.bg, borderRadius: radius.input, padding: spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: intensityColor(urge.intensity, theme) }} />
                        <Text variant="callout" style={{ flex: 1 }}>{urge.intensity}/10 intensity</Text>
                        {urge.mood != null ? <Text variant="caption" color={theme.color.primary}>Mood {urge.mood}/10</Text> : null}
                      </View>
                      <Text variant="caption" dim style={{ marginTop: spacing.xs }}>
                        {new Date(urge.at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      <Text variant="caption" dim style={{ marginTop: spacing.xs }}>
                        {triggers.length ? triggers.join(' · ') : 'No trigger selected'}
                      </Text>
                    </View>
                  );
                })}
                {recentLimit < recentUrges.length ? (
                  <Pressable
                    onPress={() => setRecentLimit((value) => Math.min(value + 10, recentUrges.length))}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      minHeight: 44,
                      borderRadius: radius.round,
                      backgroundColor: theme.color.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text variant="footnote" color={theme.color.primary}>Show more</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}

function Metric({ value, label, icon }: { value: string | number; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, minHeight: 88, borderRadius: radius.input, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md }}>
      <Ionicons name={icon} size={18} color={theme.color.primary} />
      <Text variant="title2" style={{ marginTop: spacing.xs }}>{value}</Text>
      <Text variant="caption" dim>{label}</Text>
    </View>
  );
}

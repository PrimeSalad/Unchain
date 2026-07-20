import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStore } from '@/application/store';
import { addictionMeta } from '@/domain/gambling';
import { journalConfig } from '@/domain/addictionJournal';
import {
  averageInsightMood,
  averageInsightUrgePeak,
  hasUnlockedPatternInsights,
  insightMoodTrend,
  localDateKey,
  localDateOrdinal,
  localDateOrdinalFromKey,
  patternInsightUnlockProgress,
  projectDailyInsightSamples,
  topInsightTriggers,
  type InsightTrend,
} from '@/domain/patternInsights';

function round1(value: number): string {
  return value.toFixed(1);
}

function moodColor(mood: number, theme: ReturnType<typeof import('../theme/ThemeProvider').useTheme>) {
  if (mood <= 4) return theme.color.danger;
  if (mood <= 6) return theme.color.celebrate;
  return theme.color.success;
}

function urgeColor(urge: number, theme: ReturnType<typeof import('../theme/ThemeProvider').useTheme>) {
  if (urge >= 7) return theme.color.danger;
  if (urge >= 4) return theme.color.celebrate;
  return theme.color.success;
}

function trendIcon(trend: InsightTrend): keyof typeof Ionicons.glyphMap {
  if (trend === 'improving') return 'trending-up';
  if (trend === 'declining') return 'trending-down';
  return 'remove';
}

function trendColor(trend: InsightTrend, theme: ReturnType<typeof import('../theme/ThemeProvider').useTheme>) {
  if (trend === 'improving') return theme.color.success;
  if (trend === 'declining') return theme.color.danger;
  return theme.color.celebrate;
}

function recentLocalDateKeys(days: number, now = Date.now()): string[] {
  const date = new Date(now);
  return Array.from({ length: days }, (_, index) => {
    const offset = days - 1 - index;
    const at = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset, 12).getTime();
    return localDateKey(at)!;
  });
}

function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function CheckInInsightsCard() {
  const theme = useTheme();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const profile = useStore((state) => state.profile);
  const journal = useStore((state) => state.journal);
  const urges = useStore((state) => state.urges);
  const checkIns = useStore((state) => state.checkIns);
  const [expanded, setExpanded] = useState(false);

  const track = profile?.addictionType;
  const samples = useMemo(() => track
    ? projectDailyInsightSamples({ track, journal, urges, checkIns })
    : [], [checkIns, journal, track, urges]);
  if (!track) return null;

  const progress = patternInsightUnlockProgress(samples, track);
  const unlocked = hasUnlockedPatternInsights(samples, track);
  const trackLabel = addictionMeta(track).label;
  const recentKeys = recentLocalDateKeys(7);
  const sampleByDate = new Map(samples.map((sample) => [sample.localDateKey, sample]));
  const todayHasSample = sampleByDate.has(recentKeys[recentKeys.length - 1]);
  const recentSamples = recentKeys.flatMap((key) => {
    const sample = sampleByDate.get(key);
    return sample ? [sample] : [];
  });
  const currentOrdinal = localDateOrdinal(Date.now()) ?? 0;
  const samples14 = samples.filter((sample) => {
    const ordinal = localDateOrdinalFromKey(sample.localDateKey);
    return ordinal != null && ordinal >= currentOrdinal - 13;
  });
  const moodAverage = averageInsightMood(recentSamples);
  const urgeAverage = averageInsightUrgePeak(recentSamples);
  const trend = insightMoodTrend(samples);
  const topTriggers = topInsightTriggers(samples14, 3);
  const loggedCount = recentKeys.filter((key) => sampleByDate.has(key)).length;

  if (!unlocked) {
    return (
      <Pressable
        onPress={todayHasSample ? undefined : () => router.push({
          pathname: journalConfig(track).route as never,
          params: { addiction: track },
        })}
        disabled={todayHasSample}
        accessibilityRole="button"
        accessibilityLabel={`Unlock your ${trackLabel} patterns, ${progress.qualifyingDays} of ${progress.requiredDays} days complete`}
        accessibilityHint={todayHasSample ? 'A new calendar day is needed for the next sample' : "Opens today's recovery journal"}
        accessibilityState={{ disabled: todayHasSample }}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
      >
        <View style={{
          minHeight: 76,
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bar-chart" size={21} color={theme.color.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="footnote" color={theme.color.primary}>Unlock your {trackLabel} patterns</Text>
            <Text variant="caption" dim style={{ marginTop: 2 }}>
              {todayHasSample
                ? 'Today is counted. Come back on a new day for the next sample.'
                : progress.remainingDays === 2
                ? 'Complete journals on two different days to unlock insights'
                : 'One more real-data day unlocks your insights'}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
              {Array.from({ length: progress.requiredDays }, (_, index) => (
                <Dot key={index} color={index < progress.qualifyingDays ? theme.color.primary : theme.color.hairline} />
              ))}
            </View>
          </View>
          <Ionicons name={todayHasSample ? 'calendar-outline' : 'chevron-forward'} size={18} color={theme.color.textDim} />
        </View>
      </Pressable>
    );
  }

  const toggle = () => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((value) => !value);
  };

  return (
    <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, overflow: 'hidden' }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${trackLabel} pattern insights`}
        accessibilityState={{ expanded }}
        style={({ pressed }) => ({
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="analytics" size={18} color={theme.color.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout">Your {trackLabel} patterns</Text>
          <Text variant="caption" dim>From journals and manually logged urges</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={theme.color.textDim} />
      </Pressable>

      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {recentKeys.map((key) => {
            const mood = sampleByDate.get(key)?.mood;
            return <Dot key={key} color={mood == null ? theme.color.hairline : moodColor(mood, theme)} />;
          })}
          <Text variant="caption" dim>{moodAverage == null ? 'Mood' : `${round1(moodAverage)}/10`}</Text>
        </View>
        <Text variant="caption" dim>{loggedCount}/7 days logged</Text>
      </View>

      {expanded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: theme.color.hairline, padding: spacing.md, gap: spacing.md }}>
          {moodAverage != null ? (
            <MetricRow label="7-day mood average">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text variant="caption" color={trendColor(trend, theme)}>{round1(moodAverage)}/10</Text>
                <Ionicons name={trendIcon(trend)} size={13} color={trendColor(trend, theme)} />
                <Text variant="caption" color={trendColor(trend, theme)}>
                  {trend === 'improving' ? 'Rising' : trend === 'declining' ? 'Falling' : 'Stable'}
                </Text>
              </View>
            </MetricRow>
          ) : null}
          {urgeAverage != null ? (
            <MetricRow label="Average daily urge peak">
              <Text variant="caption" color={urgeColor(urgeAverage, theme)}>{round1(urgeAverage)}/10</Text>
            </MetricRow>
          ) : null}
          {topTriggers.length ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="footnote" dim>Most common triggers</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {topTriggers.map(({ tag, count }) => (
                  <View key={tag} style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.chip, backgroundColor: theme.color.primarySoft, paddingHorizontal: spacing.sm }}>
                    <Text variant="caption" color={theme.color.primary}>{tag}</Text>
                    <Text variant="caption" color={theme.color.primary}>· {count}d</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <MetricRow label="Evidence days in the last week">
            <Text variant="caption" color={theme.color.primary}>{loggedCount} of 7</Text>
          </MetricRow>
        </View>
      ) : null}
    </View>
  );
}

function MetricRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text variant="footnote" dim style={{ flex: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

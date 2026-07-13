/**
 * CheckInInsightsCard
 *
 * Surfaces stored check-in data in a compact, glanceable card.
 * Shown on HomeScreen between StatTiles and Daily Motivation.
 *
 * Collapsed: header + 7-dot mood sparkline + clean-day dots
 * Expanded:  + urge average badge + top trigger pills
 */

import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '@/application/store';
import { sameDay } from '@/domain/records';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the last N items from an array (most-recent last). */
function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(-n);
}

/** Round to one decimal place. */
function round1(n: number): string {
  return n.toFixed(1);
}

/** Map a mood value (1–10) to a semantic color from the theme. */
function moodColor(mood: number, theme: ReturnType<typeof import('../theme/ThemeProvider').useTheme>) {
  if (mood <= 4) return theme.color.danger;
  if (mood <= 6) return theme.color.celebrate;
  return theme.color.success;
}

/** Map a urge strength value (1–10) to a semantic color. High urge = danger. */
function urgeColor(urge: number, theme: ReturnType<typeof import('../theme/ThemeProvider').useTheme>) {
  if (urge >= 7) return theme.color.danger;
  if (urge >= 4) return theme.color.celebrate;
  return theme.color.success;
}

/** Trend direction based on last-3 vs previous-3 average. */
type Trend = 'improving' | 'declining' | 'stable';

function moodTrend(moods: number[]): Trend {
  if (moods.length < 6) return 'stable';
  const prev3 = moods.slice(0, 3);
  const last3 = moods.slice(-3);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const diff = avg(last3) - avg(prev3);
  if (diff >= 0.5) return 'improving';
  if (diff <= -0.5) return 'declining';
  return 'stable';
}

function trendIcon(trend: Trend): keyof typeof Ionicons.glyphMap {
  if (trend === 'improving') return 'trending-up';
  if (trend === 'declining') return 'trending-down';
  return 'remove';
}

function trendColor(trend: Trend, theme: ReturnType<typeof import('../theme/ThemeProvider').useTheme>) {
  if (trend === 'improving') return theme.color.success;
  if (trend === 'declining') return theme.color.danger;
  return theme.color.celebrate;
}

/** Count trigger occurrences across check-ins, return sorted top N. */
function topTriggers(allTriggers: string[][], topN = 3): Array<{ tag: string; count: number }> {
  const freq: Record<string, number> = {};
  for (const tags of allTriggers) {
    for (const tag of tags) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([tag, count]) => ({ tag, count }));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single colored dot used in sparklines / calendar rows. */
function Dot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

/** 7-dot mood sparkline. Renders up to 7 dots, gray for missing slots. */
function MoodSparkline({
  moods,
  theme,
}: {
  moods: Array<number | null>; // null = no data
  theme: ReturnType<typeof import('../theme/ThemeProvider').useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {moods.map((m, i) => (
        <Dot
          key={i}
          size={10}
          color={m != null ? moodColor(m, theme) : theme.color.hairline}
        />
      ))}
    </View>
  );
}

/** 7-dot clean-day calendar row. Green = clean, red = gambled, gray = no data. */
function CleanDayRow({
  days,
  theme,
}: {
  days: Array<'clean' | 'gambled' | 'none'>;
  theme: ReturnType<typeof import('../theme/ThemeProvider').useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {days.map((d, i) => (
        <Dot
          key={i}
          size={10}
          color={
            d === 'clean'
              ? theme.color.success
              : d === 'gambled'
                ? theme.color.danger
                : theme.color.hairline
          }
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CheckInInsightsCard() {
  const theme = useTheme();
  const router = useRouter();
  const checkIns = useStore((s) => s.checkIns);
  const [expanded, setExpanded] = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Last 7 check-ins (chronological, most-recent last)
  const last7CheckIns = lastN(
    [...checkIns].sort((a, b) => a.at - b.at),
    7,
  );

  // Last 14 days for trigger analysis
  const cutoff14 = now - 14 * DAY_MS;
  const last14CheckIns = checkIns.filter((c) => c.at >= cutoff14);

  // Mood data from last 7
  const moodEntries = last7CheckIns.filter((c) => c.mood != null) as Array<
    (typeof last7CheckIns)[number] & { mood: number }
  >;

  // Build 7-slot sparkline (null if that slot has no mood data)
  const sparklineMoods: Array<number | null> = Array.from({ length: 7 }, (_, i) => {
    const entry = last7CheckIns[i];
    return entry?.mood ?? null;
  });

  const moodAvg =
    moodEntries.length > 0
      ? moodEntries.reduce((s, c) => s + c.mood, 0) / moodEntries.length
      : null;

  const trend: Trend = moodEntries.length >= 6 ? moodTrend(moodEntries.map((c) => c.mood)) : 'stable';

  // Urge data from last 7
  const urgeEntries = last7CheckIns.filter((c) => c.urgeStrength != null) as Array<
    (typeof last7CheckIns)[number] & { urgeStrength: number }
  >;
  const urgeAvg =
    urgeEntries.length > 0
      ? urgeEntries.reduce((s, c) => s + c.urgeStrength, 0) / urgeEntries.length
      : null;

  // Trigger data from last 14 days
  const triggerArrays = last14CheckIns
    .filter((c) => c.triggers && c.triggers.length > 0)
    .map((c) => c.triggers as string[]);
  const topTriggerList = triggerArrays.length > 0 ? topTriggers(triggerArrays, 3) : [];

  // Clean-day row (last 7 calendar days, oldest first)
  const cleanDayStatuses: Array<'clean' | 'gambled' | 'none'> = Array.from({ length: 7 }, (_, i) => {
    const dayOffset = 6 - i; // 6 days ago → today
    const targetDay = now - dayOffset * DAY_MS;
    const entry = checkIns.find((c) => sameDay(c.at, targetDay));
    if (!entry) return 'none';
    return entry.gambled ? 'gambled' : 'clean';
  });

  const cleanCount = cleanDayStatuses.filter((d) => d === 'clean').length;

  // ── Empty state ───────────────────────────────────────────────────────────

  const hasEnoughData = checkIns.length >= 2;

  if (!hasEnoughData) {
    return (
      <Pressable
        onPress={() => router.push('/checkin')}
        accessibilityRole="button"
        accessibilityLabel="Complete daily check-ins to unlock insights"
        style={({ pressed }) => ({
          marginTop: 0,
          opacity: pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View
          style={{
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            padding: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="bar-chart" size={20} color={theme.color.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="footnote" color={theme.color.primary}>
              Unlock your patterns
            </Text>
            <Text variant="caption" dim style={{ marginTop: 2 }}>
              Complete daily check-ins to unlock mood and urge insights
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.color.textDim} />
        </View>
      </Pressable>
    );
  }

  // ── Filled state ──────────────────────────────────────────────────────────

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View
      style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        overflow: 'hidden',
      }}
    >
      {/* ── Header row (always visible, tap to expand/collapse) ── */}
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse pattern insights' : 'Expand pattern insights'}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          minHeight: 44,
          gap: spacing.sm,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: theme.color.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="analytics" size={16} color={theme.color.primary} />
        </View>

        <Text
          variant="callout"
          style={{ flex: 1, fontFamily: 'Nunito_700Bold' }}
        >
          Your Patterns
        </Text>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.color.textDim}
        />
      </Pressable>

      {/* ── Always-visible summary row ── */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          flexWrap: 'wrap',
        }}
      >
        {/* Mood sparkline + avg */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          <MoodSparkline moods={sparklineMoods} theme={theme} />
          {moodAvg != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="caption" dim>
                {round1(moodAvg)}/10
              </Text>
              <Ionicons
                name={trendIcon(trend)}
                size={13}
                color={trendColor(trend, theme)}
              />
            </View>
          ) : (
            <Text variant="caption" dim>
              No mood yet
            </Text>
          )}
        </View>

        {/* Clean-day dots + count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <CleanDayRow days={cleanDayStatuses} theme={theme} />
          <Text variant="caption" dim>
            {cleanCount}/7
          </Text>
        </View>
      </View>

      {/* ── Expanded detail rows ── */}
      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.color.hairline,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.md,
          }}
        >
          {/* Mood detail row */}
          {moodAvg != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="footnote" dim style={{ flex: 1 }}>
                7-day mood avg
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: theme.color.primarySoft,
                  borderRadius: radius.chip,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}
              >
                <Text variant="caption" color={theme.color.primary}>
                  {round1(moodAvg)}/10
                </Text>
                <Ionicons
                  name={trendIcon(trend)}
                  size={12}
                  color={trendColor(trend, theme)}
                />
                <Text variant="caption" color={trendColor(trend, theme)}>
                  {trend === 'improving' ? 'Rising' : trend === 'declining' ? 'Falling' : 'Stable'}
                </Text>
              </View>
            </View>
          )}

          {/* Urge average row */}
          {urgeAvg != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="footnote" dim style={{ flex: 1 }}>
                Avg urge strength
              </Text>
              <View
                style={{
                  backgroundColor: urgeColor(urgeAvg, theme) + '22',
                  borderRadius: radius.chip,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}
              >
                <Text variant="caption" color={urgeColor(urgeAvg, theme)}>
                  {round1(urgeAvg)}/10
                </Text>
              </View>
            </View>
          )}

          {/* Top triggers row */}
          {topTriggerList.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Text variant="footnote" dim>
                Most common triggers
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {topTriggerList.map(({ tag, count }) => (
                  <View
                    key={tag}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: theme.color.primarySoft,
                      borderRadius: radius.chip,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                    }}
                  >
                    <Text variant="caption" color={theme.color.primary}>
                      {tag}
                    </Text>
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: theme.color.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text variant="caption" color={theme.color.surface} style={{ fontSize: 9, lineHeight: 11 }}>
                        {count}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Clean-day detail */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="footnote" dim style={{ flex: 1 }}>
              Clean days (last 7)
            </Text>
            <Text
              variant="caption"
              color={cleanCount >= 5 ? theme.color.success : cleanCount >= 3 ? theme.color.celebrate : theme.color.danger}
            >
              {cleanCount} of 7 days clean
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

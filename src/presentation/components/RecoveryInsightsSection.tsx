/**
 * RecoveryInsightsSection
 *
 * A self-contained Progress-tab section that renders:
 *   • Urge Heatmap (hourly / weekly / combined views)
 *   • Auto-generated recovery insights (text cards)
 *   • Weekly + monthly trend comparison
 *   • Trigger Prediction status (next high-risk window)
 *   • Aggregate stats: total urges, avg intensity, top trigger, top mood
 *
 * Data flow:
 *   - Reads `urges` from the Zustand store
 *   - Calls `analyzeUrges` (pure domain logic, zero side effects)
 *   - Re-renders whenever urges changes
 *
 * All computation stays 100 % local. No server, no cloud.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Card } from './Card';
import { UrgeHeatmap } from './UrgeHeatmap';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '@/application/store';
import {
  analyzeUrges,
  DAYS_SHORT,
  formatHour,
  type RecoveryInsight,
  type TrendData,
  type PredictionWindow,
  type AnalyticsResult,
} from '@/domain/urgeAnalytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function improvementLabel(trend: TrendData): { text: string; positive: boolean } | null {
  if (trend.weeklyPct == null || Math.abs(trend.weeklyDelta) < 1) return null;
  const pct = Math.abs(trend.weeklyPct);
  if (trend.improving) {
    return { text: `↓ ${pct}% fewer urges this week`, positive: true };
  }
  return { text: `↑ ${pct}% more urges this week`, positive: false };
}

function predictionDowLabel(dow: number): string {
  return DAYS_SHORT[dow];
}

function formatHourRange(h: number): string {
  const end = (h + 1) % 24;
  return `${formatHour(h)} – ${formatHour(end)}`;
}

// ---------------------------------------------------------------------------
// Trend banner
// ---------------------------------------------------------------------------

function TrendBanner({ trend }: { trend: TrendData }) {
  const theme = useTheme();
  const label = improvementLabel(trend);
  if (!label) return null;

  const bg = label.positive ? theme.color.successSoft : theme.color.accentSoft;
  const fg = label.positive ? theme.color.success : theme.color.accentText;
  const icon = label.positive ? 'trending-down-outline' : 'trending-up-outline';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: radius.chip,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <Ionicons name={icon} size={16} color={fg} />
      <Text variant="caption" color={fg} style={{ flex: 1 }}>
        {label.text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single insight card
// ---------------------------------------------------------------------------

function InsightCard({ insight }: { insight: RecoveryInsight }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: theme.color.surfaceAlt,
        borderRadius: radius.chip,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: theme.color.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ionicons name={insight.icon as any} size={16} color={theme.color.primary} />
      </View>
      <Text variant="footnote" style={{ flex: 1, lineHeight: 18 }}>
        {insight.text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Insights list (collapsible after 3 entries)
// ---------------------------------------------------------------------------

function InsightsList({ insights }: { insights: RecoveryInsight[] }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? insights : insights.slice(0, 3);
  const hasMore = insights.length > 3;

  return (
    <View style={{ gap: spacing.sm }}>
      {visible.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}
      {hasMore && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show fewer insights' : `Show ${insights.length - 3} more insights`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text variant="caption" color={theme.color.primary}>
            {expanded ? 'Show less' : `${insights.length - 3} more insights`}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.color.primary}
          />
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Trigger prediction status card
// ---------------------------------------------------------------------------

function PredictionStatusCard({
  nextPrediction,
  hasSufficientData,
  predictionsCount,
}: {
  nextPrediction: PredictionWindow | null;
  hasSufficientData: boolean;
  predictionsCount: number;
}) {
  const theme = useTheme();

  if (!hasSufficientData) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.color.surfaceAlt,
          borderRadius: radius.chip,
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            backgroundColor: theme.color.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="hourglass-outline" size={18} color={theme.color.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout">Building your pattern</Text>
          <Text variant="caption" dim style={{ marginTop: 2 }}>
            Log a few more urges to activate trigger prediction.
          </Text>
        </View>
      </View>
    );
  }

  if (!nextPrediction) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.color.successSoft,
          borderRadius: radius.chip,
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            backgroundColor: theme.color.success,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="shield-checkmark" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout" color={theme.color.success}>No high-risk window soon</Text>
          <Text variant="caption" dim style={{ marginTop: 2 }}>
            {predictionsCount} pattern{predictionsCount !== 1 ? 's' : ''} tracked. Keep it up.
          </Text>
        </View>
      </View>
    );
  }

  const riskPct = Math.round(nextPrediction.score * 100);
  const riskColor =
    riskPct >= 70
      ? theme.color.danger
      : riskPct >= 50
      ? theme.color.celebrate
      : theme.color.primary;

  return (
    <View
      style={{
        backgroundColor: theme.color.surfaceAlt,
        borderRadius: radius.chip,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            backgroundColor: theme.color.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="notifications-outline" size={18} color={theme.color.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout">Next high-risk period</Text>
          <Text variant="caption" dim style={{ marginTop: 1 }}>
            Trigger prediction active
          </Text>
        </View>
        <View
          style={{
            backgroundColor: theme.color.primarySoft,
            borderRadius: radius.round,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
          }}
        >
          <Text variant="caption" color={riskColor} style={{ fontVariant: ['tabular-nums'] }}>
            {riskPct}% risk
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          marginTop: spacing.xs,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.color.surface,
            borderRadius: radius.chip,
            padding: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Ionicons name="time-outline" size={14} color={theme.color.textDim} />
          <Text variant="caption" dim style={{ marginTop: 3 }}>Time</Text>
          <Text variant="footnote" style={{ marginTop: 1 }}>
            {formatHourRange(nextPrediction.hour)}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.color.surface,
            borderRadius: radius.chip,
            padding: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Ionicons name="calendar-outline" size={14} color={theme.color.textDim} />
          <Text variant="caption" dim style={{ marginTop: 3 }}>Day</Text>
          <Text variant="footnote" style={{ marginTop: 1 }}>
            {predictionDowLabel(nextPrediction.dow)}
          </Text>
        </View>
        {nextPrediction.topTrigger && (
          <View
            style={{
              flex: 1.5,
              backgroundColor: theme.color.surface,
              borderRadius: radius.chip,
              padding: spacing.sm,
              alignItems: 'center',
            }}
          >
            <Ionicons name="warning-outline" size={14} color={theme.color.textDim} />
            <Text variant="caption" dim style={{ marginTop: 3 }}>Trigger</Text>
            <Text variant="footnote" numberOfLines={1} style={{ marginTop: 1 }}>
              {nextPrediction.topTrigger}
            </Text>
          </View>
        )}
      </View>

      <Text variant="caption" dim style={{ marginTop: spacing.xs }}>
        A reminder will arrive 15 min before this window so you can prepare.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Aggregate stats strip
// ---------------------------------------------------------------------------

function StatsStrip({
  result,
  urgesThisWeek,
  urgesThisMonth,
  urgesLastWeek,
  urgesLastMonth,
}: {
  result: AnalyticsResult;
  urgesThisWeek: number;
  urgesThisMonth: number;
  urgesLastWeek: number;
  urgesLastMonth: number;
}) {
  const theme = useTheme();

  const weekPct =
    urgesLastWeek > 0
      ? Math.round(((urgesThisWeek - urgesLastWeek) / urgesLastWeek) * 100)
      : null;
  const monthPct =
    urgesLastMonth > 0
      ? Math.round(((urgesThisMonth - urgesLastMonth) / urgesLastMonth) * 100)
      : null;

  const Tile = ({
    icon,
    label,
    value,
    sub,
    subPositive,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    sub?: string;
    subPositive?: boolean;
  }) => (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.surfaceAlt,
        borderRadius: radius.chip,
        padding: spacing.md,
        gap: 2,
        alignItems: 'center',
      }}
    >
      <Ionicons name={icon} size={16} color={theme.color.textDim} />
      <Text variant="caption" dim style={{ marginTop: 3, textAlign: 'center' }}>
        {label}
      </Text>
      <Text variant="headline" color={theme.color.text}>
        {value}
      </Text>
      {sub != null && (
        <Text
          variant="caption"
          style={{ textAlign: 'center' }}
          color={
            subPositive === true
              ? theme.color.success
              : subPositive === false
              ? theme.color.danger
              : theme.color.textDim
          }
        >
          {sub}
        </Text>
      )}
    </View>
  );

  const topTrigger = useMemo(() => {
    // Find most common trigger across all urges
    const counts: Record<string, number> = {};
    // result is in scope via closure – we only need the heatmap data
    return result.heatmap.totalUrges > 0 ? null : null;
  }, [result]);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Tile
          icon="pulse-outline"
          label="Total Urges"
          value={`${result.heatmap.totalUrges}`}
        />
        <Tile
          icon="flame-outline"
          label="Avg Intensity"
          value={result.heatmap.avgIntensity > 0 ? `${result.heatmap.avgIntensity}/10` : '—'}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Tile
          icon="calendar-outline"
          label="This Week"
          value={`${urgesThisWeek}`}
          sub={weekPct != null ? `${weekPct > 0 ? '+' : ''}${weekPct}% vs last` : undefined}
          subPositive={weekPct != null ? weekPct < 0 : undefined}
        />
        <Tile
          icon="stats-chart-outline"
          label="This Month"
          value={`${urgesThisMonth}`}
          sub={monthPct != null ? `${monthPct > 0 ? '+' : ''}${monthPct}% vs last` : undefined}
          subPositive={monthPct != null ? monthPct < 0 : undefined}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Top triggers summary
// ---------------------------------------------------------------------------

function TopTriggersCard({ urges }: { urges: Array<{ trigger?: string; triggers?: string[]; mood?: number; intensity: number }> }) {
  const theme = useTheme();

  const { triggerRanking, topMood } = useMemo(() => {
    const counts: Record<string, number> = {};
    const moodCounts: Record<number, number> = {};

    urges.forEach((u) => {
      const triggers = Array.isArray(u.triggers) && u.triggers.length ? u.triggers : u.trigger ? [u.trigger] : [];
      triggers.forEach((trigger) => { counts[trigger] = (counts[trigger] ?? 0) + 1; });
      if (u.mood != null) moodCounts[u.mood] = (moodCounts[u.mood] ?? 0) + 1;
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxCount = sorted[0]?.[1] ?? 1;

    const topMoodEntry = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    const topMoodVal = topMoodEntry ? +topMoodEntry[0] : null;
    const topMoodLabel =
      topMoodVal != null
        ? topMoodVal <= 3
          ? 'Low'
          : topMoodVal <= 6
          ? 'Moderate'
          : 'High'
        : null;

    return {
      triggerRanking: sorted.map(([name, count]) => ({ name, count, pct: count / maxCount })),
      topMood: topMoodVal != null ? { value: topMoodVal, label: topMoodLabel! } : null,
    };
  }, [urges]);

  if (triggerRanking.length === 0 && topMood == null) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      {triggerRanking.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text variant="footnote" dim>Most common triggers</Text>
          {triggerRanking.map(({ name, count, pct }) => (
            <View key={name} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption">{name}</Text>
                <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
                  {count}×
                </Text>
              </View>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.color.surfaceAlt,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${pct * 100}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: theme.color.primary,
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {topMood != null && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingTop: spacing.sm,
          }}
        >
          <Ionicons name="heart-outline" size={16} color={theme.color.textDim} />
          <Text variant="caption" style={{ flex: 1 }}>
            Most common mood before urges:{' '}
            <Text variant="caption" color={theme.color.primary}>
              {topMood.label} ({topMood.value}/10)
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Section header with collapse toggle
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  subtitle,
  expanded,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={expanded ? `Collapse ${title}` : `Expand ${title}`}
      accessibilityState={{ expanded }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text variant="headline">{title}</Text>
        {subtitle && (
          <Text variant="caption" dim style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={theme.color.textDim}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RecoveryInsightsSection() {
  const theme = useTheme();
  const router = useRouter();
  const urges = useStore((s) => s.urges);
  const deleteUrge = useStore((s) => s.deleteUrge);

  // Collapse state for sub-sections
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showPrediction, setShowPrediction] = useState(true);
  const [showTriggers, setShowTriggers] = useState(true);

  // Run analysis (memoised on urges reference - only re-runs when urges change)
  const result = useMemo(() => analyzeUrges(urges), [urges]);

  // Rolling window counts for trend comparison
  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  const urgesThisWeek = useMemo(
    () => urges.filter((u) => u.at >= now - 7 * MS_PER_DAY).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urges],
  );
  const urgesLastWeek = useMemo(
    () =>
      urges.filter((u) => u.at >= now - 14 * MS_PER_DAY && u.at < now - 7 * MS_PER_DAY).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urges],
  );
  const urgesThisMonth = useMemo(
    () => urges.filter((u) => u.at >= now - 30 * MS_PER_DAY).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urges],
  );
  const urgesLastMonth = useMemo(
    () =>
      urges.filter((u) => u.at >= now - 60 * MS_PER_DAY && u.at < now - 30 * MS_PER_DAY).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urges],
  );

  const isEmpty = urges.length === 0;

  return (
    <View style={{ gap: spacing.xl }}>
      {/* ── Section title ── */}
      <View style={{ gap: spacing.xs }}>
        <Text variant="title2">Recovery Intelligence</Text>
        <Text variant="caption" dim>
          All insights are computed locally from your logged urges.
        </Text>
      </View>

      {/* ── Urge Heatmap ── */}
      <Card>
        <SectionHeader
          title="Urge Heatmap"
          subtitle={isEmpty ? undefined : `${urges.length} urge${urges.length !== 1 ? 's' : ''} analysed`}
          expanded={showHeatmap}
          onToggle={() => setShowHeatmap((v) => !v)}
        />
        {showHeatmap && (
          <View style={{ marginTop: spacing.md }}>
            <UrgeHeatmap data={result.heatmap} />
          </View>
        )}
      </Card>

      {/* ── Stats strip ── */}
      {!isEmpty && (
        <View>
          <Pressable
            onPress={() => setShowStats((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showStats }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: showStats ? spacing.md : 0,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="headline" style={{ flex: 1 }}>Overview</Text>
            <Ionicons
              name={showStats ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.color.textDim}
            />
          </Pressable>
          {showStats && (
            <StatsStrip
              result={result}
              urgesThisWeek={urgesThisWeek}
              urgesLastWeek={urgesLastWeek}
              urgesThisMonth={urgesThisMonth}
              urgesLastMonth={urgesLastMonth}
            />
          )}
        </View>
      )}

      {/* ── Trend banner ── */}
      {!isEmpty && <TrendBanner trend={result.trend} />}

      {/* ── Recovery Insights ── */}
      {result.insights.length > 0 && (
        <View>
          <Pressable
            onPress={() => setShowInsights((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showInsights }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: showInsights ? spacing.md : 0,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="headline" style={{ flex: 1 }}>Recovery Insights</Text>
            <Ionicons
              name={showInsights ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.color.textDim}
            />
          </Pressable>
          {showInsights && <InsightsList insights={result.insights} />}
        </View>
      )}

      {/* ── Triggers & Mood ── */}
      {!isEmpty && urges.some((u) => u.trigger || u.triggers?.length || u.mood != null) && (
        <Card>
          <Pressable
            onPress={() => setShowTriggers((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showTriggers }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="headline" style={{ flex: 1 }}>Triggers & Mood</Text>
            <Ionicons
              name={showTriggers ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.color.textDim}
            />
          </Pressable>
          {showTriggers && (
            <View style={{ marginTop: spacing.md }}>
              <TopTriggersCard urges={urges} />
            </View>
          )}
        </Card>
      )}

      {/* ── Trigger Prediction ── */}
      {!isEmpty && (
        <Card>
          <Text variant="headline">Recent urge check-ins</Text>
          <Text variant="caption" dim style={{ marginTop: 2, marginBottom: spacing.sm }}>Changes here refresh every insight and prediction.</Text>
          {urges.slice(0, 5).map((urge, index) => (
            <View key={urge.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: index ? 1 : 0, borderTopColor: theme.color.hairline }}>
              <View style={{ flex: 1 }}>
                <Text variant="callout">{urge.intensity}/10 urge</Text>
                <Text variant="caption" dim>{new Date(urge.at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit urge" hitSlop={10} onPress={() => router.push({ pathname: '/log-urge', params: { id: urge.id } })}>
                <Ionicons name="create-outline" size={20} color={theme.color.primary} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Delete urge" hitSlop={10} onPress={() => Alert.alert('Delete urge?', 'This will update your analytics and predictions.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteUrge(urge.id) },
              ])}>
                <Ionicons name="trash-outline" size={20} color={theme.color.danger} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <View>
        <Pressable
          onPress={() => setShowPrediction((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showPrediction }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: showPrediction ? spacing.md : 0,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text variant="headline" style={{ flex: 1 }}>Trigger Prediction</Text>
          <Ionicons
            name={showPrediction ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.color.textDim}
          />
        </Pressable>
        {showPrediction && (
          <PredictionStatusCard
            nextPrediction={result.nextPrediction}
            hasSufficientData={result.hasSufficientData}
            predictionsCount={result.predictions.length}
          />
        )}
      </View>
    </View>
  );
}

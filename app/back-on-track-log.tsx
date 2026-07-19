/**
 * Back on Track - the single hub screen.
 * Route: /back-on-track-log
 *
 * Stats, trend charts, expandable entry cards, add button, insights.
 * Everything Back on Track lives here. After submitting the assessment
 * (via /back-on-track), the user lands back here with the new entry visible.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { elevation, spacing, radius } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import {
  backOnTrackAvailability,
  generateInsights,
  type BackOnTrackEntry,
} from '@/domain/backOnTrack';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Score maps ────────────────────────────────────────────────────────────

const WELLBEING_SCORES: Record<string, number> = { 'Excellent': 5, 'Good': 4, 'Fair': 3, 'Poor': 2, 'Very Poor': 1 };
const ENERGY_SCORES: Record<string, number> = { 'Very High': 5, 'High': 4, 'Average': 3, 'Low': 2, 'Very Low': 1 };
const SLEEP_SCORES: Record<string, number> = { 'Excellent': 5, 'Good': 4, 'Fair': 3, 'Poor': 2, 'Very Poor': 1 };
const MOOD_SCORES: Record<string, number> = { 'Very Positive': 5, 'Mostly Positive': 4, 'Neutral': 3, 'Mostly Negative': 2, 'Very Negative': 1 };
const CRAVING_SCORES: Record<string, number> = { 'None': 5, 'Mild': 4, 'Moderate': 3, 'Strong': 2, 'Very Strong': 1 };
const SUBSTANCE_SCORES: Record<string, number> = { 'No': 4, 'Once': 3, 'A Few Times': 2, 'Frequently': 1 };

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, color, delay,
}: {
  icon: string; value: string | number; label: string; color: string; delay?: number;
}) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay ?? 0).springify().damping(16)}
      style={{ flex: 1 }}
    >
      <View style={{
        flex: 1,
        backgroundColor: theme.color.surface,
        borderRadius: radius.input,
        padding: spacing.md,
        alignItems: 'flex-start',
        gap: 2,
        borderWidth: 1,
        borderColor: color + '24',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name={icon as any} size={15} color={color} />
          <Text variant="caption" color={color}>{label}</Text>
        </View>
        <Text variant="title2" color={color} style={{ fontFamily: 'Nunito_900Black' }}>
          {value}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Entry card (expandable) ───────────────────────────────────────────────

function EntryCard({ entry, index }: { entry: BackOnTrackEntry; index: number }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const chevronRot = useSharedValue(0);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
    chevronRot.value = withSpring(expanded ? 0 : 1, { damping: 15, stiffness: 200 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value * 90}deg` }],
  }));

  const rows: { icon: string; color: string; label: string; value: string }[] = [
    { icon: 'heart-outline', color: theme.color.success, label: 'Well-being', value: entry.overallWellBeing },
    { icon: 'swap-horizontal-outline', color: theme.color.primary, label: 'Comparison', value: entry.weekComparison },
    { icon: 'flash-outline', color: theme.color.celebrateText, label: 'Energy', value: entry.energyLevel },
    { icon: 'moon-outline', color: theme.color.primary, label: 'Sleep', value: entry.sleepQuality },
    { icon: 'eye-outline', color: theme.color.accentText, label: 'Focus', value: entry.focusLevel },
    { icon: 'happy-outline', color: entry.moodRating.includes('Positive') ? theme.color.success : theme.color.danger, label: 'Mood', value: entry.moodRating },
    { icon: 'flame-outline', color: entry.cravingStrength === 'None' ? theme.color.success : theme.color.danger, label: 'Cravings', value: entry.cravingStrength },
    { icon: 'body-outline', color: entry.physicalDiscomfort === 'None' ? theme.color.success : theme.color.danger, label: 'Physical', value: entry.physicalDiscomfort },
    { icon: 'close-circle-outline', color: entry.substanceUse === 'No' ? theme.color.success : theme.color.danger, label: 'Substance Use', value: entry.substanceUse },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 40).springify().damping(20)}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => ({ opacity: pressed ? 0.97 : 1 })}
      >
        <View style={{
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          overflow: 'hidden',
        }}>
          {/* Header row */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
          }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="trending-up" size={18} color={theme.color.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>
                {formatDate(entry.at)}
              </Text>
              <Text variant="caption" dim style={{ marginTop: 1 }}>
                Well-being: {entry.overallWellBeing} · Mood: {entry.moodRating}
              </Text>
            </View>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-forward" size={16} color={theme.color.textDim} />
            </Animated.View>
          </View>

          {/* Expanded details */}
          {expanded && (
            <View style={{
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.md,
              gap: spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.color.hairline,
              paddingTop: spacing.sm,
            }}>
              {rows.map((row) => (
                <View key={row.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <Ionicons name={row.icon as any} size={14} color={row.color} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Text variant="caption" dim style={{ width: 80, flexShrink: 0 }}>{row.label}</Text>
                  <Text variant="caption" style={{ flex: 1 }}>{row.value}</Text>
                </View>
              ))}
              {entry.notes.trim().length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xs }}>
                  <Ionicons name="create-outline" size={14} color={theme.color.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Text variant="caption" dim style={{ width: 80, flexShrink: 0 }}>Notes</Text>
                  <Text variant="caption" style={{ flex: 1, fontStyle: 'italic' }}>{entry.notes}</Text>
                </View>
              )}
              <Text variant="caption" dim style={{ marginTop: spacing.xs }}>
                Completed at {formatTime(entry.at)}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────

// ── Line chart with dots ──────────────────────────────────────────────────

function LineChart({
  data,
  label,
  maxValue,
  color,
  labels,
}: {
  data: { value: number; at: number }[];
  label: string;
  maxValue: number;
  color: string;
  labels?: string[];
}) {
  const theme = useTheme();
  if (data.length < 2) return null;

  const CHART_HEIGHT = 120;
  const POINT_SIZE = 8;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>
        {label}
      </Text>
      <View style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        padding: spacing.md,
      }}>
        <View style={{ flexDirection: 'row', height: CHART_HEIGHT }}>
          <View style={{ width: 30, justifyContent: 'space-between', paddingBottom: POINT_SIZE }}>
            {[maxValue, Math.round(maxValue / 2), 0].map((v, i) => (
              <Text key={i} variant="caption" dim style={{ fontSize: 10, textAlign: 'right' }}>
                {v}
              </Text>
            ))}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm, position: 'relative' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <View
                key={pct}
                style={{
                  position: 'absolute',
                  top: CHART_HEIGHT * (1 - pct) - 0.5,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: theme.color.hairline,
                }}
              />
            ))}
            {data.map((d, i) => {
              const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
              const y = CHART_HEIGHT * (1 - d.value / maxValue);
              return (
                <View key={i}>
                  <View
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: Math.max(0, y - 18),
                      marginLeft: -12,
                      width: 24,
                      alignItems: 'center',
                    }}
                  >
                    <Text variant="caption" style={{ fontSize: 9, color: theme.color.textDim }}>
                      {d.value}
                    </Text>
                  </View>
                  <View
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: y - POINT_SIZE / 2,
                      width: POINT_SIZE,
                      height: POINT_SIZE,
                      borderRadius: POINT_SIZE / 2,
                      backgroundColor: color,
                      marginLeft: -POINT_SIZE / 2,
                      borderWidth: 2,
                      borderColor: theme.color.surface,
                      zIndex: 1,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
          <View style={{ width: 30 }} />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
            {data.map((d, i) => {
              const show = data.length <= 6 || i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 5) === 0;
              if (!show) return <View key={i} style={{ flex: 1 }} />;
              return (
                <Text key={i} variant="caption" dim style={{ fontSize: 10, flex: 1, textAlign: 'center' }}>
                  {labels?.[i] ?? `W${i + 1}`}
                </Text>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Week-over-week comparison cards ────────────────────────────────────────

function DeltaCard({ label, prevLabel, currLabel, prevScore, currScore }: {
  label: string;
  prevLabel: string;
  currLabel: string;
  prevScore: number;
  currScore: number;
}) {
  const theme = useTheme();
  const diff = currScore - prevScore;
  const improved = diff > 0;
  const same = diff === 0;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: theme.color.hairline,
    }}>
      <Text variant="caption" dim style={{ width: 80, flexShrink: 0 }}>{label}</Text>
      <Text variant="caption" style={{ width: 70, flexShrink: 0 }}>{prevLabel}</Text>
      <Ionicons
        name="arrow-forward"
        size={12}
        color={improved ? theme.color.success : same ? theme.color.textDim : theme.color.danger}
      />
      <Text variant="caption" style={{ width: 70, flexShrink: 0, fontFamily: 'Nunito_700Bold' }}>{currLabel}</Text>
      <View style={{
        marginLeft: 'auto',
        paddingHorizontal: spacing.sm, paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: improved ? theme.color.success + '18' : same ? theme.color.surfaceAlt : theme.color.danger + '18',
      }}>
        <Text variant="caption" style={{
          fontFamily: 'Nunito_700Bold',
          color: improved ? theme.color.success : same ? theme.color.textDim : theme.color.danger,
        }}>
          {improved ? '↑ Better' : same ? '→ Same' : '↓ Worse'}
        </Text>
      </View>
    </View>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────

function SearchBar({ query, onChange }: { query: string; onChange: (s: string) => void }) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.color.surface,
        borderRadius: radius.input + 4,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: theme.color.hairline,
      }}
    >
      <Ionicons name="search" size={15} color={theme.color.textDim} />
      <TextInput
        value={query}
        onChangeText={onChange}
        placeholder="Search check-ins..."
        placeholderTextColor={theme.color.textDim}
        returnKeyType="search"
        style={{
          flex: 1,
          marginLeft: spacing.sm,
          fontSize: 15,
          color: theme.color.text,
          paddingVertical: spacing.xs,
        }}
      />
      {query.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={theme.color.textDim} />
        </Pressable>
      )}
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function BackOnTrackLog() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const entries = useStore((s) => s.backOnTrackEntries);
  const lastBackOnTrackAt = useStore((s) => s.lastBackOnTrackAt);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const toggleSearch = useCallback(() => {
    setSearching((v) => {
      if (v) setQuery('');
      return !v;
    });
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const availability = backOnTrackAvailability(lastBackOnTrackAt);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = entries.length;
    const avgWellbeing = total > 0
      ? Math.round(entries.reduce((s, e) => s + (WELLBEING_SCORES[e.overallWellBeing] ?? 3), 0) / total * 10) / 10
      : null;
    const substanceFree = entries.filter((e) => e.substanceUse === 'No').length;
    return { total, avgWellbeing, substanceFree };
  }, [entries]);

  // ── Filtered entries ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return entries
      .filter((e) => {
        if (query) {
          const q = query.toLowerCase();
          return (
            e.overallWellBeing.toLowerCase().includes(q) ||
            e.moodRating.toLowerCase().includes(q) ||
            e.substanceUse.toLowerCase().includes(q) ||
            e.cravingStrength.toLowerCase().includes(q) ||
            e.notes.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.at - a.at);
  }, [entries, query]);

  // ── Insights ─────────────────────────────────────────────────────────────
  const insights = useMemo(() => generateInsights(entries), [entries]);

  // ── Trend data ───────────────────────────────────────────────────────────
  const sorted = useMemo(() => [...entries].sort((a, b) => a.at - b.at), [entries]);

  const wellbeingData = useMemo(() =>
    sorted.map((e) => ({ value: WELLBEING_SCORES[e.overallWellBeing] ?? 3, at: e.at })),
    [sorted]);

  const moodData = useMemo(() =>
    sorted.map((e) => ({ value: MOOD_SCORES[e.moodRating] ?? 3, at: e.at })),
    [sorted]);

  const energyData = useMemo(() =>
    sorted.map((e) => ({ value: ENERGY_SCORES[e.energyLevel] ?? 3, at: e.at })),
    [sorted]);

  const sleepData = useMemo(() =>
    sorted.map((e) => ({ value: SLEEP_SCORES[e.sleepQuality] ?? 3, at: e.at })),
    [sorted]);

  const cravingData = useMemo(() =>
    sorted.map((e) => ({ value: CRAVING_SCORES[e.cravingStrength] ?? 3, at: e.at })),
    [sorted]);

  const substanceData = useMemo(() =>
    sorted.map((e) => ({ value: SUBSTANCE_SCORES[e.substanceUse] ?? 2, at: e.at })),
    [sorted]);

  const weekLabels = useMemo(() =>
    sorted.map((_, i) => `W${i + 1}`),
    [sorted]);

  // ── Week-over-week comparison ────────────────────────────────────────────
  const hasComparison = entries.length >= 2;
  const newest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
      }}>
        <Pressable
          onPress={safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
            marginRight: spacing.md,
          })}
        >
          <Ionicons name="chevron-back" size={20} color={theme.color.primary} />
        </Pressable>
        <Text variant="title1" style={{ flex: 1, fontFamily: 'Nunito_900Black' }}>Back on Track</Text>

        <Pressable
          onPress={toggleSearch}
          accessibilityRole="button"
          accessibilityLabel={searching ? 'Close search' : 'Search check-ins'}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: spacing.xs })}
        >
          <Ionicons
            name={searching ? 'close-outline' : 'search-outline'}
            size={22}
            color={searching ? theme.color.primary : theme.color.textDim}
          />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/back-on-track');
          }}
          disabled={!availability.available}
          accessibilityRole="button"
          accessibilityLabel={availability.available ? 'Add new check-in' : `Available in ${availability.daysLeft} days`}
          hitSlop={12}
          style={({ pressed }) => ({
            marginLeft: spacing.md,
            opacity: pressed ? 0.5 : availability.available ? 1 : 0.3,
            padding: spacing.xs,
          })}
        >
          <Ionicons name="create-outline" size={22} color={theme.color.primary} />
        </Pressable>
      </View>

      {/* Search bar */}
      {searching && <SearchBar query={query} onChange={setQuery} />}

      {/* Cooldown banner */}
      {!availability.available && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card,
          padding: spacing.md, marginBottom: spacing.xl,
        }}>
          <Ionicons name="time-outline" size={16} color={theme.color.textDim} />
          <Text variant="caption" dim style={{ flex: 1 }}>
            Next check-in available in {availability.daysLeft} {availability.daysLeft === 1 ? 'day' : 'days'}
          </Text>
        </View>
      )}

      {/* Stats row */}
      {entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
          <StatCard icon="document-text" value={stats.total} label="Check-ins" color={theme.color.primary} delay={0} />
          <StatCard icon="heart" value={stats.avgWellbeing ?? '-'} label="Avg Well-being" color={theme.color.success} delay={60} />
          <StatCard icon="close-circle" value={stats.substanceFree} label="Substance-Free" color={theme.color.success} delay={120} />
        </View>
      )}

      {/* Charts — only after 2+ entries */}
      {entries.length >= 2 && (
        <View style={{ marginBottom: spacing.xl }}>
          <LineChart
            data={wellbeingData}
            label="Overall Well-being"
            maxValue={5}
            color={theme.color.success}
            labels={weekLabels}
          />
          <LineChart
            data={moodData}
            label="Mood"
            maxValue={5}
            color={theme.color.primary}
            labels={weekLabels}
          />
          <LineChart
            data={energyData}
            label="Energy Level"
            maxValue={5}
            color={theme.color.celebrateText}
            labels={weekLabels}
          />
          <LineChart
            data={sleepData}
            label="Sleep Quality"
            maxValue={5}
            color={theme.color.accentText}
            labels={weekLabels}
          />
          <LineChart
            data={cravingData}
            label="Craving Strength"
            maxValue={5}
            color={theme.color.danger}
            labels={weekLabels}
          />
          <LineChart
            data={substanceData}
            label="Substance Use (fewer is better)"
            maxValue={4}
            color={theme.color.success}
            labels={weekLabels}
          />
        </View>
      )}

      {/* Week-over-week comparison — only after 2+ entries */}
      {hasComparison && newest && previous && (
        <View style={{ marginBottom: spacing.xl }}>
          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>
            This Week vs Last Week
          </Text>
          <View style={{
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            padding: spacing.md,
          }}>
            <DeltaCard
              label="Well-being"
              prevLabel={previous.overallWellBeing}
              currLabel={newest.overallWellBeing}
              prevScore={WELLBEING_SCORES[previous.overallWellBeing] ?? 3}
              currScore={WELLBEING_SCORES[newest.overallWellBeing] ?? 3}
            />
            <DeltaCard
              label="Mood"
              prevLabel={previous.moodRating}
              currLabel={newest.moodRating}
              prevScore={MOOD_SCORES[previous.moodRating] ?? 3}
              currScore={MOOD_SCORES[newest.moodRating] ?? 3}
            />
            <DeltaCard
              label="Energy"
              prevLabel={previous.energyLevel}
              currLabel={newest.energyLevel}
              prevScore={ENERGY_SCORES[previous.energyLevel] ?? 3}
              currScore={ENERGY_SCORES[newest.energyLevel] ?? 3}
            />
            <DeltaCard
              label="Sleep"
              prevLabel={previous.sleepQuality}
              currLabel={newest.sleepQuality}
              prevScore={SLEEP_SCORES[previous.sleepQuality] ?? 3}
              currScore={SLEEP_SCORES[newest.sleepQuality] ?? 3}
            />
            <DeltaCard
              label="Cravings"
              prevLabel={previous.cravingStrength}
              currLabel={newest.cravingStrength}
              prevScore={CRAVING_SCORES[previous.cravingStrength] ?? 3}
              currScore={CRAVING_SCORES[newest.cravingStrength] ?? 3}
            />
            <DeltaCard
              label="Substance Use"
              prevLabel={previous.substanceUse}
              currLabel={newest.substanceUse}
              prevScore={SUBSTANCE_SCORES[previous.substanceUse] ?? 2}
              currScore={SUBSTANCE_SCORES[newest.substanceUse] ?? 2}
            />
          </View>
        </View>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
          {insights.slice(0, 3).map((insight) => (
            <View
              key={insight.label}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: theme.color.surface, borderRadius: radius.card,
                borderWidth: 1, borderColor: theme.color.hairline,
                padding: spacing.md,
              }}
            >
              <Ionicons
                name={insight.trend === 'improving' ? 'arrow-up-circle' : insight.trend === 'declining' ? 'arrow-down-circle' : 'remove-circle'}
                size={18}
                color={insight.trend === 'improving' ? theme.color.success : insight.trend === 'declining' ? theme.color.danger : theme.color.primary}
              />
              <Text variant="caption" style={{ flex: 1, lineHeight: 18 }}>
                {insight.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Entry list or empty state */}
      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing.lg,
          }}>
            <Ionicons name="trending-up" size={32} color={theme.color.textDim} />
          </View>
          <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.sm }}>
            {entries.length === 0 ? 'No check-ins yet' : 'No results found'}
          </Text>
          <Text variant="footnote" dim center style={{ lineHeight: 20, marginBottom: spacing.lg }}>
            {entries.length === 0
              ? 'Take a couple of minutes to reflect on your recovery this week.'
              : 'Try a different search term.'}
          </Text>
          {entries.length === 0 && (
            <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic', marginBottom: spacing.lg }}>
              This reflection helps you monitor changes in your overall well-being during recovery. It is not a medical evaluation or diagnosis.
            </Text>
          )}
          {entries.length === 0 && (
            <Button
              label="Start Your First Check-In"
              onPress={() => router.push('/back-on-track')}
              full
            />
          )}
        </View>
      ) : (
        <View style={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
          {filtered.map((entry, i) => (
            <EntryCard key={entry.id} entry={entry} index={i} />
          ))}
        </View>
      )}

      {/* Disclaimer */}
      <View style={{
        backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card,
        padding: spacing.md, marginBottom: spacing.xl,
      }}>
        <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic' }}>
          Back on Track is a self-reflection tool for monitoring personal recovery and well-being. It is not a medical evaluation or diagnosis.
        </Text>
      </View>
    </Screen>
  );
}

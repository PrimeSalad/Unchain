/**
 * Catch Your Breath - the single hub screen.
 * Route: /catch-your-breath-log
 *
 * Stats, trend charts, expandable entry cards, add button, insights.
 * Everything Catch Your Breath lives here. After submitting the assessment
 * (via /catch-your-breath), the user lands back here with the new entry visible.
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
import { elevation, spacing, radius } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import {
  catchYourBreathAvailability,
  generateInsights,
  type CatchYourBreathEntry,
} from '@/domain/catchYourBreath';

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

function EntryCard({ entry, index }: { entry: CatchYourBreathEntry; index: number }) {
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
    { icon: 'leaf-outline', color: theme.color.success, label: 'Breathing', value: entry.breathingRating },
    { icon: 'swap-horizontal-outline', color: theme.color.primary, label: 'Comparison', value: entry.breathingComparison },
    { icon: 'medical-outline', color: theme.color.celebrateText, label: 'Coughing', value: entry.coughFrequency },
    { icon: 'water-outline', color: theme.color.primary, label: 'Mucus', value: entry.mucusFrequency },
    { icon: 'body-outline', color: theme.color.accentText, label: 'Out of Breath', value: entry.shortnessOfBreath },
    { icon: 'volume-medium-outline', color: theme.color.danger, label: 'Wheezing', value: entry.wheezingFrequency },
    { icon: 'heart-outline', color: theme.color.danger, label: 'Chest', value: entry.chestDiscomfort },
    { icon: 'walk-outline', color: theme.color.success, label: 'Activity', value: entry.activityTolerance },
    { icon: 'close-circle-outline', color: entry.smokingFrequency === "I didn't smoke" ? theme.color.success : theme.color.danger, label: 'Smoking', value: entry.smokingFrequency },
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
              backgroundColor: theme.color.successSoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="fitness" size={18} color={theme.color.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>
                {formatDate(entry.at)}
              </Text>
              <Text variant="caption" dim style={{ marginTop: 1 }}>
                Breathing: {entry.breathingRating} · Smoking: {entry.smokingFrequency}
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

const BREATHING_SCORES: Record<string, number> = { 'Excellent': 5, 'Good': 4, 'Fair': 3, 'Poor': 2, 'Very Poor': 1 };
const SMOKING_SCORES: Record<string, number> = { "I didn't smoke": 4, 'Less than usual': 3, 'About the same': 2, 'More than usual': 1 };
const WHEEZING_SCORES: Record<string, number> = { 'Never': 3, 'Sometimes': 2, 'Often': 1 };
const SHORTNESS_SCORES: Record<string, number> = {
  'I rarely get out of breath': 4,
  'After climbing several flights of stairs': 3,
  'After one flight of stairs': 2,
  'During light walking': 1,
  'Even while resting': 0,
};
const COUGH_SCORES: Record<string, number> = { 'Never': 4, 'Occasionally': 3, 'Frequently': 2, 'Almost Every Day': 1 };
const ACTIVITY_SCORES: Record<string, number> = { 'More than 30 minutes': 4, '15–30 minutes': 3, '5–15 minutes': 2, 'Less than 5 minutes': 1 };

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
          {/* Y-axis labels */}
          <View style={{ width: 30, justifyContent: 'space-between', paddingBottom: POINT_SIZE }}>
            {[maxValue, Math.round(maxValue / 2), 0].map((v, i) => (
              <Text key={i} variant="caption" dim style={{ fontSize: 10, textAlign: 'right' }}>
                {v}
              </Text>
            ))}
          </View>

          {/* Chart area */}
          <View style={{ flex: 1, marginLeft: spacing.sm, position: 'relative' }}>
            {/* Grid lines */}
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

            {/* Data points with value labels */}
            {data.map((d, i) => {
              const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
              const y = CHART_HEIGHT * (1 - d.value / maxValue);
              return (
                <View key={i}>
                  {/* Value label above dot */}
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
                  {/* Dot */}
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

        {/* X-axis labels */}
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
        placeholder="Search reflections..."
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

export default function CatchYourBreathLog() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const entries = useStore((s) => s.catchYourBreathEntries);
  const lastCatchYourBreathAt = useStore((s) => s.lastCatchYourBreathAt);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const toggleSearch = useCallback(() => {
    setSearching((v) => {
      if (v) setQuery('');
      return !v;
    });
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const availability = catchYourBreathAvailability(lastCatchYourBreathAt);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = entries.length;
    const breathingScores: Record<string, number> = { 'Excellent': 5, 'Good': 4, 'Fair': 3, 'Poor': 2, 'Very Poor': 1 };
    const avgBreathing = total > 0
      ? Math.round(entries.reduce((s, e) => s + (breathingScores[e.breathingRating] ?? 3), 0) / total * 10) / 10
      : null;
    const smokeFree = entries.filter((e) => e.smokingFrequency === "I didn't smoke").length;
    return { total, avgBreathing, smokeFree };
  }, [entries]);

  // ── Filtered entries ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return entries
      .filter((e) => {
        if (query) {
          const q = query.toLowerCase();
          return (
            e.breathingRating.toLowerCase().includes(q) ||
            e.smokingFrequency.toLowerCase().includes(q) ||
            e.coughFrequency.toLowerCase().includes(q) ||
            e.wheezingFrequency.toLowerCase().includes(q) ||
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

  const breathingData = useMemo(() =>
    sorted.map((e) => ({ value: BREATHING_SCORES[e.breathingRating] ?? 3, at: e.at })),
    [sorted]);

  const smokingData = useMemo(() =>
    sorted.map((e) => ({ value: SMOKING_SCORES[e.smokingFrequency] ?? 2, at: e.at })),
    [sorted]);

  const wheezingData = useMemo(() =>
    sorted.map((e) => ({ value: WHEEZING_SCORES[e.wheezingFrequency] ?? 2, at: e.at })),
    [sorted]);

  const shortnessData = useMemo(() =>
    sorted.map((e) => ({ value: SHORTNESS_SCORES[e.shortnessOfBreath] ?? 2, at: e.at })),
    [sorted]);

  const coughData = useMemo(() =>
    sorted.map((e) => ({ value: COUGH_SCORES[e.coughFrequency] ?? 2, at: e.at })),
    [sorted]);

  const activityData = useMemo(() =>
    sorted.map((e) => ({ value: ACTIVITY_SCORES[e.activityTolerance] ?? 2, at: e.at })),
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
        <Text variant="title1" style={{ flex: 1, fontFamily: 'Nunito_900Black' }}>Catch Your Breath</Text>

        <Pressable
          onPress={toggleSearch}
          accessibilityRole="button"
          accessibilityLabel={searching ? 'Close search' : 'Search reflections'}
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
            router.push('/catch-your-breath');
          }}
          disabled={!availability.available}
          accessibilityRole="button"
          accessibilityLabel={availability.available ? 'Add new reflection' : `Available in ${availability.daysLeft} days`}
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
            Next reflection available in {availability.daysLeft} {availability.daysLeft === 1 ? 'day' : 'days'}
          </Text>
        </View>
      )}

      {/* Stats row */}
      {entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
          <StatCard icon="document-text" value={stats.total} label="Reflections" color={theme.color.success} delay={0} />
          <StatCard icon="leaf" value={stats.avgBreathing ?? '-'} label="Avg Breathing" color={theme.color.primary} delay={60} />
          <StatCard icon="close-circle" value={stats.smokeFree} label="Smoke-Free" color={theme.color.success} delay={120} />
        </View>
      )}

      {/* Charts — only after 2+ entries */}
      {entries.length >= 2 && (
        <View style={{ marginBottom: spacing.xl }}>
          <LineChart
            data={breathingData}
            label="Breathing Rating"
            maxValue={5}
            color={theme.color.success}
            labels={weekLabels}
          />
          <LineChart
            data={smokingData}
            label="Smoking Frequency"
            maxValue={4}
            color={theme.color.primary}
            labels={weekLabels}
          />
          <LineChart
            data={shortnessData}
            label="Shortness of Breath"
            maxValue={4}
            color={theme.color.accentText}
            labels={weekLabels}
          />
          <LineChart
            data={wheezingData}
            label="Wheezing"
            maxValue={3}
            color={theme.color.danger}
            labels={weekLabels}
          />
          <LineChart
            data={coughData}
            label="Cough Frequency"
            maxValue={4}
            color={theme.color.celebrateText}
            labels={weekLabels}
          />
          <LineChart
            data={activityData}
            label="Activity Tolerance"
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
              label="Breathing"
              prevLabel={previous.breathingRating}
              currLabel={newest.breathingRating}
              prevScore={BREATHING_SCORES[previous.breathingRating] ?? 3}
              currScore={BREATHING_SCORES[newest.breathingRating] ?? 3}
            />
            <DeltaCard
              label="Smoking"
              prevLabel={previous.smokingFrequency}
              currLabel={newest.smokingFrequency}
              prevScore={SMOKING_SCORES[previous.smokingFrequency] ?? 2}
              currScore={SMOKING_SCORES[newest.smokingFrequency] ?? 2}
            />
            <DeltaCard
              label="Coughing"
              prevLabel={previous.coughFrequency}
              currLabel={newest.coughFrequency}
              prevScore={COUGH_SCORES[previous.coughFrequency] ?? 2}
              currScore={COUGH_SCORES[newest.coughFrequency] ?? 2}
            />
            <DeltaCard
              label="Wheezing"
              prevLabel={previous.wheezingFrequency}
              currLabel={newest.wheezingFrequency}
              prevScore={WHEEZING_SCORES[previous.wheezingFrequency] ?? 2}
              currScore={WHEEZING_SCORES[newest.wheezingFrequency] ?? 2}
            />
            <DeltaCard
              label="Out of Breath"
              prevLabel={previous.shortnessOfBreath}
              currLabel={newest.shortnessOfBreath}
              prevScore={SHORTNESS_SCORES[previous.shortnessOfBreath] ?? 2}
              currScore={SHORTNESS_SCORES[newest.shortnessOfBreath] ?? 2}
            />
            <DeltaCard
              label="Activity"
              prevLabel={previous.activityTolerance}
              currLabel={newest.activityTolerance}
              prevScore={ACTIVITY_SCORES[previous.activityTolerance] ?? 2}
              currScore={ACTIVITY_SCORES[newest.activityTolerance] ?? 2}
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
            <Ionicons name="fitness" size={32} color={theme.color.textDim} />
          </View>
          <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.sm }}>
            {entries.length === 0 ? 'No reflections yet' : 'No results found'}
          </Text>
          <Text variant="footnote" dim center style={{ lineHeight: 20, marginBottom: spacing.lg }}>
            {entries.length === 0
              ? 'Take a moment to reflect on how your lungs have felt this week.'
              : 'Try a different search term.'}
          </Text>
          {entries.length === 0 && (
            <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic', marginBottom: spacing.lg }}>
              This reflection helps you track changes in your breathing over time. It is not a medical evaluation or diagnosis.
            </Text>
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
          Catch Your Breath is a self-reflection tool. It is not a medical evaluation or diagnosis.
        </Text>
      </View>
    </Screen>
  );
}

/**
 * Cheers to Change - the single hub screen (alcohol addiction only).
 * Route: /cheers-to-change-log
 *
 * Stats, trend charts, expandable entry cards, add button, insights.
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
  cheersToChangeAvailability,
  generateInsights,
  type CheersToChangeEntry,
} from '@/domain/cheersToChange';

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

const HEALTH_SCORES: Record<string, number> = { 'Excellent': 5, 'Good': 4, 'Fair': 3, 'Poor': 2, 'Very Poor': 1 };
const ENERGY_SCORES: Record<string, number> = { 'Very High': 5, 'Good': 4, 'Average': 3, 'Low': 2, 'Very Low': 1 };
const SLEEP_SCORES: Record<string, number> = { 'Excellent': 5, 'Good': 4, 'Fair': 3, 'Poor': 2, 'Very Poor': 1 };
const MOOD_SCORES: Record<string, number> = { 'Very Positive': 5, 'Mostly Positive': 4, 'Neutral': 3, 'Mostly Negative': 2, 'Very Negative': 1 };
const DRINKING_SCORES: Record<string, number> = { 'None': 4, '1–2 Days': 3, '3–4 Days': 2, '5–7 Days': 1 };
const HYDRATION_SCORES: Record<string, number> = { 'Very Well Hydrated': 4, 'Mostly Hydrated': 3, 'Sometimes Dehydrated': 2, 'Frequently Dehydrated': 1 };

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

function EntryCard({ entry, index }: { entry: CheersToChangeEntry; index: number }) {
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
    { icon: 'heart-outline', color: theme.color.success, label: 'Physical Health', value: entry.physicalHealth },
    { icon: 'swap-horizontal-outline', color: theme.color.primary, label: 'Comparison', value: entry.bodyComparison },
    { icon: 'flash-outline', color: theme.color.celebrateText, label: 'Energy', value: entry.energyLevel },
    { icon: 'moon-outline', color: theme.color.primary, label: 'Sleep', value: entry.sleepQuality },
    { icon: 'skull-outline', color: theme.color.danger, label: 'Headaches', value: entry.headacheFrequency },
    { icon: 'nutrition-outline', color: theme.color.accentText, label: 'Digestion', value: entry.digestiveIssues },
    { icon: 'water-outline', color: theme.color.primary, label: 'Hydration', value: entry.hydrationLevel },
    { icon: 'happy-outline', color: theme.color.success, label: 'Mood', value: entry.moodRating },
    { icon: 'wine-outline', color: entry.drinkingDays === 'None' ? theme.color.success : theme.color.danger, label: 'Drinking', value: entry.drinkingDays },
  ];

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40).springify().damping(20)}>
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
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
          }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: theme.color.successSoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="wine" size={18} color={theme.color.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>
                {formatDate(entry.at)}
              </Text>
              <Text variant="caption" dim style={{ marginTop: 1 }}>
                Health: {entry.physicalHealth} · Mood: {entry.moodRating}
              </Text>
            </View>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-forward" size={16} color={theme.color.textDim} />
            </Animated.View>
          </View>

          {expanded && (
            <View style={{
              paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.hairline, paddingTop: spacing.sm,
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

// ── Line chart ────────────────────────────────────────────────────────────

function LineChart({
  data, label, maxValue, color, labels,
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
      <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>{label}</Text>
      <View style={{
        backgroundColor: theme.color.surface, borderRadius: radius.card,
        borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md,
      }}>
        <View style={{ flexDirection: 'row', height: CHART_HEIGHT }}>
          <View style={{ width: 30, justifyContent: 'space-between', paddingBottom: POINT_SIZE }}>
            {[maxValue, Math.round(maxValue / 2), 0].map((v, i) => (
              <Text key={i} variant="caption" dim style={{ fontSize: 10, textAlign: 'right' }}>{v}</Text>
            ))}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm, position: 'relative' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <View key={pct} style={{
                position: 'absolute', top: CHART_HEIGHT * (1 - pct) - 0.5,
                left: 0, right: 0, height: 1, backgroundColor: theme.color.hairline,
              }} />
            ))}
            {data.map((d, i) => {
              const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
              const y = CHART_HEIGHT * (1 - d.value / maxValue);
              return (
                <View key={i}>
                  <View style={{
                    position: 'absolute', left: `${x}%`, top: Math.max(0, y - 18),
                    marginLeft: -12, width: 24, alignItems: 'center',
                  }}>
                    <Text variant="caption" style={{ fontSize: 9, color: theme.color.textDim }}>{d.value}</Text>
                  </View>
                  <View style={{
                    position: 'absolute', left: `${x}%`, top: y - POINT_SIZE / 2,
                    width: POINT_SIZE, height: POINT_SIZE, borderRadius: POINT_SIZE / 2,
                    backgroundColor: color, marginLeft: -POINT_SIZE / 2,
                    borderWidth: 2, borderColor: theme.color.surface, zIndex: 1,
                  }} />
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

// ── Week-over-week comparison ──────────────────────────────────────────────

function DeltaCard({ label, prevLabel, currLabel, prevScore, currScore }: {
  label: string; prevLabel: string; currLabel: string; prevScore: number; currScore: number;
}) {
  const theme = useTheme();
  const diff = currScore - prevScore;
  const improved = diff > 0;
  const same = diff === 0;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.color.hairline,
    }}>
      <Text variant="caption" dim style={{ width: 80, flexShrink: 0 }}>{label}</Text>
      <Text variant="caption" style={{ width: 70, flexShrink: 0 }}>{prevLabel}</Text>
      <Ionicons name="arrow-forward" size={12} color={improved ? theme.color.success : same ? theme.color.textDim : theme.color.danger} />
      <Text variant="caption" style={{ width: 70, flexShrink: 0, fontFamily: 'Nunito_700Bold' }}>{currLabel}</Text>
      <View style={{
        marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8,
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
    <Animated.View entering={FadeIn.duration(200)} style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surface,
      borderRadius: radius.input + 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      marginBottom: spacing.sm, borderWidth: 1, borderColor: theme.color.hairline,
    }}>
      <Ionicons name="search" size={15} color={theme.color.textDim} />
      <TextInput
        value={query} onChangeText={onChange} placeholder="Search reflections..."
        placeholderTextColor={theme.color.textDim} returnKeyType="search"
        style={{ flex: 1, marginLeft: spacing.sm, fontSize: 15, color: theme.color.text, paddingVertical: spacing.xs }}
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

export default function CheersToChangeLog() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const entries = useStore((s) => s.cheersToChangeEntries);
  const lastCheersToChangeAt = useStore((s) => s.lastCheersToChangeAt);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const toggleSearch = useCallback(() => {
    setSearching((v) => { if (v) setQuery(''); return !v; });
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const availability = cheersToChangeAvailability(lastCheersToChangeAt);

  const stats = useMemo(() => {
    const total = entries.length;
    const avgHealth = total > 0
      ? Math.round(entries.reduce((s, e) => s + (HEALTH_SCORES[e.physicalHealth] ?? 3), 0) / total * 10) / 10
      : null;
    const noneDrink = entries.filter((e) => e.drinkingDays === 'None').length;
    return { total, avgHealth, noneDrink };
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (query) {
        const q = query.toLowerCase();
        return e.physicalHealth.toLowerCase().includes(q) || e.moodRating.toLowerCase().includes(q) ||
          e.sleepQuality.toLowerCase().includes(q) || e.drinkingDays.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => b.at - a.at);
  }, [entries, query]);

  const insights = useMemo(() => generateInsights(entries), [entries]);
  const sorted = useMemo(() => [...entries].sort((a, b) => a.at - b.at), [entries]);
  const weekLabels = useMemo(() => sorted.map((_, i) => `W${i + 1}`), [sorted]);

  const hasComparison = entries.length >= 2;
  const newest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }}>
        <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back"
          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1, marginRight: spacing.md })}>
          <Ionicons name="chevron-back" size={20} color={theme.color.primary} />
        </Pressable>
        <Text variant="title1" style={{ flex: 1, fontFamily: 'Nunito_900Black' }}>Cheers to Change</Text>
        <Pressable onPress={toggleSearch} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: spacing.xs })}>
          <Ionicons name={searching ? 'close-outline' : 'search-outline'} size={22} color={searching ? theme.color.primary : theme.color.textDim} />
        </Pressable>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); router.push('/cheers-to-change'); }}
          disabled={!availability.available} hitSlop={12}
          style={({ pressed }) => ({ marginLeft: spacing.md, opacity: pressed ? 0.5 : availability.available ? 1 : 0.3, padding: spacing.xs })}>
          <Ionicons name="create-outline" size={22} color={theme.color.primary} />
        </Pressable>
      </View>

      {searching && <SearchBar query={query} onChange={setQuery} />}

      {!availability.available && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.xl }}>
          <Ionicons name="time-outline" size={16} color={theme.color.textDim} />
          <Text variant="caption" dim style={{ flex: 1 }}>
            Next reflection available in {availability.daysLeft} {availability.daysLeft === 1 ? 'day' : 'days'}
          </Text>
        </View>
      )}

      {entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
          <StatCard icon="document-text" value={stats.total} label="Reflections" color={theme.color.success} delay={0} />
          <StatCard icon="heart" value={stats.avgHealth ?? '-'} label="Avg Health" color={theme.color.primary} delay={60} />
          <StatCard icon="wine-outline" value={stats.noneDrink} label="Sober Weeks" color={theme.color.success} delay={120} />
        </View>
      )}

      {entries.length >= 2 && (
        <View style={{ marginBottom: spacing.xl }}>
          <LineChart data={sorted.map((e) => ({ value: HEALTH_SCORES[e.physicalHealth] ?? 3, at: e.at }))} label="Physical Health" maxValue={5} color={theme.color.success} labels={weekLabels} />
          <LineChart data={sorted.map((e) => ({ value: ENERGY_SCORES[e.energyLevel] ?? 3, at: e.at }))} label="Energy Level" maxValue={5} color={theme.color.celebrateText} labels={weekLabels} />
          <LineChart data={sorted.map((e) => ({ value: SLEEP_SCORES[e.sleepQuality] ?? 3, at: e.at }))} label="Sleep Quality" maxValue={5} color={theme.color.primary} labels={weekLabels} />
          <LineChart data={sorted.map((e) => ({ value: MOOD_SCORES[e.moodRating] ?? 3, at: e.at }))} label="Mood" maxValue={5} color={theme.color.success} labels={weekLabels} />
          <LineChart data={sorted.map((e) => ({ value: DRINKING_SCORES[e.drinkingDays] ?? 2, at: e.at }))} label="Sobriety (higher = less drinking)" maxValue={4} color={theme.color.danger} labels={weekLabels} />
          <LineChart data={sorted.map((e) => ({ value: HYDRATION_SCORES[e.hydrationLevel] ?? 2, at: e.at }))} label="Hydration" maxValue={4} color={theme.color.primary} labels={weekLabels} />
        </View>
      )}

      {hasComparison && newest && previous && (
        <View style={{ marginBottom: spacing.xl }}>
          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>This Week vs Last Week</Text>
          <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md }}>
            <DeltaCard label="Health" prevLabel={previous.physicalHealth} currLabel={newest.physicalHealth} prevScore={HEALTH_SCORES[previous.physicalHealth] ?? 3} currScore={HEALTH_SCORES[newest.physicalHealth] ?? 3} />
            <DeltaCard label="Energy" prevLabel={previous.energyLevel} currLabel={newest.energyLevel} prevScore={ENERGY_SCORES[previous.energyLevel] ?? 3} currScore={ENERGY_SCORES[newest.energyLevel] ?? 3} />
            <DeltaCard label="Sleep" prevLabel={previous.sleepQuality} currLabel={newest.sleepQuality} prevScore={SLEEP_SCORES[previous.sleepQuality] ?? 3} currScore={SLEEP_SCORES[newest.sleepQuality] ?? 3} />
            <DeltaCard label="Mood" prevLabel={previous.moodRating} currLabel={newest.moodRating} prevScore={MOOD_SCORES[previous.moodRating] ?? 3} currScore={MOOD_SCORES[newest.moodRating] ?? 3} />
            <DeltaCard label="Drinking" prevLabel={previous.drinkingDays} currLabel={newest.drinkingDays} prevScore={DRINKING_SCORES[previous.drinkingDays] ?? 2} currScore={DRINKING_SCORES[newest.drinkingDays] ?? 2} />
            <DeltaCard label="Hydration" prevLabel={previous.hydrationLevel} currLabel={newest.hydrationLevel} prevScore={HYDRATION_SCORES[previous.hydrationLevel] ?? 2} currScore={HYDRATION_SCORES[newest.hydrationLevel] ?? 2} />
          </View>
        </View>
      )}

      {insights.length > 0 && (
        <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
          {insights.slice(0, 3).map((insight) => (
            <View key={insight.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md }}>
              <Ionicons name={insight.trend === 'improving' ? 'arrow-up-circle' : insight.trend === 'declining' ? 'arrow-down-circle' : 'remove-circle'} size={18}
                color={insight.trend === 'improving' ? theme.color.success : insight.trend === 'declining' ? theme.color.danger : theme.color.primary} />
              <Text variant="caption" style={{ flex: 1, lineHeight: 18 }}>{insight.value}</Text>
            </View>
          ))}
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
            <Ionicons name="wine" size={32} color={theme.color.textDim} />
          </View>
          <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.sm }}>
            {entries.length === 0 ? 'No reflections yet' : 'No results found'}
          </Text>
          <Text variant="footnote" dim center style={{ lineHeight: 20, marginBottom: spacing.lg }}>
            {entries.length === 0 ? 'Take a moment to reflect on how your body has felt this week.' : 'Try a different search term.'}
          </Text>
          {entries.length === 0 && (
            <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic', marginBottom: spacing.lg }}>
              This reflection helps you monitor changes in your overall well-being. It is not a medical evaluation or diagnosis.
            </Text>
          )}
        </View>
      ) : (
        <View style={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
          {filtered.map((entry, i) => <EntryCard key={entry.id} entry={entry} index={i} />)}
        </View>
      )}

      <View style={{ backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.xl }}>
        <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic' }}>
          Cheers to Change is a self-reflection tool. It is not a medical evaluation or diagnosis.
        </Text>
      </View>
    </Screen>
  );
}

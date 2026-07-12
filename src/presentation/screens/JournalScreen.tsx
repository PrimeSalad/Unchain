/**
 * JournalScreen - private recovery timeline with quick entry, search,
 * filters, compact stats, and expandable day cards.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
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
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { elevation, spacing, radius, palette, motion } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore, useProfile } from '@/application/store';
import { recoveryAdjustedBalance } from '@/domain/gambling';
import type { JournalEntry } from '@/domain/records';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Filter = 'all' | 'clean' | 'gambled' | 'watched';
type DateRange = 'all_time' | 'today' | 'week' | 'month' | 'year';

// ─────────────────────────────────────────────────────────────────────────────
// Mood helpers - text only, no emoji
// ─────────────────────────────────────────────────────────────────────────────
function moodLabel(mood: number): string {
  if (mood <= 2) return 'Very low';
  if (mood <= 4) return 'Low';
  if (mood <= 6) return 'Okay';
  if (mood <= 8) return 'Good';
  return 'Great';
}

function moodColor(mood: number, danger: string, celebrate: string, honey: string, success: string): string {
  if (mood <= 3) return danger;
  if (mood <= 5) return celebrate;
  if (mood <= 7) return honey;
  return success;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card - glassmorphism tinted by meaning
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  icon, value, label, color, entering, delay,
}: {
  icon: string; value: string | number; label: string; color: string;
  entering?: any; delay?: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// Entry card - animated expand, accent stroke, mood emoji badge
// Supports both gambling entries (gambled field) and porn entries (watched field).
// ─────────────────────────────────────────────────────────────────────────────
function EntryCard({ entry, index, currency }: { entry: JournalEntry; index: number; currency: string }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const chevronRot = useSharedValue(0);
  const press = useSharedValue(0);

  // Gambling entry detection
  const isGamble = entry.gambled === true;
  const isClean  = entry.gambled === false;
  // Porn entry detection
  const isWatched    = entry.watched === true;
  const isPornClean  = entry.watched === false;
  // Whether this is a porn-type entry at all
  const isPornEntry  = entry.watched !== undefined;

  const accent =
    isGamble || isWatched ? theme.color.danger :
    isClean || isPornClean ? theme.color.success :
    theme.color.primary;

  const statusLabel =
    isGamble    ? 'Gambled' :
    isClean     ? 'Clean day' :
    isWatched   ? 'Relapse' :
    isPornClean ? 'Clean day' :
    'Entry';

  const statusIcon =
    isGamble || isWatched   ? 'alert-circle' :
    isClean  || isPornClean ? 'checkmark-circle' :
    'document-text-outline';

  const dateStr = new Date(entry.at).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const timeStr = new Date(entry.at).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{
      rotate: withSpring(`${chevronRot.value * 180}deg`, motion.spring),
    }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(press.value ? 0.985 : 1, motion.spring) }],
  }));

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    chevronRot.value = expanded ? 0 : 1;
    setExpanded(!expanded);
    Haptics.selectionAsync().catch(() => {});
  };

  const hasText = entry.text &&
    entry.text !== 'Gambling relapse recorded.' &&
    entry.text !== 'Clean day recorded.';

  // The recovery-adjusted balance: raw balance minus the wager on a losing
  // day (wins are never added). This is the figure the app tracks everywhere.
  const adjusted = recoveryAdjustedBalance(entry);

  return (
    <Animated.View
      // Cap the stagger so long histories don't keep animating far down the list.
      entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().damping(18)}
    >
      <Pressable
        onPress={toggle}
        onPressIn={() => { press.value = 1; }}
        onPressOut={() => { press.value = 0; }}
        accessibilityRole="button"
        accessibilityLabel={`${statusLabel}, ${dateStr}`}
        accessibilityState={{ expanded }}
      >
        <Animated.View style={[{
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.color.hairline,
        }, cardStyle]}>

          {/* ── Header row ── */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.lg,
            gap: spacing.md,
          }}>
            <View style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              backgroundColor: accent + '18',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Ionicons name={statusIcon as any} size={19} color={accent} />
            </View>

            {/* Labels */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Text
                  variant="callout"
                  color={accent}
                  style={{ fontFamily: 'Nunito_800ExtraBold' }}
                >
                  {statusLabel}
                </Text>
                {isGamble && entry.amountWagered != null && (
                  <View style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: radius.round,
                    backgroundColor: theme.color.danger + '20',
                  }}>
                    <Text variant="caption" color={theme.color.danger} style={{ fontFamily: 'Nunito_700Bold' }}>
                      {currency}{entry.amountWagered.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
              <Text variant="caption" dim style={{ marginTop: 2 }}>
                {dateStr} · {timeStr}
              </Text>
            </View>

            {/* Mood badge + chevron */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
              {entry.mood != null && (
                <View style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                  borderRadius: radius.chip,
                  backgroundColor: moodColor(entry.mood, theme.color.danger, theme.color.celebrate, palette.honey, theme.color.success) + '18',
                }}>
                  <Text
                    variant="caption"
                    color={moodColor(entry.mood, theme.color.danger, theme.color.celebrate, palette.honey, theme.color.success)}
                    style={{ fontFamily: 'Nunito_700Bold' }}
                  >
                    {entry.mood}/10
                  </Text>
                </View>
              )}
              <Animated.View style={chevronStyle}>
                <Ionicons name="chevron-down" size={15} color={theme.color.textDim} />
              </Animated.View>
            </View>
          </View>

          {/* ── Text preview (always shown if present) ── */}
          {hasText && (
            <View style={{
              paddingHorizontal: spacing.lg,
              paddingBottom: expanded ? spacing.sm : spacing.lg,
            }}>
              <View style={{
                borderLeftWidth: 2,
                borderLeftColor: accent,
                paddingLeft: spacing.md,
              }}>
                <Text
                  variant="callout"
                  dim
                  numberOfLines={expanded ? undefined : 2}
                  style={{ lineHeight: 22 }}
                >
                  {entry.text}
                </Text>
              </View>
            </View>
          )}

          {/* ── Expanded detail rows ── */}
          {expanded && (
            <View style={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
              paddingTop: hasText ? 0 : spacing.xs,
              gap: spacing.xs,
            }}>
              <View style={{ height: 1, backgroundColor: theme.color.hairline, marginBottom: spacing.sm }} />

              {entry.mood != null && (
                <DetailRow icon="bar-chart-outline" color={theme.color.primary} label="Mood" value={`${entry.mood}/10 - ${moodLabel(entry.mood)}`} />
              )}

              {/* ── Gambling-specific rows ── */}
              {entry.gambled === true && entry.amountWagered != null && (
                <DetailRow icon="cash-outline" color={theme.color.textDim} label="Wagered" value={`${currency}${entry.amountWagered.toLocaleString()}`} />
              )}
              {entry.gambled === true && entry.lost != null && (
                <DetailRow
                  icon={entry.lost ? 'trending-down' : 'trending-up'}
                  color={entry.lost ? theme.color.danger : theme.color.success}
                  label="Result"
                  value={entry.lost ? `Lost ${currency}${(entry.amountLost ?? 0).toLocaleString()}` : 'No loss'}
                />
              )}
              {entry.moneyBalance != null && (
                <DetailRow
                  icon="wallet-outline"
                  color={theme.color.primary}
                  label="Balance"
                  value={
                    adjusted != null && adjusted !== entry.moneyBalance
                      ? `${currency}${entry.moneyBalance.toLocaleString()} → ${currency}${adjusted.toLocaleString()} after lost wager`
                      : `${currency}${entry.moneyBalance.toLocaleString()}`
                  }
                />
              )}
              {(entry.whyGambled ?? entry.trigger) && (
                <DetailRow
                  icon="flag-outline"
                  color={theme.color.textDim}
                  label="Trigger"
                  value={entry.whyGambled ?? entry.trigger ?? ''}
                />
              )}

              {/* ── Porn clean-day rows ── */}
              {entry.watched === false && entry.urgeIntensity != null && (
                <DetailRow icon="pulse-outline" color={theme.color.celebrate} label="Urge" value={`${entry.urgeIntensity}/10`} />
              )}
              {entry.watched === false && entry.triggersEncountered != null && entry.triggersEncountered.length > 0 && (
                <DetailRow icon="warning-outline" color={theme.color.textDim} label="Triggers" value={entry.triggersEncountered.join(', ')} />
              )}
              {entry.watched === false && entry.whatHelped && (
                <DetailRow icon="shield-checkmark-outline" color={theme.color.success} label="Helped" value={entry.whatHelped} />
              )}

              {/* ── Porn relapse rows ── */}
              {entry.watched === true && entry.watchDuration != null && (
                <DetailRow icon="time-outline" color={theme.color.textDim} label="Duration"
                  value={
                    entry.watchDuration < 10 ? 'Less than 10 min' :
                    entry.watchDuration <= 30 ? '10–30 min' :
                    entry.watchDuration <= 60 ? '30–60 min' :
                    'More than 1 hour'
                  }
                />
              )}
              {entry.watched === true && entry.relapseLeadUp && (
                <DetailRow icon="flag-outline" color={theme.color.textDim} label="Lead-up" value={entry.relapseLeadUp} />
              )}
              {entry.watched === true && entry.emotionsBefore && (
                <DetailRow icon="heart-outline" color={theme.color.danger} label="Emotions" value={entry.emotionsBefore} />
              )}
              {entry.watched === true && entry.relapseTrigger && (
                <DetailRow icon="warning-outline" color={theme.color.danger} label="Trigger" value={entry.relapseTrigger} />
              )}
              {entry.watched === true && entry.nextTimePlan && (
                <DetailRow icon="bulb-outline" color={theme.color.primary} label="Next time" value={entry.nextTimePlan} />
              )}
              {entry.watched === true && entry.feelingNow && (
                <DetailRow icon="happy-outline" color={theme.color.primary} label="Feeling now" value={entry.feelingNow} />
              )}
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function DetailRow({ icon, color, label, value }: {
  icon: string; color: string; label: string; value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
      <Ionicons name={icon as any} size={14} color={color} style={{ marginTop: 2 }} />
      <Text variant="caption" dim style={{ width: 72 }}>{label}</Text>
      <Text variant="caption" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.md }}>
      <Text variant="headline" style={{ flex: 1 }}>{title}</Text>
      {meta ? <Text variant="caption" color={theme.color.textDim}>{meta}</Text> : null}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        borderBottomWidth: 2,
        borderBottomColor: active ? theme.color.primary : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        variant="callout"
        color={active ? theme.color.primary : theme.color.textDim}
        style={{ fontFamily: active ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Search bar - slides down when active
// ─────────────────────────────────────────────────────────────────────────────
function SearchBar({ query, onChange }: { query: string; onChange: (s: string) => void }) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

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
        shadowColor: palette.ink,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
        borderWidth: 1,
        borderColor: theme.color.hairline,
      }}
    >
      <Ionicons name="search" size={15} color={theme.color.textDim} />
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={onChange}
        placeholder="Search entries…"
        placeholderTextColor={theme.color.textDim}
        autoFocus
        underlineColorAndroid="transparent"
        selectionColor={theme.color.primary}
        style={{
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          color: theme.color.text,
          fontSize: 15,
          fontFamily: 'Nunito_600SemiBold',
        }}
      />
      {query.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={14} accessibilityRole="button" accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={16} color={theme.color.textDim} />
        </Pressable>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export function JournalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const entries = useStore((s) => s.journal);

  const isGambling = profile?.addictionType === 'gambling';
  const isPorn     = profile?.addictionType === 'pornography';

  const [query, setQuery]         = useState('');
  const [filter, setFilter]       = useState<Filter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all_time');
  const [searching, setSearching] = useState(false);

  const toggleSearch = useCallback(() => {
    setSearching((v) => {
      if (v) setQuery('');
      return !v;
    });
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const isPorn = profile?.addictionType === 'pornography';
    const total    = entries.length;
    // Gambling stats
    const clean    = entries.filter((e) => e.gambled === false).length;
    const relapses = entries.filter((e) => e.gambled === true).length;
    // Porn stats
    const pornClean    = entries.filter((e) => e.watched === false).length;
    const pornRelapses = entries.filter((e) => e.watched === true).length;
    const withMood = entries.filter((e) => e.mood != null);
    const avgMood  = withMood.length
      ? Math.round(withMood.reduce((s, e) => s + (e.mood ?? 0), 0) / withMood.length * 10) / 10
      : null;
    return { total, clean, relapses, pornClean, pornRelapses, avgMood };
  }, [entries, profile]);

  // ── Filtered + sorted entries ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now = Date.now();

    // Date-range cutoff - local calendar boundaries so "this week" means
    // Mon 00:00:00 of the current week, not exactly 7 × 24h ago.
    let cutoff = 0;
    if (dateRange !== 'all_time') {
      const d = new Date();
      if (dateRange === 'today') {
        cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      } else if (dateRange === 'week') {
        const day = d.getDay();
        const diffToMon = day === 0 ? -6 : 1 - day;
        cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon).getTime();
      } else if (dateRange === 'month') {
        cutoff = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      } else if (dateRange === 'year') {
        cutoff = new Date(d.getFullYear(), 0, 1).getTime();
      }
    }

    return entries
      .filter((e) => {
        // Date range
        if (cutoff > 0 && e.at < cutoff) return false;
        // Addiction-specific status filter
        if (isGambling) {
          if (filter === 'clean'   && e.gambled !== false) return false;
          if (filter === 'gambled' && e.gambled !== true)  return false;
        }
        if (isPorn) {
          if (filter === 'clean'   && e.watched !== false) return false;
          if (filter === 'watched' && e.watched !== true)  return false;
        }
        // Search
        if (query && !e.text.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      })
      // Newest first
      .sort((a, b) => b.at - a.at);
  }, [entries, query, filter, dateRange, isGambling, isPorn]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Screen tabPadding>

      {/* ── Hero ── */}
      <View
        style={{
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
          paddingBottom: spacing.lg,
          gap: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: theme.color.hairline,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 18,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="book" size={25} color={theme.color.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="title1" style={{ fontFamily: 'Nunito_900Black' }}>Journal</Text>
            <Text variant="footnote" dim style={{ marginTop: 3, lineHeight: 18 }}>
              {entries.length === 0
                ? 'Start with one honest line today.'
                : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} saved in your private timeline.`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              router.push(isPorn ? '/porn-journal-entry' : '/journal-entry');
            }}
            accessibilityRole="button"
            accessibilityLabel="Write new entry"
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              borderRadius: radius.button,
              backgroundColor: theme.color.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <Ionicons name="create" size={18} color={theme.color.onPrimary} />
            <Text variant="headline" color={theme.color.onPrimary}>Write entry</Text>
          </Pressable>
          <Pressable
            onPress={toggleSearch}
            accessibilityRole="button"
            accessibilityLabel={searching ? 'Close search' : 'Search entries'}
            style={({ pressed }) => ({
              width: 48,
              minHeight: 48,
              borderRadius: radius.button,
              backgroundColor: searching ? theme.color.primarySoft : theme.color.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons
              name={searching ? 'close' : 'search'}
              size={19}
              color={searching ? theme.color.primary : theme.color.textDim}
            />
          </Pressable>
        </View>
      </View>

      {/* ── Search bar (animated slide-in) ── */}
      {searching && (
        <SearchBar query={query} onChange={setQuery} />
      )}

      {/* ── Stats row ── */}
      {isGambling && entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
          <StatCard
            icon="checkmark-circle"
            value={stats.clean}
            label="Clean days"
            color={theme.color.success}
            delay={0}
          />
          <StatCard
            icon="alert-circle"
            value={stats.relapses}
            label="Relapses"
            color={theme.color.danger}
            delay={60}
          />
          {stats.avgMood != null && (
            <StatCard
              icon="happy"
              value={stats.avgMood}
              label="Avg mood"
              color={theme.color.primary}
              delay={120}
            />
          )}
        </View>
      )}

      {isPorn && entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
          <StatCard
            icon="checkmark-circle"
            value={stats.pornClean}
            label="Clean days"
            color={theme.color.success}
            delay={0}
          />
          <StatCard
            icon="alert-circle"
            value={stats.pornRelapses}
            label="Relapses"
            color={theme.color.danger}
            delay={60}
          />
          {stats.avgMood != null && (
            <StatCard
              icon="happy"
              value={stats.avgMood}
              label="Avg mood"
              color={theme.color.primary}
              delay={120}
            />
          )}
        </View>
      )}

      {/* ── Date-range filter (all users, always visible when entries exist) ── */}
      {entries.length > 0 && (
        <>
          <SectionHeader title="Filters" meta={filtered.length === entries.length ? 'All visible' : `${filtered.length} shown`} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.sm }}
          >
            {([
              { key: 'all_time', label: 'All time'   },
              { key: 'today',    label: 'Today'      },
              { key: 'week',     label: 'This week'  },
              { key: 'month',    label: 'This month' },
              { key: 'year',     label: 'This year'  },
            ] as { key: DateRange; label: string }[]).map(({ key, label }) => (
              <FilterChip
                key={key}
                label={label}
                active={dateRange === key}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setDateRange(key);
                }}
              />
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Status filter pills (addiction-specific) ── */}
      {isGambling && entries.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}
        >
          {(['all', 'clean', 'gambled'] as Filter[]).map((f) => (
            <FilterChip
              key={f}
              label={f === 'all' ? 'All entries' : f === 'clean' ? 'Clean days' : 'Relapses'}
              active={filter === f}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setFilter(f); }}
            />
          ))}
        </ScrollView>
      )}

      {isPorn && entries.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}
        >
          {(['all', 'clean', 'watched'] as Filter[]).map((f) => (
            <FilterChip
              key={f}
              label={f === 'all' ? 'All entries' : f === 'clean' ? 'Clean days' : 'Relapses'}
              active={filter === f}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setFilter(f); }}
            />
          ))}
        </ScrollView>
      )}

      {/* Spacer when no addiction pills are shown (e.g. social media, other) */}
      {!isGambling && !isPorn && entries.length > 0 && (
        <View style={{ marginBottom: spacing.xl }} />
      )}

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{
            alignItems: 'center',
            paddingVertical: spacing.xxxl,
            gap: spacing.lg,
          }}
        >
          {/* Stacked rings illustration */}
          <View style={{ position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              position: 'absolute',
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: theme.color.primary + '08',
              borderWidth: 1,
              borderColor: theme.color.primary + '20',
            }} />
            <View style={{
              position: 'absolute',
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: theme.color.primary + '10',
              borderWidth: 1,
              borderColor: theme.color.primary + '30',
            }} />
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="book-outline" size={26} color={theme.color.primary} />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text variant="headline" center style={{ fontFamily: 'Nunito_700Bold' }}>
              {entries.length === 0 ? 'Your journal is empty' : 'No entries match'}
            </Text>
            <Text variant="callout" dim center style={{ paddingHorizontal: spacing.xl, lineHeight: 22 }}>
              {entries.length === 0
                ? 'Your first entry is the hardest.\nEven one sentence counts.'
                : 'Try a different filter, date range, or search term.'}
            </Text>
          </View>

          {entries.length === 0 && (
            <Pressable
              onPress={() => router.push(isPorn ? '/porn-journal-entry' : '/journal-entry')}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.xxl,
                paddingVertical: spacing.md + 2,
                borderRadius: radius.button,
                backgroundColor: theme.color.primary,
                opacity: pressed ? 0.8 : 1,
                shadowColor: theme.color.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6,
              })}
            >
              <Text variant="headline" color="#FFFFFF" style={{ fontFamily: 'Nunito_700Bold' }}>
                Write first entry
              </Text>
            </Pressable>
          )}
        </Animated.View>
      ) : (
        /* ── Entry list ── */
        <>
          <SectionHeader title="Timeline" meta={`${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`} />
          <View style={{ gap: spacing.md }}>
            {filtered.map((e, i) => (
              <EntryCard key={e.id} entry={e} index={i} currency={profile?.currency ?? '₱'} />
            ))}
            <View style={{ height: spacing.xl }} />
          </View>
        </>
      )}
    </Screen>
  );
}

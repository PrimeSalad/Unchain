/**
 * JournalScreen - premium iOS-native list view.
 *
 * Design highlights:
 * ─────────────────
 * • Full-bleed gradient header with large title + live subtitle.
 * • Animated search bar slides open from the FAB tray.
 * • Stat cards use soft glassmorphism tinted by meaning (green / red / purple).
 * • Entry cards have left accent stroke, animated expand chevron, mood emoji.
 * • Empty state has a gentle mascot-like illustration ring.
 * • FAB has a glow halo + spring press.
 * • All animations use react-native-reanimated for 60fps on the JS thread.
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
  withTiming,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Pill } from '../components/Pill';
import { spacing, radius, palette, motion } from '../theme/tokens';
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
  return (
    <Animated.View
      entering={FadeInDown.delay(delay ?? 0).springify().damping(16)}
      style={{ flex: 1 }}
    >
      <View style={{
        flex: 1,
        backgroundColor: color + '18',
        borderRadius: radius.card,
        padding: spacing.lg,
        alignItems: 'center',
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: color + '30',
      }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: color + '25',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs,
        }}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text variant="title2" color={color} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
          {value}
        </Text>
        <Text variant="caption" dim>{label}</Text>
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
          borderLeftWidth: 3,
          borderLeftColor: accent,
          shadowColor: palette.ink,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.mode === 'dark' ? 0 : 0.06,
          shadowRadius: 10,
          elevation: 2,
        }, cardStyle]}>

          {/* ── Header row ── */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.lg,
            gap: spacing.md,
          }}>
            {/* Status dot */}
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 19,
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
                  variant="footnote"
                  color={accent}
                  style={{ fontFamily: 'Nunito_700Bold' }}
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
              <Text
                variant="callout"
                dim
                numberOfLines={expanded ? undefined : 2}
                style={{ lineHeight: 21 }}
              >
                {entry.text}
              </Text>
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
      <Text variant="caption" dim style={{ width: 54 }}>{label}</Text>
      <Text variant="caption" style={{ flex: 1 }}>{value}</Text>
    </View>
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
// FAB - glowing add button
// ─────────────────────────────────────────────────────────────────────────────
function FAB({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const press = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(press.value ? 0.9 : 1, motion.spring) }],
    shadowOpacity: withTiming(press.value ? 0.2 : 0.4, { duration: 100 }),
  }));

  return (
    <Pressable
      onPressIn={() => { press.value = 1; }}
      onPressOut={() => { press.value = 0; }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      accessibilityLabel="Write new entry"
      accessibilityRole="button"
    >
      <Animated.View style={[{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.color.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.color.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 8,
      }, animStyle]}>
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </Animated.View>
    </Pressable>
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

      {/* ── Header ── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: spacing.sm,
        marginBottom: entries.length > 0 ? spacing.lg : spacing.xl,
      }}>
        <View style={{ flex: 1 }}>
          <Text variant="title1" style={{ fontFamily: 'Nunito_900Black' }}>Journal</Text>
          <Text variant="footnote" dim style={{ marginTop: 3 }}>
            {entries.length === 0
              ? 'Start writing - every entry counts'
              : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · your private space`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          {/* Search toggle */}
          <Pressable
            onPress={toggleSearch}
            hitSlop={8}
            accessibilityLabel={searching ? 'Close search' : 'Search entries'}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: searching ? theme.color.primary : theme.color.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons
              name={searching ? 'close' : 'search'}
              size={18}
              color={searching ? '#FFF' : theme.color.textDim}
            />
          </Pressable>
          <FAB onPress={() => router.push(isPorn ? '/porn-journal-entry' : '/journal-entry')} />
        </View>
      </View>

      {/* ── Search bar (animated slide-in) ── */}
      {searching && (
        <SearchBar query={query} onChange={setQuery} />
      )}

      {/* ── Stats row ── */}
      {isGambling && entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
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
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
        >
          {([
            { key: 'all_time', label: 'All time'   },
            { key: 'today',    label: 'Today'      },
            { key: 'week',     label: 'This week'  },
            { key: 'month',    label: 'This month' },
            { key: 'year',     label: 'This year'  },
          ] as { key: DateRange; label: string }[]).map(({ key, label }) => (
            <Pill
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
      )}

      {/* ── Status filter pills (addiction-specific) ── */}
      {isGambling && entries.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
        >
          {(['all', 'clean', 'gambled'] as Filter[]).map((f) => (
            <Pill
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
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
        >
          {(['all', 'clean', 'watched'] as Filter[]).map((f) => (
            <Pill
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
        <View style={{ marginBottom: spacing.lg }} />
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
        <View style={{ gap: spacing.md }}>
          {filtered.map((e, i) => (
            <EntryCard key={e.id} entry={e} index={i} currency={profile?.currency ?? '₱'} />
          ))}
          <View style={{ height: spacing.xl }} />
        </View>
      )}
    </Screen>
  );
}

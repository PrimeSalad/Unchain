/**
 * JournalScreen - private recovery timeline with quick entry, search,
 * filters, compact stats, and expandable day cards.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
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
import { DEFAULT_CURRENCY, recoveryAdjustedBalance } from '@/domain/gambling';
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
  // Social media entry detection
  const isBinged      = entry.binged === true;
  const isSocialClean = entry.binged === false;

  const accent =
    isGamble || isWatched || isBinged ? theme.color.danger :
    isClean || isPornClean || isSocialClean ? theme.color.success :
    theme.color.primary;

  const statusLabel =
    isGamble      ? 'Gambled' :
    isClean       ? 'Clean day' :
    isWatched     ? 'Relapse' :
    isPornClean   ? 'Clean day' :
    isBinged      ? 'Relapse' :
    isSocialClean ? 'Clean day' :
    'Entry';

  const statusIcon =
    isGamble || isWatched || isBinged          ? 'alert-circle' :
    isClean  || isPornClean || isSocialClean   ? 'checkmark-circle' :
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
    entry.text !== 'Clean day recorded.' &&
    entry.text !== 'Social media binge recorded.' &&
    entry.text !== 'Relapse recorded.';

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

              {/* ── Social media clean-day rows ── */}
              {entry.binged === false && entry.socialUrgeIntensity != null && (
                <DetailRow icon="pulse-outline" color={theme.color.celebrate} label="Urge" value={`${entry.socialUrgeIntensity}/10`} />
              )}
              {entry.binged === false && entry.socialTriggersEncountered != null && entry.socialTriggersEncountered.length > 0 && (
                <DetailRow icon="warning-outline" color={theme.color.textDim} label="Triggers" value={entry.socialTriggersEncountered.join(', ')} />
              )}
              {entry.binged === false && entry.socialWhatHelped && (
                <DetailRow icon="shield-checkmark-outline" color={theme.color.success} label="Helped" value={entry.socialWhatHelped} />
              )}

              {/* ── Social media binge rows ── */}
              {entry.binged === true && entry.bingeDuration && (
                <DetailRow icon="time-outline" color={theme.color.textDim} label="Duration" value={entry.bingeDuration} />
              )}
              {entry.binged === true && entry.bingedPlatforms != null && entry.bingedPlatforms.length > 0 && (
                <DetailRow icon="phone-portrait-outline" color={theme.color.textDim} label="Platforms" value={entry.bingedPlatforms.join(', ')} />
              )}
              {entry.binged === true && entry.bingeEmotions != null && entry.bingeEmotions.length > 0 && (
                <DetailRow icon="heart-outline" color={theme.color.danger} label="Emotions" value={entry.bingeEmotions.join(', ')} />
              )}
              {entry.binged === true && entry.bingeTrigger && (
                <DetailRow icon="warning-outline" color={theme.color.danger} label="Trigger" value={entry.bingeTrigger} />
              )}
              {entry.binged === true && entry.bingeNextTimePlan && (
                <DetailRow icon="bulb-outline" color={theme.color.primary} label="Next time" value={entry.bingeNextTimePlan} />
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
// PickerSheet — iOS-style bottom sheet with radio options
// ─────────────────────────────────────────────────────────────────────────────
function PickerSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { key: T; label: string }[];
  value: T;
  onSelect: (key: T) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Scrim */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        {/* Sheet */}
        <View style={{
          backgroundColor: theme.color.surface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingBottom: 34,
          ...elevation.e2,
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.lg }} />
          {/* Title */}
          <Text variant="footnote" dim style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {title}
          </Text>
          {/* Options */}
          {options.map(({ key, label }, i) => {
            const active = value === key;
            return (
              <Pressable
                key={key}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect(key); onClose(); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md + 2,
                  borderTopWidth: i === 0 ? 1 : 0,
                  borderBottomWidth: 1,
                  borderColor: theme.color.hairline,
                  backgroundColor: pressed ? theme.color.surfaceAlt : 'transparent',
                })}
              >
                <Text
                  variant="callout"
                  style={{ flex: 1, fontFamily: active ? 'Nunito_700Bold' : 'Nunito_600SemiBold' }}
                  color={active ? theme.color.primary : theme.color.text}
                >
                  {label}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={theme.color.primary} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
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
  const isSocial   = profile?.addictionType === 'social_media';

  const [query, setQuery]         = useState('');
  const [filter, setFilter]       = useState<Filter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all_time');
  const [searching, setSearching] = useState(false);
  const [showDateSheet, setShowDateSheet]     = useState(false);
  const [showStatusSheet, setShowStatusSheet] = useState(false);

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
    const isSocial = profile?.addictionType === 'social_media';
    const total    = entries.length;
    // Gambling stats
    const clean    = entries.filter((e) => e.gambled === false).length;
    const relapses = entries.filter((e) => e.gambled === true).length;
    // Porn stats
    const pornClean    = entries.filter((e) => e.watched === false).length;
    const pornRelapses = entries.filter((e) => e.watched === true).length;
    // Social media stats
    const socialClean    = entries.filter((e) => e.binged === false).length;
    const socialRelapses = entries.filter((e) => e.binged === true).length;
    const withMood = entries.filter((e) => e.mood != null);
    const avgMood  = withMood.length
      ? Math.round(withMood.reduce((s, e) => s + (e.mood ?? 0), 0) / withMood.length * 10) / 10
      : null;
    return { total, clean, relapses, pornClean, pornRelapses, socialClean, socialRelapses, avgMood };
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
        if (isSocial) {
          if (filter === 'clean'   && e.binged !== false) return false;
          if (filter === 'gambled' && e.binged !== true)  return false;
        }
        // Search
        if (query && !e.text.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      })
      // Newest first
      .sort((a, b) => b.at - a.at);
  }, [entries, query, filter, dateRange, isGambling, isPorn]);

  // Status filter options per addiction type
  const statusFilters: { key: Filter; label: string }[] =
    isGambling ? [{ key: 'all', label: 'All' }, { key: 'clean', label: 'Clean' }, { key: 'gambled', label: 'Relapses' }]
    : isPorn   ? [{ key: 'all', label: 'All' }, { key: 'clean', label: 'Clean' }, { key: 'watched', label: 'Relapses' }]
    : [];

  // Date ranges
  const DATE_RANGES: { key: DateRange; label: string }[] = [
    { key: 'all_time', label: 'All time'   },
    { key: 'today',    label: 'Today'      },
    { key: 'week',     label: 'This week'  },
    { key: 'month',    label: 'This month' },
    { key: 'year',     label: 'This year'  },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Screen tabPadding>

      {/* ── Header: just the title + two icon buttons ── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
      }}>
        <Text variant="title1" style={{ flex: 1, fontFamily: 'Nunito_900Black' }}>Journal</Text>

        <Pressable
          onPress={toggleSearch}
          accessibilityRole="button"
          accessibilityLabel={searching ? 'Close search' : 'Search entries'}
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
            router.push(isPorn ? '/porn-journal-entry' : isSocial ? '/social-journal-entry' : '/journal-entry');
          }}
          accessibilityRole="button"
          accessibilityLabel="Write new entry"
          hitSlop={12}
          style={({ pressed }) => ({
            marginLeft: spacing.md,
            opacity: pressed ? 0.5 : 1,
            padding: spacing.xs,
          })}
        >
          <Ionicons name="create-outline" size={22} color={theme.color.primary} />
        </Pressable>
      </View>

      {/* ── Search bar ── */}
      {searching && <SearchBar query={query} onChange={setQuery} />}

      {/* ── Stats: three compact tiles, only when there are entries ── */}
      {(isGambling || isPorn || isSocial) && entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
          <StatCard
            icon="checkmark-circle"
            value={isGambling ? stats.clean : isPorn ? stats.pornClean : stats.socialClean}
            label="Clean"
            color={theme.color.success}
            delay={0}
          />
          <StatCard
            icon="alert-circle"
            value={isGambling ? stats.relapses : isPorn ? stats.pornRelapses : stats.socialRelapses}
            label="Relapses"
            color={theme.color.danger}
            delay={60}
          />
          {stats.avgMood != null && (
            <StatCard
              icon="happy"
              value={stats.avgMood}
              label="Mood"
              color={theme.color.primary}
              delay={120}
            />
          )}
        </View>
      )}

      {/* ── Filter row — two compact selector buttons ── */}
      {entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>

          {/* Date range selector */}
          <Pressable
            onPress={() => setShowDateSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={`Period: ${DATE_RANGES.find(d => d.key === dateRange)?.label}`}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              borderRadius: radius.input,
              backgroundColor: theme.color.surface,
              borderWidth: 1,
              borderColor: dateRange !== 'all_time' ? theme.color.primary : theme.color.hairline,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="calendar-outline" size={14} color={dateRange !== 'all_time' ? theme.color.primary : theme.color.textDim} />
              <Text
                variant="footnote"
                color={dateRange !== 'all_time' ? theme.color.primary : theme.color.textDim}
                style={{ fontFamily: dateRange !== 'all_time' ? 'Nunito_700Bold' : 'Nunito_600SemiBold' }}
              >
                {DATE_RANGES.find(d => d.key === dateRange)?.label ?? 'All time'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={13} color={dateRange !== 'all_time' ? theme.color.primary : theme.color.textDim} />
          </Pressable>

          {/* Status selector (only for gambling/porn) */}
          {statusFilters.length > 0 && (
            <Pressable
              onPress={() => setShowStatusSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={`Status: ${statusFilters.find(s => s.key === filter)?.label}`}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                borderRadius: radius.input,
                backgroundColor: theme.color.surface,
                borderWidth: 1,
                borderColor: filter !== 'all' ? theme.color.primary : theme.color.hairline,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Ionicons name="filter-outline" size={14} color={filter !== 'all' ? theme.color.primary : theme.color.textDim} />
                <Text
                  variant="footnote"
                  color={filter !== 'all' ? theme.color.primary : theme.color.textDim}
                  style={{ fontFamily: filter !== 'all' ? 'Nunito_700Bold' : 'Nunito_600SemiBold' }}
                >
                  {statusFilters.find(s => s.key === filter)?.label ?? 'All'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={13} color={filter !== 'all' ? theme.color.primary : theme.color.textDim} />
            </Pressable>
          )}
        </View>
      )}

      {/* Date range picker sheet */}
      <PickerSheet
        visible={showDateSheet}
        title="Period"
        options={DATE_RANGES}
        value={dateRange}
        onSelect={setDateRange}
        onClose={() => setShowDateSheet(false)}
      />

      {/* Status picker sheet */}
      <PickerSheet
        visible={showStatusSheet}
        title="Status"
        options={statusFilters}
        value={filter}
        onSelect={setFilter}
        onClose={() => setShowStatusSheet(false)}
      />

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.lg }}
        >
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: theme.color.primarySoft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="book-outline" size={24} color={theme.color.primary} />
          </View>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text variant="headline" center style={{ fontFamily: 'Nunito_700Bold' }}>
              {entries.length === 0 ? 'No entries yet' : 'No entries match'}
            </Text>
            <Text variant="callout" dim center style={{ paddingHorizontal: spacing.xl, lineHeight: 22 }}>
              {entries.length === 0
                ? 'Your first entry is the hardest. Even one sentence counts.'
                : 'Try adjusting the filters or search term.'}
            </Text>
          </View>
        </Animated.View>
      ) : (
        /* ── Entry list ── */
        <>
          {/* Timeline header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Text variant="headline" style={{ flex: 1 }}>Timeline</Text>
            {filtered.length < entries.length && (
              <Text variant="caption" color={theme.color.textDim}>
                {filtered.length} of {entries.length}
              </Text>
            )}
          </View>
          <View style={{ gap: spacing.md }}>
            {filtered.map((e, i) => (
              <EntryCard key={e.id} entry={e} index={i} currency={profile?.currency ?? DEFAULT_CURRENCY} />
            ))}
            <View style={{ height: spacing.xl }} />
          </View>
        </>
      )}
    </Screen>
  );
}

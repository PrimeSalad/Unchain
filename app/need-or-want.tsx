/**
 * Need or Want? - list screen with purchase history, inline cooldown timer,
 * filters, and "Add" button. The question flow lives in need-or-want-flow.tsx.
 */

import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { radius, spacing, elevation } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import { NEED_OR_WANT_CATEGORIES, NEED_OR_WANT_COOLDOWN_MS } from '@/domain/alternatives';
import type { NeedOrWantEntry } from '@/domain/alternatives';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return 'Ready';
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  if (hours >= 24) return '1 day left';
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

type FilterKey = 'all' | 'passed' | 'bought' | 'pending';
type DateRange = 'all_time' | 'today' | 'week' | 'month' | 'year';

// ─────────────────────────────────────────────────────────────────────────────
// PickerSheet — bottom sheet with radio options (journal style)
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
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View style={{
          backgroundColor: theme.color.surface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingBottom: 34,
          ...elevation.e2,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.lg }} />
          <Text variant="footnote" dim style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {title}
          </Text>
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
// Entry Card — with inline cooldown timer
// ─────────────────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onPress,
  now,
}: {
  entry: NeedOrWantEntry;
  onPress: () => void;
  now: number;
}) {
  const theme = useTheme();
  const meta = NEED_OR_WANT_CATEGORIES[entry.category];
  const displayPrice = entry.itemPrice ? `${entry.currency}${entry.itemPrice}` : '';

  const isCoolingDown = entry.decision === null && (now - entry.cooldownStart) < NEED_OR_WANT_COOLDOWN_MS;
  const isPending = entry.decision === null && !isCoolingDown;
  const isSaved = entry.decision === false;
  const isBought = entry.decision === true;

  const accentColor = isSaved
    ? theme.color.success
    : isBought
      ? theme.color.danger
      : theme.color.primary;

  const statusLabel = isSaved
    ? 'Passed'
    : isBought
      ? 'Bought'
      : isCoolingDown
        ? 'Cooling down'
        : 'Pending';

  const statusIcon = isSaved
    ? 'checkmark-circle'
    : isBought
      ? 'cart'
      : isCoolingDown
        ? 'hourglass-outline'
        : 'time';

  const cooldownProgress = isCoolingDown
    ? Math.min(1, (now - entry.cooldownStart) / NEED_OR_WANT_COOLDOWN_MS)
    : 0;
  const remaining = isCoolingDown
    ? NEED_OR_WANT_COOLDOWN_MS - (now - entry.cooldownStart)
    : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: isCoolingDown ? theme.color.primary + '40' : isBought ? theme.color.danger + '30' : isSaved ? theme.color.success + '30' : theme.color.hairline,
        padding: spacing.md,
        gap: spacing.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Main row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: accentColor + '18',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ionicons name={(meta?.icon ?? 'cart') as keyof typeof Ionicons.glyphMap} size={18} color={accentColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="callout" numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold' }}>
            {entry.itemName}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
            {displayPrice ? (
              <Text variant="caption" dim>{displayPrice}</Text>
            ) : null}
            <Text variant="caption" dim>{meta?.label ?? entry.category}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={statusIcon as keyof typeof Ionicons.glyphMap} size={14} color={accentColor} />
            <Text variant="caption" color={accentColor} style={{ fontFamily: 'Nunito_700Bold' }}>
              {statusLabel}
            </Text>
          </View>
          <Text variant="caption" dim>{formatDate(entry.at)}</Text>
        </View>
      </View>

      {/* Inline cooldown timer */}
      {isCoolingDown && (
        <View style={{ gap: spacing.xs }}>
          <ProgressBar progress={cooldownProgress} height={4} color={theme.color.primary} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
              {fmtRemaining(remaining)}
            </Text>
            <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
              {Math.round(cooldownProgress * 100)}%
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Sheet
// ─────────────────────────────────────────────────────────────────────────────

function DetailSheet({
  entry,
  visible,
  onClose,
  onDelete,
  now,
}: {
  entry: NeedOrWantEntry | null;
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
  now: number;
}) {
  const theme = useTheme();
  if (!entry) return null;

  const meta = NEED_OR_WANT_CATEGORIES[entry.category];
  const displayPrice = entry.itemPrice ? `${entry.currency}${entry.itemPrice}` : '';

  const isSaved = entry.decision === false;
  const isBought = entry.decision === true;
  const isCoolingDown = entry.decision === null && (now - entry.cooldownStart) < NEED_OR_WANT_COOLDOWN_MS;

  const accentColor = isSaved
    ? theme.color.success
    : isBought
      ? theme.color.danger
      : theme.color.primary;

  const statusText = isSaved
    ? 'You didn\'t buy it — great job!'
    : isBought
      ? 'You bought it after the cooldown.'
      : isCoolingDown
        ? 'Still cooling down.'
        : 'Awaiting your decision.';

  return (
    <ActionSheet visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: accentColor + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={(meta?.icon ?? 'cart') as keyof typeof Ionicons.glyphMap} size={22} color={accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{entry.itemName}</Text>
            <Text variant="caption" dim>{meta?.label ?? entry.category}</Text>
          </View>
        </View>

        {displayPrice ? (
          <Text variant="title2" style={{ fontFamily: 'Nunito_900Black' }}>{displayPrice}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: accentColor + '10', borderRadius: radius.card, padding: spacing.md }}>
          <Ionicons name={isSaved ? 'checkmark-circle' : isBought ? 'cart' : 'time'} size={20} color={accentColor} />
          <Text variant="callout" color={accentColor} style={{ fontFamily: 'Nunito_700Bold', flex: 1 }}>{statusText}</Text>
        </View>

        {entry.itemReason ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>Why you wanted it</Text>
            <Text variant="callout" dim style={{ lineHeight: 22 }}>{entry.itemReason}</Text>
          </View>
        ) : null}

        {entry.summary ? (
          <View style={{ backgroundColor: theme.color.primarySoft, borderRadius: radius.card, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: theme.color.primary }}>
            <Text variant="callout" style={{ lineHeight: 22 }}>{entry.summary}</Text>
          </View>
        ) : null}

        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" dim>Logged {formatDate(entry.at)} at {formatTime(entry.at)}</Text>
          {entry.decidedAt ? (
            <Text variant="caption" dim>Decided {formatDate(entry.decidedAt)} at {formatTime(entry.decidedAt)}</Text>
          ) : null}
        </View>

        <Button label="Delete Entry" kind="tertiary" onPress={() => { onDelete(); onClose(); }} full />
      </View>
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'passed', label: 'Passed' },
  { key: 'bought', label: 'Bought' },
  { key: 'pending', label: 'Pending' },
];

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: 'all_time', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
];

export default function NeedOrWantScreen() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const entries = useStore((s) => s.needOrWantEntries);
  const deleteEntry = useStore((s) => s.deleteNeedOrWantEntry);
  const needOrWantCooldown = useStore((s) => s.needOrWantCooldown);

  const [selectedEntry, setSelectedEntry] = useState<NeedOrWantEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all_time');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Tick for live cooldown updates
  useEffect(() => {
    const hasActive = entries.some(
      (e) => e.decision === null && (Date.now() - e.cooldownStart) < NEED_OR_WANT_COOLDOWN_MS,
    );
    if (!hasActive) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [entries]);

  const filtered = entries
    .filter((e) => {
      // Status filter
      if (filter === 'passed') return e.decision === false;
      if (filter === 'bought') return e.decision === true;
      if (filter === 'pending') return e.decision === null;
      return true;
    })
    .filter((e) => {
      // Date range filter
      if (dateRange === 'all_time') return true;
      const entryDate = new Date(e.at);
      const nowDate = new Date();
      if (dateRange === 'today') {
        return entryDate.toDateString() === nowDate.toDateString();
      }
      if (dateRange === 'week') {
        const weekAgo = new Date(nowDate.getTime() - 7 * 86_400_000);
        return entryDate >= weekAgo;
      }
      if (dateRange === 'month') {
        return entryDate.getMonth() === nowDate.getMonth() && entryDate.getFullYear() === nowDate.getFullYear();
      }
      if (dateRange === 'year') {
        return entryDate.getFullYear() === nowDate.getFullYear();
      }
      return true;
    })
    .sort((a, b) => b.at - a.at);

  const savedCount = entries.filter((e) => e.decision === false).length;
  const boughtCount = entries.filter((e) => e.decision === true).length;
  const pendingCount = entries.filter((e) => e.decision === null).length;

  function handleEntryPress(entry: NeedOrWantEntry) {
    Haptics.selectionAsync().catch(() => {});
    setSelectedEntry(entry);
    setDetailVisible(true);
  }

  function handleDelete(entry: NeedOrWantEntry) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      'Delete Entry',
      `Remove "${entry.itemName}" from your history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEntry(entry.id);
            setDetailVisible(false);
          },
        },
      ],
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }}>
        <Pressable
          onPress={safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="close" size={22} color={theme.color.primary} />
        </Pressable>

        <Text variant="title1" style={{ flex: 1, fontFamily: 'Nunito_900Black', marginLeft: spacing.md }}>
          Need or Want?
        </Text>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/need-or-want-flow');
          }}
          accessibilityRole="button"
          accessibilityLabel="Add new entry"
          hitSlop={12}
          style={({ pressed }) => ({
            marginLeft: spacing.md,
            opacity: pressed ? 0.5 : 1,
            padding: spacing.xs,
          })}
        >
          <Ionicons name="add-circle-outline" size={26} color={theme.color.primary} />
        </Pressable>
      </View>

      {/* ── Stats bar ── */}
      {entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {[
            { label: 'Total', count: entries.length, color: theme.color.text },
            { label: 'Passed', count: savedCount, color: theme.color.success },
            { label: 'Bought', count: boughtCount, color: theme.color.danger },
            ...(pendingCount > 0 ? [{ label: 'Pending', count: pendingCount, color: theme.color.primary }] : []),
          ].map((stat) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                backgroundColor: theme.color.surface,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                padding: spacing.sm,
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Text
                variant="title2"
                color={stat.color}
                style={{ fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'] }}
              >
                {stat.count}
              </Text>
              <Text variant="caption" dim>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Filter row — two compact selector buttons (journal style) ── */}
      {entries.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {/* Date range selector */}
          <Pressable
            onPress={() => setShowDateSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={`Period: ${DATE_RANGES.find((d) => d.key === dateRange)?.label}`}
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
                {DATE_RANGES.find((d) => d.key === dateRange)?.label ?? 'All time'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={13} color={dateRange !== 'all_time' ? theme.color.primary : theme.color.textDim} />
          </Pressable>

          {/* Status selector */}
          <Pressable
            onPress={() => setShowFilterSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={`Status: ${STATUS_FILTERS.find((s) => s.key === filter)?.label}`}
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
                {STATUS_FILTERS.find((s) => s.key === filter)?.label ?? 'All'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={13} color={filter !== 'all' ? theme.color.primary : theme.color.textDim} />
          </Pressable>
        </View>
      )}

      {/* ── Entry list ── */}
      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cart-outline" size={36} color={theme.color.primary} />
          </View>
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
              {entries.length === 0 ? 'No entries yet' : 'No matching entries'}
            </Text>
            <Text variant="callout" dim center style={{ lineHeight: 22 }}>
              {entries.length === 0
                ? 'Tap the + button to pause before a purchase. Your reflections will show up here.'
                : 'Try adjusting the filter.'}
            </Text>
          </View>
          {entries.length === 0 && (
            <Button label="Add your first entry" onPress={() => router.push('/need-or-want-flow')} full />
          )}
          {entries.length > 0 && filtered.length < entries.length && (
            <Text variant="caption" dim center>
              {filtered.length} of {entries.length}
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().damping(18)}>
              <EntryCard entry={item} onPress={() => handleEntryPress(item)} now={now} />
            </Animated.View>
          )}
        />
      )}

      {/* Date range picker */}
      <PickerSheet
        visible={showDateSheet}
        title="Period"
        options={DATE_RANGES}
        value={dateRange}
        onSelect={setDateRange}
        onClose={() => setShowDateSheet(false)}
      />

      {/* Status filter picker */}
      <PickerSheet
        visible={showFilterSheet}
        title="Status"
        options={STATUS_FILTERS}
        value={filter}
        onSelect={setFilter}
        onClose={() => setShowFilterSheet(false)}
      />

      {/* Detail sheet */}
      <DetailSheet
        entry={selectedEntry}
        visible={detailVisible}
        onClose={() => { setDetailVisible(false); setSelectedEntry(null); }}
        onDelete={() => { if (selectedEntry) handleDelete(selectedEntry); }}
        now={now}
      />
    </Screen>
  );
}

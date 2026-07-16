/**
 * Need or Want? - Purchase History Log
 * Shows all past need-or-want entries with outcomes.
 */

import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import { NEED_OR_WANT_CATEGORIES, NEED_OR_WANT_COOLDOWN_MS, type NeedOrWantEntry } from '@/domain/alternatives';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Card
// ─────────────────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onPress,
  onDelete,
}: {
  entry: NeedOrWantEntry;
  onPress: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const meta = NEED_OR_WANT_CATEGORIES[entry.category];
  const decision = entry.decision;
  const isSaved = decision === false;
  const isBought = decision === true;
  const isPending = decision === null;
  const isCoolingDown = isPending && (Date.now() - entry.cooldownStart) < NEED_OR_WANT_COOLDOWN_MS;

  const accentColor = isSaved
    ? theme.color.success
    : isBought
      ? theme.color.danger
      : theme.color.primary;

  const accentBg = isSaved
    ? theme.color.successSoft
    : isBought
      ? theme.color.danger + '18'
      : theme.color.primarySoft;

  const statusLabel = isSaved
    ? 'Didn\'t buy'
    : isBought
      ? 'Still bought'
      : isCoolingDown
        ? 'Cooling down'
        : 'Awaiting decision';

  const statusIcon = isSaved
    ? 'checkmark-circle'
    : isBought
      ? 'cart'
      : isCoolingDown
        ? 'hourglass-outline'
        : 'time';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        padding: spacing.md,
        gap: spacing.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Header row: icon + name + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: accentBg,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ionicons
            name={(meta?.icon ?? 'cart') as keyof typeof Ionicons.glyphMap}
            size={18}
            color={accentColor}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="callout"
            numberOfLines={1}
            style={{ fontFamily: 'Nunito_700Bold' }}
          >
            {entry.itemName}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
            {entry.itemPrice ? (
              <Text variant="caption" dim>
                {entry.currency}{entry.itemPrice}
              </Text>
            ) : null}
            <Text variant="caption" dim>·</Text>
            <Text variant="caption" dim>{meta?.label ?? entry.category}</Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: accentBg,
            borderRadius: radius.round,
            paddingVertical: 3,
            paddingHorizontal: spacing.sm,
          }}
        >
          <Ionicons name={statusIcon as keyof typeof Ionicons.glyphMap} size={12} color={accentColor} />
          <Text variant="caption" color={accentColor} style={{ fontFamily: 'Nunito_700Bold' }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Date + reason */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="caption" dim>{formatDate(entry.at)} · {formatTime(entry.at)}</Text>
        {entry.itemReason ? (
          <Text variant="caption" dim numberOfLines={1} style={{ flex: 1, textAlign: 'right', marginLeft: spacing.sm }}>
            {entry.itemReason}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Sheet
// ─────────────────────────────────────────────────────────────────────────────

function EntryDetailSheet({
  entry,
  visible,
  onClose,
  onDelete,
}: {
  entry: NeedOrWantEntry | null;
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  if (!entry) return null;

  const meta = NEED_OR_WANT_CATEGORIES[entry.category];
  const decision = entry.decision;
  const isSaved = decision === false;
  const isBought = decision === true;
  const isCoolingDown = decision === null && (Date.now() - entry.cooldownStart) < NEED_OR_WANT_COOLDOWN_MS;

  const accentColor = isSaved
    ? theme.color.success
    : isBought
      ? theme.color.danger
      : theme.color.primary;

  return (
    <ActionSheet visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: accentColor + '15',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={(meta?.icon ?? 'cart') as keyof typeof Ionicons.glyphMap}
              size={22}
              color={accentColor}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline" style={{ fontFamily: 'Nunito_800ExtraBold' }}>
              {entry.itemName}
            </Text>
            <Text variant="caption" dim>{meta?.label ?? entry.category}</Text>
          </View>
        </View>

        {/* Price */}
        {entry.itemPrice ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title2" style={{ fontFamily: 'Nunito_900Black' }}>
              {entry.currency}{entry.itemPrice}
            </Text>
          </View>
        ) : null}

        {/* Reason */}
        {entry.itemReason ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>Why you wanted it</Text>
            <Text variant="callout" dim style={{ lineHeight: 22 }}>{entry.itemReason}</Text>
          </View>
        ) : null}

        {/* Summary */}
        {entry.summary ? (
          <View
            style={{
              backgroundColor: theme.color.primarySoft,
              borderRadius: radius.card,
              padding: spacing.md,
              borderLeftWidth: 3,
              borderLeftColor: theme.color.primary,
            }}
          >
            <Text variant="callout" style={{ lineHeight: 22 }}>{entry.summary}</Text>
          </View>
        ) : null}

        {/* Decision */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>Outcome</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: accentColor + '10',
              borderRadius: radius.card,
              padding: spacing.md,
            }}
          >
            <Ionicons
              name={isSaved ? 'checkmark-circle' : isBought ? 'cart' : isCoolingDown ? 'hourglass-outline' : 'time'}
              size={20}
              color={accentColor}
            />
            <Text variant="callout" color={accentColor} style={{ fontFamily: 'Nunito_700Bold' }}>
              {isSaved
                ? 'You decided not to buy it — great job!'
                : isBought
                  ? 'You still bought it after the cooldown.'
                  : isCoolingDown
                    ? 'Still cooling down — open Need or Want? to see your decision.'
                    : 'Decision pending — open Need or Want? to decide.'}
            </Text>
          </View>
        </View>

        {/* Timestamps */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" dim>
            Logged {formatDate(entry.at)} at {formatTime(entry.at)}
          </Text>
          {entry.decidedAt ? (
            <Text variant="caption" dim>
              Decided {formatDate(entry.decidedAt)} at {formatTime(entry.decidedAt)}
            </Text>
          ) : null}
        </View>

        {/* Delete */}
        <Button
          label="Delete Entry"
          kind="tertiary"
          onPress={() => { onDelete(); onClose(); }}
          full
        />
      </View>
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function NeedOrWantLogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const entries = useStore((s) => s.needOrWantEntries);
  const deleteNeedOrWantEntry = useStore((s) => s.deleteNeedOrWantEntry);

  const [selectedEntry, setSelectedEntry] = useState<NeedOrWantEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Stats
  const totalEntries = entries.length;
  const savedCount = entries.filter((e) => e.decision === false).length;
  const boughtCount = entries.filter((e) => e.decision === true).length;
  const pendingCount = entries.filter((e) => e.decision === null).length;

  const handleEntryPress = (entry: NeedOrWantEntry) => {
    setSelectedEntry(entry);
    setDetailVisible(true);
  };

  const handleDelete = () => {
    if (selectedEntry) {
      deleteNeedOrWantEntry(selectedEntry.id);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
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
        <View style={{ flex: 1 }}>
          <Text variant="headline">Purchase History</Text>
          <Text variant="footnote" dim style={{ marginTop: 2 }}>
            All your Need or Want? reflections in one place.
          </Text>
        </View>
      </View>

      {/* Stats bar */}
      {totalEntries > 0 && (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
          }}
        >
          {[
            { label: 'Total', count: totalEntries, color: theme.color.text },
            { label: 'Saved', count: savedCount, color: theme.color.success },
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

      {/* Entry list */}
      {totalEntries === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cart-outline" size={36} color={theme.color.primary} />
          </View>
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
              No entries yet
            </Text>
            <Text variant="callout" dim center style={{ lineHeight: 22 }}>
              Use "Need or Want?" from the Healthy Alternatives to pause before a purchase. Your reflections will appear here.
            </Text>
          </View>
          <Button
            label="Try Need or Want?"
            onPress={() => { safeBack(); router.push('/need-or-want'); }}
            full
          />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 40).springify().damping(18)}>
              <EntryCard
                entry={item}
                onPress={() => handleEntryPress(item)}
                onDelete={() => deleteNeedOrWantEntry(item.id)}
              />
            </Animated.View>
          )}
        />
      )}

      {/* Detail sheet */}
      <EntryDetailSheet
        entry={selectedEntry}
        visible={detailVisible}
        onClose={() => { setDetailVisible(false); setSelectedEntry(null); }}
        onDelete={handleDelete}
      />
    </Screen>
  );
}

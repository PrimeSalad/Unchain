/**
 * Back on Track - History Log
 * Shows all past weekly recovery check-ins.
 * Route: /back-on-track-history
 */

import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import type { BackOnTrackEntry } from '@/domain/backOnTrack';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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

// ── Entry Card ────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onPress,
}: {
  entry: BackOnTrackEntry;
  onPress: () => void;
}) {
  const theme = useTheme();
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
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: theme.color.primarySoft,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="trending-up" size={20} color={theme.color.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>
            {formatDate(entry.at)}
          </Text>
          <Text variant="caption" dim style={{ marginTop: 2 }}>
            Well-being: {entry.overallWellBeing} · Mood: {entry.moodRating}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
      </View>
    </Pressable>
  );
}

// ── Detail Sheet ──────────────────────────────────────────────────────────

function DetailSheet({
  entry,
  visible,
  onClose,
  onDelete,
}: {
  entry: BackOnTrackEntry | null;
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  if (!entry) return null;

  const rows: { label: string; value: string }[] = [
    { label: 'Well-being', value: entry.overallWellBeing },
    { label: 'Comparison', value: entry.weekComparison },
    { label: 'Energy', value: entry.energyLevel },
    { label: 'Sleep', value: entry.sleepQuality },
    { label: 'Focus', value: entry.focusLevel },
    { label: 'Mood', value: entry.moodRating },
    { label: 'Cravings', value: entry.cravingStrength },
    { label: 'Physical', value: entry.physicalDiscomfort },
    { label: 'Substance Use', value: entry.substanceUse },
  ];

  return (
    <ActionSheet visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: theme.color.primarySoft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="trending-up" size={28} color={theme.color.primary} />
          </View>
          <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
            {formatDate(entry.at)}
          </Text>
          <Text variant="caption" dim>
            {new Date(entry.at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {' · '}
            {formatTime(entry.at)}
          </Text>
        </View>

        <View style={{
          backgroundColor: theme.color.surfaceAlt,
          borderRadius: radius.card,
          padding: spacing.md,
        }}>
          {rows.map((row, i) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: spacing.sm,
                borderBottomWidth: i < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: theme.color.hairline,
              }}
            >
              <Text variant="footnote" dim>{row.label}</Text>
              <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', flex: 1, textAlign: 'right' }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {entry.notes.trim().length > 0 && (
          <View style={{
            backgroundColor: theme.color.surfaceAlt,
            borderRadius: radius.card,
            padding: spacing.md,
          }}>
            <Text variant="caption" dim style={{ marginBottom: spacing.xs }}>Personal Notes</Text>
            <Text variant="callout" style={{ lineHeight: 22 }}>{entry.notes}</Text>
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <Button label="Delete Entry" kind="destructive" onPress={() => { onDelete(); onClose(); }} full />
          <Button label="Close" kind="tertiary" onPress={onClose} full />
        </View>
      </View>
    </ActionSheet>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function BackOnTrackHistory() {
  const theme = useTheme();
  const safeBack = useSafeBack();
  const router = useRouter();
  const entries = useStore((s) => s.backOnTrackEntries);
  const deleteBackOnTrackEntry = useStore((s) => s.deleteBackOnTrackEntry);

  const [selectedEntry, setSelectedEntry] = useState<BackOnTrackEntry | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const openEntry = (entry: BackOnTrackEntry) => {
    setSelectedEntry(entry);
    setSheetVisible(true);
  };

  const deleteEntry = () => {
    if (selectedEntry) {
      deleteBackOnTrackEntry(selectedEntry.id);
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
          accessibilityLabel="Go back"
          style={({ pressed }) => ({
            width: 40, height: 40, borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="headline">Back on Track History</Text>
          <Text variant="footnote" dim style={{ marginTop: 2 }}>
            {entries.length} {entries.length === 1 ? 'check-in' : 'check-ins'} recorded
          </Text>
        </View>
      </View>

      {entries.length === 0 ? (
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
            No check-ins yet
          </Text>
          <Text variant="footnote" dim center style={{ lineHeight: 20, marginBottom: spacing.lg }}>
            Complete your first Back on Track check-in to start tracking your recovery over time.
          </Text>
          <Button label="Start a Check-In" onPress={() => router.push('/back-on-track')} full />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm }}
          renderItem={({ item }) => (
            <EntryCard entry={item} onPress={() => openEntry(item)} />
          )}
        />
      )}

      <DetailSheet
        entry={selectedEntry}
        visible={sheetVisible}
        onClose={() => { setSheetVisible(false); setSelectedEntry(null); }}
        onDelete={deleteEntry}
      />
    </Screen>
  );
}

/**
 * Beyond the Screen - the single hub screen.
 * Route: /beyond-the-screen-log
 *
 * Stats, trend charts, expandable entry cards, add button, insights.
 * Everything Beyond the Screen lives here. After submitting the assessment
 * (via /beyond-the-screen), the user lands back here with the new entry visible.
 */

import { useMemo, useState, useCallback } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
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
  beyondTheScreenAvailability,
  generateInsights,
  randomSupportiveMessage,
  type BeyondTheScreenEntry,
} from '@/domain/beyondTheScreen';

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

function EntryCard({ entry, index }: { entry: BeyondTheScreenEntry; index: number }) {
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
    { icon: 'eye-outline', color: theme.color.primary, label: 'Focus', value: entry.focusLevel },
    { icon: 'rocket-outline', color: theme.color.primary, label: 'Motivation', value: entry.motivationLevel },
    { icon: 'heart-outline', color: theme.color.primary, label: 'Confidence', value: entry.confidenceLevel },
    { icon: 'flame-outline', color: entry.urgeFrequency === 'None' ? theme.color.success : theme.color.danger, label: 'Urge Freq', value: entry.urgeFrequency },
    { icon: 'people-outline', color: entry.socialTime === 'Yes' ? theme.color.success : theme.color.danger, label: 'Social', value: entry.socialTime },
    { icon: 'color-palette-outline', color: entry.hobbiesTime === 'Yes' ? theme.color.success : theme.color.danger, label: 'Hobbies', value: entry.hobbiesTime },
    { icon: 'walk-outline', color: entry.presenceLevel.includes('More') ? theme.color.success : theme.color.danger, label: 'Presence', value: entry.presenceLevel },
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
              <Ionicons name="eye" size={18} color={theme.color.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>
                {formatDate(entry.at)}
              </Text>
              <Text variant="caption" dim style={{ marginTop: 1 }}>
                Focus: {entry.focusLevel} · Confidence: {entry.confidenceLevel}
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
                  <Ionicons name="document-text-outline" size={14} color={theme.color.textDim} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Text variant="caption" dim style={{ width: 80, flexShrink: 0 }}>Notes</Text>
                  <Text variant="caption" style={{ flex: 1 }}>{entry.notes}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Insight card ──────────────────────────────────────────────────────────

function InsightCard({ insight, index }: { insight: { label: string; value: string; trend: string }; index: number }) {
  const theme = useTheme();
  const trendColor = insight.trend === 'improving' ? theme.color.success
    : insight.trend === 'declining' ? theme.color.danger
    : theme.color.textDim;
  const trendIcon = insight.trend === 'improving' ? 'arrow-up'
    : insight.trend === 'declining' ? 'arrow-down'
    : 'remove';

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 3) * 60).springify().damping(16)}
      style={{
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Ionicons name={trendIcon as any} size={14} color={trendColor} />
        <Text variant="caption" color={trendColor} style={{ fontFamily: 'Nunito_700Bold' }}>{insight.label}</Text>
      </View>
      <Text variant="footnote" style={{ lineHeight: 18 }}>{insight.value}</Text>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function BeyondTheScreenLogScreen() {
  const router = useRouter();
  const theme = useTheme();
  const back = useSafeBack();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const beyondTheScreenEntries = useStore((s) => s.beyondTheScreenEntries);
  const deleteBeyondTheScreenEntry = useStore((s) => s.deleteBeyondTheScreenEntry);

  const sortedEntries = useMemo(
    () => [...beyondTheScreenEntries].sort((a, b) => b.at - a.at),
    [beyondTheScreenEntries],
  );

  const availability = useMemo(
    () => beyondTheScreenAvailability(sortedEntries[0]?.at ?? null),
    [sortedEntries],
  );

  const insights = useMemo(() => generateInsights(sortedEntries), [sortedEntries]);
  const supportiveMessage = useMemo(() => randomSupportiveMessage(), []);

  const weeksFree = useMemo(() => {
    let count = 0;
    for (const entry of sortedEntries) {
      if (entry.urgeFrequency === 'None') count++;
      else break;
    }
    return count;
  }, [sortedEntries]);

  const totalReflections = beyondTheScreenEntries.length;

  const handleDelete = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeletingId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deletingId) {
      deleteBeyondTheScreenEntry(deletingId);
      setDeletingId(null);
    }
  }, [deletingId, deleteBeyondTheScreenEntry]);

  return (
    <Screen background={theme.color.bg}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingTop: spacing.xl,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
      }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: spacing.xs })}
        >
          <Ionicons name="chevron-back" size={22} color={theme.color.text} />
        </Pressable>
        <Text variant="headline" style={{ flex: 1, fontFamily: 'Nunito_900Black' }}>Beyond the Screen</Text>
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl + 100 }}
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: 0 }}
      >
        {/* Supportive message */}
        <Animated.View
          entering={FadeIn.delay(100).springify().damping(16)}
          style={{
            backgroundColor: theme.color.primarySoft,
            borderRadius: radius.card,
            padding: spacing.md,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: theme.color.primary + '24',
          }}
        >
          <Text variant="footnote" style={{ color: theme.color.primary, lineHeight: 20, fontStyle: 'italic' }}>
            {supportiveMessage}
          </Text>
        </Animated.View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          <StatCard icon="calendar" value={weeksFree} label="Weeks Strong" color={theme.color.success} delay={200} />
          <StatCard icon="trending-up" value={totalReflections} label="Reflections" color={theme.color.primary} delay={260} />
        </View>

        {/* Add button / cooldown */}
        {availability.available ? (
          <Pressable
            onPress={() => router.push('/beyond-the-screen')}
            style={({ pressed }) => ({
              backgroundColor: theme.color.primary,
              borderRadius: radius.input,
              paddingVertical: spacing.md,
              alignItems: 'center',
              marginBottom: spacing.lg,
              opacity: pressed ? 0.85 : 1,
              ...elevation.e2,
            })}
          >
            <Text variant="callout" style={{ color: '#FFFFFF', fontFamily: 'Nunito_800ExtraBold' }}>
              Start Weekly Reflection
            </Text>
          </Pressable>
        ) : (
          <View style={{
            backgroundColor: theme.color.surface,
            borderRadius: radius.input,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}>
            <Ionicons name="time-outline" size={18} color={theme.color.textDim} />
            <Text variant="footnote" dim>
              Next reflection available in {availability.daysLeft} day{availability.daysLeft === 1 ? '' : 's'}
            </Text>
          </View>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>
              Weekly Insights
            </Text>
            <View style={{ gap: spacing.sm }}>
              {insights.map((insight, i) => (
                <InsightCard key={insight.label} insight={insight} index={i} />
              ))}
            </View>
          </View>
        )}

        {/* Entries */}
        <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>
          History
        </Text>
        {sortedEntries.length === 0 ? (
          <View style={{
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            padding: spacing.xl,
            alignItems: 'center',
            gap: spacing.sm,
          }}>
            <Ionicons name="eye-outline" size={32} color={theme.color.textDim} />
            <Text variant="footnote" dim style={{ textAlign: 'center', lineHeight: 20 }}>
              Complete your first reflection to start tracking your well-being over time.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {sortedEntries.map((entry, i) => (
              <EntryCard key={entry.id} entry={entry} index={i} />
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <Text variant="caption" dim style={{ marginTop: spacing.xl, textAlign: 'center', lineHeight: 16 }}>
          Beyond the Screen is a self-reflection tool for monitoring well-being. It is not a clinical assessment or diagnosis.
        </Text>
      </Animated.ScrollView>

      {/* Delete confirmation */}
      {deletingId && (
        <View style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
        }}>
          <View style={{
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            padding: spacing.xl,
            width: '100%',
            maxWidth: 320,
            gap: spacing.md,
          }}>
            <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold', textAlign: 'center' }}>
              Delete Entry?
            </Text>
            <Text variant="footnote" dim style={{ textAlign: 'center', lineHeight: 20 }}>
              This will permanently delete this reflection. This action cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                kind="secondary"
                label="Cancel"
                onPress={() => setDeletingId(null)}
                style={{ flex: 1 }}
              />
              <Button
                kind="primary"
                label="Delete"
                onPress={confirmDelete}
                style={{ flex: 1, backgroundColor: theme.color.danger }}
              />
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}
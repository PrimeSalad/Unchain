import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { StatTile } from '../components/StatTile';
import { ProgressBar } from '../components/ProgressBar';
import { Roadmap } from '../components/Roadmap';
import { Pill } from '../components/Pill';
import { elevation, spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore, useProfile } from '@/application/store';
import { streakDays, currentStreakStart, journalMoneyStats, formatMoney, nextMilestone } from '@/domain/gambling';
import { sameDay } from '@/domain/records';
import {
  computeStats,
  badgeProgress,
  goalProgress,
  goalTitle,
  GOAL_META,
  GOAL_PRESETS,
  type BadgeCategory,
  type Goal,
  type GoalKind,
} from '@/domain/achievements';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Helpers — all date arithmetic uses LOCAL calendar values so the result
// always matches what the device clock shows, regardless of timezone.
// ---------------------------------------------------------------------------

/** Midnight (00:00:00.000) of the local calendar day that contains `ts`. */
function localMidnight(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Midnight of today according to the device clock. */
function todayLocalMidnight(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// ---------------------------------------------------------------------------

export function ProgressScreen() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const checkIns = useStore((s) => s.checkIns);
  const urges = useStore((s) => s.urges);
  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);
  const reflections = useStore((s) => s.reflections);
  const timeline = useStore((s) => s.timeline);
  const points = useStore((s) => s.points);
  const longestStreak = useStore((s) => s.longestStreak);
  const goals = useStore((s) => s.goals);
  const addGoal = useStore((s) => s.addGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const syncAchievements = useStore((s) => s.syncAchievements);
  const completeMission = useStore((s) => s.completeMission);

  // Viewing this screen IS the "Review Your Progress" daily mission —
  // without this call the mission could never be completed. Runs on every
  // focus (not just mount) so it also counts on later days while the tab
  // stays mounted; completeMission is idempotent per day.
  useFocusEffect(
    useCallback(() => {
      completeMission('review_progress');
    }, [completeMission]),
  );

  const [goalModal, setGoalModal] = useState(false);

  const current = profile
    ? streakDays(currentStreakStart(profile.startedAt, relapses, journal))
    : 0;
  const best = Math.max(longestStreak, current);
  // Financial stats use the recovery-adjusted balance from journal entries:
  // gambling losses are subtracted from the entered balance, gambling wins
  // are never added — a win can never improve these figures, achievements,
  // or the streak.
  const moneyStats = journalMoneyStats(journal);
  const currency = profile?.currency ?? '₱';
  const resisted = urges.filter((u) => u.resisted).length;

  const stats = useMemo(
    () =>
      profile
        ? computeStats({ profile, checkIns, urges, relapses, journal, reflections, timeline, points, longestStreak })
        : null,
    [profile, checkIns, urges, relapses, journal, reflections, timeline, points, longestStreak],
  );

  const badges = useMemo(() => (stats ? badgeProgress(stats) : []), [stats]);
  const earnedCount = badges.filter((b) => b.earned).length;

  // Award any newly-earned badges / completed goals (logs them to the timeline).
  useEffect(() => {
    syncAchievements();
  }, [current, checkIns.length, urges.length, journal.length, goals.length, syncAchievements]);

  // ---------------------------------------------------------------------------
  // Calendar
  //
  // Source of truth: journal entries ONLY.
  //   green  ("clean")   → journal entry exists for that day AND gambled=false
  //   red    ("relapse") → journal entry exists for that day AND gambled=true
  //   none               → no journal entry for that day, future days, or days
  //                        before the first journal entry
  //
  // "high" urge days are still shown when a clean journal entry exists AND
  // a high-intensity urge (≥7) was logged that same day — so the indicator
  // still works but never overrides the journal-based color.
  //
  // profile.startedAt and the relapses array are intentionally NOT used here
  // to infer calendar colors — only committed journal entries count.
  // ---------------------------------------------------------------------------
  const calendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const todayMid = todayLocalMidnight();

    // Index journal entries by local-midnight timestamp for O(1) lookup.
    const journalByDay = new Map<number, boolean>(); // midnight → gambled
    journal.forEach((j) => {
      if (j.gambled !== undefined) {
        journalByDay.set(localMidnight(j.at), j.gambled);
      }
    });

    const cells: ({ day: number; status: 'clean' | 'high' | 'relapse' | 'none' } | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const cellMid = new Date(year, month, d).getTime();
      const isFuture = cellMid > todayMid;
      const journalGambled = journalByDay.get(cellMid);
      const hasJournal = journalByDay.has(cellMid);

      let status: 'clean' | 'high' | 'relapse' | 'none';

      if (isFuture || !hasJournal) {
        status = 'none';
      } else if (journalGambled === true) {
        status = 'relapse';
      } else {
        // Clean day — check for high urge on the same day
        const hasHighUrge =
          urges.some((u) => sameDay(u.at, cellMid) && u.intensity >= 7) ||
          checkIns.some((c) => sameDay(c.at, cellMid) && (c.urgeStrength ?? 0) >= 7);
        status = hasHighUrge ? 'high' : 'clean';
      }

      cells.push({ day: d, status });
    }
    return cells;
  }, [journal, urges, checkIns]);

  // ---------------------------------------------------------------------------
  // Trigger analysis
  // ---------------------------------------------------------------------------
  const analysis = useMemo(() => {
    const counts: Record<string, number> = {};
    const bump = (t?: string[]) => t?.forEach((x) => (counts[x] = (counts[x] ?? 0) + 1));
    checkIns.forEach((c) => bump(c.triggers));
    urges.forEach((u) => u.trigger && bump([u.trigger]));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

    const byDow: Record<number, number> = {};
    const byHour: Record<number, number> = {};
    urges.forEach((u) => {
      const d = new Date(u.at);
      byDow[d.getDay()] = (byDow[d.getDay()] ?? 0) + 1;
      byHour[d.getHours()] = (byHour[d.getHours()] ?? 0) + 1;
    });
    const topDow = Object.entries(byDow).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]?.[0];
    const avgUrge = urges.length
      ? Math.round((urges.reduce((s, u) => s + u.intensity, 0) / urges.length) * 10) / 10
      : 0;

    return {
      top,
      day: topDow != null ? DOW[+topDow] : undefined,
      hour: topHour != null ? formatHour(+topHour) : undefined,
      avgUrge,
    };
  }, [checkIns, urges]);

  const statusColor = (s: string) => {
    if (s === 'clean') return theme.color.success;
    if (s === 'high') return theme.color.celebrate;
    if (s === 'relapse') return theme.color.danger;
    return theme.color.surfaceAlt;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Screen tabPadding>
      {/* Header + share */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <Text variant="title1" style={{ flex: 1 }}>Progress</Text>
        <Pressable
          onPress={() => router.push('/share' as Href)}
          hitSlop={10}
          accessibilityLabel="Share your progress"
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: spacing.md, height: 40, borderRadius: radius.round,
            backgroundColor: theme.color.primarySoft, opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="share-outline" size={18} color={theme.color.primary} />
          <Text variant="footnote" color={theme.color.primary}>Share</Text>
        </Pressable>
      </View>

      {/* Core stats */}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <StatTile value={`${current}`} label="Current streak" />
        <StatTile value={`${best}`} label="Longest streak" />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <StatTile value={`${resisted}`} label="Urges resisted" />
        <StatTile value={`${earnedCount}`} label="Badges earned" tone="primarySoft" />
        <StatTile value={`${relapses.length}`} label="Relapses" />
      </View>

      {/* Recovery roadmap */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        Your Recovery Road
      </Text>
      <Text variant="footnote" dim style={{ marginBottom: spacing.md }}>
        {current >= 365
          ? 'A full year free. You built this.'
          : `${current} days in — next stop is day ${nextMilestone(current)}.`}
      </Text>
      <Card>
        <Roadmap days={current} />
      </Card>

      {/* Goals */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md }}>
        <Text variant="headline" style={{ flex: 1 }}>My Goals</Text>
        <Pressable onPress={() => setGoalModal(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add goal" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
          <Ionicons name="add-circle" size={20} color={theme.color.primary} />
          <Text variant="footnote" color={theme.color.primary}>Add goal</Text>
        </Pressable>
      </View>
      {goals.length === 0 ? (
        <Card tone="primarySoft" style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Ionicons name="flag" size={28} color={theme.color.primary} />
          <Text variant="callout" center style={{ marginTop: spacing.sm }}>Set a goal to aim for</Text>
          <Text variant="footnote" dim center style={{ marginTop: 4, paddingHorizontal: spacing.md }}>
            A target gives every clean day a purpose.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} stats={stats} onRemove={() => removeGoal(g.id)} currency={currency} />
          ))}
        </View>
      )}

      {/* Badges */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Badges · {earnedCount}/{badges.length}
      </Text>
      <BadgesPager badges={badges} />

      {/* Money */}
      <Card style={{ marginTop: spacing.xl }}>
        <Text variant="headline" style={{ marginBottom: spacing.md }}>Financial Tracker</Text>
        <Text variant="footnote" dim style={{ marginBottom: spacing.md, lineHeight: 18 }}>
          Based on your daily balance entries in the journal. A lost wager is subtracted from your balance; winnings are never counted — recovery comes first. Financial changes do not affect your streak or achievements.
        </Text>
        <Row
          label="Current balance"
          value={moneyStats.current != null ? formatMoney(moneyStats.current, currency) : '—'}
          bold
        />
        <Row
          label="Since last entry"
          value={
            moneyStats.change != null
              ? (moneyStats.change >= 0 ? '+' : '') + formatMoney(moneyStats.change, currency)
              : '—'
          }
        />
        <Row
          label="Weekly trend (avg/day)"
          value={
            moneyStats.weeklyTrend != null
              ? (moneyStats.weeklyTrend >= 0 ? '+' : '') + formatMoney(moneyStats.weeklyTrend, currency)
              : '—'
          }
        />
        <Row
          label="Monthly trend (avg/day)"
          value={
            moneyStats.monthlyTrend != null
              ? (moneyStats.monthlyTrend >= 0 ? '+' : '') + formatMoney(moneyStats.monthlyTrend, currency)
              : '—'
          }
        />
      </Card>

      {/* Calendar */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Recovery Calendar
      </Text>
      <Card>
        <View style={{ flexDirection: 'row' }}>
          {DOW.map((d) => (
            <View key={d} style={{ width: `${100 / 7}%`, alignItems: 'center', marginBottom: spacing.sm }}>
              <Text variant="caption" dim>{d[0]}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {calendar.map((c, i) => (
            <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 }}>
              {c ? (
                <View
                  style={{
                    width: 30, height: 30, borderRadius: radius.chip,
                    backgroundColor: statusColor(c.status),
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text variant="caption" color={c.status === 'none' ? theme.color.textDim : '#FFFFFF'}>
                    {c.day}
                  </Text>
                </View>
              ) : (
                <View style={{ width: 30, height: 30 }} />
              )}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, flexWrap: 'wrap' }}>
          <Legend color={theme.color.success} label="Clean" />
          <Legend color={theme.color.celebrate} label="High urge" />
          <Legend color={theme.color.danger} label="Relapse / start" />
        </View>
      </Card>

      {/* Trigger analysis */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Trigger Analysis
      </Text>
      <Card>
        {urges.length === 0 && checkIns.length === 0 ? (
          <Text variant="callout" dim>Log urges and check-ins to see your patterns.</Text>
        ) : (
          <>
            <Row label="Most common trigger" value={analysis.top ?? '—'} />
            <Row label="Highest-risk day" value={analysis.day ?? '—'} />
            <Row label="Highest-risk time" value={analysis.hour ?? '—'} />
            <Row label="Average urge" value={analysis.avgUrge ? `${analysis.avgUrge}/10` : '—'} />
          </>
        )}
      </Card>

      {/* Add-goal modal */}
      <AddGoalModal
        visible={goalModal}
        existing={goals}
        onClose={() => setGoalModal(false)}
        onAdd={(kind, target) => {
          addGoal(kind, target);
          setGoalModal(false);
        }}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GoalCard({
  goal, stats, onRemove, currency,
}: {
  goal: Goal;
  stats: ReturnType<typeof computeStats> | null;
  onRemove: () => void;
  currency: string;
}) {
  const theme = useTheme();
  const meta = GOAL_META[goal.kind];
  const p = stats ? goalProgress(goal, stats) : { value: 0, pct: 0, done: false };
  const fmt = (n: number) => (goal.kind === 'money' ? formatMoney(n, currency) : `${n}`);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: radius.round, backgroundColor: p.done ? theme.color.successSoft : theme.color.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={(p.done ? 'checkmark' : meta.icon) as any} size={18} color={p.done ? theme.color.success : theme.color.primary} />
        </View>
        <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }}>{goalTitle(goal)}</Text>
        <Pressable onPress={onRemove} hitSlop={14} accessibilityRole="button" accessibilityLabel={`Remove goal: ${goalTitle(goal)}`}>
          <Ionicons name="close" size={18} color={theme.color.textDim} />
        </Pressable>
      </View>
      <ProgressBar progress={p.pct} color={p.done ? theme.color.success : theme.color.primary} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Text variant="caption" dim>{p.done ? 'Reached 🎉' : `${Math.round(p.pct * 100)}%`}</Text>
        <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
          {fmt(p.value)} / {fmt(goal.target)}
        </Text>
      </View>
    </Card>
  );
}

const BADGE_CATEGORIES: { key: BadgeCategory; label: string }[] = [
  { key: 'streak', label: 'Streak' },
  { key: 'resilience', label: 'Resilience' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'reflection', label: 'Reflection' },
  { key: 'tools', label: 'Calm Tools' },
  { key: 'money', label: 'Money' },
];

/** Badges organised into category tabs — tap a category, see its badges.
 *  No horizontal paging (which fought the vertical scroll and crowded text). */
function BadgesPager({ badges }: { badges: ReturnType<typeof badgeProgress> }) {
  const theme = useTheme();
  const groups = BADGE_CATEGORIES
    .map((c) => ({ ...c, items: badges.filter((b) => b.category === c.key) }))
    .filter((g) => g.items.length > 0);

  const [cat, setCat] = useState<BadgeCategory>(groups[0]?.key ?? 'streak');
  const active = groups.find((g) => g.key === cat) ?? groups[0];
  if (!active) return null;

  return (
    <View>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
      >
        {groups.map((g) => {
          const earned = g.items.filter((i) => i.earned).length;
          const on = g.key === active.key;
          return (
            <Pressable
              key={g.key}
              onPress={() => setCat(g.key)}
              accessibilityRole="tab"
              accessibilityLabel={`${g.label} badges, ${earned} of ${g.items.length} earned`}
              accessibilityState={{ selected: on }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 1,
                borderRadius: radius.round,
                backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt,
              }}
            >
              <Text variant="footnote" color={on ? theme.color.onPrimary : theme.color.text}>{g.label}</Text>
              <Text variant="caption" color={on ? theme.color.onPrimary : theme.color.textDim} style={{ fontVariant: ['tabular-nums'] }}>
                {earned}/{g.items.length}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Selected category's badges */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {active.items.map((b) => <BadgeTile key={b.id} badge={b} />)}
      </View>
    </View>
  );
}

function BadgeTile({ badge }: { badge: ReturnType<typeof badgeProgress>[number] }) {
  const theme = useTheme();
  const earned = badge.earned;
  return (
    <View
      style={{
        flexBasis: '30%', flexGrow: 0, minWidth: 92,
        backgroundColor: earned ? theme.color.primarySoft : theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: earned ? 'transparent' : theme.color.hairline,
        paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
        alignItems: 'center',
        opacity: earned ? 1 : 0.75,
      }}
    >
      <View
        style={{
          width: 44, height: 44, borderRadius: radius.round,
          backgroundColor: earned ? theme.color.primary : theme.color.surfaceAlt,
          alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
        }}
      >
        <Ionicons
          name={(earned ? badge.icon : 'lock-closed') as any}
          size={22}
          color={earned ? theme.color.onPrimary : theme.color.textDim}
        />
      </View>
      <Text variant="caption" center numberOfLines={1} color={earned ? theme.color.text : theme.color.textDim}>
        {badge.title}
      </Text>
      <Text variant="caption" dim center style={{ fontVariant: ['tabular-nums'], marginTop: 2 }}>
        {earned ? 'Earned' : `${Math.min(badge.value, badge.target)}/${badge.target}`}
      </Text>
    </View>
  );
}

function AddGoalModal({
  visible, existing, onClose, onAdd,
}: {
  visible: boolean;
  existing: Goal[];
  onClose: () => void;
  onAdd: (kind: GoalKind, target: number) => void;
}) {
  const theme = useTheme();
  const [kind, setKind] = useState<GoalKind>('streak');
  const [custom, setCustom] = useState('');

  const hasGoal = (k: GoalKind, t: number) => existing.some((g) => g.kind === k && g.target === t);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Scrim and sheet are siblings — nesting the sheet inside a Pressable
          nests buttons inside a button (invalid on web). */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={{
            backgroundColor: theme.color.surface,
            borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md,
            ...elevation.e2,
          }}
        >
          <Text variant="title2">Add a goal</Text>
          <Text variant="footnote" dim>Pick something to aim for.</Text>

          {/* Presets */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            {GOAL_PRESETS.map((g) => {
              const label =
                g.kind === 'money' ? `Save ₱${g.target.toLocaleString('en-PH')}`
                : g.kind === 'streak' ? `${g.target} days`
                : `${g.target} check-ins`;
              const taken = hasGoal(g.kind, g.target);
              return (
                <Pressable
                  key={`${g.kind}-${g.target}`}
                  disabled={taken}
                  onPress={() => onAdd(g.kind, g.target)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: taken }}
                  style={{
                    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
                    borderRadius: radius.round,
                    backgroundColor: taken ? theme.color.surfaceAlt : theme.color.primarySoft,
                    opacity: taken ? 0.5 : 1,
                  }}
                >
                  <Text variant="callout" color={taken ? theme.color.textDim : theme.color.primary}>
                    {taken ? `✓ ${label}` : label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom */}
          <Text variant="footnote" dim style={{ marginTop: spacing.md }}>Or set your own target</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['streak', 'money', 'checkins'] as GoalKind[]).map((k) => (
              <Pill key={k} label={GOAL_META[k].label} active={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <TextInput
              value={custom}
              onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder={kind === 'money' ? 'Amount in ₱' : 'Target number'}
              placeholderTextColor={theme.color.textDim}
              style={{
                flex: 1, borderRadius: radius.input, backgroundColor: theme.color.surfaceAlt,
                padding: spacing.md, color: theme.color.text, fontSize: 16,
              }}
            />
            <Pressable
              disabled={!custom || parseInt(custom, 10) <= 0}
              onPress={() => { onAdd(kind, parseInt(custom, 10)); setCustom(''); }}
              accessibilityRole="button"
              accessibilityLabel="Add custom goal"
              style={{
                paddingHorizontal: spacing.xl, height: 48, borderRadius: radius.button,
                backgroundColor: theme.color.primary, alignItems: 'center', justifyContent: 'center',
                opacity: !custom || parseInt(custom, 10) <= 0 ? 0.4 : 1,
              }}
            >
              <Text variant="headline" color={theme.color.onPrimary}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text variant="callout" dim>{label}</Text>
      <Text variant={bold ? 'headline' : 'callout'} color={bold ? theme.color.primary : theme.color.text}>
        {value}
      </Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" dim>{label}</Text>
    </View>
  );
}

function formatHour(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ampm}`;
}

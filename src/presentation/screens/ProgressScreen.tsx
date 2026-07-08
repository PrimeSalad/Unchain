import { useMemo } from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { StatTile } from '../components/StatTile';
import { spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore, useProfile } from '@/application/store';
import { streakDays, moneySaved, formatMoney, MILESTONES } from '@/domain/gambling';
import { sameDay } from '@/domain/records';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ProgressScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const checkIns = useStore((s) => s.checkIns);
  const urges = useStore((s) => s.urges);
  const relapses = useStore((s) => s.relapses);
  const longestStreak = useStore((s) => s.longestStreak);

  const current = profile ? streakDays(profile.startedAt) : 0;
  const best = Math.max(longestStreak, current);
  const money = profile ? moneySaved(profile) : { today: 0, week: 0, month: 0, total: 0 };
  const currency = profile?.currency ?? '₱';
  const resisted = urges.filter((u) => u.resisted).length;

  // Calendar for the current month.
  const calendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: ({ day: number; status: 'clean' | 'high' | 'relapse' | 'none' } | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d).getTime();
      const relapse = relapses.some((r) => sameDay(r.at, date));
      const high = urges.some((u) => sameDay(u.at, date) && u.intensity >= 7) || checkIns.some((c) => sameDay(c.at, date) && (c.urgeStrength ?? 0) >= 7);
      const clean = checkIns.some((c) => sameDay(c.at, date) && !c.gambled);
      cells.push({ day: d, status: relapse ? 'relapse' : high ? 'high' : clean ? 'clean' : 'none' });
    }
    return cells;
  }, [checkIns, urges, relapses]);

  // Trigger analysis.
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
    const avgUrge = urges.length ? Math.round((urges.reduce((s, u) => s + u.intensity, 0) / urges.length) * 10) / 10 : 0;

    return {
      top,
      day: topDow != null ? DOW[+topDow] : undefined,
      hour: topHour != null ? formatHour(+topHour) : undefined,
      avgUrge,
    };
  }, [checkIns, urges]);

  const statusColor = (s: string) =>
    s === 'clean' ? theme.color.success : s === 'high' ? theme.color.celebrate : s === 'relapse' ? theme.color.danger : theme.color.surfaceAlt;

  return (
    <Screen tabPadding>
      <Text variant="title1" style={{ marginTop: spacing.sm }}>Progress</Text>

      {/* Core stats */}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <StatTile value={`${current}`} label="Current streak" />
        <StatTile value={`${best}`} label="Longest streak" />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <StatTile value={`${urges.length}`} label="Total urges" />
        <StatTile value={`${resisted}`} label="Urges resisted" />
        <StatTile value={`${relapses.length}`} label="Relapses" />
      </View>

      {/* Money */}
      <Card style={{ marginTop: spacing.md }}>
        <Text variant="headline" style={{ marginBottom: spacing.md }}>Money Saved</Text>
        <Row label="This week" value={formatMoney(money.week, currency)} />
        <Row label="This month" value={formatMoney(money.month, currency)} />
        <Row label="Overall" value={formatMoney(money.total, currency)} bold />
      </Card>

      {/* Calendar */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Recovery Calendar</Text>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {DOW.map((d) => (
            <View key={d} style={{ width: `${100 / 7}%`, alignItems: 'center', marginBottom: spacing.sm }}>
              <Text variant="caption" dim>{d[0]}</Text>
            </View>
          ))}
          {calendar.map((c, i) => (
            <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 }}>
              {c ? (
                <View style={{ width: 30, height: 30, borderRadius: radius.chip, backgroundColor: statusColor(c.status), alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="caption" color={c.status === 'none' ? theme.color.textDim : '#FFFFFF'}>{c.day}</Text>
                </View>
              ) : <View style={{ width: 30, height: 30 }} />}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md }}>
          <Legend color={theme.color.success} label="Clean" />
          <Legend color={theme.color.celebrate} label="High urge" />
          <Legend color={theme.color.danger} label="Relapse" />
        </View>
      </Card>

      {/* Trigger analysis */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Trigger Analysis</Text>
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

      {/* Achievements */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Achievements</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {MILESTONES.map((m) => {
          const got = best >= m;
          return (
            <View key={m} style={{ paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.round, backgroundColor: got ? theme.color.primarySoft : theme.color.surfaceAlt }}>
              <Text variant="footnote" color={got ? theme.color.primary : theme.color.textDim}>Day {m}</Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text variant="callout" dim>{label}</Text>
      <Text variant={bold ? 'headline' : 'callout'} color={bold ? theme.color.primary : theme.color.text}>{value}</Text>
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

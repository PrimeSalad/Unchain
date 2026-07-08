import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { RecoveryRing } from '../components/RecoveryRing';
import { Mascot } from '../components/Mascot';
import { spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useNow } from '../hooks/useNow';
import { useStore, useProfile, useTodayCheckIn } from '@/application/store';
import {
  streakDays, recoveryTimer, nextMilestone, moneySaved, formatMoney, milestoneCrossed, addictionMeta,
} from '@/domain/gambling';
import { quoteOfNow, randomFrom, MOTIVATION } from '@/domain/content';
import type { TimelineType } from '@/domain/records';
import { sameDay } from '@/domain/records';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

const TIMELINE_ICON: Record<TimelineType, keyof typeof Ionicons.glyphMap> = {
  checkin: 'checkmark-circle', clean: 'sunny', money: 'wallet', urge: 'pulse',
  relapse: 'refresh-circle', journal: 'book', milestone: 'ribbon', badge: 'medal',
  breathing: 'leaf', start: 'flag',
};

export function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const now = useNow();
  const profile = useProfile();

  const timeline = useStore((s) => s.timeline);
  const urges = useStore((s) => s.urges);
  const journal = useStore((s) => s.journal);
  const pushTimeline = useStore((s) => s.pushTimeline);
  const todayCheckIn = useTodayCheckIn();

  const days = profile ? streakDays(profile.startedAt, now) : 0;
  const timer = profile ? recoveryTimer(profile.startedAt, now) : { days: 0, hours: 0, minutes: 0 };
  const target = nextMilestone(days);
  const money = profile ? moneySaved(profile, now) : { today: 0, week: 0, month: 0, total: 0 };
  const currency = profile?.currency ?? '₱';

  const motivation = useMemo(() => randomFrom(MOTIVATION), []);

  // Announce milestone crossings into the timeline (once).
  useEffect(() => {
    if (!profile) return;
    const crossed = milestoneCrossed(days - 1, days);
    if (crossed && !timeline.some((e) => e.type === 'milestone' && e.label.includes(`Day ${crossed}`))) {
      pushTimeline('milestone', `Reached Day ${crossed}`);
      router.push({ pathname: '/celebrate', params: { title: `Day ${crossed} gambling-free!`, arm: 'Keep going — one day at a time.' } });
    }
  }, [days, profile, timeline, pushTimeline, router]);

  if (!profile) return null;

  const activityToday = urges.some((u) => sameDay(u.at, now)) || journal.some((j) => sameDay(j.at, now));
  const tasks = [
    { key: 'checkin', label: 'Complete daily check-in', done: !!todayCheckIn, go: () => router.push('/checkin') },
    { key: 'mood', label: "Record today's mood", done: todayCheckIn?.mood != null, go: () => router.push('/checkin') },
    { key: 'activity', label: 'Finish one recovery activity', done: activityToday, go: () => router.push('/breathing') },
  ];

  return (
    <Screen tabPadding>
      {/* Greeting */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="title1">{greeting()}, {profile.name}</Text>
          <Text variant="callout" dim style={{ marginTop: 2 }}>{quoteOfNow()}</Text>
        </View>
        <Mascot state={days > 0 ? 'happy' : 'braced'} size={72} />
      </View>

      {/* Recovery Dashboard */}
      <Card raised style={{ marginTop: spacing.lg, alignItems: 'center' }}>
        <RecoveryRing current={days} target={target} size={190} caption={`of ${target} days`} />
        <Text variant="title2" style={{ marginTop: spacing.md }}>{days} Days {addictionMeta(profile.addictionType).freeLabel}</Text>
        <Text variant="callout" dim style={{ marginTop: 2 }}>
          {timer.days}d · {timer.hours}h · {timer.minutes}m · Next goal: {target} days
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.lg, alignSelf: 'stretch' }}>
          <Money label="Today" value={formatMoney(money.today, currency)} />
          <Money label="This Week" value={formatMoney(money.week, currency)} />
          <Money label="This Month" value={formatMoney(money.month, currency)} />
          <Money label="Total" value={formatMoney(money.total, currency)} highlight />
        </View>
      </Card>

      {/* Today's Recovery */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Today's Recovery</Text>
      <Card padding={0}>
        {tasks.map((t, i) => (
          <Pressable key={t.key} onPress={t.go} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline }}>
            <Ionicons name={t.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={t.done ? theme.color.success : theme.color.textDim} />
            <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }} color={t.done ? theme.color.textDim : theme.color.text}>{t.label}</Text>
            {!t.done && <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />}
          </Pressable>
        ))}
      </Card>

      {/* Quick Actions */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Quick Actions</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <QuickAction icon="pulse" label="Log Urge" onPress={() => router.push('/log-urge')} />
        <QuickAction icon="book" label="Journal" onPress={() => router.push('/(tabs)/journal')} />
        <QuickAction icon="warning" label="SOS" tone accent onPress={() => router.push('/sos')} />
        <QuickAction icon="leaf" label="Breathing" onPress={() => router.push('/breathing')} />
      </View>

      {/* Recovery Timeline */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Recovery Timeline</Text>
      <Card padding={0}>
        {timeline.slice(0, 8).map((e, i) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline }}>
            <Ionicons name={TIMELINE_ICON[e.type]} size={20} color={theme.color.primary} />
            <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }}>{e.label}</Text>
            <Text variant="caption" dim>{relTime(e.at, now)}</Text>
          </View>
        ))}
      </Card>

      {/* Motivation */}
      <Card tone="celebrateSoft" style={{ marginTop: spacing.xl }}>
        <Text variant="callout" color={theme.color.celebrateText}>{motivation}</Text>
      </Card>
    </Screen>
  );
}

function Money({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ width: '50%', paddingVertical: spacing.sm }}>
      <Text variant="footnote" dim>{label}</Text>
      <Text variant="title2" color={highlight ? theme.color.primary : theme.color.text} style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tone?: boolean; accent?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={{ width: '47%', flexGrow: 1 }}>
      <Card tone={accent ? 'accentSoft' : 'surface'} style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
        <Ionicons name={icon} size={26} color={accent ? theme.color.accentText : theme.color.primary} />
        <Text variant="callout" style={{ marginTop: spacing.sm }} color={accent ? theme.color.accentText : theme.color.text}>{label}</Text>
      </Card>
    </Pressable>
  );
}

function relTime(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

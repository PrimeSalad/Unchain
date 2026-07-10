import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { RecoveryRing } from '../components/RecoveryRing';
import { StatTile } from '../components/StatTile';
import { Mascot } from '../components/Mascot';
import { spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useNow } from '../hooks/useNow';
import { useResponsive } from '../hooks/useResponsive';
import { useStore, useProfile, useTodayCheckIn } from '@/application/store';
import {
  streakDays,
  currentStreakStart,
  recoveryTimer,
  nextMilestone,
  journalMoneyStats,
  formatMoney,
  milestoneCrossed,
  addictionMeta,
} from '@/domain/gambling';
import { quoteOfNow } from '@/domain/content';
import type { TimelineType } from '@/domain/records';
import { sameDay } from '@/domain/records';
import { DailyQuoteCard, FavoriteQuotesCarousel } from '../components/QuoteCards';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

const TIMELINE_ICON: Record<TimelineType, keyof typeof Ionicons.glyphMap> = {
  checkin: 'checkmark-circle',
  clean: 'sunny',
  money: 'wallet',
  urge: 'pulse',
  relapse: 'refresh-circle',
  journal: 'book',
  milestone: 'ribbon',
  badge: 'medal',
  achievement: 'trophy',
  breathing: 'leaf',
  activity: 'walk',
  start: 'flag',
};

export function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const now = useNow();
  const profile = useProfile();
  const { ringSize } = useResponsive();

  const timeline = useStore((s) => s.timeline);
  const urges = useStore((s) => s.urges);
  const journal = useStore((s) => s.journal);
  const relapses = useStore((s) => s.relapses);
  const pushTimeline = useStore((s) => s.pushTimeline);
  const todayCheckIn = useTodayCheckIn();

  // Derive the current streak start from the event log — never from startedAt
  // directly — so a relapse only marks today red without wiping history.
  const streakStart = profile
    ? currentStreakStart(profile.startedAt, relapses, journal)
    : 0;
  const days = streakStart ? streakDays(streakStart, now) : 0;
  const timer = streakStart ? recoveryTimer(streakStart, now) : { days: 0, hours: 0, minutes: 0 };
  const target = nextMilestone(days);
  // Financial stats use the recovery-adjusted balance from journal entries:
  // gambling losses are subtracted from the entered balance, gambling wins
  // are never added. Neither fact changes the streak or calendar.
  const moneyStats = journalMoneyStats(journal);
  const currency = profile?.currency ?? '₱';

  useEffect(() => {
    if (!profile) return;
    const crossed = milestoneCrossed(days - 1, days);
    if (
      crossed &&
      !timeline.some((e) => e.type === 'milestone' && e.label.includes(`Day ${crossed}`))
    ) {
      pushTimeline('milestone', `Reached Day ${crossed}`);
      router.push({
        pathname: '/celebrate',
        params: { title: `Day ${crossed} ${addictionMeta(profile.addictionType).freeLabel}!`, arm: 'Keep going — one day at a time.' },
      });
    }
  }, [days, profile, timeline, pushTimeline, router]);

  if (!profile) return null;

  const activityToday =
    urges.some((u) => sameDay(u.at, now)) ||
    journal.some((j) => sameDay(j.at, now)) ||
    timeline.some((e) => (e.type === 'breathing' || e.type === 'activity') && sameDay(e.at, now));
  const tasks = [
    { key: 'checkin', label: 'Complete daily check-in', done: !!todayCheckIn, go: () => router.push('/checkin') },
    { key: 'mood', label: "Record today's mood", done: todayCheckIn?.mood != null, go: () => router.push('/checkin') },
    { key: 'activity', label: 'Finish one recovery activity', done: activityToday, go: () => router.push('/alternatives' as Href) },
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

      {/* Recovery Dashboard — flat, sits directly on the page */}
      <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
        <RecoveryRing current={days} target={target} size={ringSize} caption={`of ${target} days`} />
        <Text variant="title2" style={{ marginTop: spacing.md }}>
          {days} Day{days === 1 ? '' : 's'} {addictionMeta(profile.addictionType).freeLabel}
        </Text>
        <Text variant="callout" dim style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}>
          {timer.days}d {timer.hours}h {timer.minutes}m clean · Goal: {target} days
        </Text>

        <View style={{ alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <StatTile
              value={moneyStats.current != null ? formatMoney(moneyStats.current, currency) : '—'}
              label="Current Balance"
            />
            <StatTile
              value={
                moneyStats.change != null
                  ? (moneyStats.change >= 0 ? '+' : '') + formatMoney(moneyStats.change, currency)
                  : '—'
              }
              label="Since Last Entry"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <StatTile
              value={
                moneyStats.weeklyTrend != null
                  ? (moneyStats.weeklyTrend >= 0 ? '+' : '') + formatMoney(moneyStats.weeklyTrend, currency) + '/day'
                  : '—'
              }
              label="Weekly Trend"
            />
            <StatTile
              value={
                moneyStats.monthlyTrend != null
                  ? (moneyStats.monthlyTrend >= 0 ? '+' : '') + formatMoney(moneyStats.monthlyTrend, currency) + '/day'
                  : '—'
              }
              label="Monthly Trend"
              tone="primarySoft"
            />
          </View>
        </View>
      </View>

      {/* Share progress */}
      <Pressable
        onPress={() => router.push('/share' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Share your progress"
        style={({ pressed }) => ({ marginTop: spacing.md, opacity: pressed ? 0.85 : 1 })}
      >
        <Card tone="primarySoft" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="share-social" size={20} color={theme.color.primary} />
          <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }} color={theme.color.primary}>
            Share your progress
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.color.primary} />
        </Card>
      </Pressable>

      {/* Today's Recovery */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Today's Recovery
      </Text>
      <Card padding={0}>
        {tasks.map((t, i) => (
          <Pressable
            key={t.key}
            onPress={t.go}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ checked: t.done }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons
              name={t.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={t.done ? theme.color.success : theme.color.textDim}
            />
            <Text
              variant="callout"
              style={{ flex: 1, marginLeft: spacing.md }}
              color={t.done ? theme.color.textDim : theme.color.text}
            >
              {t.label}
            </Text>
            {!t.done && <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />}
          </Pressable>
        ))}
      </Card>

      {/* Quick Actions */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Quick Actions
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <QuickAction icon="pulse"  label="Log Urge"  onPress={() => router.push('/log-urge')} />
        <QuickAction icon="book"   label="Journal"   onPress={() => router.push('/(tabs)/journal')} />
        <QuickAction icon="warning" label="SOS"      accent onPress={() => router.push('/sos')} />
        <QuickAction icon="flower" label="Pause"     onPress={() => router.push('/mindful-pause')} />
      </View>

      {/* Recreational Games */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Recreational Games
      </Text>
      <Pressable
        onPress={() => router.push('/games' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Play a game"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
      >
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 48, height: 48, borderRadius: radius.round,
            backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="game-controller" size={24} color={theme.color.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text variant="callout">Play a game</Text>
            <Text variant="footnote" dim style={{ marginTop: 2 }}>
              Checkers, Clarity, Sudoku & Block Puzzle — all offline
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
        </Card>
      </Pressable>

      {/* Recovery Timeline */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Recovery Timeline
      </Text>
      <Card padding={0}>
        {timeline.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
            <Ionicons name="footsteps-outline" size={26} color={theme.color.textDim} />
            <Text variant="callout" dim center>
              Your recovery events will appear here as you check in, journal, and grow.
            </Text>
          </View>
        ) : (
          timeline.slice(0, 8).map((e, i) => (
            <View
              key={e.id}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline,
              }}
            >
              <Ionicons name={TIMELINE_ICON[e.type]} size={20} color={theme.color.primary} />
              <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }}>{e.label}</Text>
              <Text variant="caption" dim>{relTime(e.at, now)}</Text>
            </View>
          ))
        )}
      </Card>

      {/* Recovery Motivation — one quote per day, heart to keep it */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Recovery Motivation
      </Text>
      <DailyQuoteCard />

      {/* Favorite quotes carousel (hidden until the user hearts one) */}
      <FavoritesSection />
    </Screen>
  );
}

function FavoritesSection() {
  const hasFavorites = useStore((s) => s.favoriteQuotes.length > 0);
  if (!hasFavorites) return null;
  return (
    <>
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Your Favorite Quotes
      </Text>
      <FavoriteQuotesCarousel />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------


function QuickAction({
  icon, label, onPress, accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: boolean;
  accent?: boolean;
}) {
  const theme = useTheme();
  const tint = accent ? theme.color.accentText : theme.color.primary;
  const chipBg = accent ? theme.color.accentSoft : theme.color.primarySoft;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flexBasis: '40%', flexGrow: 1, minWidth: 130, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <Card style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
        <View style={{
          width: 48, height: 48, borderRadius: radius.round,
          backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={24} color={tint} />
        </View>
        <Text variant="callout" color={theme.color.text}>{label}</Text>
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

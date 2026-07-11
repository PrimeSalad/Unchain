import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { RecoveryRing } from '../components/RecoveryRing';
import { StatTile } from '../components/StatTile';
import { Mascot } from '../components/Mascot';
import { DailyMissions } from '../components/DailyMissions';
import { spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useNow } from '../hooks/useNow';
import { useResponsive } from '../hooks/useResponsive';
import { useStore, useProfile } from '@/application/store';
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
import type { TimelineType } from '@/domain/records';
import { sameDay } from '@/domain/records';
import { QuoteFeed } from '../components/QuoteCards';
import { formatLastCheckedIn } from '@/domain/pornRecovery';

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
  shield: 'shield-checkmark',
  start: 'flag',
};

export function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const now = useNow();
  const profile = useProfile();
  const { ringSize } = useResponsive();

  const timeline = useStore((s) => s.timeline);
  const journal = useStore((s) => s.journal);
  const relapses = useStore((s) => s.relapses);
  const pushTimeline = useStore((s) => s.pushTimeline);
  const completeMission = useStore((s) => s.completeMission);
  const longestStreak = useStore((s) => s.longestStreak);
  const lastCheckedIn = useStore((s) => s.lastCheckedIn);
  const urgesResisted = useStore((s) => s.urgesResisted);
  const healthyHabitsCount = useStore((s) => s.healthyHabitsCount);

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

  // Auto-complete the daily_log mission the moment a journal entry exists
  // for today. Derived directly from the store (not from the ticking `now`)
  // so this effect only fires when the journal array actually changes.
  const hasTodayJournal = useStore((s) =>
    s.journal.some((j) => sameDay(j.at, Date.now())),
  );
  useEffect(() => {
    if (hasTodayJournal) {
      completeMission('daily_log');
    }
  }, [hasTodayJournal, completeMission]);

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

  return (
    <Screen tabPadding>
      {/* Greeting */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" dim style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {new Date(now).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text variant="title1" style={{ marginTop: 2 }}>{greeting()}, {profile.name}</Text>
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
          {profile.addictionType === 'pornography' ? (
            <>
              {/* Compact values + context in the label — same visual rhythm
                  as the gambling money tiles. */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <StatTile
                  value={`${Math.max(longestStreak, days)}`}
                  label={`Longest streak (day${Math.max(longestStreak, days) === 1 ? '' : 's'})`}
                />
                <StatTile
                  value={formatLastCheckedIn(lastCheckedIn, now)}
                  label="Last check-in"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <StatTile
                  value={`${urgesResisted}`}
                  label="Urges resisted this week"
                />
                <StatTile
                  value={`${healthyHabitsCount}`}
                  label="Healthy habits done"
                  tone="primarySoft"
                />
              </View>
            </>
          ) : (
            <>
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
            </>
          )}
        </View>
      </View>

      {/* Share progress — sits above the motivation feed. */}
      <Pressable
        onPress={() => router.push('/share' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Share your progress"
        style={({ pressed }) => ({
          marginTop: spacing.xl,
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 1, borderColor: theme.color.hairline,
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="share-social" size={20} color={theme.color.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="callout">Share your progress</Text>
            <Text variant="caption" dim style={{ marginTop: 1 }}>Turn your streak into a card</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
        </View>
      </Pressable>

      {/* Daily motivation — today's quote first, saved favorites after. */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Daily Motivation
      </Text>
      <QuoteFeed />

      {/* Daily Missions */}
      <View style={{ marginTop: spacing.xl }}>
        <DailyMissions />
      </View>

      {/* Quick Actions */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Quick Actions
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <QuickAction icon="pulse"  label="Log Urge"  onPress={() => router.push('/log-urge')} />
        <QuickAction icon="book"   label="Journal"   onPress={() => router.push('/(tabs)/journal')} />
        <QuickAction icon="warning" label="SOS"      accent onPress={() => router.push('/sos')} />
        <QuickAction icon="flower" label="Pause"     onPress={() => router.push('/mindful-pause')} />
        <QuickAction icon="shield-checkmark" label="Protect" onPress={() => router.push('/protection' as Href)} />
        <QuickAction icon="walk"   label="Habits"    onPress={() => router.push('/alternatives' as Href)} />
      </View>

      {/* Recreational Games */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Take a Break
      </Text>
      <Pressable
        onPress={() => router.push('/games' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Play a game"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
      >
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 1, borderColor: theme.color.hairline,
            padding: spacing.lg,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="game-controller" size={20} color={theme.color.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="callout">Play a game</Text>
            <Text variant="caption" dim style={{ marginTop: 1 }}>
              Checkers, Clarity, Sudoku & Block Puzzle — all offline
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
        </View>
      </Pressable>

      {/* Recent activity */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Recent Activity
      </Text>
      <View
        style={{
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1, borderColor: theme.color.hairline,
          overflow: 'hidden',
        }}>
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
      </View>

    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------


/** Compact iOS-style action tile — 3-up grid, flat surface with a hairline
 *  border and a tinted rounded-square glyph. Calm, not carnival. */
function QuickAction({
  icon, label, onPress, accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const theme = useTheme();
  const tint = accent ? theme.color.accentText : theme.color.primary;
  const chipBg = accent ? theme.color.accentSoft : theme.color.primarySoft;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexBasis: '30%',
        flexGrow: 1,
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        style={{
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          alignItems: 'center',
          paddingVertical: spacing.md + 2,
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: chipBg,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        <Text variant="footnote" color={theme.color.text} numberOfLines={1}>
          {label}
        </Text>
      </View>
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

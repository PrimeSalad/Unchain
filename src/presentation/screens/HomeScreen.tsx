import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { StatTile } from '../components/StatTile';
import { Mascot } from '../components/Mascot';
import { DailyMissions } from '../components/DailyMissions';
import { ProgressBar } from '../components/ProgressBar';
import { ActionSheet } from '../components/ActionSheet';
import { spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useNow } from '../hooks/useNow';
import { useResponsive } from '../hooks/useResponsive';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStore, useProfile, useDailyJournalProgress } from '@/application/store';
import {
  DEFAULT_CURRENCY,
  streakDays,
  currentStreakStart,
  recoveryTimer,
  nextMilestone,
  journalMoneyStats,
  formatMoney,
  milestoneCrossed,
  recoveryFreeLabel,
  addictionMeta,
  type AddictionType,
} from '@/domain/gambling';
import type { TimelineType } from '@/domain/records';
import { catchYourBreathAvailability } from '@/domain/catchYourBreath';
import { cheersToChangeAvailability } from '@/domain/cheersToChange';
import { QuoteFeed } from '../components/QuoteCards';
import { CheckInInsightsCard } from '../components/CheckInInsightsCard';
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
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [mascotActive, setMascotActive] = useState(true);
  const [showCatchPopup, setShowCatchPopup] = useState(false);
  const [showCheersPopup, setShowCheersPopup] = useState(false);
  const [showAddictionPicker, setShowAddictionPicker] = useState(false);
  const [catchDismissed, setCatchDismissed] = useState(false);
  const [cheersDismissed, setCheersDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setMascotActive(true);
      return () => setMascotActive(false);
    }, []),
  );

  const timeline = useStore((s) => s.timeline);
  const journal = useStore((s) => s.journal);
  const relapses = useStore((s) => s.relapses);
  const pushTimeline = useStore((s) => s.pushTimeline);
  const completeMission = useStore((s) => s.completeMission);
  const longestStreak = useStore((s) => s.longestStreak);
  const lastCheckedIn = useStore((s) => s.lastCheckedIn);
  const urgesResisted = useStore((s) => s.urgesResisted);
  const recordedUrges = useStore((s) => s.urges.filter((urge) => urge.resisted).length);
  const healthyHabitsCount = useStore((s) => s.healthyHabitsCount);
  const blockedSites = useStore((s) => s.blockedSites);
  const lastCatchYourBreathAt = useStore((s) => s.lastCatchYourBreathAt);
  const lastCheersToChangeAt = useStore((s) => s.lastCheersToChangeAt);
  const setActiveAddiction = useStore((s) => s.setActiveAddiction);
  const journalProgress = useDailyJournalProgress();

  // Show Catch Your Breath popup when weekly assessment is available (smoking only)
  useFocusEffect(
    useCallback(() => {
      if (profile?.addictionType !== 'smoking' || catchDismissed) return;
      const avail = catchYourBreathAvailability(lastCatchYourBreathAt);
      if (avail.available) {
        const timer = setTimeout(() => setShowCatchPopup(true), 800);
        return () => clearTimeout(timer);
      }
    }, [profile?.addictionType, lastCatchYourBreathAt, catchDismissed]),
  );

  // Show Cheers to Change popup when weekly assessment is available (alcohol only)
  useFocusEffect(
    useCallback(() => {
      if (profile?.addictionType !== 'alcohol' || cheersDismissed) return;
      const avail = cheersToChangeAvailability(lastCheersToChangeAt);
      if (avail.available) {
        const timer = setTimeout(() => setShowCheersPopup(true), 800);
        return () => clearTimeout(timer);
      }
    }, [profile?.addictionType, lastCheersToChangeAt, cheersDismissed]),
  );

  // Derive the current streak start from the event log - never from startedAt
  // directly - so a relapse only marks today red without wiping history.
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
  const currency = profile?.currency ?? DEFAULT_CURRENCY;
  const managedUrges = Math.max(recordedUrges, urgesResisted);
  // Derived from the hydrated profile on every render, so a profile update is
  // reflected immediately without caching stale addiction copy.
  const freeLabel = profile
    ? recoveryFreeLabel(profile.addictionType, profile.addictionDetail)
    : '';

  // Auto-complete the daily_log mission the moment a journal entry exists
  // for today. Derived directly from the store (not from the ticking `now`)
  // so this effect only fires when the journal array actually changes.
  const hasTodayJournal = journalProgress.complete;
  const activityLimit = 4;
  const hasMoreActivity = timeline.length > activityLimit;
  const activityItems = showAllActivity ? timeline : timeline.slice(0, activityLimit);

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
        params: { title: `Day ${crossed} ${freeLabel}!`, arm: 'Keep going - one day at a time.' },
      });
    }
  }, [days, freeLabel, profile, timeline, pushTimeline, router]);

  if (!profile) return null;

  const addictionChoices = profile.selectedAddictions?.length
    ? profile.selectedAddictions
    : [profile.addictionType];
  const switchAddiction = (addiction: AddictionType) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveAddiction(addiction);
    setShowAddictionPicker(false);
    setShowCatchPopup(false);
    setShowCheersPopup(false);
  };

  return (
    <Screen tabPadding>
      {/* Greeting */}
      <View style={{ marginTop: spacing.sm }}>
        <Text variant="caption" dim style={{ textTransform: 'uppercase' }}>
          {new Date(now).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Text variant="headline" numberOfLines={2} style={{ marginTop: 2, fontSize: 20, lineHeight: 26 }}>
          {greeting()}, {profile.name}
        </Text>
      </View>

      <Pressable
        onPress={() => setShowAddictionPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`Active addiction: ${addictionMeta(profile.addictionType).label}`}
        style={({ pressed }) => ({
          minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.lg,
          borderRadius: radius.input, borderWidth: 1, borderColor: theme.color.hairline,
          backgroundColor: theme.color.surface, flexDirection: 'row', alignItems: 'center',
          opacity: pressed ? 0.78 : 1,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="caption" dim style={{ textTransform: 'uppercase' }}>Active addiction</Text>
          <Text variant="callout" color={theme.color.primary}>{addictionMeta(profile.addictionType).label}</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={theme.color.primary} />
      </Pressable>

      <RecoveryHero
        days={days}
        timer={timer}
        target={target}
        freeLabel={freeLabel}
        mascotActive={mascotActive}
        onCheckIn={() => router.push('/checkin')}
        onShare={() => router.push('/share' as Href)}
      />

      <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
        <View style={{ alignSelf: 'stretch', gap: spacing.md }}>
          {profile.addictionType === 'pornography' ? (
            <>
              {/* Porn-specific stats + money tiles */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <StatTile
                  value={moneyStats.current != null ? formatMoney(moneyStats.current, currency) : '-'}
                  label="Current Balance"
                />
                <StatTile
                  value={
                    moneyStats.change != null
                      ? (moneyStats.change >= 0 ? '+' : '') + formatMoney(moneyStats.change, currency)
                      : '-'
                  }
                  label="Since Last Entry"
                />
              </View>
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
                  value={moneyStats.current != null ? formatMoney(moneyStats.current, currency) : '-'}
                  label="Current Balance"
                />
                <StatTile
                  value={
                    moneyStats.change != null
                      ? (moneyStats.change >= 0 ? '+' : '') + formatMoney(moneyStats.change, currency)
                      : '-'
                  }
                  label="Since Last Entry"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <StatTile
                  value={
                    moneyStats.weeklyTrend != null
                      ? (moneyStats.weeklyTrend >= 0 ? '+' : '') + formatMoney(moneyStats.weeklyTrend, currency) + '/day'
                      : '-'
                  }
                  label="Weekly Trend"
                />
                <StatTile
                  value={
                    moneyStats.monthlyTrend != null
                      ? (moneyStats.monthlyTrend >= 0 ? '+' : '') + formatMoney(moneyStats.monthlyTrend, currency) + '/day'
                      : '-'
                  }
                  label="Monthly Trend"
                  tone="primarySoft"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <StatTile
                  value={managedUrges.toLocaleString()}
                  label="Urges managed"
                />
                <StatTile
                  value={journal.length.toLocaleString()}
                  label="Journal entries"
                  tone="primarySoft"
                />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Check-in insights - mood sparkline, urge avg, top triggers */}
      <View style={{ marginTop: spacing.xl }}>
        <CheckInInsightsCard />
      </View>

      {/* Stay Protected - Protect Card */}
      <Text variant="callout" style={{ marginTop: spacing.xl, marginBottom: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
        Stay Protected
      </Text>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          router.push('/protection' as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel="Focus Protection - Block distracting sites"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            padding: spacing.lg,
          }}
        >
          {/* Left: icon badge */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shield-checkmark" size={20} color={theme.color.primary} />
          </View>

          {/* Middle: title + subtitle */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>
              Focus Protection
            </Text>
            {blockedSites.length > 0 ? (
              <Text variant="caption" dim style={{ marginTop: 1 }}>
                {blockedSites.length} site{blockedSites.length !== 1 ? 's' : ''} blocked
              </Text>
            ) : (
              <Text variant="caption" dim style={{ marginTop: 1 }}>
                Block distracting sites and stay on track.
              </Text>
            )}
          </View>

          {/* Right: pill badge + chevron */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{
                backgroundColor: theme.color.primarySoft,
                borderRadius: 99,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}
            >
              <Text variant="caption" color={theme.color.primary}>
                Protect
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
          </View>
        </View>
      </Pressable>

      {/* Daily motivation - today's quote first, saved favorites after. */}
      <Text variant="callout" style={{ marginTop: spacing.xl, marginBottom: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
        Daily Motivation
      </Text>
      <QuoteFeed />

      {/* Daily Missions */}
      <View style={{ marginTop: spacing.xl }}>
        <DailyMissions />
      </View>

      {/* Quick Actions */}
      <Text variant="callout" style={{ marginTop: spacing.xl, marginBottom: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
        Quick Actions
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <QuickAction icon="pulse"  label="Log Urge"  onPress={() => router.push('/log-urge')} />
        <QuickAction icon="book"   label="Journal"   onPress={() => router.push('/(tabs)/journal')} />
        <QuickAction icon="warning" label="SOS"      accent onPress={() => router.push('/sos')} />
        <QuickAction icon="flower" label="Pause"     onPress={() => router.push('/mindful-pause')} />
        <QuickAction icon="walk"   label="Habits"    onPress={() => router.push('/alternatives' as Href)} />
      </View>

      {/* Recreational Games */}
      <Text variant="callout" style={{ marginTop: spacing.xl, marginBottom: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
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
              No-stakes games to keep your hands busy: Clarity, Blocks, Sudoku, Checkers, and Go / No-Go.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
        </View>
      </Pressable>

      {/* Recent activity */}
      <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text variant="callout" style={{ flex: 1, fontFamily: 'Nunito_700Bold' }}>
          Recent Activity
        </Text>
        {hasMoreActivity ? (
          <Pressable
            onPress={() => setShowAllActivity((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showAllActivity ? 'Show less activity' : 'Show all activity'}
            hitSlop={10}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              minHeight: 36,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text variant="footnote" color={theme.color.primary}>
              {showAllActivity ? 'Show less' : 'Show all'}
            </Text>
            <Ionicons name={showAllActivity ? 'chevron-up' : 'chevron-down'} size={15} color={theme.color.primary} />
          </Pressable>
        ) : null}
      </View>
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
          activityItems.map((e, i) => (
            <View
              key={e.id}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                gap: spacing.sm,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.color.hairline,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  backgroundColor: theme.color.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                <Ionicons name={TIMELINE_ICON[e.type]} size={17} color={theme.color.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="callout" numberOfLines={2} style={{ lineHeight: 20 }}>
                  {e.label}
                </Text>
              </View>
              <Text variant="caption" dim numberOfLines={1} style={{ width: 62, textAlign: 'right', marginTop: 2 }}>
                {relTime(e.at, now)}
              </Text>
            </View>
          ))
        )}
      </View>

      <ActionSheet visible={showAddictionPicker} onClose={() => setShowAddictionPicker(false)}>
        <Text variant="title2">Switch recovery track</Text>
        <Text variant="footnote" dim style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
          This changes Home, Progress, and addiction-specific tools. Today’s journal still includes every selected track.
        </Text>
        <View style={{ gap: spacing.xs }}>
          {addictionChoices.map((addiction) => {
            const active = addiction === profile.addictionType;
            const meta = addictionMeta(addiction);
            return (
              <Pressable
                key={addiction}
                onPress={() => switchAddiction(addiction)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  minHeight: 52, borderRadius: radius.input, paddingHorizontal: spacing.md,
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: active ? theme.color.primarySoft : 'transparent',
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="callout" color={active ? theme.color.primary : theme.color.text}>{meta.label}</Text>
                  <Text variant="caption" dim>{active ? 'Currently active' : 'Switch to this track'}</Text>
                </View>
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? theme.color.primary : theme.color.textDim} />
              </Pressable>
            );
          })}
        </View>
      </ActionSheet>

      {/* ── Catch Your Breath weekly reminder popup (smoking only) ── */}
      {profile?.addictionType === 'smoking' && (
        <Modal
          visible={showCatchPopup}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setShowCatchPopup(false)}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 32 }}>
            <View style={{
              backgroundColor: theme.color.surface,
              borderRadius: radius.card,
              padding: spacing.xl,
              alignItems: 'center',
              gap: spacing.md,
              maxWidth: 340,
              width: '100%',
            }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: theme.color.successSoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="fitness" size={32} color={theme.color.success} />
              </View>
              <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                Catch Your Breath
              </Text>
              <Text variant="footnote" dim center style={{ lineHeight: 20 }}>
                Time for your weekly breathing check-in. Take two minutes to see how your breathing has changed this week.
              </Text>
              <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic' }}>
                This is a self-reflection tool, not a medical evaluation.
              </Text>
              <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button
                  label="Start Reflection"
                  onPress={() => {
                    setShowCatchPopup(false);
                    router.push('/catch-your-breath-log');
                  }}
                  full
                />
                <Button
                  label="Remind Me Later"
                  kind="tertiary"
                  onPress={() => { setShowCatchPopup(false); setCatchDismissed(true); }}
                  full
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Cheers to Change weekly reminder popup (alcohol only) ── */}
      {profile?.addictionType === 'alcohol' && (
        <Modal
          visible={showCheersPopup}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setShowCheersPopup(false)}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 32 }}>
            <View style={{
              backgroundColor: theme.color.surface,
              borderRadius: radius.card,
              padding: spacing.xl,
              alignItems: 'center',
              gap: spacing.md,
              maxWidth: 340,
              width: '100%',
            }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: theme.color.successSoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="wine" size={32} color={theme.color.success} />
              </View>
              <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                Cheers to Change
              </Text>
              <Text variant="footnote" dim center style={{ lineHeight: 20 }}>
                Time for your weekly body wellness check-in. Take a couple of minutes to reflect on how your body has been feeling this week.
              </Text>
              <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic' }}>
                This is a self-reflection tool, not a medical evaluation.
              </Text>
              <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button
                  label="Start Reflection"
                  onPress={() => {
                    setShowCheersPopup(false);
                    router.push('/cheers-to-change-log');
                  }}
                  full
                />
                <Button
                  label="Remind Me Later"
                  kind="tertiary"
                  onPress={() => { setShowCheersPopup(false); setCheersDismissed(true); }}
                  full
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RecoveryHeroProps {
  days: number;
  timer: { days: number; hours: number; minutes: number };
  target: number;
  freeLabel: string;
  mascotActive: boolean;
  onCheckIn: () => void;
  onShare: () => void;
}

function RecoveryHero({
  days,
  timer,
  target,
  freeLabel,
  mascotActive,
  onCheckIn,
  onShare,
}: RecoveryHeroProps) {
  const theme = useTheme();
  const { width } = useResponsive();
  const reduceMotion = useReducedMotion();
  const compact = width < 360;
  const mascotSize = compact ? 112 : Math.min(148, width * 0.36);
  const progress = target > 0 ? Math.min(1, days / target) : 0;

  const select = (action: () => void) => {
    Haptics.selectionAsync().catch(() => {});
    action();
  };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(420)}
      style={{
        marginTop: spacing.lg,
        alignSelf: 'stretch',
        paddingHorizontal: compact ? spacing.sm : spacing.lg,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: mascotSize,
          gap: compact ? spacing.xs : spacing.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="shield-checkmark" size={16} color={theme.color.primary} />
            <Text variant="caption" color={theme.color.primary}>
              YOUR RECOVERY
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm }}>
            <Text
              variant="display"
              style={{ fontSize: compact ? 42 : 48, lineHeight: compact ? 46 : 52, fontVariant: ['tabular-nums'] }}
            >
              {days}
            </Text>
            <Text variant="headline" dim style={{ marginLeft: 6 }}>
              day{days === 1 ? '' : 's'}
            </Text>
          </View>
          <Text variant="headline" color={theme.color.primary} numberOfLines={2}>
            {freeLabel}
          </Text>
          <Text variant="caption" dim style={{ marginTop: spacing.sm, fontVariant: ['tabular-nums'] }}>
            {timer.days}d {timer.hours}h {timer.minutes}m in this streak
          </Text>
        </View>

        <Mascot
          state="happy"
          size={mascotSize}
          motion="hero"
          interactive
          still={!mascotActive}
        />
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.color.hairline,
          paddingTop: spacing.md,
          marginTop: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text variant="footnote" dim style={{ flex: 1 }}>
            Next milestone
          </Text>
          <Text variant="footnote" color={theme.color.primary} style={{ fontVariant: ['tabular-nums'] }}>
            {Math.min(days, target)} / {target} days
          </Text>
        </View>
        <ProgressBar
          progress={progress}
          color={theme.color.primary}
          track={theme.color.surface}
          height={8}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Pressable
          onPress={() => select(onCheckIn)}
          accessibilityRole="button"
          accessibilityLabel="Daily check-in"
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            borderRadius: radius.button,
            backgroundColor: theme.color.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            opacity: pressed ? 0.78 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Ionicons name="checkmark-circle" size={20} color={theme.color.onPrimary} />
          <Text variant="callout" color={theme.color.onPrimary}>
            Check in
          </Text>
        </Pressable>
        <Pressable
          onPress={() => select(onShare)}
          accessibilityRole="button"
          accessibilityLabel="Share your progress"
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: radius.button,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            backgroundColor: theme.color.surface,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <Ionicons name="share-social" size={20} color={theme.color.primary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** Compact iOS-style action tile - 3-up grid, flat surface with a hairline
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

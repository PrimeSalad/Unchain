import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Text } from '@/presentation/components/Text';
import { Mascot } from '@/presentation/components/Mascot';
import { useReducedMotion } from '@/presentation/hooks/useReducedMotion';
import { useReliableSafeAreaInsets } from '@/presentation/hooks/useReliableSafeAreaInsets';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useProfile, useStore } from '@/application/store';
import { DEFAULT_CURRENCY, recoveryTimer, journalMoneyStats, formatMoney, currentStreakStart, type AddictionType } from '@/domain/gambling';
import { QUOTES } from '@/domain/quotes';

const GLASS = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const FOG_SOFT = 'rgba(236,230,242,0.75)';

/** Slow double-ring pulse behind the mascot - a visual breath to sync with. */
function PulseHero({ reduce }: { reduce: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    const loop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 3200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const l1 = loop(a, 0);
    const l2 = loop(b, 1600);
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [a, b, reduce]);

  const ring = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
    borderColor: palette.grape300,
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.45] }) }],
  });

  return (
    <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      {!reduce && <Animated.View pointerEvents="none" style={ring(a)} />}
      {!reduce && <Animated.View pointerEvents="none" style={ring(b)} />}
      <View
        style={{
          width: 168,
          height: 168,
          borderRadius: 84,
          backgroundColor: GLASS,
          borderWidth: 1,
          borderColor: GLASS_BORDER,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Mascot
          state="braced"
          size={118}
          still
          accessibilityLabel="Unchainly is here with you through this urge"
        />
      </View>
    </View>
  );
}

function GlassTile({
  children,
  style,
  ...rest
}: {
  children: React.ReactNode;
  style?: object;
  accessibilityLabel?: string;
}) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: GLASS,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: GLASS_BORDER,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Anchor({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <GlassTile style={{ flex: 1, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={13} color={palette.grape300} />
        <Text variant="caption" color={FOG_SOFT}>{label}</Text>
      </View>
      <Text variant="title2" color={palette.fog} style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </GlassTile>
  );
}

function recoveryAnchor(addictionType: AddictionType, resistedUrges: number, healthyHabits: number): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
} {
  switch (addictionType) {
    case 'pornography':
      return { icon: 'shield-checkmark', label: 'Urges resisted', value: `${resistedUrges}` };
    case 'social_media':
      return { icon: 'leaf', label: 'Healthy habits', value: `${healthyHabits}` };
    case 'smoking':
    case 'alcohol':
    case 'drugs':
      return { icon: 'fitness', label: 'Cravings resisted', value: `${resistedUrges}` };
    default:
      return { icon: 'checkmark-circle', label: 'Urges resisted', value: `${resistedUrges}` };
  }
}

function ToolTile({
  icon, label, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
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
          backgroundColor: GLASS,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: GLASS_BORDER,
          alignItems: 'center',
          paddingVertical: spacing.md + 2,
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: 'rgba(185,143,214,0.18)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={palette.grape300} />
        </View>
        <Text variant="footnote" color={palette.fog} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function Sos() {
  const router = useRouter();
  const safeBack = useSafeBack();
  const reduce = useReducedMotion();
  const insets = useReliableSafeAreaInsets();
  const profile = useProfile();

  // The same daily quote shown on Home - consistent all day, offline.
  const dailyQuote = useStore((s) => s.dailyQuote);
  const ensureDailyQuote = useStore((s) => s.ensureDailyQuote);
  useEffect(() => {
    ensureDailyQuote();
  }, [ensureDailyQuote]);
  // A persisted index can outlive a shrunken quote pool after an update -
  // never index blindly.
  const motivation = (QUOTES[dailyQuote?.index ?? 0] ?? QUOTES[0]).text;

  // The blocklist is permanent - in a moment of crisis this is reassurance.
  const protectedCount = useStore((s) => s.blockedSites.length);
  const urgesResisted = useStore((s) => s.urges.filter((urge) => urge.resisted).length);
  const healthyHabits = useStore((s) => s.healthyHabitsCount);
  const logUrgeForTrack = useStore((s) => s.logUrgeForTrack);
  const urgeLogLock = useRef(false);

  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);
  // Streak start comes from the event log (same as Home) so the anchors here
  // never overstate recovery after a relapse - honesty matters most in crisis.
  const streakStart = profile ? currentStreakStart(profile.startedAt, relapses, journal) : 0;
  const timer = profile ? recoveryTimer(streakStart) : { days: 0, hours: 0, minutes: 0 };
  // Same recovery-adjusted journal source used by Home and Progress.
  const moneyStats = journalMoneyStats(journal);
  const secondaryAnchor = profile && profile.addictionType !== 'gambling'
    ? recoveryAnchor(profile.addictionType, urgesResisted, healthyHabits)
    : null;
  const currency = profile?.currency ?? DEFAULT_CURRENCY;

  return (
    <View style={{ flex: 1, backgroundColor: palette.night }}>
      <LinearGradient
        colors={[palette.night, '#241735', palette.grapeDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView edges={['left', 'right']} style={{ flex: 1, paddingTop: insets.top }}>
        {/* Close */}
        <View
          style={{
            minHeight: 64,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.sm,
          }}
        >
          <Pressable
            onPress={safeBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="close" size={20} color={palette.fog} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: Math.max(spacing.xxxl, insets.bottom + spacing.xxxl) }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <PulseHero reduce={reduce} />
          <Text variant="caption" center color={palette.grape300} style={{ textTransform: 'uppercase', marginTop: spacing.md }}>
            Emergency pause
          </Text>
          <Text variant="title1" center color={palette.fog} style={{ marginTop: spacing.xs }}>
            Take a deep breath.
          </Text>
          <Text variant="body" center color={FOG_SOFT} style={{ marginTop: spacing.sm, paddingHorizontal: spacing.lg }}>
            You're safe. Don't decide anything yet - the urge will pass.
          </Text>

          {/* Primary action */}
          <Pressable
            onPress={() => router.replace('/mindful-pause' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Start a Mindful Pause"
            style={({ pressed }) => ({
              marginTop: spacing.xl,
              height: 54,
              borderRadius: radius.button,
              backgroundColor: palette.grape300,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <Ionicons name="flower" size={20} color={palette.night} />
            <Text variant="headline" color={palette.night}>Start a Mindful Pause</Text>
          </Pressable>

          {/* Anchors */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <Anchor icon="time" label="Recovery" value={`${timer.days}d ${timer.hours}h`} />
            {profile?.addictionType === 'gambling' ? (
              <Anchor icon="wallet" label="Money saved" value={moneyStats.current != null ? formatMoney(moneyStats.current, currency) : '-'} />
            ) : secondaryAnchor ? (
              <Anchor {...secondaryAnchor} />
            ) : null}
          </View>

          {/* Your reason */}
          {profile?.reason ? (
            <GlassTile style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.md }}>
              <View style={{ width: 3, borderRadius: 2, backgroundColor: palette.grape300 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="caption" color={FOG_SOFT}>Your reason for quitting</Text>
                <Text variant="body" color={palette.fog}>“{profile.reason}”</Text>
              </View>
            </GlassTile>
          ) : null}

          {/* Focus Protection status */}
          {protectedCount > 0 && (
            <GlassTile
              style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
              accessibilityLabel={`Focus list, ${protectedCount} websites saved`}
            >
              <Ionicons name="shield-checkmark" size={18} color="#77B58A" />
              <Text variant="callout" color={palette.fog} style={{ flex: 1 }}>
                {protectedCount} website{protectedCount === 1 ? '' : 's'} in your focus list
              </Text>
            </GlassTile>
          )}

          {/* ── I'm having an urge - primary quick-log CTA ── */}
          <Pressable
            onPress={() => {
              if (!profile || urgeLogLock.current) return;
              urgeLogLock.current = true;
              Haptics.selectionAsync().catch(() => {});
              const entryId = logUrgeForTrack(profile.addictionType, {
                intensity: 8,
                trigger: 'SOS',
                triggers: ['SOS'],
                notes: 'Started from SOS.',
                resisted: true,
              });
              if (!entryId) {
                urgeLogLock.current = false;
                return;
              }
              router.push({
                pathname: '/log-urge',
                params: { id: entryId, track: profile.addictionType },
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="I'm having an urge — log it now"
            style={({ pressed }) => ({
              marginTop: spacing.xl,
              borderRadius: radius.card,
              backgroundColor: GLASS,
              borderWidth: 1.5,
              borderColor: palette.grape300,
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: 'rgba(185,143,214,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="pulse" size={22} color={palette.grape300} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="callout" color={palette.fog}>I'm having an urge</Text>
              <Text variant="caption" color={FOG_SOFT} style={{ marginTop: 2 }}>
                Log it now — awareness is recovery
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.grape300} />
          </Pressable>

          {/* Tools */}
          <Text variant="headline" color={palette.fog} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
            Steady yourself
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <ToolTile icon="book" label="Journal" onPress={() => router.replace('/(tabs)/journal')} />
            <ToolTile icon="game-controller" label="Games" onPress={() => router.replace('/games' as Href)} />
            <ToolTile icon="walk" label="Habits" onPress={() => router.push('/alternatives' as Href)} />
            <ToolTile icon="shield-checkmark" label="Protect" onPress={() => router.push('/protection' as Href)} />
            <ToolTile icon="create" label="Reflect" onPress={() => router.replace('/reflection')} />
          </View>

          {/* Education Hub */}
          <Pressable
            onPress={() => router.push('/education' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open the Education Hub"
            style={({ pressed }) => ({ marginTop: spacing.sm, opacity: pressed ? 0.8 : 1 })}
          >
            <GlassTile style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: 'rgba(185,143,214,0.18)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="school" size={20} color={palette.grape300} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="callout" color={palette.fog}>Education Hub</Text>
                <Text variant="caption" color={FOG_SOFT} style={{ marginTop: 1 }}>
                  Understand it to beat it - guides & free reading
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={FOG_SOFT} />
            </GlassTile>
          </Pressable>

          {/* Pomodoro */}
          <Pressable
            onPress={() => router.push('/one-more-minute' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open Pomodoro timer"
            style={({ pressed }) => ({ marginTop: spacing.sm, opacity: pressed ? 0.8 : 1 })}
          >
            <GlassTile style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: 'rgba(185,143,214,0.18)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="timer" size={20} color={palette.grape300} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="callout" color={palette.fog}>Pomodoro</Text>
                <Text variant="caption" color={FOG_SOFT} style={{ marginTop: 1 }}>
                  Focus on recovery for a little while
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={FOG_SOFT} />
            </GlassTile>
          </Pressable>

          {/* Fuel Your Recovery */}
          <Pressable
            onPress={() => router.push('/fuel-your-recovery' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open Fuel Your Recovery"
            style={({ pressed }) => ({ marginTop: spacing.sm, opacity: pressed ? 0.8 : 1 })}
          >
            <GlassTile style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: 'rgba(185,143,214,0.18)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="nutrition" size={20} color={palette.grape300} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="callout" color={palette.fog}>Fuel Your Recovery</Text>
                <Text variant="caption" color={FOG_SOFT} style={{ marginTop: 1 }}>
                  Track meals, hydration & nutrition
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={FOG_SOFT} />
            </GlassTile>
          </Pressable>

          {/* Today's reminder */}
          <GlassTile style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="heart" size={13} color={palette.coral300} />
              <Text variant="caption" color={FOG_SOFT}>Today's reminder</Text>
            </View>
            <Text variant="body" color={palette.fog} style={{ lineHeight: 24 }}>
              {motivation}
            </Text>
          </GlassTile>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

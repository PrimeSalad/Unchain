/**
 * DailyMissions — gamified daily recovery quests displayed as navigation cards.
 *
 * Interaction model (nav cards, not a checklist):
 *  - Tapping a mission navigates to the corresponding feature screen.
 *  - Completion happens automatically when the user finishes the action in
 *    that screen — never by tapping a checkbox here.
 *  - Completed missions show a checkmark + muted style as visual feedback.
 *  - No manual completion controls exist anywhere in this component.
 *
 * Rendering guarantees:
 *  - useDailyMissions() returns s.dailyMissions directly — a stable store
 *    reference — so this component never triggers the "getSnapshot should be
 *    cached" warning.
 *  - Reduced-motion preference is respected throughout.
 */

import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  interpolateColor,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import { Text } from './Text';
import { Card } from './Card';
import { spacing, radius, motion } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStore, useDailyMissions } from '@/application/store';
import {
  MISSIONS,
  missionById,
  completedCount,
  earnedXp,
  allMissionsComplete,
  xpToLevel,
  DAILY_XP_TOTAL,
  type MissionId,
} from '@/domain/missions';

// ---------------------------------------------------------------------------
// Where each mission navigates to
// ---------------------------------------------------------------------------

const MISSION_ROUTES: Record<MissionId, Href> = {
  daily_log:       '/(tabs)/journal',
  mindful_pause:   '/mindful-pause',
  play_game:       '/games',
  breathing:       '/mindful-pause',
  review_progress: '/(tabs)/progress',
};

// ---------------------------------------------------------------------------
// Tint helpers
// ---------------------------------------------------------------------------

type Tint = 'primary' | 'success' | 'accent' | 'celebrate';

function useTintColor(tint: Tint) {
  const theme = useTheme();
  switch (tint) {
    case 'success':   return { icon: theme.color.success,       soft: theme.color.successSoft };
    case 'accent':    return { icon: theme.color.accentText,    soft: theme.color.accentSoft };
    case 'celebrate': return { icon: theme.color.celebrateText, soft: theme.color.celebrateSoft };
    default:          return { icon: theme.color.primary,       soft: theme.color.primarySoft };
  }
}

// ---------------------------------------------------------------------------
// XP / Level progress bar
// ---------------------------------------------------------------------------

function LevelBar({
  totalXp,
  todayXp,
  todayMax,
}: {
  totalXp: number;
  todayXp: number;
  todayMax: number;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { level, progress } = xpToLevel(totalXp);

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = reduced ? progress : withTiming(progress, { duration: 600 });
  }, [progress, reduced, fill]);

  const barAnim = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%` as `${number}%`,
  }));

  const todayPct = todayMax > 0 ? Math.round((todayXp / todayMax) * 100) : 0;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
            backgroundColor: theme.color.primarySoft, borderRadius: radius.round,
            paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
          }}
        >
          <Ionicons name="star" size={13} color={theme.color.primary} />
          <Text variant="caption" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>
            Level {level}
          </Text>
        </View>
        <Text variant="caption" dim>
          {todayXp} / {todayMax} XP today · {todayPct}%
        </Text>
      </View>
      <View
        style={{
          height: 8, borderRadius: radius.round,
          backgroundColor: theme.color.hairline, overflow: 'hidden',
        }}
        accessibilityRole="progressbar"
        accessibilityLabel={`Level ${level} progress: ${Math.round(progress * 100)} percent`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <Animated.View
          style={[
            { height: '100%', borderRadius: radius.round, backgroundColor: theme.color.primary },
            barAnim,
          ]}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single mission row — navigation card only, no manual completion control
// ---------------------------------------------------------------------------

function MissionRow({
  id,
  index,
  done,
}: {
  id: MissionId;
  index: number;
  done: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const reduced = useReducedMotion();
  const mission = missionById(id);
  const tint = useTintColor(mission.tint);

  // Animate row background and checkmark when transitioning to done.
  const rowBg = useSharedValue(done ? 1 : 0);
  const checkScale = useSharedValue(done ? 1 : 0);
  const prevDone = useRef(done);

  useEffect(() => {
    if (done && !prevDone.current) {
      if (!reduced) {
        rowBg.value = withTiming(1, { duration: motion.standard });
        checkScale.value = withSequence(
          withSpring(1.3, { damping: 8, stiffness: 200 }),
          withSpring(1,   { damping: 12, stiffness: 160 }),
        );
      } else {
        rowBg.value = 1;
        checkScale.value = 1;
      }
    } else if (done && prevDone.current) {
      // Already done on mount — set immediately, no animation.
      rowBg.value = 1;
      checkScale.value = 1;
    }
    prevDone.current = done;
  }, [done, reduced, rowBg, checkScale]);

  const rowAnim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      rowBg.value,
      [0, 1],
      [theme.color.surface, theme.color.successSoft],
    ),
  }));

  const checkAnim = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(MISSION_ROUTES[id]);
  };

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(index * 55).springify().damping(18)}
      style={rowAnim}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={
          done
            ? `${mission.title} — completed`
            : `${mission.title} — tap to start`
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          borderTopWidth: index === 0 ? 0 : 1,
          borderTopColor: theme.color.hairline,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        {/* Icon chip */}
        <View
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: done ? theme.color.successSoft : tint.soft,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons
            name={
              done
                ? 'checkmark'
                : (mission.icon as keyof typeof Ionicons.glyphMap)
            }
            size={21}
            color={done ? theme.color.success : tint.icon}
          />
        </View>

        {/* Text */}
        <View style={{ flex: 1, marginLeft: spacing.md, minWidth: 0 }}>
          <Text
            variant="callout"
            color={done ? theme.color.textDim : theme.color.text}
            style={done ? { textDecorationLine: 'line-through' } : undefined}
            numberOfLines={1}
          >
            {mission.title}
          </Text>
          <Text variant="caption" dim numberOfLines={1} style={{ marginTop: 1 }}>
            {done ? 'Completed' : mission.subtitle}
          </Text>
        </View>

        {/* Right side: checkmark when done, XP + chevron when not */}
        {done ? (
          <Animated.View style={[{ marginLeft: spacing.sm }, checkAnim]}>
            <Ionicons name="checkmark-circle" size={22} color={theme.color.success} />
          </Animated.View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.sm }}>
            <View
              style={{
                backgroundColor: theme.color.primarySoft,
                borderRadius: radius.round,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text variant="caption" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>
                +{mission.xp} XP
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.color.textDim} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// All-done celebration
// ---------------------------------------------------------------------------

function AllDoneState() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : ZoomIn.springify().damping(14)}
      style={{
        alignItems: 'center', paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl, gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: theme.color.successSoft,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="checkmark-done-circle" size={44} color={theme.color.success} />
      </View>
      <Text variant="title2" style={{ textAlign: 'center' }}>
        All Missions Complete! 🎉
      </Text>
      <Text variant="callout" dim style={{ textAlign: 'center', lineHeight: 22 }}>
        Amazing work today. Come back tomorrow for a fresh set of missions.
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function DailyMissions() {
  const theme = useTheme();
  // Stable store reference — no new object created on each render.
  const missionState = useDailyMissions();
  const missionXp = useStore((s) => s.missionXp);

  const done = completedCount(missionState);
  const total = MISSIONS.length;
  const todayXp = earnedXp(missionState);
  const allDone = allMissionsComplete(missionState);

  return (
    <View>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="headline">Daily Missions</Text>
          <Text variant="caption" dim style={{ marginTop: 1 }}>
            Resets each day · {done}/{total} complete
          </Text>
        </View>
        {/* Completion badge */}
        <View
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: allDone ? theme.color.successSoft : theme.color.primarySoft,
            alignItems: 'center', justifyContent: 'center',
          }}
          accessibilityLabel={`${done} of ${total} missions completed`}
        >
          <Text
            variant="headline"
            color={allDone ? theme.color.success : theme.color.primary}
            style={{ fontFamily: 'Nunito_800ExtraBold' }}
          >
            {done}
          </Text>
        </View>
      </View>

      {/* XP bar */}
      <View style={{ marginBottom: spacing.md }}>
        <LevelBar totalXp={missionXp} todayXp={todayXp} todayMax={DAILY_XP_TOTAL} />
      </View>

      {/* Mission cards */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        {allDone ? (
          <AllDoneState />
        ) : (
          MISSIONS.map((m, i) => (
            <MissionRow
              key={m.id}
              id={m.id}
              index={i}
              done={missionState.completed.includes(m.id)}
            />
          ))
        )}
      </Card>
    </View>
  );
}

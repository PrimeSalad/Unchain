/**
 * Shared HUD pieces for the Go/No-Go inhibition-training game:
 * score/combo tiles, focus (lives) hearts, the 3-2-1 countdown overlay,
 * floating "+N" score pops, and the daily-challenge chip.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../Text';
import { radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { LIVES, comboMultiplier } from '@/domain/games/inhibition';
import { playSound } from '@/application/sound';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export function HudStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return;
    scale.setValue(1.12);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 220 }).start();
  }, [value, scale, reduceMotion]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.surface, borderRadius: radius.card, padding: spacing.md, alignItems: 'center' }}>
      <Text variant="footnote" dim>{label}</Text>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text variant="title2" color={highlight ? theme.color.accent : theme.color.text} style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Focus hearts - lose one per mistake; the last one pulses as a warning. */
export function LivesRow({ lives }: { lives: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (lives !== 1 || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lives, pulse, reduceMotion]);

  return (
    <View
      accessibilityLabel={`${lives} of ${LIVES} focus points left`}
      style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}
    >
      {Array.from({ length: LIVES }).map((_, i) => {
        const alive = i < lives;
        const isLast = alive && lives === 1;
        return (
          <Animated.View key={i} style={{ transform: [{ scale: isLast ? pulse : 1 }] }}>
            <Ionicons
              name={alive ? 'heart' : 'heart-outline'}
              size={18}
              color={alive ? theme.color.accent : theme.color.hairline}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Combo badge that swells with the multiplier. */
export function ComboBadge({ combo }: { combo: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const mult = comboMultiplier(combo);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (combo === 0 || reduceMotion) return;
    scale.setValue(1.25);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 240 }).start();
  }, [combo, scale, reduceMotion]);

  if (combo < 2) return <View style={{ height: 26 }} />;
  return (
    <Animated.View
      style={{
        alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: theme.color.celebrateSoft, borderRadius: radius.round,
        paddingHorizontal: spacing.md, height: 26,
        transform: [{ scale }],
      }}
    >
      <Ionicons name="flame" size={12} color={theme.color.celebrateText} />
      <Text variant="caption" color={theme.color.celebrateText} style={{ fontVariant: ['tabular-nums'], fontFamily: 'Nunito_700Bold' }}>
        {combo} combo · ×{mult}
      </Text>
    </Animated.View>
  );
}

/** Full-area 3-2-1-GO countdown with ticks. Calls onDone when finished. */
export function Countdown({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [n, setN] = useState(3);
  const scale = useRef(new Animated.Value(0.4)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    playSound('tap', 0.5);
    scale.setValue(reduceMotion ? 1 : 0.4);
    if (!reduceMotion) {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 220 }).start();
    }
    if (n === 0) {
      const t = setTimeout(() => doneRef.current(), 380);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v - 1), 750);
    return () => clearTimeout(t);
  }, [n, scale, reduceMotion]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text variant="display" color={theme.color.primary} style={{ fontSize: 76, lineHeight: 84 }}>
          {n === 0 ? 'GO' : n}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Floating "+N" that drifts up from the stimulus and fades. */
export function PointsFloat({ amount, id }: { amount: number; id: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(reduceMotion ? 0.75 : 0);
    if (!reduceMotion) {
      Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [anim, id, reduceMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, right: 0, top: '22%', alignItems: 'center',
        opacity: reduceMotion ? 1 : anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: reduceMotion ? 0 : anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
      }}
    >
      <Text variant="title2" color={theme.color.success} style={{ fontVariant: ['tabular-nums'], fontFamily: 'Nunito_800ExtraBold' }}>
        +{amount}
      </Text>
    </Animated.View>
  );
}

/** Today's target - turns into a "complete" state once beaten. */
export function ChallengeChip({ target, done }: { target: number; done: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={done ? 'Daily challenge complete' : `Daily challenge: score ${target}`}
      style={{
        alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: done ? theme.color.successSoft : theme.color.surfaceAlt,
        borderRadius: radius.round, paddingHorizontal: spacing.md, paddingVertical: 5,
      }}
    >
      <Ionicons name={done ? 'checkmark-circle' : 'ribbon'} size={13} color={done ? theme.color.success : theme.color.primary} />
      <Text variant="caption" color={done ? theme.color.success : theme.color.textDim} style={{ fontVariant: ['tabular-nums'] }}>
        {done ? 'Daily challenge complete' : `Daily challenge: score ${target.toLocaleString()}`}
      </Text>
    </View>
  );
}

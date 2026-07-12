import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '../Text';
import { Button } from '../Button';
import { elevation, radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { ConfettiBurst } from './Confetti';
import { playSound } from '@/application/sound';

/** Minimal shape a celebrated achievement needs - structurally satisfied by
 *  both GameAchievement and AltAchievement, so games and healthy habits share
 *  this popup. */
export interface UnlockedAchievement {
  id: string;
  title: string;
  /** Ionicons glyph name. */
  icon: string;
}

export interface CelebrationStat {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  tone: 'win' | 'lose' | 'neutral';
  title: string;
  subtitle?: string;
  /** A number that counts up (e.g. final score). */
  score?: { label: string; value: number };
  stats?: CelebrationStat[];
  /** Achievements unlocked by this result - revealed with a stagger. */
  unlocked?: UnlockedAchievement[];
  /** Progress hint toward the next locked achievement. */
  hint?: string | null;
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  onShareAchievement?: (a: UnlockedAchievement) => void;
}

/**
 * Shared end-of-game / milestone popup. Springs in over a dimmed backdrop,
 * celebrates wins with confetti + haptics, counts scores up, and reveals any
 * newly unlocked achievements. Fast to appear, quick to dismiss.
 */
export function GameCelebration({
  visible, tone, title, subtitle, score, stats, unlocked, hint, primary, secondary, onShareAchievement,
}: Props) {
  const theme = useTheme();
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 160 }).start();
      Haptics.notificationAsync(
        tone === 'win' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
      if (unlocked && unlocked.length > 0) {
        const t = setTimeout(() => playSound('clear', 0.7), 550);
        return () => clearTimeout(t);
      }
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true })
        .start(() => setMounted(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="auto">
      {/* Backdrop */}
      <Animated.View
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          backgroundColor: 'rgba(20,14,26,0.6)', opacity: anim,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={secondary?.onPress} accessibilityLabel="Dismiss" />
      </Animated.View>

      {/* Card */}
      <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <Animated.View
          style={{
            width: '100%', maxWidth: 380,
            backgroundColor: theme.color.surface,
            borderRadius: radius.sheet,
            padding: spacing.lg,
            ...elevation.e2,
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
            ],
          }}
        >
          {tone === 'win' && <ConfettiBurst play={visible} />}

          <Text variant="headline" center>{title}</Text>
          {subtitle ? (
            <Text variant="footnote" dim center style={{ marginTop: spacing.xs, lineHeight: 19 }}>{subtitle}</Text>
          ) : null}

          {score && (
            <View style={{ alignItems: 'center', marginTop: spacing.md }}>
              <CountUp value={score.value} />
              <Text variant="footnote" dim style={{ marginTop: 2 }}>{score.label}</Text>
            </View>
          )}

          {stats && stats.length > 0 && (
            <View style={{ flexDirection: 'row', marginTop: spacing.md, backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.sm }}>
              {stats.map((st) => (
                <View key={st.label} style={{ flex: 1, alignItems: 'center' }}>
                  <Text variant="callout" style={{ fontVariant: ['tabular-nums'], fontFamily: 'Nunito_700Bold' }}>{st.value}</Text>
                  <Text variant="caption" dim style={{ marginTop: 2 }} center>{st.label}</Text>
                </View>
              ))}
            </View>
          )}

          {unlocked && unlocked.length > 0 && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {unlocked.map((a, i) => (
                <AchievementRow key={a.id} a={a} index={i} onPress={onShareAchievement ? () => onShareAchievement(a) : undefined} />
              ))}
            </View>
          )}

          {hint ? (
            <Text variant="caption" dim center style={{ marginTop: spacing.md }}>{hint}</Text>
          ) : null}

          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {primary && <Button label={primary.label} onPress={primary.onPress} full />}
            {secondary && <Button label={secondary.label} kind="secondary" onPress={secondary.onPress} full />}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/** Number that eases up from 0 - the little dopamine drumroll. */
function CountUp({ value }: { value: number }) {
  const theme = useTheme();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value <= 0) {
      setDisplay(value);
      return;
    }
    const start = Date.now();
    const dur = Math.min(1100, 500 + value / 4);
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value]);

  return (
    <Text color={theme.color.primary} style={{ fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums'] }}>
      {display.toLocaleString()}
    </Text>
  );
}

function AchievementRow({ a, index, onPress }: { a: UnlockedAchievement; index: number; onPress?: () => void }) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, useNativeDriver: true, damping: 14, stiffness: 150, delay: 450 + index * 220,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          backgroundColor: theme.color.primarySoft, borderRadius: radius.card, padding: spacing.sm,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E3B34C', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={theme.color.primary}>Achievement unlocked</Text>
          <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>{a.title}</Text>
        </View>
        {onPress && <Ionicons name="share-outline" size={18} color={theme.color.primary} />}
      </Pressable>
    </Animated.View>
  );
}

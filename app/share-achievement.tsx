import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Text } from '@/presentation/components/Text';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import { achievementById, GAME_NAMES } from '@/domain/games/achievements';
import { ALTERNATIVES, altAchievementById } from '@/domain/alternatives';

/** Strava-style share card for an unlocked achievement — recreational games
 *  and healthy-habit achievements share the same card and flow. */
export default function ShareAchievement() {
  const safeBack = useSafeBack();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const games = useStore((s) => s.games);
  const altAchievements = useStore((s) => s.altAchievements);
  const altCounts = useStore((s) => s.altCounts);
  const journalCount = useStore((s) => s.journal.length);
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const gameAch = id ? achievementById(id) : undefined;
  const altAch = !gameAch && id ? altAchievementById(id) : undefined;
  const achievement = gameAch ?? altAch;

  // Navigation is a side effect — never call it during render.
  useEffect(() => {
    if (!achievement) safeBack();
  }, [achievement, safeBack]);
  if (!achievement) return null;

  const categoryLabel = gameAch ? GAME_NAMES[gameAch.game] : 'Healthy Habits';
  const unlockedAt =
    (gameAch ? games.achievements[gameAch.id] : altAchievements[achievement.id]) ?? Date.now();
  const date = new Date(unlockedAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  // Stats that make the card feel earned — per game, or habit totals.
  const stats: { label: string; value: string }[] = (() => {
    if (!gameAch) {
      const counts = { ...altCounts, journal: journalCount };
      const totalDone = ALTERNATIVES.reduce((sum, a) => sum + (counts[a.id] ?? 0), 0);
      return [
        { label: 'Activities done', value: `${totalDone}` },
        { label: 'Journal entries', value: `${journalCount}` },
        { label: 'Habit badges', value: `${Object.keys(altAchievements).length}` },
      ];
    }
    switch (gameAch.game) {
      case 'checkers': {
        const played = games.checkersWins + games.checkersLosses;
        const rate = played ? Math.round((games.checkersWins / played) * 100) : 0;
        return [
          { label: 'Wins', value: `${games.checkersWins}` },
          { label: 'Games', value: `${played}` },
          { label: 'Win rate', value: `${rate}%` },
        ];
      }
      case 'clarity': {
        const played = games.clarityPlayed + games.clarityPracticePlayed;
        const won = games.clarityWon + games.clarityPracticeWon;
        const rate = played ? Math.round((won / played) * 100) : 0;
        return [
          { label: 'Solved', value: `${won}` },
          { label: 'Daily streak', value: `${games.clarityStreak}` },
          { label: 'Win rate', value: `${rate}%` },
        ];
      }
      case 'sudoku': {
        const bests = Object.values(games.sudokuBestMs).filter((v): v is number => typeof v === 'number');
        const best = bests.length ? Math.min(...bests) : null;
        const mm = best != null ? Math.floor(best / 60000) : 0;
        const ss = best != null ? Math.floor((best % 60000) / 1000) : 0;
        return [
          { label: 'Solved', value: `${games.sudokuSolved}` },
          { label: 'Best time', value: best != null ? `${mm}:${String(ss).padStart(2, '0')}` : '—' },
          { label: 'Levels', value: `${Object.keys(games.sudokuBestMs).length}/4` },
        ];
      }
      case 'blocks':
        return [
          { label: 'Best score', value: games.blocksBest.toLocaleString() },
          { label: 'Games', value: `${games.blocksGames}` },
          { label: 'Unlocked', value: `${Object.keys(games.achievements).length}` },
        ];
      case 'gonogo':
        return [
          { label: 'Best score', value: games.gonogoBest.toLocaleString() },
          { label: 'Rounds', value: `${games.gonogoGames}` },
          { label: 'Unlocked', value: `${Object.keys(games.achievements).length}` },
        ];
      case 'stopsignal':
        return [
          { label: 'Best score', value: games.stopBest.toLocaleString() },
          { label: 'Rounds', value: `${games.stopGames}` },
          { label: 'Unlocked', value: `${Object.keys(games.achievements).length}` },
        ];
    }
  })();

  const summary = `Achievement unlocked: ${achievement.title} — ${categoryLabel} 🏆\n${achievement.desc}\nRecovering, one calm day at a time. — Unchain`;

  const shareImage = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your achievement' });
      } else {
        await Share.share({ message: summary });
      }
    } catch {
      await Share.share({ message: summary }).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <Text variant="title2" style={{ flex: 1 }}>Share achievement</Text>
          <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={theme.color.textDim} />
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          {/* Capture target — 4:5 card */}
          <View
            ref={cardRef}
            collapsable={false}
            style={{ aspectRatio: 4 / 5, borderRadius: radius.sheet, overflow: 'hidden', ...cardShadow }}
          >
            <LinearGradient
              colors={[palette.grapeDeep, palette.grape, palette.coralDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, padding: spacing.xl, justifyContent: 'space-between' }}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={require('../assets/images/icon.png')}
                  style={{ width: 32, height: 32, borderRadius: 9 }}
                  resizeMode="cover"
                />
                <Text variant="headline" color={palette.white} style={{ marginLeft: spacing.sm, letterSpacing: 0.5 }}>Unchain</Text>
                <View style={{ flex: 1 }} />
                <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
                  <Text variant="caption" color={palette.white}>{categoryLabel}</Text>
                </View>
              </View>

              {/* Badge hero */}
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 118, height: 118, borderRadius: 59,
                    backgroundColor: 'rgba(255,255,255,0.14)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
                  }}
                >
                  <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#E3B34C', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={achievement.icon as keyof typeof Ionicons.glyphMap} size={44} color="#FFFFFF" />
                  </View>
                </View>
                <Text variant="caption" color="rgba(255,255,255,0.8)" style={{ marginTop: spacing.lg, letterSpacing: 2, textTransform: 'uppercase' }}>
                  Achievement unlocked
                </Text>
                <Text variant="title1" center color={palette.white} style={{ marginTop: spacing.xs }}>
                  {achievement.title}
                </Text>
                <Text variant="callout" center color="rgba(255,255,255,0.85)" style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }}>
                  {achievement.desc}
                </Text>
              </View>

              {/* Stats + date */}
              <View>
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.card, padding: spacing.md }}>
                  {stats.map((st) => (
                    <View key={st.label} style={{ flex: 1, alignItems: 'center' }}>
                      <Text variant="title2" color={palette.white} style={{ fontVariant: ['tabular-nums'] }}>{st.value}</Text>
                      <Text variant="caption" color="rgba(255,255,255,0.75)" style={{ marginTop: 2 }}>{st.label}</Text>
                    </View>
                  ))}
                </View>
                <Text variant="caption" center color="rgba(255,255,255,0.7)" style={{ marginTop: spacing.md }}>
                  {date} · Unchain
                </Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Share */}
        <View style={{ padding: spacing.xl }}>
          <Pressable
            onPress={shareImage}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Share"
            accessibilityState={{ disabled: busy, busy }}
            style={({ pressed }) => ({
              height: 54, borderRadius: radius.button, backgroundColor: theme.color.primary,
              alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm,
              opacity: busy ? 0.6 : pressed ? 0.9 : 1,
            })}
          >
            <Ionicons name="share-social" size={20} color={theme.color.onPrimary} />
            <Text variant="headline" color={theme.color.onPrimary}>{busy ? 'Preparing…' : 'Share'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.25,
  shadowRadius: 24,
  elevation: 12,
} as const;

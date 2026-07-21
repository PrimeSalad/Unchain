import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, Share, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/presentation/components/Text';
import { ShareActionButton } from '@/presentation/components/ShareActionButton';
import { ShareFallbackSvg } from '@/presentation/components/ShareFallbackSvg';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import { captureShareRef, saveShareRefToPhotos, saveSvgRefToPhotos, saveToPhotosMessage, shareCapturedContent } from '@/application/shareMedia';
import { achievementById, GAME_ACHIEVEMENTS, GAME_NAMES } from '@/domain/games/achievements';
import { ALTERNATIVES, altAchievementById } from '@/domain/alternatives';

/** Strava-style share card for an unlocked achievement - recreational games
 *  and healthy-habit achievements share the same card and flow. */
export default function ShareAchievement() {
  const safeBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const games = useStore((s) => s.games);
  const altAchievements = useStore((s) => s.altAchievements);
  const altCounts = useStore((s) => s.altCounts);
  const journalCount = useStore((s) => s.journal.length);
  const cardRef = useRef<View>(null);
  const svgRef = useRef<any>(null);
  const [pendingAction, setPendingAction] = useState<'share' | 'save' | null>(null);
  const busy = pendingAction != null;

  const gameAch = id ? achievementById(id) : undefined;
  const altAch = !gameAch && id ? altAchievementById(id) : undefined;
  const achievement = gameAch ?? altAch;

  // Navigation is a side effect - never call it during render.
  useEffect(() => {
    if (!achievement) safeBack();
  }, [achievement, safeBack]);
  if (!achievement) return null;

  const categoryLabel = gameAch ? GAME_NAMES[gameAch.game] : 'Healthy Habits';
  const unlockedGameCount = GAME_ACHIEVEMENTS.filter((a) => games.achievements[a.id]).length;
  const unlockedAt =
    (gameAch ? games.achievements[gameAch.id] : (altAchievements ?? {})[achievement.id]) ?? Date.now();
  const date = new Date(unlockedAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  // Stats that make the card feel earned - per game, or habit totals.
  const stats: { label: string; value: string }[] = (() => {
    if (!gameAch) {
      const counts = { ...(altCounts ?? {}), journal: journalCount };
      const totalDone = ALTERNATIVES.reduce((sum, a) => sum + (counts[a.id] ?? 0), 0);
      return [
        { label: 'Activities done', value: `${totalDone}` },
        { label: 'Journal entries', value: `${journalCount}` },
        { label: 'Habit badges', value: `${Object.keys(altAchievements ?? {}).length}` },
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
          { label: 'Best time', value: best != null ? `${mm}:${String(ss).padStart(2, '0')}` : '-' },
          { label: 'Levels', value: `${Object.keys(games.sudokuBestMs).length}/4` },
        ];
      }
      case 'blocks':
        return [
          { label: 'Best score', value: games.blocksBest.toLocaleString() },
          { label: 'Games', value: `${games.blocksGames}` },
          { label: 'Unlocked', value: `${unlockedGameCount}` },
        ];
      case 'gonogo':
        return [
          { label: 'Best score', value: games.gonogoBest.toLocaleString() },
          { label: 'Rounds', value: `${games.gonogoGames}` },
          { label: 'Unlocked', value: `${unlockedGameCount}` },
        ];
    }
  })();

  const summary = `Achievement unlocked: ${achievement?.title ?? 'Achievement'} - ${categoryLabel} 🏆\n${achievement?.desc ?? ''}\nRecovering, one calm day at a time. - Unchainly`;

  const shareImage = async () => {
    if (busy) return;
    setPendingAction('share');
    try {
      // Null-guard the ref before capture to avoid native crash on iOS.
      if (!cardRef.current) {
        await Share.share({ message: summary }).catch(() => {});
        return;
      }
      const uri = await captureShareRef(cardRef);
      if (uri) {
        await shareCapturedContent({ uri, summary, dialogTitle: 'Share your achievement' });
      } else {
        await Share.share({ message: summary }).catch(() => {});
      }
    } catch {
      await Share.share({ message: summary }).catch(() => {});
    } finally {
      setPendingAction(null);
    }
  };

  const saveImage = async () => {
    if (busy) return;
    setPendingAction('save');
    try {
      if (!cardRef.current) {
        Alert.alert('Could not render image', 'The share card is not ready yet. Please try again.');
        return;
      }
      let result = await saveShareRefToPhotos(cardRef);
      if (!result.ok && (result.reason === 'capture-unavailable' || result.reason === 'failed')) {
        result = await saveSvgRefToPhotos(svgRef);
      }
      const message = saveToPhotosMessage(result);
      Alert.alert(message.title, message.message);
    } catch {
      Alert.alert('Save failed', 'The card could not be saved right now. Please try again.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <ShareFallbackSvg
        svgRef={svgRef}
        gradient={[palette.grapeDeep, palette.grape, palette.coralDeep]}
        pill={categoryLabel}
        eyebrow="Achievement unlocked"
        title={achievement.title}
        subtitle={achievement.desc}
        stats={stats}
        footer={`${date} · Unchainly`}
      />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.sm }}>
          <Text variant="title2" style={{ flex: 1 }}>Share achievement</Text>
          <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={theme.color.textDim} />
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          {/* Capture target - 4:5 card */}
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
                <Text variant="headline" color={palette.white} style={{ marginLeft: spacing.sm, letterSpacing: 0.5 }}>Unchainly</Text>
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
                    <Ionicons name={(achievement.icon ?? 'trophy') as keyof typeof Ionicons.glyphMap} size={44} color="#FFFFFF" />
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
                  {date} · Unchainly
                </Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Share */}
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <ShareActionButton
            icon="download-outline"
            label={pendingAction === 'save' ? 'Saving...' : 'Save to Photos'}
            onPress={saveImage}
            disabled={busy}
            busy={pendingAction === 'save'}
            accessibilityLabel="Save card to Photos"
            kind="secondary"
          />
          <ShareActionButton
            icon="share-social"
            label={pendingAction === 'share' ? 'Preparing...' : 'Share'}
            onPress={shareImage}
            disabled={busy}
            busy={pendingAction === 'share'}
            accessibilityLabel="Share"
          />
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

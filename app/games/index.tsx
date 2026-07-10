import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Image, Pressable, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView } from 'react-native';
import { Text } from '@/presentation/components/Text';
import { Card } from '@/presentation/components/Card';
import { BackButton } from '@/presentation/components/BackButton';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import { GAME_ACHIEVEMENTS, type GameId } from '@/domain/games/achievements';

// A crash inside the hub must never take navigation down with it.
export { GamesErrorBoundary as ErrorBoundary } from '@/presentation/components/games/GamesErrorBoundary';

interface GameDef {
  route: string;
  icon: ImageSourcePropType;
  game: GameId;
  title: string;
  desc: string;
  stat: string;
}

export default function GamesHub() {
  const router = useRouter();
  const theme = useTheme();
  const games = useStore((s) => s.games);

  const clarityRate = games.clarityPlayed > 0 ? Math.round((games.clarityWon / games.clarityPlayed) * 100) : 0;

  const trophies = (game: GameId) => {
    const defs = GAME_ACHIEVEMENTS.filter((a) => a.game === game);
    const earned = defs.filter((a) => games.achievements[a.id]).length;
    return `${earned}/${defs.length}`;
  };

  const defs: GameDef[] = [
    { route: '/games/clarity', game: 'clarity', icon: require('../../assets/game icon/WordPuzzle.jpg'), title: 'Clarity', desc: 'Guess the five-letter word', stat: games.clarityPlayed ? `Streak ${games.clarityStreak} · ${clarityRate}% won` : 'Daily + practice' },
    { route: '/games/checkers', game: 'checkers', icon: require('../../assets/game icon/Checkers.jpg'), title: 'Checkers', desc: 'Outsmart the AI', stat: games.checkersWins || games.checkersLosses ? `${games.checkersWins}W · ${games.checkersLosses}L` : '3 difficulties' },
    { route: '/games/sudoku', game: 'sudoku', icon: require('../../assets/game icon/Sodoku.jpg'), title: 'Sudoku', desc: 'Fill the grid, 1–9', stat: games.sudokuSolved ? `${games.sudokuSolved} solved` : '4 difficulties' },
    { route: '/games/blocks', game: 'blocks', icon: require('../../assets/game icon/Blocks Align.jpg'), title: 'Block Puzzle', desc: 'Place, clear, combo', stat: games.blocksBest ? `Best ${games.blocksBest.toLocaleString()}` : 'Beat your best' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
          <BackButton />
          <Text variant="title1" style={{ flex: 1 }}>Games</Text>
          <Pressable
            onPress={() => router.push('/games/achievements' as Href)}
            hitSlop={12}
            accessibilityLabel="Achievements"
            style={({ pressed }) => ({
              width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt,
              alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="trophy" size={20} color="#E3B34C" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          <Text variant="footnote" dim style={{ marginBottom: spacing.xs }}>
            A calm distraction when a craving hits. All offline.
          </Text>
          {defs.map((g, i) => (
            <EnterFade key={g.route} index={i}>
              <Pressable
                onPress={() => router.push(g.route as Href)}
                accessibilityRole="button"
                accessibilityLabel={`${g.title} — ${g.desc}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
              >
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                  <Image source={g.icon} style={{ width: 56, height: 56, borderRadius: radius.card }} />
                  <View style={{ flex: 1 }}>
                    <Text variant="headline">{g.title}</Text>
                    <Text variant="footnote" dim style={{ marginTop: 2 }}>{g.desc}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 }}>
                      <Text variant="caption" color={theme.color.primary}>{g.stat}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="trophy" size={11} color="#E3B34C" />
                        <Text variant="caption" dim>{trophies(g.game)}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.color.textDim} />
                </Card>
              </Pressable>
            </EnterFade>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Soft staggered entrance for the hub cards. */
function EnterFade({ index, children }: { index: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay: index * 70,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

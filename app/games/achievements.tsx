import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/presentation/components/Text';
import { Card } from '@/presentation/components/Card';
import { BackButton } from '@/presentation/components/BackButton';
import { spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import {
  GAME_ACHIEVEMENTS,
  GAME_NAMES,
  type GameAchievement,
  type GameId,
} from '@/domain/games/achievements';

// A crash inside the screen must never take navigation down with it.
export { GamesErrorBoundary as ErrorBoundary } from '@/presentation/components/games/GamesErrorBoundary';

const GAME_ORDER: GameId[] = ['clarity', 'checkers', 'sudoku', 'blocks'];

export default function Achievements() {
  const theme = useTheme();
  const games = useStore((s) => s.games);
  const unlockedCount = Object.keys(games.achievements).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
          <BackButton fallback="/games" />
          <View style={{ flex: 1 }}>
            <Text variant="title1">Achievements</Text>
          </View>
          <View style={{ backgroundColor: theme.color.primarySoft, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 }}>
            <Text variant="footnote" color={theme.color.primary}>
              {unlockedCount}/{GAME_ACHIEVEMENTS.length}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
          {GAME_ORDER.map((game) => {
            const defs = GAME_ACHIEVEMENTS.filter((a) => a.game === game);
            const earned = defs.filter((a) => games.achievements[a.id]).length;
            return (
              <View key={game}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.sm, marginTop: spacing.sm }}>
                  <Text variant="headline" style={{ flex: 1 }}>{GAME_NAMES[game]}</Text>
                  <Text variant="footnote" dim>{earned}/{defs.length}</Text>
                </View>
                <Card padding={0}>
                  {defs.map((a, i) => (
                    <AchievementItem key={a.id} a={a} first={i === 0} unlockedAt={games.achievements[a.id]} />
                  ))}
                </Card>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AchievementItem({ a, first, unlockedAt }: { a: GameAchievement; first: boolean; unlockedAt?: number }) {
  const theme = useTheme();
  const router = useRouter();
  const games = useStore((s) => s.games);
  const unlocked = unlockedAt != null;
  const hidden = a.secret && !unlocked;
  const prog = !unlocked && !hidden && a.progress ? a.progress(games) : null;

  return (
    <Pressable
      disabled={!unlocked}
      onPress={() => router.push({ pathname: '/share-achievement', params: { id: a.id } })}
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Secret achievement, locked' : `${a.title}${unlocked ? ', unlocked. Share' : ', locked'}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
        borderTopWidth: first ? 0 : 1, borderTopColor: theme.color.hairline,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: unlocked ? '#E3B34C' : theme.color.surfaceAlt,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons
          name={hidden ? 'help' : (a.icon as keyof typeof Ionicons.glyphMap)}
          size={22}
          color={unlocked ? '#FFFFFF' : theme.color.textDim}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" color={unlocked ? theme.color.text : theme.color.textDim}>
          {hidden ? 'Secret achievement' : a.title}
        </Text>
        <Text variant="caption" dim style={{ marginTop: 2 }}>
          {hidden ? 'Keep playing to discover it.' : a.desc}
        </Text>
        {prog && (
          <View style={{ marginTop: spacing.sm, height: 5, borderRadius: 3, backgroundColor: theme.color.surfaceAlt, overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.min(100, Math.max(0, Math.round((prog.current / prog.target) * 100)))}%`,
                height: '100%', borderRadius: 3, backgroundColor: theme.color.primary,
              }}
            />
          </View>
        )}
        {unlocked && (
          <Text variant="caption" color={theme.color.primary} style={{ marginTop: 2 }}>
            {new Date(unlockedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
      {unlocked && <Ionicons name="share-outline" size={18} color={theme.color.primary} />}
    </Pressable>
  );
}

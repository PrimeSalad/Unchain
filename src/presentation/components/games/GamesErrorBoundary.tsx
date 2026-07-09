import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../Text';
import { Button } from '../Button';
import { spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Per-route error boundary for the game screens (expo-router picks this up
 * via each route's `export { GamesErrorBoundary as ErrorBoundary }`). If a
 * game ever throws during render, the player lands here — with working
 * navigation — instead of a dead app.
 */
export function GamesErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  const router = useRouter();
  const theme = useTheme();

  const backToGames = () => {
    try {
      if (router.canGoBack()) router.back();
      else router.replace('/games' as Href);
    } catch {
      try { router.replace('/(tabs)/home'); } catch { /* last resort: stay */ }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="game-controller-outline" size={56} color={theme.color.textDim} />
          <Text variant="title2" center style={{ marginTop: spacing.lg }}>
            That round hit a snag
          </Text>
          <Text variant="body" dim center style={{ marginTop: spacing.sm }}>
            No progress was lost. Take a breath and jump back in.
          </Text>
        </View>
        <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
          <Button label="Try again" onPress={() => { retry().catch(() => {}); }} full />
          <Button label="Back to games" kind="secondary" onPress={backToGames} full />
        </View>
      </SafeAreaView>
    </View>
  );
}

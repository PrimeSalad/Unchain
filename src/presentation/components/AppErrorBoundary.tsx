import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Root error boundary (expo-router picks this up via the layout's
 * `export { AppErrorBoundary as ErrorBoundary }`). If any screen throws during
 * render the user lands here — with a calm, recovery-appropriate message and a
 * way back — instead of a dead app. Raw exception details are never shown.
 */
export function AppErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  const router = useRouter();
  const theme = useTheme();

  const goHome = () => {
    try {
      router.replace('/(tabs)/home');
    } catch {
      /* retry remains available; never crash the fallback itself */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="cloud-offline-outline" size={56} color={theme.color.textDim} />
          <Text variant="title2" center style={{ marginTop: spacing.lg }}>
            Something went wrong
          </Text>
          <Text variant="body" dim center style={{ marginTop: spacing.sm }}>
            Your data is safe on this device. Take a breath — then try again.
          </Text>
        </View>
        <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
          <Button label="Try again" onPress={() => { retry().catch(() => {}); }} full />
          <Button label="Go to Home" kind="secondary" onPress={goHome} full />
        </View>
      </SafeAreaView>
    </View>
  );
}

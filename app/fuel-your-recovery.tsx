import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { spacing } from '@/presentation/theme/tokens';

/**
 * Automatic calorie, weight-change, and fasting recommendations are
 * intentionally unavailable in this release. Keeping this route as a safe
 * migration destination prevents old bookmarks from crashing.
 */
export default function FuelYourRecoveryUnavailable() {
  const router = useRouter();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <Text variant="title1" accessibilityRole="header">Nutrition recommendations unavailable</Text>
        <Text variant="body" dim>
          Unchainly does not provide calorie, fasting, weight-change, or medical nutrition recommendations.
          Choose a general wellness activity instead, or speak with a qualified professional for personal guidance.
        </Text>
        <Button label="Open wellness activities" onPress={() => router.replace('/alternatives')} full />
        <Button label="Go back" kind="secondary" onPress={() => router.back()} full />
      </View>
    </Screen>
  );
}

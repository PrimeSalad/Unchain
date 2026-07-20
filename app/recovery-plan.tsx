import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { spacing } from '@/presentation/theme/tokens';
import { resolveRecoveryFeature } from '@/application/recoveryFeatureRegistry';

/** Safe destination for native-free features while they remain internal. */
export default function RecoveryPlanScreen() {
  const router = useRouter();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const definition = resolveRecoveryFeature(feature ?? '', __DEV__);
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <Text variant="title1" accessibilityRole="header">
          {definition?.title ?? 'Feature unavailable'}
        </Text>
        <Text variant="body" dim>
          {definition
            ? `${definition.subtitle}. This planning tool is still being validated and is not enabled in release builds.`
            : 'This recovery tool is unavailable in the current release.'}
        </Text>
        <Button label="Back" onPress={() => router.back()} full />
      </View>
    </Screen>
  );
}

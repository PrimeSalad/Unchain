/**
 * Catch Your Breath - Progress Insights
 * Visual trends and encouraging observations over time.
 * Route: /catch-your-breath-insights
 */

import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import { generateInsights, type Insight } from '@/domain/catchYourBreath';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Trend icon/color ──────────────────────────────────────────────────────

function trendIcon(trend: Insight['trend']): keyof typeof Ionicons.glyphMap {
  switch (trend) {
    case 'improving': return 'arrow-up-circle';
    case 'stable': return 'remove-circle';
    case 'declining': return 'arrow-down-circle';
    default: return 'information-circle';
  }
}

function trendColor(trend: Insight['trend'], theme: ReturnType<typeof useTheme>['color']): string {
  switch (trend) {
    case 'improving': return theme.success;
    case 'stable': return theme.primary;
    case 'declining': return theme.danger;
    default: return theme.textDim;
  }
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function CatchYourBreathInsights() {
  const theme = useTheme();
  const safeBack = useSafeBack();
  const router = useRouter();
  const entries = useStore((s) => s.catchYourBreathEntries);

  const insights = generateInsights(entries);

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable
          onPress={safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({
            width: 40, height: 40, borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="headline">Progress Insights</Text>
          <Text variant="footnote" dim style={{ marginTop: 2 }}>
            Based on {entries.length} {entries.length === 1 ? 'reflection' : 'reflections'}
          </Text>
        </View>
      </View>

      {entries.length < 2 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing.lg,
          }}>
            <Ionicons name="trending-up" size={32} color={theme.color.textDim} />
          </View>
          <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.sm }}>
            Not enough data yet
          </Text>
          <Text variant="footnote" dim center style={{ lineHeight: 20, marginBottom: spacing.lg }}>
            Complete at least 2 weekly reflections to see your progress trends and insights.
          </Text>
          <Button label="Start a Reflection" onPress={() => router.push('/catch-your-breath')} full />
        </View>
      ) : (
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          style={{ marginTop: spacing.lg, gap: spacing.sm }}
        >
          {insights.map((insight, i) => {
            const color = trendColor(insight.trend, theme.color);
            return (
              <Animated.View
                key={insight.label}
                entering={FadeInDown.delay(i * 80).springify().damping(18)}
                style={{
                  backgroundColor: theme.color.surface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: theme.color.hairline,
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.md,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: color + '18',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Ionicons name={trendIcon(insight.trend)} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: 2 }}>
                    {insight.label}
                  </Text>
                  <Text variant="caption" color={theme.color.textDim} style={{ lineHeight: 18 }}>
                    {insight.value}
                  </Text>
                </View>
              </Animated.View>
            );
          })}

          {/* Disclaimer */}
          <View style={{
            marginTop: spacing.md,
            backgroundColor: theme.color.surfaceAlt,
            borderRadius: radius.card,
            padding: spacing.md,
          }}>
            <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic' }}>
              These insights summarize your self-reported responses. They are not medical advice or diagnosis. If you notice worsening symptoms, please consult a healthcare professional.
            </Text>
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}

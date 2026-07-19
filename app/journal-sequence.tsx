import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { useDailyJournalProgress, useStore } from '@/application/store';
import { addictionMeta } from '@/domain/gambling';
import { journalConfig } from '@/domain/addictionJournal';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';

export default function JournalSequenceScreen() {
  const theme = useTheme();
  const router = useRouter();
  const ensurePlan = useStore((s) => s.ensureDailyJournalPlan);
  const progress = useDailyJournalProgress();
  const [ready, setReady] = useState(false);
  const advancing = useRef(false);

  useEffect(() => {
    ensurePlan();
    setReady(true);
  }, [ensurePlan]);

  const next = progress.required.find((addiction) => !progress.completed.includes(addiction));
  useEffect(() => {
    if (!ready || !next || progress.complete || advancing.current) return;
    advancing.current = true;
    const timer = setTimeout(() => {
      router.replace({
        pathname: journalConfig(next).route as never,
        params: { sequence: '1', addiction: next },
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [next, progress.complete, ready, router]);

  const total = Math.max(1, progress.required.length);
  return (
    <Screen edges={['top', 'bottom']} scroll={false} contentStyle={{ paddingTop: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
        <Pressable
          onPress={() => router.replace('/(tabs)/journal')}
          accessibilityRole="button"
          accessibilityLabel="Close daily journal"
          style={({ pressed }) => ({
            width: 48, height: 48, borderRadius: radius.round,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: theme.color.surface, opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="close" size={24} color={theme.color.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text variant="headline">Today’s journal</Text>
          <Text variant="caption" dim>{progress.completed.length} of {progress.required.length} completed</Text>
        </View>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <ProgressBar progress={progress.completed.length / total} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.sm }}>
        {progress.required.map((addiction) => {
          const complete = progress.completed.includes(addiction);
          return (
            <View key={addiction} style={{
              minHeight: 58, borderRadius: radius.input, paddingHorizontal: spacing.md,
              backgroundColor: theme.color.surface, flexDirection: 'row', alignItems: 'center',
              borderWidth: 1, borderColor: complete ? theme.color.success : theme.color.hairline,
            }}>
              <Ionicons name={complete ? 'checkmark-circle' : addiction === next ? 'arrow-forward-circle' : 'ellipse-outline'} size={22} color={complete ? theme.color.success : theme.color.primary} />
              <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }}>{addictionMeta(addiction).label}</Text>
              <Text variant="caption" dim>{complete ? 'Completed' : addiction === next ? 'Up next' : 'Waiting'}</Text>
            </View>
          );
        })}
      </View>

      {progress.complete ? (
        <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="checkmark-circle" size={48} color={theme.color.success} />
            <Text variant="title2" center>Daily journal complete</Text>
            <Text variant="footnote" dim center>Every selected recovery track has been checked in for today.</Text>
          </View>
          <Button label="View journal" onPress={() => router.replace('/(tabs)/journal')} full />
        </View>
      ) : (
        <Text variant="footnote" dim center style={{ paddingBottom: spacing.lg }}>
          Opening {next ? addictionMeta(next).label : 'your next check-in'}…
        </Text>
      )}
    </Screen>
  );
}

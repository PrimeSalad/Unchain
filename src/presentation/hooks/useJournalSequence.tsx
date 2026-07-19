import { useCallback } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AddictionType } from '@/domain/gambling';
import type { JournalEntry } from '@/domain/records';
import { addictionMeta } from '@/domain/gambling';
import {
  useDailyJournalProgress,
  useProfileForAddiction,
  useStore,
  useTodayJournalForAddiction,
} from '@/application/store';
import { Text } from '../components/Text';
import { ProgressBar } from '../components/ProgressBar';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

export function useJournalSequence(addiction: AddictionType, fallback: () => void) {
  const router = useRouter();
  const params = useLocalSearchParams<{ sequence?: string }>();
  const sequence = params.sequence === '1';
  const profile = useProfileForAddiction(addiction);
  const todayJournal = useTodayJournalForAddiction(addiction);
  const progress = useDailyJournalProgress();
  const addJournal = useStore((s) => s.addJournal);
  const addJournalForAddiction = useStore((s) => s.addJournalForAddiction);
  const draft = useStore((s) => s.journalDrafts[addiction]);
  const saveJournalDraft = useStore((s) => s.saveJournalDraft);
  const clearJournalDraft = useStore((s) => s.clearJournalDraft);

  const submitJournal = useCallback((data: Omit<JournalEntry, 'id' | 'at'>) => {
    if (sequence) addJournalForAddiction(addiction, data);
    else addJournal(data);
  }, [addJournal, addJournalForAddiction, addiction, sequence]);

  const finishSection = useCallback(() => {
    if (sequence) {
      router.replace('/journal-sequence' as Parameters<typeof router.replace>[0]);
    } else {
      fallback();
    }
  }, [fallback, router, sequence]);

  return {
    sequence,
    profile,
    todayJournal,
    progress,
    draft: draft?.values,
    submitJournal,
    finishSection,
    saveDraft: (values: Record<string, unknown>) => saveJournalDraft(addiction, values),
    clearDraft: () => clearJournalDraft(addiction),
  };
}

export function JournalSequenceBanner({ addiction }: { addiction: AddictionType }) {
  const theme = useTheme();
  const progress = useDailyJournalProgress();
  const index = Math.max(0, progress.required.indexOf(addiction));
  const done = progress.completed.length;
  const total = Math.max(1, progress.required.length);
  return (
    <View style={{
      marginBottom: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.input,
      backgroundColor: theme.color.primarySoft,
      borderWidth: 1,
      borderColor: theme.color.primary + '30',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={theme.color.primary} style={{ textTransform: 'uppercase' }}>
            Current check-in
          </Text>
          <Text variant="callout" color={theme.color.primary}>{addictionMeta(addiction).label}</Text>
        </View>
        <Text variant="footnote" color={theme.color.primary}>{index + 1} of {total}</Text>
      </View>
      <ProgressBar progress={done / total} height={6} />
      <Text variant="caption" dim style={{ marginTop: spacing.xs }}>
        {done} of {total} addiction check-ins completed
      </Text>
    </View>
  );
}

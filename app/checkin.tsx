/**
 * Daily Check-in gate.
 *
 * The journal IS the check-in. This screen either:
 *   1. Shows "already done today" after all selected entries are complete, or
 *   2. Immediately redirects to the multi-addiction journal sequence.
 *      addiction type (gambling → /journal-entry, porn → /porn-journal-entry,
 *      social_media → /social-journal-entry).
 *
 * No duplicate form. No redundant data entry. The journal save drives every
 * downstream feature: streak, calendar, analytics, missions, insights.
 */

import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { Mascot } from '@/presentation/components/Mascot';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import {
  useDailyJournalProgress,
  useProfile,
  useTodayJournalForAddiction,
} from '@/application/store';
import { journalConfig } from '@/domain/addictionJournal';

export default function CheckIn() {
  const theme    = useTheme();
  const router   = useRouter();
  const safeBack = useSafeBack();
  const profile  = useProfile();

  const addictionType = profile?.addictionType ?? 'gambling';
  const todayEntry    = useTodayJournalForAddiction(addictionType);
  const journalProgress = useDailyJournalProgress();
  const alreadyDone   = journalProgress.complete;

  // Redirect immediately when there is no entry yet.
  // useEffect so the component mounts first (router needs to be ready).
  useEffect(() => {
    if (!alreadyDone) {
      Haptics.selectionAsync().catch(() => {});
      router.replace(journalConfig(addictionType).route as any);
    }
  }, [alreadyDone, addictionType, router]);

  // ── Already done today ────────────────────────────────────────────────────
  if (alreadyDone) {
    const isRelapse =
      todayEntry?.gambled === true ||
      todayEntry?.watched === true ||
      todayEntry?.binged  === true ||
      todayEntry?.smoked  === true ||
      todayEntry?.drank   === true ||
      todayEntry?.used    === true ||
      todayEntry?.played  === true ||
      todayEntry?.shopped === true ||
      todayEntry?.otherActed === true;

    const accent  = isRelapse ? theme.color.danger : theme.color.success;
    const recordedAt = todayEntry?.at ?? Date.now();
    const timeStr = new Date(recordedAt).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    });
    const dateStr = new Date(recordedAt).toLocaleDateString('en-PH', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        {/* Close button */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm }}>
          <Pressable
            onPress={safeBack}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radius.round,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? theme.color.surfaceAlt : 'transparent',
            })}
          >
            <Ionicons name="close" size={26} color={theme.color.textDim} />
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          {/* Stacked ring illustration */}
          <View style={{ position: 'relative', width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              position: 'absolute', width: 120, height: 120, borderRadius: 60,
              backgroundColor: accent + '08', borderWidth: 1, borderColor: accent + '20',
            }} />
            <View style={{
              position: 'absolute', width: 88, height: 88, borderRadius: 44,
              backgroundColor: accent + '12', borderWidth: 1, borderColor: accent + '30',
            }} />
            <Mascot
              state={isRelapse ? 'comfort' : 'celebrate'}
              size={60}
              still
              decorative
            />
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title2" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
              {isRelapse ? 'Entry recorded' : 'Journal written'}
            </Text>
            <Text variant="callout" dim center style={{ lineHeight: 22 }}>
              You submitted today's journal at {timeStr}.{'\n'}
              Come back tomorrow to write a new one.
            </Text>
            <View style={{
              marginTop: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.chip,
              backgroundColor: accent + '15',
              borderWidth: 1,
              borderColor: accent + '30',
            }}>
              <Text variant="footnote" color={accent} style={{ fontFamily: 'Nunito_700Bold' }}>
                {dateStr}
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
            <Button
              label="View journal"
              onPress={() => router.replace('/(tabs)/journal')}
              full
            />
            <Button
              label="Go home"
              kind="secondary"
              onPress={() => router.replace('/(tabs)/home')}
              full
            />
          </View>
        </View>
      </Screen>
    );
  }

  // Render nothing while the redirect fires (useEffect runs after mount).
  return null;
}

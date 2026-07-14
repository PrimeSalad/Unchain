/**
 * Daily Check-in gate.
 *
 * The journal IS the check-in. This screen either:
 *   1. Shows "already done today" if a journal entry exists for today, or
 *   2. Immediately redirects to the correct journal wizard for the user's
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
import { useProfile } from '@/application/store';
import {
  useTodayJournal,
  useTodayPornJournal,
  useTodaySocialJournal,
  useTodaySmokeJournal,
  useTodayAlcoholJournal,
  useTodayDrugJournal,
  useTodayGamingJournal,
} from '@/application/store';
import { addictionMeta } from '@/domain/gambling';

/** Pick the right journal route for the user's addiction type. */
function journalRoute(addictionType: string): string {
  if (addictionType === 'pornography') return '/porn-journal-entry';
  if (addictionType === 'social_media') return '/social-journal-entry';
  if (addictionType === 'online_shopping') return '/online-shopping-journal-entry';
  if (addictionType === 'smoking') return '/smoke-journal-entry';
  if (addictionType === 'alcohol') return '/alcohol-journal-entry';
  if (addictionType === 'drugs') return '/drug-journal-entry';
  if (addictionType === 'gaming') return '/game-journal-entry';
  return '/journal-entry';
}

/** Return today's journal entry for whichever addiction type is active. */
function useTodayEntry(addictionType: string | undefined) {
  const gambling = useTodayJournal();
  const porn     = useTodayPornJournal();
  const social   = useTodaySocialJournal();
  const smoke    = useTodaySmokeJournal();
  const alcohol  = useTodayAlcoholJournal();
  const drugs    = useTodayDrugJournal();
  const gaming   = useTodayGamingJournal();
  if (addictionType === 'pornography') return porn;
  if (addictionType === 'social_media') return social;
  if (addictionType === 'smoking') return smoke;
  if (addictionType === 'alcohol') return alcohol;
  if (addictionType === 'drugs') return drugs;
  if (addictionType === 'gaming') return gaming;
  return gambling;
}

export default function CheckIn() {
  const theme    = useTheme();
  const router   = useRouter();
  const safeBack = useSafeBack();
  const profile  = useProfile();

  const addictionType = profile?.addictionType ?? 'gambling';
  const meta          = addictionMeta(addictionType as any);
  const todayEntry    = useTodayEntry(addictionType);
  const alreadyDone   = todayEntry != null;

  // Redirect immediately when there is no entry yet.
  // useEffect so the component mounts first (router needs to be ready).
  useEffect(() => {
    if (!alreadyDone) {
      Haptics.selectionAsync().catch(() => {});
      router.replace(journalRoute(addictionType) as any);
    }
  }, [alreadyDone, addictionType, router]);

  // ── Already done today ────────────────────────────────────────────────────
  if (alreadyDone) {
    const isRelapse =
      todayEntry?.gambled === true ||
      todayEntry?.watched === true ||
      todayEntry?.binged  === true ||
      todayEntry?.drank   === true ||
      todayEntry?.played  === true;

    const accent  = isRelapse ? theme.color.danger : theme.color.success;
    const timeStr = new Date(todayEntry!.at).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    });
    const dateStr = new Date(todayEntry!.at).toLocaleDateString('en-PH', {
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

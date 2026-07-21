import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, Share, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/presentation/components/Text';
import { ShareActionButton } from '@/presentation/components/ShareActionButton';
import { ShareFallbackSvg } from '@/presentation/components/ShareFallbackSvg';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useProfile } from '@/application/store';
import { captureShareRef, saveShareRefToPhotos, saveSvgRefToPhotos, saveToPhotosMessage, shareCapturedContent } from '@/application/shareMedia';
import { currentStreakStart, streakDays } from '@/domain/gambling';
import { ALTERNATIVES, WATER_GOAL_GLASSES, alternativeById, type AlternativeId } from '@/domain/alternatives';
import { formatDistance, formatPace } from '@/domain/walk';
import { journalStatsForAddiction } from '@/domain/addictionJournal';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/** Session time as a stopwatch readout: 10:00, 1:23. */
function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Lifetime time as a human total: 45s → "45s", 12m 30s → "12m", 95m → "1h 35m". */
function fmtTotal(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-activity card flavour
// ─────────────────────────────────────────────────────────────────────────────

const GRADIENTS: Record<'primary' | 'success' | 'accent' | 'celebrate', [string, string, string]> = {
  primary:   ['#43265C', '#5A2E7A', '#B23A4B'],
  success:   ['#28422F', '#4E7A5A', '#77B58A'],
  celebrate: ['#6B3E12', '#97591F', '#D0A070'],
  accent:    ['#B23A4B', '#E8697A', '#D0A070'],
};

const HERO_LABEL: Record<AlternativeId, string> = {
  walk: 'Recovery Walk',
  breathe: 'Deep Breathing',
  stretch: 'Guided Stretch',
  water: 'Hydration Break',
  music: 'Calming Music',
  journal: 'Journal Entry',
  'need-or-want': 'Need or Want?',
  'catch-your-breath': 'Catch Your Breath',
  'cheers-to-change': 'Cheers to Change',
  'back-on-track': 'Back on Track',
};

const TAGLINE: Record<AlternativeId, string> = {
  walk: 'Ten minutes of motion beats an hour of craving.',
  breathe: 'A calm nervous system makes strong choices.',
  stretch: 'Tension released is stress recovery no longer carries.',
  water: 'Small anchors hold big ships.',
  music: 'A few quiet minutes can outlast the loudest urge.',
  journal: 'Every honest page makes recovery stronger.',
  'need-or-want': 'Pause before you buy. Intentional decisions are better decisions.',
  'catch-your-breath': 'Tracking your breathing is tracking your recovery.',
  'cheers-to-change': 'Every step forward in recovery matters.',
  'back-on-track': 'Every check-in is a step forward in recovery.',
};

// Full breathing cycle: inhale 4s + hold 2s + exhale 6s.
const BREATH_CYCLE_SECONDS = 12;

/** Strava-style share card for a just-finished Healthy Alternative session. */
export default function ShareActivity() {
  const safeBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    seconds?: string;
    steps?: string;
    meters?: string;
    glasses?: string;
    stretches?: string;
  }>();
  const profile = useProfile();
  const altCounts = useStore((s) => s.altCounts);
  const altSeconds = useStore((s) => s.altSeconds);
  const altSessions = useStore((s) => s.altSessions);
  const walkSteps = useStore((s) => s.walkSteps);
  const walkMeters = useStore((s) => s.walkMeters);
  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);
  const journalCount = journal.length;
  const journalStats = profile
    ? journalStatsForAddiction(journal, profile.addictionType)
    : null;
  const cardRef = useRef<View>(null);
  const svgRef = useRef<any>(null);
  const [pendingAction, setPendingAction] = useState<'share' | 'save' | null>(null);
  const busy = pendingAction != null;

  const id = ALTERNATIVES.some((a) => a.id === params.id)
    ? (params.id as AlternativeId)
    : null;

  // Navigation is a side effect - never call it during render.
  useEffect(() => {
    if (!id) safeBack();
  }, [id, safeBack]);
  if (!id) return null;

  const alt = alternativeById(id);
  const seconds = Math.max(0, parseInt(params.seconds ?? '0', 10) || 0);
  const gradient = GRADIENTS[alt.tint];
  const streak = profile
    ? streakDays(currentStreakStart(profile.startedAt, relapses, journal))
    : 0;

  const sessions = altSessions[id] ?? 0;
  const totalSeconds = altSeconds[id] ?? 0;
  const daysDone = altCounts[id] ?? 0;

  const sessionSteps = Math.max(0, parseInt(params.steps ?? '0', 10) || 0);
  const sessionMeters = Math.max(0, parseInt(params.meters ?? '0', 10) || 0);
  const sessionGlasses = Math.max(0, parseInt(params.glasses ?? '0', 10) || 0);
  const sessionStretches = Math.max(0, parseInt(params.stretches ?? '0', 10) || 0);

  // Three stats that make the session feel earned - tuned per activity.
  const stats: { label: string; value: string }[] = (() => {
    switch (id) {
      case 'walk': {
        const pace = formatPace(seconds, sessionMeters);
        return [
          { label: 'Steps', value: sessionSteps > 0 ? sessionSteps.toLocaleString() : '-' },
          { label: 'Distance', value: sessionMeters > 0 ? formatDistance(sessionMeters) : '-' },
          pace != null
            ? { label: 'Avg pace', value: pace }
            : { label: 'Day streak', value: `${streak}` },
        ];
      }
      case 'breathe':
        return [
          { label: 'Breath cycles', value: `${Math.max(1, Math.round(seconds / BREATH_CYCLE_SECONDS))}` },
          { label: 'Sessions', value: `${sessions}` },
          { label: 'Total time', value: fmtTotal(totalSeconds) },
        ];
      case 'stretch':
        return [
          { label: 'Stretches', value: sessionStretches > 0 ? `${sessionStretches}` : '-' },
          { label: 'Sessions', value: `${sessions}` },
          { label: 'Total time', value: fmtTotal(totalSeconds) },
        ];
      case 'music':
        return [
          { label: 'Sessions', value: `${sessions}` },
          { label: 'Total listening', value: fmtTotal(totalSeconds) },
          { label: 'Day streak', value: `${streak}` },
        ];
      case 'journal':
        // Journal counts are derived from the journal itself, not altCounts.
        return [
          { label: 'Entries', value: `${journalStats?.total ?? journalCount}` },
          { label: 'Clean days', value: `${journalStats?.cleanDays ?? 0}` },
          { label: 'Day streak', value: `${streak}` },
        ];
      default: // water - glasses instead of duration
        return [
          { label: 'Today', value: `${sessionGlasses}/${WATER_GOAL_GLASSES}` },
          { label: 'Days logged', value: `${daysDone}` },
          { label: 'Day streak', value: `${streak}` },
        ];
    }
  })();

  const timed = seconds > 0;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fallbackHeroValue =
    timed ? fmtClock(seconds) :
    id === 'water' && sessionGlasses > 0 ? `${sessionGlasses}` :
    'Done';
  const fallbackHeroLabel =
    id === 'water' && sessionGlasses > 0
      ? `glass${sessionGlasses === 1 ? '' : 'es'} today`
      : HERO_LABEL[id];

  const walkDetail =
    id === 'walk'
      ? [
          sessionSteps > 0 ? `${sessionSteps.toLocaleString()} steps` : null,
          sessionMeters > 0 ? formatDistance(sessionMeters) : null,
        ].filter(Boolean).join(' · ')
      : '';
  const summary =
    `${HERO_LABEL[id]}${timed ? ` - ${fmtClock(seconds)}` : ''}${walkDetail ? ` · ${walkDetail}` : ''} ✅\n` +
    `${TAGLINE[id]}\n` +
    `Day ${streak} of recovery, one calm choice at a time. - Unchainly`;

  const shareImage = async () => {
    if (busy) return;
    setPendingAction('share');
    try {
      await Share.share({ message: summary }).catch(() => {});
    } catch {
      // Share failed silently
    } finally {
      // Delay to prevent freeze from rapid state change while share sheet is up
      setTimeout(() => setPendingAction(null), 300);
    }
  };

  const saveImage = async () => {
    if (busy) return;
    setPendingAction('save');
    try {
      if (!cardRef.current) {
        Alert.alert('Could not render image', 'The share card is not ready yet. Please try again.');
        return;
      }
      let result = await saveShareRefToPhotos(cardRef);
      if (!result.ok && (result.reason === 'capture-unavailable' || result.reason === 'failed')) {
        result = await saveSvgRefToPhotos(svgRef);
      }
      const message = saveToPhotosMessage(result);
      Alert.alert(message.title, message.message);
    } catch {
      Alert.alert('Save failed', 'The card could not be saved right now. Please try again.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <ShareFallbackSvg
        svgRef={svgRef}
        gradient={gradient}
        pill="Healthy Habits"
        eyebrow={HERO_LABEL[id]}
        title={HERO_LABEL[id]}
        subtitle={TAGLINE[id]}
        heroValue={fallbackHeroValue}
        heroLabel={fallbackHeroLabel}
        stats={stats}
        footer={`Day ${streak} of recovery · ${dateStr}`}
      />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.sm }}>
          <Text variant="title2" style={{ flex: 1 }}>Share your session</Text>
          <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={theme.color.textDim} />
          </Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          {/* Capture target - 4:5 card */}
          <View
            ref={cardRef}
            collapsable={false}
            style={{ aspectRatio: 4 / 5, borderRadius: radius.sheet, overflow: 'hidden', ...cardShadow }}
          >
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, padding: spacing.xl, justifyContent: 'space-between' }}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={require('../assets/images/icon.png')}
                  style={{ width: 32, height: 32, borderRadius: 9 }}
                  resizeMode="cover"
                />
                <Text variant="headline" color={palette.white} style={{ marginLeft: spacing.sm, letterSpacing: 0.5 }}>Unchainly</Text>
                <View style={{ flex: 1 }} />
                <View style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
                  <Text variant="caption" color={palette.white}>Healthy Habits</Text>
                </View>
              </View>

              {/* Hero */}
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 92, height: 92, borderRadius: 46,
                    backgroundColor: 'rgba(255,255,255,0.14)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
                  }}
                >
                  <Ionicons name={alt.icon as keyof typeof Ionicons.glyphMap} size={42} color={palette.white} />
                </View>
                <Text variant="caption" color="rgba(255,255,255,0.8)" style={{ marginTop: spacing.lg, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {HERO_LABEL[id]}
                </Text>
                {timed ? (
                  <Text color={palette.white} style={{ fontSize: 72, lineHeight: 78, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'], marginTop: spacing.xs }}>
                    {fmtClock(seconds)}
                  </Text>
                ) : id === 'water' && sessionGlasses > 0 ? (
                  <>
                    <Text color={palette.white} style={{ fontSize: 72, lineHeight: 78, fontFamily: 'Nunito_900Black', fontVariant: ['tabular-nums'], marginTop: spacing.xs }}>
                      {sessionGlasses}
                    </Text>
                    <Text variant="callout" color="rgba(255,255,255,0.85)" style={{ marginTop: -4 }}>
                      glass{sessionGlasses === 1 ? '' : 'es'} today
                    </Text>
                  </>
                ) : (
                  <Text color={palette.white} style={{ fontSize: 56, lineHeight: 64, fontFamily: 'Nunito_900Black', marginTop: spacing.xs }}>
                    Done ✓
                  </Text>
                )}
                <Text variant="callout" center color="rgba(255,255,255,0.85)" style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }}>
                  {TAGLINE[id]}
                </Text>
              </View>

              {/* Stats + footer */}
              <View>
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.card, padding: spacing.md }}>
                  {stats.map((st) => (
                    <View key={st.label} style={{ flex: 1, alignItems: 'center' }}>
                      <Text variant="title2" color={palette.white} style={{ fontVariant: ['tabular-nums'] }}>{st.value}</Text>
                      <Text variant="caption" color="rgba(255,255,255,0.75)" style={{ marginTop: 2 }} center>{st.label}</Text>
                    </View>
                  ))}
                </View>
                {id === 'walk' && (walkSteps > 0 || walkMeters > 0) && (
                  <Text variant="caption" center color="rgba(255,255,255,0.75)" style={{ marginTop: spacing.md }}>
                    Lifetime · {sessions} walk{sessions === 1 ? '' : 's'} · {formatDistance(walkMeters)} · {walkSteps.toLocaleString()} steps
                  </Text>
                )}
                <Text variant="caption" center color="rgba(255,255,255,0.7)" style={{ marginTop: id === 'walk' ? spacing.xs : spacing.md }}>
                  Day {streak} of recovery · {dateStr} · {timeStr}
                </Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Share */}
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <ShareActionButton
            icon="download-outline"
            label={pendingAction === 'save' ? 'Saving...' : 'Save to Photos'}
            onPress={saveImage}
            disabled={busy}
            busy={pendingAction === 'save'}
            accessibilityLabel="Save card to Photos"
            kind="secondary"
          />
          <ShareActionButton
            icon="share-social"
            label={pendingAction === 'share' ? 'Preparing...' : 'Share'}
            onPress={shareImage}
            disabled={busy}
            busy={pendingAction === 'share'}
            accessibilityLabel="Share"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.25,
  shadowRadius: 24,
  elevation: 12,
} as const;

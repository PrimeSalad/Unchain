import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/presentation/components/Screen';
import { KeyboardFormScreen } from '@/presentation/components/KeyboardFormScreen';
import { Text } from '@/presentation/components/Text';
import { Card } from '@/presentation/components/Card';
import { Button } from '@/presentation/components/Button';
import { Pill } from '@/presentation/components/Pill';
import { Slider } from '@/presentation/components/Slider';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useProfile, type AddictionRecoverySnapshot } from '@/application/store';
import {
  ADDICTIONS,
  addictionMeta,
  urgeLevel,
  type AddictionType,
  type RecoveryProfile,
} from '@/domain/gambling';
import type { UrgeLog } from '@/domain/records';
import { normalizeSelectedAddictions } from '@/domain/multiAddiction';
import { isCompleteRecoveryTrackSetup } from '@/domain/recoveryTrackSetup';
import {
  resolveUrgeDestination,
  triggerOptionsForAddiction,
} from '@/domain/urgeLogging';

type RouteParams = {
  id?: string | string[];
  track?: string | string[];
};

interface ExistingUrgeMatch {
  track: AddictionType;
  urge: UrgeLog;
}

interface InitialFormState {
  track: AddictionType;
  intensity: number;
  triggers: string[];
  mood: number;
  notes: string;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function asAddictionType(value: string | undefined): AddictionType | null {
  return ADDICTIONS.some((item) => item.key === value)
    ? value as AddictionType
    : null;
}

function urgeTriggers(urge: UrgeLog | undefined): string[] {
  if (!urge) return [];
  if (Array.isArray(urge.triggers) && urge.triggers.length > 0) return [...urge.triggers];
  return urge.trigger ? [urge.trigger] : [];
}

function findExistingUrge(
  id: string | undefined,
  requestedTrack: AddictionType | null,
  activeTrack: AddictionType | undefined,
  activeUrges: readonly UrgeLog[],
  snapshots: Partial<Record<AddictionType, AddictionRecoverySnapshot>>,
): ExistingUrgeMatch | undefined {
  if (!id) return undefined;
  const orderedTracks = Array.from(new Set([
    ...(requestedTrack ? [requestedTrack] : []),
    ...(activeTrack ? [activeTrack] : []),
    ...ADDICTIONS.map((item) => item.key),
  ]));

  for (const track of orderedTracks) {
    const urges = track === activeTrack ? activeUrges : snapshots[track]?.urges ?? [];
    const urge = urges.find((entry) => entry.id === id);
    if (urge) return { track, urge };
  }
  return undefined;
}

function profileForTrack(
  track: AddictionType,
  activeProfile: RecoveryProfile | null,
  snapshots: Partial<Record<AddictionType, AddictionRecoverySnapshot>>,
): RecoveryProfile | null {
  if (activeProfile?.addictionType === track) return activeProfile;
  return snapshots[track]?.profile ?? null;
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export default function LogUrge() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<RouteParams>();
  const safeBack = useSafeBack();
  const profile = useProfile();
  const activeUrges = useStore((state) => state.urges);
  const recoveryByAddiction = useStore((state) => state.recoveryByAddiction);
  const logUrgeForTrack = useStore((state) => state.logUrgeForTrack);
  const updateUrgeForTrack = useStore((state) => state.updateUrgeForTrack);
  const setActiveAddiction = useStore((state) => state.setActiveAddiction);

  const editId = firstParam(params.id);
  const rawRequestedTrack = firstParam(params.track);
  const requestedTrack = asAddictionType(rawRequestedTrack);
  const selectedTracks = profile
    ? normalizeSelectedAddictions(profile.addictionType, profile.selectedAddictions)
    : [];
  const eligibleTracks = selectedTracks.filter((track) => {
    const snapshot = recoveryByAddiction[track];
    return snapshot != null && isCompleteRecoveryTrackSetup(snapshot.setup);
  });
  const existingMatch = useMemo(() => findExistingUrge(
    editId,
    requestedTrack,
    profile?.addictionType,
    activeUrges,
    recoveryByAddiction,
  ), [activeUrges, editId, profile?.addictionType, recoveryByAddiction, requestedTrack]);
  const existing = existingMatch?.urge;
  const invalidEdit = Boolean(editId) && !existingMatch;
  const resolvedTrack = profile
    ? resolveUrgeDestination({
        activeTrack: profile.addictionType,
        selectedTracks: eligibleTracks,
        requestedTrack,
        editOwnerTrack: existingMatch?.track,
      })
    : null;
  // A concrete value keeps controlled form state stable. New logging is gated
  // below when no eligible track exists; edit ownership may remain incomplete
  // because updating the existing record does not activate that track.
  const initialTrack = resolvedTrack ?? profile?.addictionType ?? 'gambling';
  const initialTriggers = urgeTriggers(existing);
  const initialForm = useRef<InitialFormState>({
    track: initialTrack,
    intensity: existing?.intensity ?? 5,
    triggers: initialTriggers,
    mood: existing?.mood ?? 5,
    notes: existing?.notes ?? '',
  });

  const [selectedTrack, setSelectedTrack] = useState<AddictionType>(initialTrack);
  const [intensity, setIntensity] = useState(existing?.intensity ?? 5);
  const [triggers, setTriggers] = useState<string[]>(initialTriggers);
  const [mood, setMood] = useState(existing?.mood ?? 5);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const saveLock = useRef(false);
  const allowClose = useRef(false);
  const dismissalAlertOpen = useRef(false);
  const focusScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = !committed && (
    selectedTrack !== initialForm.current.track
    || intensity !== initialForm.current.intensity
    || !sameStrings(triggers, initialForm.current.triggers)
    || mood !== initialForm.current.mood
    || notes !== initialForm.current.notes
  );

  const destinationProfile = profileForTrack(selectedTrack, profile, recoveryByAddiction);
  const legacyEditTriggers = urgeTriggers(existing);
  const triggerOptions = triggerOptionsForAddiction(
    selectedTrack,
    destinationProfile?.triggers ?? [],
    legacyEditTriggers,
  );
  const requestedTrackUnavailable = Boolean(rawRequestedTrack)
    && (!requestedTrack || (!existing && !eligibleTracks.includes(requestedTrack)));
  const setupRequired = !existing && (
    eligibleTracks.length === 0 || !eligibleTracks.includes(selectedTrack)
  );
  const activeTrack = profile?.addictionType;
  const setupTarget = requestedTrack && selectedTracks.includes(requestedTrack)
    ? requestedTrack
    : selectedTracks.includes(selectedTrack) && !eligibleTracks.includes(selectedTrack)
      ? selectedTrack
    : activeTrack && selectedTracks.includes(activeTrack)
      ? activeTrack
      : selectedTracks[0] ?? activeTrack ?? selectedTrack;
  const level = urgeLevel(intensity);

  const closeWithoutPrompt = () => {
    allowClose.current = true;
    safeBack();
  };

  const confirmDiscard = (discard: () => void) => {
    if (dismissalAlertOpen.current) return;
    dismissalAlertOpen.current = true;
    Alert.alert(
      existing ? 'Discard urge changes?' : 'Discard this urge log?',
      'Your unsaved answers will be lost.',
      [
        {
          text: 'Keep editing',
          style: 'cancel',
          onPress: () => { dismissalAlertOpen.current = false; },
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            dismissalAlertOpen.current = false;
            discard();
          },
        },
      ],
      { onDismiss: () => { dismissalAlertOpen.current = false; } },
    );
  };

  const requestClose = () => {
    if (dirty && !saved) {
      confirmDiscard(closeWithoutPrompt);
      return;
    }
    closeWithoutPrompt();
  };

  useEffect(() => navigation.addListener('beforeRemove', (event: any) => {
    if (allowClose.current || !dirty || saved) return;
    event.preventDefault();
    confirmDiscard(() => {
      allowClose.current = true;
      navigation.dispatch(event.data.action);
    });
  }), [dirty, navigation, saved]);

  useEffect(() => {
    if (!saved) return;
    AccessibilityInfo.announceForAccessibility(
      `Urge saved for ${addictionMeta(selectedTrack).label}.`,
    );
  }, [saved, selectedTrack]);

  useEffect(() => () => {
    if (focusScrollTimer.current) clearTimeout(focusScrollTimer.current);
  }, []);

  // Persisted state can finish hydrating after this route mounts. If the form
  // is still untouched, align it to the first eligible destination instead of
  // leaving the temporary fallback category selected.
  const eligibleTrackKey = eligibleTracks.join('\0');
  useEffect(() => {
    if (
      existing
      || dirty
      || eligibleTracks.length === 0
      || eligibleTracks.includes(selectedTrack)
    ) return;
    const next = resolveUrgeDestination({
      activeTrack: profile?.addictionType ?? eligibleTracks[0],
      selectedTracks: eligibleTracks,
      requestedTrack,
    });
    if (!next) return;
    initialForm.current = { ...initialForm.current, track: next, triggers: [] };
    setSelectedTrack(next);
    setTriggers([]);
  // The stable key represents the eligible array without re-running on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, eligibleTrackKey, existing, profile?.addictionType, requestedTrack, selectedTrack]);

  const chooseTrack = (next: AddictionType) => {
    if (next === selectedTrack || existing) return;
    const apply = () => {
      setSelectedTrack(next);
      setTriggers([]);
      setSaveError(null);
      AccessibilityInfo.announceForAccessibility(`Logging for ${addictionMeta(next).label}.`);
    };
    if (triggers.length === 0) {
      apply();
      return;
    }
    Alert.alert(
      'Switch recovery track?',
      'Selected triggers will be cleared so they are not filed under the wrong track.',
      [
        { text: 'Keep current track', style: 'cancel' },
        { text: 'Switch and clear triggers', onPress: apply },
      ],
    );
  };

  const save = () => {
    if (saveLock.current || saving || invalidEdit) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);

    const data = {
      intensity,
      trigger: triggers[0],
      triggers,
      notes: notes.trim() || undefined,
      resisted: true,
      mood,
    };

    try {
      if (existing) {
        const result = updateUrgeForTrack(selectedTrack, existing.id, data);
        if (result !== 'updated') {
          throw new Error('This urge no longer exists. Close this screen or start a new log.');
        }
        setCommitted(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        allowClose.current = true;
        safeBack();
        return;
      }

      const destination = useStore.getState().recoveryByAddiction[selectedTrack];
      if (!destination || !isCompleteRecoveryTrackSetup(destination.setup)) {
        throw new Error('Finish this recovery track setup before logging a new urge.');
      }

      const entryId = logUrgeForTrack(selectedTrack, data);
      if (!entryId) {
        throw new Error('That recovery track is unavailable. Choose an active track and try again.');
      }
      setCommitted(true);
      setSaving(false);
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'The urge could not be saved. Review the form and try again.';
      saveLock.current = false;
      setSaving(false);
      setSaveError(message);
      AccessibilityInfo.announceForAccessibility(message);
    }
  };

  const navigateAfterSave = (href: Href) => {
    allowClose.current = true;
    router.replace(href);
  };

  const openTrackJournal = () => {
    const before = useStore.getState();
    const target = before.recoveryByAddiction[selectedTrack];
    const openSetup = () => navigateAfterSave(
      `/recovery-track-setup?mode=review&type=${encodeURIComponent(selectedTrack)}` as Href,
    );

    if (!target || !isCompleteRecoveryTrackSetup(target.setup)) {
      openSetup();
      return;
    }
    if (before.profile?.addictionType !== selectedTrack) {
      setActiveAddiction(selectedTrack);
      if (useStore.getState().profile?.addictionType !== selectedTrack) {
        openSetup();
        return;
      }
    }
    navigateAfterSave('/(tabs)/journal');
  };

  if (!profile) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Text variant="headline">Recovery profile unavailable</Text>
        <Text dim style={{ marginTop: spacing.sm }}>
          Finish onboarding before logging an urge.
        </Text>
        <Button label="Close" onPress={requestClose} full style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (invalidEdit) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ alignItems: 'flex-end' }}>
          <CloseButton onPress={requestClose} color={theme.color.textDim} />
        </View>
        <Text variant="headline" accessibilityRole="header">Urge not found</Text>
        <Text dim style={{ marginTop: spacing.sm, lineHeight: 22 }}>
          It may have been deleted or the edit link may be out of date. Your recovery data was not changed.
        </Text>
        <Button
          label="Start a new urge log"
          onPress={() => {
            allowClose.current = true;
            router.replace({
              pathname: '/log-urge',
              params: { track: profile.addictionType },
            });
          }}
          full
          style={{ marginTop: spacing.xl }}
        />
        <Button label="Close" kind="tertiary" onPress={requestClose} full style={{ marginTop: spacing.sm }} />
      </Screen>
    );
  }

  if (setupRequired) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ alignItems: 'flex-end' }}>
          <CloseButton onPress={requestClose} color={theme.color.textDim} />
        </View>
        <Text variant="headline" accessibilityRole="header">Finish recovery track setup</Text>
        <Text dim style={{ marginTop: spacing.sm, lineHeight: 22 }}>
          Complete the category questions before logging a new urge. Existing recovery history is unchanged.
        </Text>
        <Button
          label={`Finish ${addictionMeta(setupTarget).label} setup`}
          onPress={() => {
            allowClose.current = true;
            router.replace(
              `/recovery-track-setup?mode=review&type=${encodeURIComponent(setupTarget)}` as Href,
            );
          }}
          full
          style={{ marginTop: spacing.xl }}
        />
        <Button label="Close" kind="tertiary" onPress={requestClose} full style={{ marginTop: spacing.sm }} />
      </Screen>
    );
  }

  if (saved) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ paddingVertical: spacing.xl }}>
          <Text variant="caption" dim center>
            Saved for {addictionMeta(selectedTrack).label}
          </Text>
          {level === 'low' && (
            <>
              <Text variant="headline" center style={{ marginTop: spacing.sm }}>You caught it early.</Text>
              <Text variant="footnote" dim center style={{ marginTop: spacing.sm, lineHeight: 21 }}>
                Awareness logged. Keep moving with your day.
              </Text>
            </>
          )}
          {level === 'medium' && (
            <>
              <Text variant="headline" center style={{ marginTop: spacing.sm }}>Take the edge off.</Text>
              <Text variant="footnote" dim center style={{ marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 21 }}>
                Pick one action before the urge gets louder.
              </Text>
              <View style={{ gap: spacing.sm }}>
                <ActionBtn icon="leaf" label="Take a Mindful Pause" onPress={() => navigateAfterSave('/mindful-pause' as Href)} />
                <ActionBtn icon="book" label="Open Journal" onPress={openTrackJournal} />
                {destinationProfile?.reason ? (
                  <Card tone="primarySoft">
                    <Text variant="footnote" dim>Your reason</Text>
                    <Text variant="callout" style={{ marginTop: 4 }}>“{destinationProfile.reason}”</Text>
                  </Card>
                ) : null}
              </View>
            </>
          )}
          {level === 'high' && (
            <>
              <Text variant="headline" center color={theme.color.accentText} style={{ marginTop: spacing.sm }}>
                Strong urge detected.
              </Text>
              <Text variant="footnote" dim center style={{ marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 21 }}>
                Do not decide yet. Start with one stabilizing action.
              </Text>
              <View style={{ gap: spacing.sm }}>
                <ActionBtn icon="warning" label="Open SOS now" accent onPress={() => navigateAfterSave('/sos')} />
                <ActionBtn icon="time" label="Start a Mindful Pause" onPress={() => navigateAfterSave('/mindful-pause' as Href)} />
                <ActionBtn icon="book" label="Journal it out" onPress={openTrackJournal} />
              </View>
              {destinationProfile?.reason ? (
                <Card tone="primarySoft" style={{ marginTop: spacing.lg }}>
                  <Text variant="footnote" dim>Remember why</Text>
                  <Text variant="callout" style={{ marginTop: 4 }}>“{destinationProfile.reason}”</Text>
                </Card>
              ) : null}
            </>
          )}
          <Button
            label="Back to Home"
            kind="tertiary"
            onPress={() => navigateAfterSave('/(tabs)/home')}
            full
            style={{ marginTop: spacing.xxl }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardFormScreen
      scrollRef={scrollRef}
      footer={(
        <View style={{ gap: spacing.sm }}>
          {saveError ? (
            <Text accessibilityRole="alert" variant="footnote" color={theme.color.danger}>
              {saveError}
            </Text>
          ) : null}
          <Button
            label={saving ? 'Saving…' : existing ? 'Save changes' : 'Save urge'}
            onPress={save}
            disabled={saving}
            full
          />
        </View>
      )}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs }}>
        <CloseButton onPress={requestClose} color={theme.color.textDim} />
      </View>

      <Text variant="headline" accessibilityRole="header" style={{ marginTop: spacing.xs }}>
        {existing ? 'Edit urge' : 'Log an urge'}
      </Text>
      <Text variant="footnote" dim style={{ marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 21 }}>
        Logging it before acting is a win in itself.
      </Text>

      {requestedTrackUnavailable ? (
        <Card tone="accentSoft" style={{ marginBottom: spacing.md }}>
          <Text accessibilityRole="alert" variant="footnote" color={theme.color.accentText}>
            That recovery track is unavailable. Logging will use an active track instead.
          </Text>
        </Card>
      ) : null}

      <Card tone="primarySoft">
        <Text variant="caption" dim>{existing ? 'Editing for' : 'Logging for'}</Text>
        <Text variant="headline" style={{ marginTop: spacing.xs }}>
          {addictionMeta(selectedTrack).label}
        </Text>
      </Card>

      {!existing && eligibleTracks.length > 1 ? (
        <View style={{ marginTop: spacing.md }}>
          <Text variant="callout" style={{ marginBottom: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
            Choose recovery track
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {eligibleTracks.map((track) => (
              <Pill
                key={track}
                label={addictionMeta(track).label}
                active={selectedTrack === track}
                onPress={() => chooseTrack(track)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Text variant="callout" style={{ marginTop: spacing.xl, marginBottom: spacing.xs, fontFamily: 'Nunito_700Bold' }}>
        How strong is your urge?
      </Text>
      <Text variant="caption" dim style={{ marginBottom: spacing.md }}>
        1 = barely there, 10 = overwhelming.
      </Text>
      <Card>
        <Slider kind="urge" label="Urge intensity" value={intensity} onChange={setIntensity} />
      </Card>

      <Text variant="callout" style={{ marginTop: spacing.xl, marginBottom: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
        What triggered it?
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {triggerOptions.map((trigger) => (
          <Pill
            key={trigger}
            label={trigger}
            active={triggers.includes(trigger)}
            onPress={() => setTriggers((current) => current.includes(trigger)
              ? current.filter((value) => value !== trigger)
              : [...current, trigger])}
          />
        ))}
      </View>

      <Text variant="callout" style={{ marginTop: spacing.xl, marginBottom: spacing.xs, fontFamily: 'Nunito_700Bold' }}>
        How is your mood right now?
      </Text>
      <Text variant="caption" dim style={{ marginBottom: spacing.md }}>
        Tracking mood helps identify patterns in your urges.
      </Text>
      <Card>
        <Slider kind="mood" label="Mood" value={mood} onChange={setMood} />
      </Card>

      <Text variant="callout" style={{ marginTop: spacing.xl, marginBottom: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
        Notes (optional)
      </Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        onFocus={() => {
          if (focusScrollTimer.current) clearTimeout(focusScrollTimer.current);
          focusScrollTimer.current = setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 250);
        }}
        accessibilityLabel="Notes"
        accessibilityHint="Add optional context about this urge."
        placeholder="What was happening when the urge appeared?"
        placeholderTextColor={theme.color.textDim}
        multiline
        returnKeyType="default"
        style={{
          minHeight: 112,
          borderRadius: radius.input,
          backgroundColor: theme.color.surface,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          padding: spacing.md,
          color: theme.color.text,
          fontSize: 16,
          lineHeight: 23,
          textAlignVertical: 'top',
        }}
      />
    </KeyboardFormScreen>
  );
}

function CloseButton({ onPress, color }: { onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        minHeight: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Ionicons name="close" size={26} color={color} accessible={false} />
    </Pressable>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.75 : 1 })}
    >
      <Card tone={accent ? 'accentSoft' : 'surface'} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons
          name={icon}
          size={22}
          color={accent ? theme.color.accentText : theme.color.primary}
          accessible={false}
        />
        <Text
          variant="callout"
          style={{ flex: 1, marginLeft: spacing.md, fontFamily: 'Nunito_700Bold' }}
          color={accent ? theme.color.accentText : theme.color.text}
        >
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} accessible={false} />
      </Card>
    </Pressable>
  );
}

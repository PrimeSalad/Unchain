import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import {
  RecoveryTrackSetupFlow,
  type RecoveryTrackDraftMap,
} from '../components/RecoveryTrackSetupFlow';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore, useProfile } from '@/application/store';
import { ADDICTIONS, addictionMeta, type AddictionType } from '@/domain/gambling';
import {
  GOAL_MODES,
  createRecoveryTrackDraft,
  normalizeRecoveryTrackDraft,
  type RecoveryTrackDraft,
} from '@/domain/recoveryTrackSetup';
import { normalizeSelectedAddictions } from '@/domain/multiAddiction';

function asAddictionType(value: string | string[] | undefined): AddictionType | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return ADDICTIONS.some((item) => item.key === raw) ? raw as AddictionType : null;
}

function copyDraft(draft: RecoveryTrackDraft): RecoveryTrackDraft {
  return {
    ...draft,
    triggers: [...draft.triggers],
    ...(draft.expense ? { expense: { ...draft.expense } } : {}),
  };
}

const PROFILE_SETUP_DRAFT_KEY = 'unchainly-profile-track-setup-draft-v1';

function safeStoredDraft(
  type: AddictionType,
  value: unknown,
  fallback: RecoveryTrackDraft,
): RecoveryTrackDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return copyDraft(fallback);
  const raw = value as Partial<RecoveryTrackDraft>;
  return normalizeRecoveryTrackDraft({
    ...fallback,
    ...raw,
    addictionType: type,
    goalMode: GOAL_MODES.includes(raw.goalMode as any) ? raw.goalMode! : fallback.goalMode,
    startedAtLocalMidnight: typeof raw.startedAtLocalMidnight === 'number' && Number.isFinite(raw.startedAtLocalMidnight)
      ? raw.startedAtLocalMidnight
      : fallback.startedAtLocalMidnight,
    ...(fallback.expense
      ? {
          expense: {
            ...fallback.expense,
            ...(raw.expense && typeof raw.expense === 'object' ? raw.expense : {}),
          },
        }
      : { expense: undefined }),
    triggers: Array.isArray(raw.triggers)
      ? raw.triggers.filter((item): item is string => typeof item === 'string')
      : [...fallback.triggers],
    reason: typeof raw.reason === 'string' ? raw.reason : fallback.reason,
  });
}

export function RecoveryTrackSetupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ mode?: string; type?: string }>();
  const mode = params.mode === 'review' ? 'review' : 'add';
  const requestedType = asAddictionType(params.type);
  const profile = useProfile();
  const recoveryByAddiction = useStore((state) => state.recoveryByAddiction);
  const addRecoveryTrack = useStore((state) => state.addRecoveryTrack);
  const completeLegacyTrackSetup = useStore((state) => state.completeLegacyTrackSetup);
  const [chosen, setChosen] = useState<AddictionType | null>(mode === 'review' ? requestedType : null);
  const initialDraft = chosen ? recoveryByAddiction[chosen]?.setup : undefined;
  const [drafts, setDrafts] = useState<RecoveryTrackDraftMap>(() => (
    chosen && initialDraft ? { [chosen]: copyDraft(initialDraft) } : {}
  ));
  const [dirty, setDirty] = useState(false);
  const [restored, setRestored] = useState(false);
  const allowClose = useRef(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PROFILE_SETUP_DRAFT_KEY)
      .then((stored) => {
        if (!mounted || !stored || !profile) return;
        const parsed = JSON.parse(stored) as any;
        const storedType = asAddictionType(parsed.type);
        if (!storedType || parsed.mode !== mode) return;
        if (mode === 'review' && storedType !== requestedType) return;
        if (mode === 'add' && (
          normalizeSelectedAddictions(profile.addictionType, profile.selectedAddictions).includes(storedType)
          || recoveryByAddiction[storedType]
        )) return;
        const fallback = mode === 'review'
          ? recoveryByAddiction[storedType]?.setup
          : createRecoveryTrackDraft(storedType, { currency: profile.currency });
        if (!fallback) return;
        setChosen(storedType);
        setDrafts({ [storedType]: safeStoredDraft(storedType, parsed.draft, fallback) });
        setDirty(parsed.dirty === true);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setRestored(true);
      });
    return () => { mounted = false; };
    // The route/store are hydrated before this modal mounts; restore once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored || !chosen || !drafts[chosen]) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(PROFILE_SETUP_DRAFT_KEY, JSON.stringify({
        mode,
        type: chosen,
        draft: drafts[chosen],
        dirty,
      })).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [chosen, dirty, drafts, mode, restored]);

  const clearStoredDraft = () => {
    AsyncStorage.removeItem(PROFILE_SETUP_DRAFT_KEY).catch(() => {});
  };

  const close = () => {
    clearStoredDraft();
    allowClose.current = true;
    router.back();
  };

  const confirmClose = () => {
    if (!dirty) {
      close();
      return;
    }
    Alert.alert(
      'Discard recovery track setup?',
      'Your answers have not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: close },
      ],
    );
  };

  useEffect(() => navigation.addListener('beforeRemove', (event: any) => {
    if (allowClose.current) return;
    if (!dirty) {
      clearStoredDraft();
      return;
    }
    event.preventDefault();
    Alert.alert(
      'Discard recovery track setup?',
      'Your answers have not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            allowClose.current = true;
            clearStoredDraft();
            navigation.dispatch(event.data.action);
          },
        },
      ],
    );
  }), [dirty, navigation]);

  if (!profile || !restored) return null;
  const selected = normalizeSelectedAddictions(profile.addictionType, profile.selectedAddictions);

  if (mode === 'review' && !requestedType) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="title2" center>Setup link unavailable</Text>
          <Text variant="body" dim center style={{ marginTop: spacing.sm }}>
            Return to Profile and choose Finish setup on the recovery track again.
          </Text>
          <Button label="Close" kind="secondary" onPress={close} style={{ marginTop: spacing.xl }} />
        </View>
      </Screen>
    );
  }

  const choose = (type: AddictionType) => {
    const existingDraftType = Object.keys(drafts).find((key) => key !== type) as AddictionType | undefined;
    const selectType = () => {
      setChosen(type);
      setDrafts((current) => current[type]
        ? current
        : { [type]: createRecoveryTrackDraft(type, { currency: profile.currency }) });
    };
    if (dirty && existingDraftType) {
      Alert.alert(
        `Discard ${addictionMeta(existingDraftType).label} setup?`,
        'Choose Keep editing to preserve those answers, or discard them before starting another category.',
        [
          { text: 'Keep editing', style: 'cancel', onPress: () => setChosen(existingDraftType) },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setDirty(false);
              setDrafts({});
              selectType();
            },
          },
        ],
      );
      return;
    }
    selectType();
  };

  if (chosen) {
    const draft = drafts[chosen];
    if (!draft) {
      return (
        <Screen edges={['top', 'bottom']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="title2" center>Recovery track unavailable</Text>
            <Text variant="body" dim center style={{ marginTop: spacing.sm }}>
              Its saved setup could not be loaded. Your existing history has not been changed.
            </Text>
            <Button label="Close" kind="secondary" onPress={close} style={{ marginTop: spacing.xl }} />
          </View>
        </Screen>
      );
    }
    const label = addictionMeta(chosen).label;
    return (
      <RecoveryTrackSetupFlow
        trackOrder={[chosen]}
        drafts={drafts}
        onDraftChange={(type, nextDraft) => {
          setDirty(true);
          setDrafts((current) => ({ ...current, [type]: nextDraft }));
        }}
        onBackFromFirst={() => {
          if (mode === 'review') confirmClose();
          else setChosen(null);
        }}
        onCancel={confirmClose}
        finalLabel={mode === 'review' ? `Save ${label} setup` : `Add ${label} recovery track`}
        onComplete={(tracks) => {
          const setup = tracks[chosen];
          if (!setup) return false;
          const result = mode === 'review'
            ? completeLegacyTrackSetup(setup, { resumeIfArchived: !selected.includes(chosen) })
            : addRecoveryTrack(setup);
          if (result !== 'completed' && result !== 'added') {
            const message = result === 'archived_exists'
              ? 'This track has archived history. Resume it from Profile instead.'
              : 'The track could not be saved. Review the answers and try again.';
            Alert.alert('Could not save track', message);
            return false;
          }
          allowClose.current = true;
          clearStoredDraft();
          router.back();
          return true;
        }}
      />
    );
  }

  const choices = ADDICTIONS.filter(
    (item) => !selected.includes(item.key) && recoveryByAddiction[item.key] == null,
  );
  return (
    <Screen edges={['top', 'bottom']} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl }}>
        <View style={{ flex: 1 }}>
          <Text variant="title1">Add recovery track</Text>
          <Text variant="body" dim style={{ marginTop: spacing.xs }}>
            Choose a category, then answer its complete setup questions.
          </Text>
        </View>
        <Pressable
          onPress={confirmClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel adding recovery track"
          style={({ pressed }) => ({
            minWidth: 60,
            minHeight: 44,
            alignItems: 'flex-end',
            justifyContent: 'center',
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text variant="callout" color={theme.color.primary}>Cancel</Text>
        </Pressable>
      </View>

      {choices.length ? (
        <Card padding={0}>
          {choices.map((item, index) => {
            return (
              <Pressable
                key={item.key}
                onPress={() => choose(item.key)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint="Opens recovery track setup"
                style={({ pressed }) => ({
                  minHeight: 62,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.lg,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.color.hairline,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="callout">{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.round, backgroundColor: theme.color.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={26} color={theme.color.primary} />
          </View>
          <Text variant="title2" center style={{ marginTop: spacing.lg }}>No new categories available</Text>
          <Text variant="body" dim center style={{ marginTop: spacing.sm }}>
            Resume saved archived tracks from Profile so their history stays intact.
          </Text>
          <Button label="Done" kind="secondary" onPress={close} style={{ marginTop: spacing.xl }} />
        </View>
      )}
    </Screen>
  );
}

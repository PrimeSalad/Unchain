import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Mascot } from '../components/Mascot';
import { ProgressBar } from '../components/ProgressBar';
import {
  RecoveryTrackSetupFlow,
  type RecoveryTrackDraftMap,
} from '../components/RecoveryTrackSetupFlow';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '@/application/store';
import { ADDICTIONS, addictionMeta, type AddictionType } from '@/domain/gambling';
import {
  GOAL_MODES,
  createRecoveryTrackDraft,
  normalizeRecoveryTrackDraft,
  type RecoveryTrackDraft,
} from '@/domain/recoveryTrackSetup';

type IntroStep = 'welcome' | 'identity' | 'type' | 'tracks';
const ONBOARDING_DRAFT_KEY = 'unchainly-onboarding-setup-draft-v1';

function safeDraft(type: AddictionType, value: unknown): RecoveryTrackDraft {
  const base = createRecoveryTrackDraft(type);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const raw = value as Partial<RecoveryTrackDraft>;
  const rawExpense = raw.expense && typeof raw.expense === 'object' ? raw.expense : undefined;
  return normalizeRecoveryTrackDraft({
    ...base,
    addictionType: type,
    ...(typeof raw.addictionDetail === 'string' ? { addictionDetail: raw.addictionDetail } : {}),
    goalMode: GOAL_MODES.includes(raw.goalMode as any) ? raw.goalMode! : base.goalMode,
    startedAtLocalMidnight: typeof raw.startedAtLocalMidnight === 'number' && Number.isFinite(raw.startedAtLocalMidnight)
      ? raw.startedAtLocalMidnight
      : base.startedAtLocalMidnight,
    ...(base.expense
      ? {
          expense: {
            amount: typeof rawExpense?.amount === 'number' && Number.isFinite(rawExpense.amount)
              ? rawExpense.amount
              : base.expense.amount,
            period: ['daily', 'weekly', 'monthly'].includes(rawExpense?.period as string)
              ? rawExpense!.period
              : base.expense.period,
            currency: typeof rawExpense?.currency === 'string' && rawExpense.currency.trim()
              ? rawExpense.currency
              : base.expense.currency,
          },
        }
      : {}),
    ...(typeof raw.timeBaselineMinutes === 'number' && Number.isFinite(raw.timeBaselineMinutes)
      ? { timeBaselineMinutes: raw.timeBaselineMinutes }
      : {}),
    triggers: Array.isArray(raw.triggers)
      ? raw.triggers.filter((item): item is string => typeof item === 'string')
      : [],
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  });
}

function hasPersonalAnswers(draft: RecoveryTrackDraftMap[AddictionType]): boolean {
  if (!draft) return false;
  const defaults = createRecoveryTrackDraft(draft.addictionType);
  return Boolean(
    draft.addictionDetail?.trim()
    || draft.reason.trim()
    || draft.triggers.length
    || draft.timeBaselineMinutes
    || draft.expense?.amount
    || draft.goalMode !== defaults.goalMode
    || draft.startedAtLocalMidnight !== defaults.startedAtLocalMidnight
    || draft.expense?.period !== defaults.expense?.period
    || draft.expense?.currency !== defaults.expense?.currency,
  );
}

export function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const completeSetupV2 = useStore((state) => state.completeSetupV2);
  const [step, setStep] = useState<IntroStep>('welcome');
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [selected, setSelected] = useState<AddictionType[]>([]);
  const [drafts, setDrafts] = useState<RecoveryTrackDraftMap>({});
  const [restored, setRestored] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(ONBOARDING_DRAFT_KEY)
      .then((stored) => {
        if (!mounted || !stored) return;
        const parsed = JSON.parse(stored) as any;
        const validTypes = new Set(ADDICTIONS.map((item) => item.key));
        const restoredSelected: AddictionType[] = Array.isArray(parsed.selected)
          ? Array.from(new Set<AddictionType>(
              (parsed.selected as unknown[]).filter((item: unknown): item is AddictionType => (
                typeof item === 'string' && validTypes.has(item as AddictionType)
              )),
            ))
          : [];
        const restoredDrafts: RecoveryTrackDraftMap = {};
        for (const type of restoredSelected) restoredDrafts[type] = safeDraft(type, parsed.drafts?.[type]);
        const restoredStep: IntroStep = ['welcome', 'identity', 'type', 'tracks'].includes(parsed.step)
          ? parsed.step
          : 'welcome';
        setNickname(typeof parsed.nickname === 'string' ? parsed.nickname : '');
        setAge(typeof parsed.age === 'string' ? parsed.age : '');
        setSelected(restoredSelected);
        setDrafts(restoredDrafts);
        setStep(restoredStep === 'tracks' && restoredSelected.length === 0 ? 'type' : restoredStep);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setRestored(true);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!restored || completedRef.current) return;
    const timer = setTimeout(() => {
      if (completedRef.current) return;
      AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({
        step,
        nickname,
        age,
        selected,
        drafts,
      })).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [age, drafts, nickname, restored, selected, step]);

  const updateDraft = (type: AddictionType, draft: NonNullable<RecoveryTrackDraftMap[AddictionType]>) => {
    setDrafts((current) => ({ ...current, [type]: draft }));
  };

  const addType = (type: AddictionType) => {
    setSelected((current) => [...current, type]);
    setDrafts((current) => current[type]
      ? current
      : { ...current, [type]: createRecoveryTrackDraft(type) });
  };

  const removeType = (type: AddictionType) => {
    setSelected((current) => current.filter((item) => item !== type));
    setDrafts((current) => {
      const next = { ...current };
      delete next[type];
      return next;
    });
  };

  const toggleType = (type: AddictionType) => {
    if (!selected.includes(type)) {
      addType(type);
      return;
    }
    if (!hasPersonalAnswers(drafts[type])) {
      removeType(type);
      return;
    }
    Alert.alert(
      `Discard ${addictionMeta(type).label} setup?`,
      'The answers entered for this recovery track will be removed.',
      [
        { text: 'Keep track', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => removeType(type) },
      ],
    );
  };

  if (!restored) return null;

  if (step === 'tracks') {
    return (
      <RecoveryTrackSetupFlow
        trackOrder={selected}
        drafts={drafts}
        onDraftChange={updateDraft}
        onBackFromFirst={() => setStep('type')}
        onCancel={() => setStep('type')}
        finalLabel="Start recovery"
        onComplete={(tracks) => {
          const result = completeSetupV2({
            account: {
              name: nickname.trim(),
              ...(age ? { age: Number(age) } : {}),
            },
            activeTrack: selected[0],
            trackOrder: selected,
            tracks,
          });
          if (!result.ok) {
            Alert.alert('Review your setup', result.issues[0]?.message ?? 'Please review every recovery track.');
            return false;
          }
          completedRef.current = true;
          AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY).catch(() => {});
          // Give Zustand persist middleware time to flush to AsyncStorage
          // before navigating, so the home screen rehydrates from fresh data.
          setTimeout(() => router.replace('/disclaimer'), 200);
          return true;
        }}
      />
    );
  }

  const introSteps: IntroStep[] = ['welcome', 'identity', 'type'];
  const index = introSteps.indexOf(step);
  const inputStyle = {
    minHeight: 52,
    borderRadius: radius.input,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.hairline,
    padding: spacing.lg,
    color: theme.color.text,
    fontSize: 17,
  } as const;

  return (
    <Screen edges={['top', 'bottom']} scroll contentStyle={step === 'welcome' ? { flexGrow: 1 } : undefined}>
      {index > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
          <Pressable
            onPress={() => setStep(index === 1 ? 'welcome' : 'identity')}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radius.round,
              backgroundColor: theme.color.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar
              progress={(index + 1) / introSteps.length}
              height={8}
              accessibilityLabel={`Onboarding step ${index + 1} of ${introSteps.length}`}
            />
          </View>
          <Text variant="footnote" dim style={{ fontVariant: ['tabular-nums'] }}>
            {index + 1}/{introSteps.length}
          </Text>
        </View>
      ) : null}

      {step === 'welcome' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state="happy" size={180} motion="hero" interactive />
          <Text variant="display" center style={{ marginTop: spacing.lg, fontSize: 34, lineHeight: 40 }}>
            Welcome to Unchainly
          </Text>
          <Text variant="body" dim center style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
            Your private recovery companion. Every track keeps its own answers and history, entirely on this device.
          </Text>
          <Button label="Get started" onPress={() => setStep('identity')} full style={{ marginTop: spacing.xxxl }} />
        </View>
      ) : null}

      {step === 'identity' ? (
        <View>
          <Text variant="title1">What should we call you?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
            Enter this once. Your recovery answers will stay separate for each category.
          </Text>
          <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>Nickname</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="Your nickname"
            placeholderTextColor={theme.color.textDim}
            accessibilityLabel="Nickname"
            autoCapitalize="words"
            maxLength={60}
            style={inputStyle}
          />
          <Text variant="footnote" dim style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Age (optional)</Text>
          <TextInput
            value={age}
            onChangeText={(value) => {
              const cleaned = value.replace(/\D/g, '').slice(0, 3);
              if (!cleaned || Number(cleaned) <= 100) setAge(cleaned);
            }}
            placeholder="Your age"
            placeholderTextColor={theme.color.textDim}
            accessibilityLabel="Age, optional"
            keyboardType="number-pad"
            style={inputStyle}
          />
          <Button
            label="Continue"
            onPress={() => setStep('type')}
            disabled={!nickname.trim() || Boolean(age && Number(age) < 1)}
            full
            style={{ marginTop: spacing.xl }}
          />
        </View>
      ) : null}

      {step === 'type' ? (
        <View>
          <Text variant="title1">What are you working on?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            Choose one or more. You’ll answer the right questions for every selected track.
          </Text>
          <Card padding={0}>
            {ADDICTIONS.map((addiction, itemIndex) => {
              const active = selected.includes(addiction.key);
              return (
                <Pressable
                  key={addiction.key}
                  onPress={() => toggleType(addiction.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={addiction.label}
                  style={({ pressed }) => ({
                    minHeight: 56,
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.lg,
                    borderTopWidth: itemIndex === 0 ? 0 : 1,
                    borderTopColor: theme.color.hairline,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text variant="callout" style={{ flex: 1 }} color={active ? theme.color.primary : theme.color.text}>
                    {addiction.label}
                  </Text>
                  <Ionicons
                    name={active ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={active ? theme.color.primary : theme.color.textDim}
                  />
                </Pressable>
              );
            })}
          </Card>
          <Text variant="footnote" dim style={{ marginTop: spacing.md }}>
            {selected.length
              ? `${selected.length} selected · ${addictionMeta(selected[0]).label} will open first.`
              : 'Select at least one recovery category.'}
          </Text>
          <Button
            label={selected.length > 1 ? `Set up ${selected.length} tracks` : 'Set up recovery track'}
            onPress={() => setStep('tracks')}
            disabled={selected.length === 0}
            full
            style={{ marginTop: spacing.xl }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

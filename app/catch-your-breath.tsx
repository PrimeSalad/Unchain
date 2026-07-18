/**
 * Catch Your Breath - weekly assessment questionnaire.
 * Route: /catch-your-breath
 *
 * Questions-only wizard. No intro, no cooldown, no done screen.
 * Those all belong in the log screen (/catch-your-breath-log).
 * After submission, navigates back to the log screen.
 */

import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import {
  type BreathingRating,
  type BreathingComparison,
  type CoughFrequency,
  type MucusFrequency,
  type ShortnessOfBreathLevel,
  type WheezingFrequency,
  type ChestDiscomfortFrequency,
  type ActivityTolerance,
  type SmokingFrequency,
} from '@/domain/catchYourBreath';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Step IDs ──────────────────────────────────────────────────────────────

type StepId =
  | 'breathing'
  | 'comparison'
  | 'cough'
  | 'mucus'
  | 'shortness'
  | 'wheezing'
  | 'chest'
  | 'activity'
  | 'smoking'
  | 'notes';

const STEPS: StepId[] = [
  'breathing', 'comparison', 'cough', 'mucus',
  'shortness', 'wheezing', 'chest', 'activity', 'smoking', 'notes',
];

// ── Option lists ──────────────────────────────────────────────────────────

const BREATHING_OPTIONS: readonly BreathingRating[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'];
const COMPARISON_OPTIONS: readonly BreathingComparison[] = ['Much Better', 'Slightly Better', 'About the Same', 'Slightly Worse', 'Much Worse'];
const COUGH_OPTIONS: readonly CoughFrequency[] = ['Never', 'Occasionally', 'Frequently', 'Almost Every Day'];
const MUCUS_OPTIONS: readonly MucusFrequency[] = ['No', 'Occasionally', 'Frequently'];
const SHORTNESS_OPTIONS: readonly ShortnessOfBreathLevel[] = [
  'I rarely get out of breath',
  'After climbing several flights of stairs',
  'After one flight of stairs',
  'During light walking',
  'Even while resting',
];
const WHEEZING_OPTIONS: readonly WheezingFrequency[] = ['Never', 'Sometimes', 'Often'];
const CHEST_OPTIONS: readonly ChestDiscomfortFrequency[] = ['Never', 'Sometimes', 'Frequently'];
const ACTIVITY_OPTIONS: readonly ActivityTolerance[] = ['More than 30 minutes', '15–30 minutes', '5–15 minutes', 'Less than 5 minutes'];
const SMOKING_OPTIONS: readonly SmokingFrequency[] = ["I didn't smoke", 'Less than usual', 'About the same', 'More than usual'];

// ── Sub-components ────────────────────────────────────────────────────────

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{title}</Text>
      {subtitle ? (
        <Text variant="callout" color={theme.color.textDim} style={{ marginTop: spacing.xs, lineHeight: 22 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function OptionSegment<T extends string>({
  options, selected, onSelect,
}: { options: readonly T[]; selected: T | null; onSelect: (v: T) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'column', gap: spacing.sm }}>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect(opt); }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderRadius: radius.card,
              backgroundColor: active ? theme.color.primarySoft : theme.color.surface,
              borderWidth: 1,
              borderColor: active ? theme.color.primary : theme.color.hairline,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 22, height: 22, borderRadius: 11,
                borderWidth: 2,
                borderColor: active ? theme.color.primary : theme.color.hairline,
                backgroundColor: active ? theme.color.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {active && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text variant="callout" color={active ? theme.color.primary : theme.color.text} style={{ flex: 1, lineHeight: 22 }}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────

export default function CatchYourBreath() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack('/catch-your-breath-log');
  const insets = useSafeAreaInsets();
  const addCatchYourBreath = useStore((s) => s.addCatchYourBreath);

  const [stepIdx, setStepIdx] = useState(0);
  const steps = STEPS;
  const currentStep = steps[stepIdx];
  const totalSteps = steps.length;
  const isLastStep = stepIdx === totalSteps - 1;
  const progress = Math.min(1, (stepIdx + 1) / totalSteps);

  // ── Form state ──────────────────────────────────────────────────────────
  const [breathing, setBreathing] = useState<BreathingRating | null>(null);
  const [comparison, setComparison] = useState<BreathingComparison | null>(null);
  const [cough, setCough] = useState<CoughFrequency | null>(null);
  const [mucus, setMucus] = useState<MucusFrequency | null>(null);
  const [shortness, setShortness] = useState<ShortnessOfBreathLevel | null>(null);
  const [wheezing, setWheezing] = useState<WheezingFrequency | null>(null);
  const [chest, setChest] = useState<ChestDiscomfortFrequency | null>(null);
  const [activity, setActivity] = useState<ActivityTolerance | null>(null);
  const [smoking, setSmoking] = useState<SmokingFrequency | null>(null);
  const [notes, setNotes] = useState('');

  const submitting = useRef(false);

  const canAdvance = (): boolean => {
    switch (currentStep) {
      case 'breathing': return breathing != null;
      case 'comparison': return comparison != null;
      case 'cough': return cough != null;
      case 'mucus': return mucus != null;
      case 'shortness': return shortness != null;
      case 'wheezing': return wheezing != null;
      case 'chest': return chest != null;
      case 'activity': return activity != null;
      case 'smoking': return smoking != null;
      case 'notes': return true;
      default: return false;
    }
  };

  const advance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isLastStep) {
      submit();
    } else {
      setStepIdx((i) => Math.min(i + 1, totalSteps - 1));
    }
  };

  const back = () => {
    setStepIdx((i) => Math.max(0, i - 1));
  };

  const submit = () => {
    if (submitting.current) return;
    if (!breathing || !comparison || !cough || !mucus || !shortness || !wheezing || !chest || !activity || !smoking) return;
    submitting.current = true;

    addCatchYourBreath({
      breathingRating: breathing,
      breathingComparison: comparison,
      coughFrequency: cough,
      mucusFrequency: mucus,
      shortnessOfBreath: shortness,
      wheezingFrequency: wheezing,
      chestDiscomfort: chest,
      activityTolerance: activity,
      smokingFrequency: smoking,
      notes,
    });

    // Navigate back to the log screen which shows the new entry
    router.replace('/catch-your-breath-log');
  };

  // ── Question steps ──────────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 'breathing':
        return (
          <>
            <StepHeading title="How would you rate your breathing this week?" />
            <OptionSegment options={BREATHING_OPTIONS} selected={breathing} onSelect={setBreathing} />
          </>
        );
      case 'comparison':
        return (
          <>
            <StepHeading title="Compared to last week, breathing feels..." />
            <OptionSegment options={COMPARISON_OPTIONS} selected={comparison} onSelect={setComparison} />
          </>
        );
      case 'cough':
        return (
          <>
            <StepHeading title="How often did you cough this week?" />
            <OptionSegment options={COUGH_OPTIONS} selected={cough} onSelect={setCough} />
          </>
        );
      case 'mucus':
        return (
          <>
            <StepHeading title="Did you cough up mucus or phlegm?" />
            <OptionSegment options={MUCUS_OPTIONS} selected={mucus} onSelect={setMucus} />
          </>
        );
      case 'shortness':
        return (
          <>
            <StepHeading title="How quickly do you become out of breath?" />
            <OptionSegment options={SHORTNESS_OPTIONS} selected={shortness} onSelect={setShortness} />
          </>
        );
      case 'wheezing':
        return (
          <>
            <StepHeading title="Did you notice wheezing?" />
            <OptionSegment options={WHEEZING_OPTIONS} selected={wheezing} onSelect={setWheezing} />
          </>
        );
      case 'chest':
        return (
          <>
            <StepHeading title="Did you notice chest tightness or discomfort?" />
            <OptionSegment options={CHEST_OPTIONS} selected={chest} onSelect={setChest} />
          </>
        );
      case 'activity':
        return (
          <>
            <StepHeading
              title="How much activity could you comfortably do before becoming short of breath?"
            />
            <OptionSegment options={ACTIVITY_OPTIONS} selected={activity} onSelect={setActivity} />
          </>
        );
      case 'smoking':
        return (
          <>
            <StepHeading title="How often did you smoke this week?" />
            <OptionSegment options={SMOKING_OPTIONS} selected={smoking} onSelect={setSmoking} />
          </>
        );
      case 'notes':
        return (
          <>
            <StepHeading
              title="Did you notice anything different about your breathing this week?"
              subtitle="Optional - share any observations or changes you noticed."
            />
            <View style={{
              backgroundColor: theme.color.surface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              minHeight: 120,
              padding: spacing.md,
            }}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder='e.g. "I noticed I could climb the stairs more easily..."'
                placeholderTextColor={theme.color.textDim}
                multiline
                textAlignVertical="top"
                style={{
                  flex: 1,
                  minHeight: 100,
                  fontSize: 16,
                  lineHeight: 22,
                  color: theme.color.text,
                }}
              />
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable
          onPress={stepIdx > 0 ? back : safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={stepIdx > 0 ? 'Go back' : 'Cancel'}
          style={({ pressed }) => ({
            width: 40, height: 40, borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
        </Pressable>
        <Text variant="headline" style={{ flex: 1 }}>Catch Your Breath</Text>
      </View>

      {/* Progress */}
      <View style={{ marginTop: spacing.md, marginBottom: spacing.lg, gap: spacing.xs }}>
        <ProgressBar progress={progress} height={6} />
        <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
          Question {stepIdx + 1} of {totalSteps}
        </Text>
      </View>

      {/* Step content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {renderStep()}
      </ScrollView>

      {/* Next button */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom + 20}
      >
        <View style={{ paddingBottom: Math.max(insets.bottom, spacing.md) }}>
          <Button
            label={isLastStep ? 'Submit Reflection' : 'Continue'}
            onPress={advance}
            disabled={!canAdvance()}
            full
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

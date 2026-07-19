/**
 * Back on Track - weekly recovery check-in questionnaire.
 * Route: /back-on-track
 *
 * Questions-only wizard. No intro, no cooldown, no done screen.
 * Those all belong in the log screen (/back-on-track-log).
 * After submission, navigates back to the log screen.
 */

import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
  type OverallWellBeing,
  type WeekComparison,
  type EnergyLevel,
  type SleepQuality,
  type FocusLevel,
  type MoodRating,
  type CravingStrength,
  type PhysicalDiscomfort,
  type SubstanceUse,
} from '@/domain/backOnTrack';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Step IDs ──────────────────────────────────────────────────────────────

type StepId =
  | 'wellbeing'
  | 'comparison'
  | 'energy'
  | 'sleep'
  | 'focus'
  | 'mood'
  | 'cravings'
  | 'physical'
  | 'substance'
  | 'notes';

const STEPS: StepId[] = [
  'wellbeing', 'comparison', 'energy', 'sleep', 'focus',
  'mood', 'cravings', 'physical', 'substance', 'notes',
];

// ── Option lists ──────────────────────────────────────────────────────────

const WELLBEING_OPTIONS: readonly OverallWellBeing[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'];
const COMPARISON_OPTIONS: readonly WeekComparison[] = ['Much Better', 'Slightly Better', 'About the Same', 'Slightly Worse', 'Much Worse'];
const ENERGY_OPTIONS: readonly EnergyLevel[] = ['Very High', 'High', 'Average', 'Low', 'Very Low'];
const SLEEP_OPTIONS: readonly SleepQuality[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'];
const FOCUS_OPTIONS: readonly FocusLevel[] = ['Very Easy', 'Easy', 'Average', 'Difficult', 'Very Difficult'];
const MOOD_OPTIONS: readonly MoodRating[] = ['Very Positive', 'Mostly Positive', 'Neutral', 'Mostly Negative', 'Very Negative'];
const CRAVING_OPTIONS: readonly CravingStrength[] = ['None', 'Mild', 'Moderate', 'Strong', 'Very Strong'];
const PHYSICAL_OPTIONS: readonly PhysicalDiscomfort[] = ['None', 'Mild', 'Moderate', 'Severe'];
const SUBSTANCE_OPTIONS: readonly SubstanceUse[] = ['No', 'Once', 'A Few Times', 'Frequently'];

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

export default function BackOnTrack() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack('/back-on-track-log');
  const insets = useSafeAreaInsets();
  const addBackOnTrack = useStore((s) => s.addBackOnTrack);

  const [stepIdx, setStepIdx] = useState(0);
  const steps = STEPS;
  const currentStep = steps[stepIdx];
  const totalSteps = steps.length;
  const isLastStep = stepIdx === totalSteps - 1;
  const progress = Math.min(1, (stepIdx + 1) / totalSteps);

  // ── Form state ──────────────────────────────────────────────────────────
  const [wellbeing, setWellbeing] = useState<OverallWellBeing | null>(null);
  const [comparison, setComparison] = useState<WeekComparison | null>(null);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [sleep, setSleep] = useState<SleepQuality | null>(null);
  const [focus, setFocus] = useState<FocusLevel | null>(null);
  const [mood, setMood] = useState<MoodRating | null>(null);
  const [cravings, setCravings] = useState<CravingStrength | null>(null);
  const [physical, setPhysical] = useState<PhysicalDiscomfort | null>(null);
  const [substance, setSubstance] = useState<SubstanceUse | null>(null);
  const [notes, setNotes] = useState('');

  const submitting = useRef(false);

  const canAdvance = (): boolean => {
    switch (currentStep) {
      case 'wellbeing': return wellbeing != null;
      case 'comparison': return comparison != null;
      case 'energy': return energy != null;
      case 'sleep': return sleep != null;
      case 'focus': return focus != null;
      case 'mood': return mood != null;
      case 'cravings': return cravings != null;
      case 'physical': return physical != null;
      case 'substance': return substance != null;
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
    if (!wellbeing || !comparison || !energy || !sleep || !focus || !mood || !cravings || !physical || !substance) return;
    submitting.current = true;

    addBackOnTrack({
      overallWellBeing: wellbeing,
      weekComparison: comparison,
      energyLevel: energy,
      sleepQuality: sleep,
      focusLevel: focus,
      moodRating: mood,
      cravingStrength: cravings,
      physicalDiscomfort: physical,
      substanceUse: substance,
      notes,
    });

    router.replace('/back-on-track-log');
  };

  // ── Question steps ──────────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 'wellbeing':
        return (
          <>
            <StepHeading title="How would you rate your overall well-being this week?" />
            <OptionSegment options={WELLBEING_OPTIONS} selected={wellbeing} onSelect={setWellbeing} />
          </>
        );
      case 'comparison':
        return (
          <>
            <StepHeading title="Compared to last week, you feel..." />
            <OptionSegment options={COMPARISON_OPTIONS} selected={comparison} onSelect={setComparison} />
          </>
        );
      case 'energy':
        return (
          <>
            <StepHeading title="How would you rate your energy level?" />
            <OptionSegment options={ENERGY_OPTIONS} selected={energy} onSelect={setEnergy} />
          </>
        );
      case 'sleep':
        return (
          <>
            <StepHeading title="How well did you sleep this week?" />
            <OptionSegment options={SLEEP_OPTIONS} selected={sleep} onSelect={setSleep} />
          </>
        );
      case 'focus':
        return (
          <>
            <StepHeading title="How easy was it to focus or concentrate?" />
            <OptionSegment options={FOCUS_OPTIONS} selected={focus} onSelect={setFocus} />
          </>
        );
      case 'mood':
        return (
          <>
            <StepHeading title="How would you describe your mood this week?" />
            <OptionSegment options={MOOD_OPTIONS} selected={mood} onSelect={setMood} />
          </>
        );
      case 'cravings':
        return (
          <>
            <StepHeading title="How strong were your cravings this week?" />
            <OptionSegment options={CRAVING_OPTIONS} selected={cravings} onSelect={setCravings} />
          </>
        );
      case 'physical':
        return (
          <>
            <StepHeading
              title="Did you experience any physical discomfort this week?"
              subtitle="Examples include headaches, fatigue, muscle aches, restlessness, or similar recovery-related discomforts."
            />
            <OptionSegment options={PHYSICAL_OPTIONS} selected={physical} onSelect={setPhysical} />
          </>
        );
      case 'substance':
        return (
          <>
            <StepHeading title="Did you use drugs or substances this week?" />
            <OptionSegment options={SUBSTANCE_OPTIONS} selected={substance} onSelect={setSubstance} />
          </>
        );
      case 'notes':
        return (
          <>
            <StepHeading
              title="What did you notice about yourself this week?"
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
                placeholder={"e.g. \"I had more energy, found it easier to focus, and my cravings weren't as intense...\""}
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
        <Text variant="headline" style={{ flex: 1 }}>Back on Track</Text>
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
            label={isLastStep ? 'Submit Check-In' : 'Continue'}
            onPress={advance}
            disabled={!canAdvance()}
            full
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

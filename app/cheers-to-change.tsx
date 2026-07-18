/**
 * Cheers to Change - weekly assessment questionnaire (alcohol addiction only).
 * Route: /cheers-to-change
 *
 * Questions-only wizard. After submission, navigates back to the log screen.
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
  type PhysicalHealthRating,
  type BodyComparison,
  type EnergyLevel,
  type SleepQuality,
  type HeadacheFrequency,
  type DigestiveIssues,
  type HydrationLevel,
  type MoodRating,
  type DrinkingDays,
} from '@/domain/cheersToChange';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Step IDs ──────────────────────────────────────────────────────────────

type StepId =
  | 'physical'
  | 'comparison'
  | 'energy'
  | 'sleep'
  | 'headaches'
  | 'digestion'
  | 'hydration'
  | 'mood'
  | 'drinking'
  | 'notes';

const STEPS: StepId[] = [
  'physical', 'comparison', 'energy', 'sleep', 'headaches',
  'digestion', 'hydration', 'mood', 'drinking', 'notes',
];

// ── Option lists ──────────────────────────────────────────────────────────

const PHYSICAL_OPTIONS: readonly PhysicalHealthRating[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'];
const COMPARISON_OPTIONS: readonly BodyComparison[] = ['Much Better', 'Slightly Better', 'About the Same', 'Slightly Worse', 'Much Worse'];
const ENERGY_OPTIONS: readonly EnergyLevel[] = ['Very High', 'Good', 'Average', 'Low', 'Very Low'];
const SLEEP_OPTIONS: readonly SleepQuality[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'];
const HEADACHE_OPTIONS: readonly HeadacheFrequency[] = ['Never', 'Occasionally', 'Frequently'];
const DIGESTION_OPTIONS: readonly DigestiveIssues[] = ['Never', 'Occasionally', 'Frequently'];
const HYDRATION_OPTIONS: readonly HydrationLevel[] = ['Very Well Hydrated', 'Mostly Hydrated', 'Sometimes Dehydrated', 'Frequently Dehydrated'];
const MOOD_OPTIONS: readonly MoodRating[] = ['Very Positive', 'Mostly Positive', 'Neutral', 'Mostly Negative', 'Very Negative'];
const DRINKING_OPTIONS: readonly DrinkingDays[] = ['None', '1–2 Days', '3–4 Days', '5–7 Days'];

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

export default function CheersToChange() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack('/cheers-to-change-log');
  const insets = useSafeAreaInsets();
  const addCheersToChange = useStore((s) => s.addCheersToChange);

  const [stepIdx, setStepIdx] = useState(0);
  const steps = STEPS;
  const currentStep = steps[stepIdx];
  const totalSteps = steps.length;
  const isLastStep = stepIdx === totalSteps - 1;
  const progress = Math.min(1, (stepIdx + 1) / totalSteps);

  // ── Form state ──────────────────────────────────────────────────────────
  const [physical, setPhysical] = useState<PhysicalHealthRating | null>(null);
  const [comparison, setComparison] = useState<BodyComparison | null>(null);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [sleep, setSleep] = useState<SleepQuality | null>(null);
  const [headaches, setHeadaches] = useState<HeadacheFrequency | null>(null);
  const [digestion, setDigestion] = useState<DigestiveIssues | null>(null);
  const [hydration, setHydration] = useState<HydrationLevel | null>(null);
  const [mood, setMood] = useState<MoodRating | null>(null);
  const [drinking, setDrinking] = useState<DrinkingDays | null>(null);
  const [notes, setNotes] = useState('');

  const submitting = useRef(false);

  const canAdvance = (): boolean => {
    switch (currentStep) {
      case 'physical': return physical != null;
      case 'comparison': return comparison != null;
      case 'energy': return energy != null;
      case 'sleep': return sleep != null;
      case 'headaches': return headaches != null;
      case 'digestion': return digestion != null;
      case 'hydration': return hydration != null;
      case 'mood': return mood != null;
      case 'drinking': return drinking != null;
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
    if (!physical || !comparison || !energy || !sleep || !headaches || !digestion || !hydration || !mood || !drinking) return;
    submitting.current = true;

    addCheersToChange({
      physicalHealth: physical,
      bodyComparison: comparison,
      energyLevel: energy,
      sleepQuality: sleep,
      headacheFrequency: headaches,
      digestiveIssues: digestion,
      hydrationLevel: hydration,
      moodRating: mood,
      drinkingDays: drinking,
      notes,
    });

    router.replace('/cheers-to-change-log');
  };

  // ── Question steps ──────────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 'physical':
        return (
          <>
            <StepHeading title="How would you rate your overall physical health this week?" />
            <OptionSegment options={PHYSICAL_OPTIONS} selected={physical} onSelect={setPhysical} />
          </>
        );
      case 'comparison':
        return (
          <>
            <StepHeading title="Compared to last week, your body feels..." />
            <OptionSegment options={COMPARISON_OPTIONS} selected={comparison} onSelect={setComparison} />
          </>
        );
      case 'energy':
        return (
          <>
            <StepHeading title="How would you rate your energy levels this week?" />
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
      case 'headaches':
        return (
          <>
            <StepHeading title="Did you experience headaches this week?" />
            <OptionSegment options={HEADACHE_OPTIONS} selected={headaches} onSelect={setHeadaches} />
          </>
        );
      case 'digestion':
        return (
          <>
            <StepHeading title="Did you notice stomach discomfort, nausea, or digestive issues?" />
            <OptionSegment options={DIGESTION_OPTIONS} selected={digestion} onSelect={setDigestion} />
          </>
        );
      case 'hydration':
        return (
          <>
            <StepHeading title="How hydrated did you feel throughout the week?" />
            <OptionSegment options={HYDRATION_OPTIONS} selected={hydration} onSelect={setHydration} />
          </>
        );
      case 'mood':
        return (
          <>
            <StepHeading title="How would you describe your mood this week?" />
            <OptionSegment options={MOOD_OPTIONS} selected={mood} onSelect={setMood} />
          </>
        );
      case 'drinking':
        return (
          <>
            <StepHeading title="How many days did you drink alcohol this week?" />
            <OptionSegment options={DRINKING_OPTIONS} selected={drinking} onSelect={setDrinking} />
          </>
        );
      case 'notes':
        return (
          <>
            <StepHeading
              title="What positive or noticeable changes did you experience this week?"
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
                placeholder='e.g. "I woke up feeling more rested and had more energy..."'
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
        <Text variant="headline" style={{ flex: 1 }}>Cheers to Change</Text>
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

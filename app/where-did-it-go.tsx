/**
 * Where Did It Go? - weekly financial self-reflection questionnaire.
 * Route: /where-did-it-go
 *
 * Questions-only wizard. No intro, no cooldown, no done screen.
 * Those all belong in the log screen (/where-did-it-go-log).
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
  type FinancialConfidence,
  type GamblingUrges,
  type DidYouGamble,
  type SpendingSatisfaction,
  type DidYouSave,
  type MeaningfulSpending,
  type SpendingControl,
} from '@/domain/whereDidItGo';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Step IDs ──────────────────────────────────────────────────────────────

type StepId =
  | 'confidence'
  | 'urges'
  | 'gambling'
  | 'satisfaction'
  | 'save'
  | 'meaningful'
  | 'control'
  | 'notes';

const STEPS: StepId[] = [
  'confidence', 'urges', 'gambling', 'satisfaction',
  'save', 'meaningful', 'control', 'notes',
];

// ── Option lists ──────────────────────────────────────────────────────────

const CONFIDENCE_OPTIONS: readonly FinancialConfidence[] = ['Very Confident', 'Confident', 'Neutral', 'Uncertain', 'Very Uncertain'];
const URGES_OPTIONS: readonly GamblingUrges[] = ['None', 'Mild', 'Moderate', 'Strong', 'Very Strong'];
const GAMBLING_OPTIONS: readonly DidYouGamble[] = ['No', 'Once', 'A Few Times', 'Frequently'];
const SATISFACTION_OPTIONS: readonly SpendingSatisfaction[] = ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'];
const SAVE_OPTIONS: readonly DidYouSave[] = ['Yes', 'No', 'Not Applicable'];
const MEANINGFUL_OPTIONS: readonly MeaningfulSpending[] = ['Yes', 'No', 'Not Sure'];
const CONTROL_OPTIONS: readonly SpendingControl[] = ['Much More', 'Slightly More', 'About the Same', 'Slightly Less', 'Much Less'];

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
            onPress={() => { Haptics.selectionAsync(); onSelect(opt); }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderRadius: radius.input,
              borderWidth: 1.5,
              borderColor: active ? theme.color.primary : theme.color.hairline,
              backgroundColor: active ? theme.color.primarySoft : theme.color.surface,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              borderWidth: 2,
              borderColor: active ? theme.color.primary : theme.color.textDim,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.color.primary }} />}
            </View>
            <Text variant="callout" style={{ color: active ? theme.color.primary : theme.color.text, flex: 1 }}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function WhereDidItGoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const back = useSafeBack('/where-did-it-go-log');
  const insets = useSafeAreaInsets();

  const saveEntry = useStore((s) => s.saveWhereDidItGoEntry);

  const [step, setStep] = useState(0);
  const [confidence, setConfidence] = useState<FinancialConfidence | null>(null);
  const [urges, setUrges] = useState<GamblingUrges | null>(null);
  const [gambling, setGambling] = useState<DidYouGamble | null>(null);
  const [satisfaction, setSatisfaction] = useState<SpendingSatisfaction | null>(null);
  const [save, setSave] = useState<DidYouSave | null>(null);
  const [meaningful, setMeaningful] = useState<MeaningfulSpending | null>(null);
  const [control, setControl] = useState<SpendingControl | null>(null);
  const [notes, setNotes] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  const current = STEPS[step];
  const progress = (step + 1) / STEPS.length;

  const canNext = (() => {
    switch (current) {
      case 'confidence': return confidence != null;
      case 'urges': return urges != null;
      case 'gambling': return gambling != null;
      case 'satisfaction': return satisfaction != null;
      case 'save': return save != null;
      case 'meaningful': return meaningful != null;
      case 'control': return control != null;
      case 'notes': return true;
      default: return false;
    }
  })();

  const next = () => {
    if (!canNext) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      // Submit
      saveEntry({
        financialConfidence: confidence!,
        gamblingUrges: urges!,
        didYouGamble: gambling!,
        spendingSatisfaction: satisfaction!,
        didYouSave: save!,
        meaningfulSpending: meaningful!,
        spendingControl: control!,
        notes,
      });
      router.replace('/where-did-it-go-log');
    }
  };

  const prev = () => {
    if (step > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      router.back();
    }
  };

  const renderStep = () => {
    switch (current) {
      case 'confidence':
        return (
          <>
            <StepHeading
              title="Financial Confidence"
              subtitle="Looking back over the past week, how confident did you feel about your finances?"
            />
            <OptionSegment options={CONFIDENCE_OPTIONS} selected={confidence} onSelect={setConfidence} />
          </>
        );
      case 'urges':
        return (
          <>
            <StepHeading
              title="Gambling Urges"
              subtitle="During the past week, how often did you experience gambling urges?"
            />
            <OptionSegment options={URGES_OPTIONS} selected={urges} onSelect={setUrges} />
          </>
        );
      case 'gambling':
        return (
          <>
            <StepHeading
              title="Did You Gamble?"
              subtitle="Did you gamble at any point this week?"
            />
            <OptionSegment options={GAMBLING_OPTIONS} selected={gambling} onSelect={setGambling} />
          </>
        );
      case 'satisfaction':
        return (
          <>
            <StepHeading
              title="Spending Satisfaction"
              subtitle="How satisfied are you with how you spent your money this week?"
            />
            <OptionSegment options={SATISFACTION_OPTIONS} selected={satisfaction} onSelect={setSatisfaction} />
          </>
        );
      case 'save':
        return (
          <>
            <StepHeading
              title="Did You Save?"
              subtitle="Were you able to save money this week?"
            />
            <OptionSegment options={SAVE_OPTIONS} selected={save} onSelect={setSave} />
          </>
        );
      case 'meaningful':
        return (
          <>
            <StepHeading
              title="Meaningful Spending"
              subtitle="Did you spend money on something meaningful or necessary?"
            />
            <OptionSegment options={MEANINGFUL_OPTIONS} selected={meaningful} onSelect={setMeaningful} />
          </>
        );
      case 'control':
        return (
          <>
            <StepHeading
              title="Spending Control"
              subtitle="Compared to last week, do you feel more in control of your spending?"
            />
            <OptionSegment options={CONTROL_OPTIONS} selected={control} onSelect={setControl} />
          </>
        );
      case 'notes':
        return (
          <>
            <StepHeading
              title="What did you notice?"
              subtitle="What did you notice about your financial habits this week? (Optional)"
            />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any thoughts or reflections..."
              placeholderTextColor={theme.color.textDim}
              multiline
              textAlignVertical="top"
              style={{
                backgroundColor: theme.color.surface,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                borderRadius: radius.input,
                padding: spacing.md,
                minHeight: 120,
                color: theme.color.text,
                fontSize: 16,
                lineHeight: 22,
              }}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Screen background={theme.color.bg}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingTop: spacing.xl,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
      }}>
        <Pressable
          onPress={prev}
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? 'Go back' : 'Previous step'}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: spacing.xs })}
        >
          <Ionicons name="chevron-back" size={22} color={theme.color.text} />
        </Pressable>
        <Text variant="headline" style={{ flex: 1 }}>Where Did It Go?</Text>
        <Text variant="caption" dim>{step + 1}/{STEPS.length}</Text>
      </View>

      <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
        <ProgressBar progress={progress} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Next / Submit */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.lg,
        paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
        backgroundColor: theme.color.bg,
        borderTopWidth: 1,
        borderTopColor: theme.color.hairline,
      }}>
        <Button
          kind="primary"
          label={step === STEPS.length - 1 ? 'Submit Reflection' : 'Next'}
          onPress={next}
          disabled={!canNext}
        />
      </View>
    </Screen>
  );
}
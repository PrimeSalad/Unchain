/**
 * Press Pause - weekly balance reflection questionnaire.
 * Route: /press-pause
 *
 * Questions-only wizard. No intro, no cooldown, no done screen.
 * Those all belong in the log screen (/press-pause-log).
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
  type TimeSatisfaction,
  type GamingTime,
  type Interference,
  type PhysicalActivity,
  type SleepQuality,
  type SocialTime,
  type BalanceLevel,
} from '@/domain/pressPause';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Step IDs ──────────────────────────────────────────────────────────────

type StepId =
  | 'satisfaction'
  | 'gamingTime'
  | 'interference'
  | 'physical'
  | 'sleep'
  | 'social'
  | 'balance'
  | 'notes';

const STEPS: StepId[] = [
  'satisfaction', 'gamingTime', 'interference', 'physical',
  'sleep', 'social', 'balance', 'notes',
];

// ── Option lists ──────────────────────────────────────────────────────────

const SATISFACTION_OPTIONS: readonly TimeSatisfaction[] = ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'];
const GAMING_TIME_OPTIONS: readonly GamingTime[] = ['Less than 1 hour', '1-2 hours', '2-4 hours', '4-6 hours', 'More than 6 hours'];
const INTERFERENCE_OPTIONS: readonly Interference[] = ['No', 'Once', 'A Few Times', 'Frequently'];
const PHYSICAL_OPTIONS: readonly PhysicalActivity[] = ['Yes', 'No', 'Not Applicable'];
const SLEEP_OPTIONS: readonly SleepQuality[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'];
const SOCIAL_OPTIONS: readonly SocialTime[] = ['Yes', 'No', 'Not Applicable'];
const BALANCE_OPTIONS: readonly BalanceLevel[] = ['Much More Balanced', 'Slightly More Balanced', 'About the Same', 'Slightly Less Balanced', 'Much Less Balanced'];

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

export default function PressPauseScreen() {
  const router = useRouter();
  const theme = useTheme();
  const back = useSafeBack('/press-pause-log');
  const insets = useSafeAreaInsets();

  const saveEntry = useStore((s) => s.savePressPauseEntry);

  const [step, setStep] = useState(0);
  const [satisfaction, setSatisfaction] = useState<TimeSatisfaction | null>(null);
  const [gamingTime, setGamingTime] = useState<GamingTime | null>(null);
  const [interference, setInterference] = useState<Interference | null>(null);
  const [physical, setPhysical] = useState<PhysicalActivity | null>(null);
  const [sleep, setSleep] = useState<SleepQuality | null>(null);
  const [social, setSocial] = useState<SocialTime | null>(null);
  const [balance, setBalance] = useState<BalanceLevel | null>(null);
  const [notes, setNotes] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  const current = STEPS[step];
  const progress = (step + 1) / STEPS.length;

  const canNext = (() => {
    switch (current) {
      case 'satisfaction': return satisfaction != null;
      case 'gamingTime': return gamingTime != null;
      case 'interference': return interference != null;
      case 'physical': return physical != null;
      case 'sleep': return sleep != null;
      case 'social': return social != null;
      case 'balance': return balance != null;
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
        timeSatisfaction: satisfaction!,
        gamingTime: gamingTime!,
        interference: interference!,
        physicalActivity: physical!,
        sleepQuality: sleep!,
        socialTime: social!,
        balanceLevel: balance!,
        notes,
      });
      router.replace('/press-pause-log');
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
      case 'satisfaction':
        return (
          <>
            <StepHeading
              title="Time Satisfaction"
              subtitle="Looking back this week, how satisfied are you with how you spent your time?"
            />
            <OptionSegment options={SATISFACTION_OPTIONS} selected={satisfaction} onSelect={setSatisfaction} />
          </>
        );
      case 'gamingTime':
        return (
          <>
            <StepHeading
              title="Gaming Time"
              subtitle="Approximately how much time did you spend gaming this week?"
            />
            <OptionSegment options={GAMING_TIME_OPTIONS} selected={gamingTime} onSelect={setGamingTime} />
          </>
        );
      case 'interference':
        return (
          <>
            <StepHeading
              title="Interference"
              subtitle="Did gaming interfere with responsibilities at any point this week?"
            />
            <OptionSegment options={INTERFERENCE_OPTIONS} selected={interference} onSelect={setInterference} />
          </>
        );
      case 'physical':
        return (
          <>
            <StepHeading
              title="Physical Activity"
              subtitle="Did you make time for physical activity?"
            />
            <OptionSegment options={PHYSICAL_OPTIONS} selected={physical} onSelect={setPhysical} />
          </>
        );
      case 'sleep':
        return (
          <>
            <StepHeading
              title="Sleep Quality"
              subtitle="How well did you sleep throughout the week?"
            />
            <OptionSegment options={SLEEP_OPTIONS} selected={sleep} onSelect={setSleep} />
          </>
        );
      case 'social':
        return (
          <>
            <StepHeading
              title="Social Time"
              subtitle="Did you spend meaningful time with family or friends?"
            />
            <OptionSegment options={SOCIAL_OPTIONS} selected={social} onSelect={setSocial} />
          </>
        );
      case 'balance':
        return (
          <>
            <StepHeading
              title="Daily Balance"
              subtitle="Compared to last week, do you feel your gaming habits were more balanced?"
            />
            <OptionSegment options={BALANCE_OPTIONS} selected={balance} onSelect={setBalance} />
          </>
        );
      case 'notes':
        return (
          <>
            <StepHeading
              title="What did you notice?"
              subtitle="What did you notice about your gaming habits this week? (Optional)"
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
        <Text variant="headline" style={{ flex: 1 }}>Press Pause</Text>
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
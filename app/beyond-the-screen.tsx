/**
 * Beyond the Screen - weekly well-being reflection questionnaire.
 * Route: /beyond-the-screen
 *
 * Questions-only wizard. No intro, no cooldown, no done screen.
 * Those all belong in the log screen (/beyond-the-screen-log).
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
  type FocusLevel,
  type MotivationLevel,
  type ConfidenceLevel,
  type UrgeFrequency,
  type SocialTime,
  type HobbiesTime,
  type PresenceLevel,
} from '@/domain/beyondTheScreen';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Step IDs ──────────────────────────────────────────────────────────────

type StepId =
  | 'focus'
  | 'motivation'
  | 'confidence'
  | 'urges'
  | 'social'
  | 'hobbies'
  | 'presence'
  | 'notes';

const STEPS: StepId[] = [
  'focus', 'motivation', 'confidence', 'urges',
  'social', 'hobbies', 'presence', 'notes',
];

// ── Option lists ──────────────────────────────────────────────────────────

const FOCUS_OPTIONS: readonly FocusLevel[] = ['Very Focused', 'Focused', 'Neutral', 'Distracted', 'Very Distracted'];
const MOTIVATION_OPTIONS: readonly MotivationLevel[] = ['Very Motivated', 'Motivated', 'Neutral', 'Unmotivated', 'Very Unmotivated'];
const CONFIDENCE_OPTIONS: readonly ConfidenceLevel[] = ['Very Confident', 'Confident', 'Neutral', 'Uncertain', 'Very Uncertain'];
const URGE_OPTIONS: readonly UrgeFrequency[] = ['None', 'Mild', 'Moderate', 'Strong', 'Very Strong'];
const SOCIAL_OPTIONS: readonly SocialTime[] = ['Yes', 'No', 'Not Applicable'];
const HOBBIES_OPTIONS: readonly HobbiesTime[] = ['Yes', 'No', 'Not Applicable'];
const PRESENCE_OPTIONS: readonly PresenceLevel[] = ['Much More', 'Slightly More', 'About the Same', 'Slightly Less', 'Much Less'];

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

export default function BeyondTheScreenScreen() {
  const router = useRouter();
  const theme = useTheme();
  const back = useSafeBack('/beyond-the-screen-log');
  const insets = useSafeAreaInsets();

  const saveEntry = useStore((s) => s.saveBeyondTheScreenEntry);

  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<FocusLevel | null>(null);
  const [motivation, setMotivation] = useState<MotivationLevel | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [urges, setUrges] = useState<UrgeFrequency | null>(null);
  const [social, setSocial] = useState<SocialTime | null>(null);
  const [hobbies, setHobbies] = useState<HobbiesTime | null>(null);
  const [presence, setPresence] = useState<PresenceLevel | null>(null);
  const [notes, setNotes] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  const current = STEPS[step];
  const progress = (step + 1) / STEPS.length;

  const canNext = (() => {
    switch (current) {
      case 'focus': return focus != null;
      case 'motivation': return motivation != null;
      case 'confidence': return confidence != null;
      case 'urges': return urges != null;
      case 'social': return social != null;
      case 'hobbies': return hobbies != null;
      case 'presence': return presence != null;
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
        focusLevel: focus!,
        motivationLevel: motivation!,
        confidenceLevel: confidence!,
        urgeFrequency: urges!,
        socialTime: social!,
        hobbiesTime: hobbies!,
        presenceLevel: presence!,
        notes,
      });
      router.replace('/beyond-the-screen-log');
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
      case 'focus':
        return (
          <>
            <StepHeading
              title="Focus Level"
              subtitle="Looking back this week, how focused did you feel?"
            />
            <OptionSegment options={FOCUS_OPTIONS} selected={focus} onSelect={setFocus} />
          </>
        );
      case 'motivation':
        return (
          <>
            <StepHeading
              title="Motivation"
              subtitle="How motivated did you feel throughout the week?"
            />
            <OptionSegment options={MOTIVATION_OPTIONS} selected={motivation} onSelect={setMotivation} />
          </>
        );
      case 'confidence':
        return (
          <>
            <StepHeading
              title="Confidence"
              subtitle="How confident did you feel?"
            />
            <OptionSegment options={CONFIDENCE_OPTIONS} selected={confidence} onSelect={setConfidence} />
          </>
        );
      case 'urges':
        return (
          <>
            <StepHeading
              title="Urge Frequency"
              subtitle="How often did you experience urges this week?"
            />
            <OptionSegment options={URGE_OPTIONS} selected={urges} onSelect={setUrges} />
          </>
        );
      case 'social':
        return (
          <>
            <StepHeading
              title="Social Time"
              subtitle="Did you spend meaningful time with other people?"
            />
            <OptionSegment options={SOCIAL_OPTIONS} selected={social} onSelect={setSocial} />
          </>
        );
      case 'hobbies':
        return (
          <>
            <StepHeading
              title="Hobbies & Interests"
              subtitle="Did you make time for hobbies or personal interests?"
            />
            <OptionSegment options={HOBBIES_OPTIONS} selected={hobbies} onSelect={setHobbies} />
          </>
        );
      case 'presence':
        return (
          <>
            <StepHeading
              title="Presence"
              subtitle="Compared to last week, did you feel more present during your day-to-day life?"
            />
            <OptionSegment options={PRESENCE_OPTIONS} selected={presence} onSelect={setPresence} />
          </>
        );
      case 'notes':
        return (
          <>
            <StepHeading
              title="What did you notice?"
              subtitle="What positive changes or challenges did you notice this week? (Optional)"
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
        <Text variant="headline" style={{ flex: 1 }}>Beyond the Screen</Text>
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
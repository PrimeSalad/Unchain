/**
 * Journal Entry wizard.
 * All inputs match the onboarding design system exactly:
 *   borderRadius: radius.input, backgroundColor: surface,
 *   borderWidth: 1, borderColor: hairline, padding: spacing.lg, fontSize: 17.
 * Progress bar uses the shared ProgressBar component (height=8, animated).
 * No emoji anywhere.
 */

import { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { Pill } from '@/presentation/components/Pill';
import { Slider } from '@/presentation/components/Slider';
import { Card } from '@/presentation/components/Card';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore, useProfile } from '@/application/store';

// ─────────────────────────────────────────────────────────────────────────────
// Step types
// ─────────────────────────────────────────────────────────────────────────────

type StepId =
  | 'did_gamble'
  | 'amount_wagered'
  | 'did_lose'
  | 'amount_lost'
  | 'why_gamble'
  | 'mood'
  | 'reflection'
  | 'summary';

function buildSteps(isGambling: boolean, gambled: boolean, lost: boolean | null): StepId[] {
  const s: StepId[] = [];
  if (isGambling) {
    s.push('did_gamble');
    if (gambled) {
      s.push('amount_wagered', 'did_lose');
      if (lost === true) s.push('amount_lost');
      s.push('why_gamble');
    }
  }
  s.push('mood', 'reflection', 'summary');
  return s;
}

const WHY_OPTIONS = [
  'Stress',
  'Boredom',
  'To win back losses',
  'Financial pressure',
  'Peer pressure / friends',
  'Payday / extra cash',
  'Excitement / thrill',
  'Loneliness',
  'Saw an ad or promotion',
  'Habit / routine',
  'Other',
] as const;
type WhyOption = (typeof WHY_OPTIONS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// StepHeading
// ─────────────────────────────────────────────────────────────────────────────

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="callout" color={theme.color.textDim} style={{ marginTop: spacing.xs, lineHeight: 22 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// YesNoToggle
// ─────────────────────────────────────────────────────────────────────────────

function YesNoToggle({
  value,
  onChange,
  yesLabel = 'Yes',
  noLabel = 'No',
  yesActive,
  noActive,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
  yesActive?: string;
  noActive?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {([true, false] as const).map((opt) => {
        const active   = value === opt;
        const activeBg = opt ? (yesActive ?? theme.color.danger) : (noActive ?? theme.color.success);
        return (
          <Pressable
            key={String(opt)}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(opt); }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{ flex: 1 }}
          >
            <View
              style={{
                height: 64,
                borderRadius: radius.card,
                backgroundColor: active ? activeBg : theme.color.surface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: active ? activeBg : theme.color.hairline,
              }}
            >
              <Text
                variant="headline"
                color={active ? '#FFFFFF' : theme.color.text}
                style={{ fontFamily: 'Nunito_700Bold' }}
              >
                {opt ? yesLabel : noLabel}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AmountInput — identical to the onboarding expense step
// ─────────────────────────────────────────────────────────────────────────────

function AmountInput({
  value,
  onChange,
  currency,
}: {
  value: string;
  onChange: (v: string) => void;
  currency: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Text variant="title1">{currency}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
        placeholder="0"
        placeholderTextColor={theme.color.textDim}
        keyboardType="decimal-pad"
        autoFocus
        underlineColorAndroid="transparent"
        selectionColor={theme.color.primary}
        style={{
          flex: 1,
          borderRadius: radius.input,
          backgroundColor: theme.color.surface,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          padding: spacing.lg,
          color: theme.color.text,
          fontSize: 17,
          fontFamily: 'Nunito_600SemiBold',
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SummaryRow
// ─────────────────────────────────────────────────────────────────────────────

function SummaryRow({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.color.hairline,
      }}
    >
      <Ionicons name={icon as any} size={16} color={iconColor} style={{ marginTop: 2, flexShrink: 0 }} />
      <Text variant="callout" dim style={{ width: 72, flexShrink: 0 }}>{label}</Text>
      <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>{value}</Text>
    </View>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────────────────────

export default function JournalEntry() {
  const theme      = useTheme();
  const router     = useRouter();
  const profile    = useProfile();
  const addJournal = useStore((s) => s.addJournal);
  const currency   = profile?.currency ?? '₱';
  const insets     = useSafeAreaInsets();
  const isGambling = profile?.addictionType === 'gambling';

  const [gambled,       setGambled]       = useState<boolean | null>(null);
  const [amountWagered, setAmountWagered] = useState('');
  const [lost,          setLost]          = useState<boolean | null>(null);
  const [amountLost,    setAmountLost]    = useState('');
  const [whyOption,     setWhyOption]     = useState<WhyOption | null>(null);
  const [whyOther,      setWhyOther]      = useState('');
  const [mood,          setMood]          = useState(5);
  const [notes,         setNotes]         = useState('');

  const [stepIdx, setStepIdx] = useState(0);
  const frozenSteps = useRef<StepId[] | null>(null);
  // Default: show minimum possible path before user answers did_gamble.
  // For non-gambling users this is already the full path (no did_gamble step).
  const steps       = frozenSteps.current ?? buildSteps(isGambling, false, null);
  const currentStep = steps[stepIdx];
  const totalSteps  = steps.length;

  // Slide animation — clamped ±12px, no overflow:hidden needed
  const slideAnim = useRef(new Animated.Value(0)).current;
  function slide(dir: 'forward' | 'back', cb: () => void) {
    slideAnim.setValue(dir === 'forward' ? 12 : -12);
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    cb();
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'did_gamble':     return gambled !== null;
      case 'amount_wagered': return amountWagered.trim() !== '';
      case 'did_lose':       return lost !== null;
      case 'amount_lost':    return amountLost.trim() !== '';
      case 'why_gamble':
        return whyOption !== null && (whyOption !== 'Other' || whyOther.trim() !== '');
      default:               return true;
    }
  }

  function goNext() {
    if (!canProceed()) return;
    Haptics.selectionAsync().catch(() => {});
    // Freeze the step list the moment the user confirms did_gamble so the
    // progress bar denominator never changes mid-journey.
    if (currentStep === 'did_gamble' && frozenSteps.current === null) {
      frozenSteps.current = buildSteps(isGambling, gambled === true, lost);
      if (gambled !== true) {
        setAmountWagered(''); setLost(null);
        setAmountLost('');    setWhyOption(null); setWhyOther('');
      }
    }
    const active = frozenSteps.current ?? steps;
    if (stepIdx < active.length - 1) slide('forward', () => setStepIdx((i) => i + 1));
  }

  function goBack() {
    if (stepIdx === 0) { router.back(); return; }
    Haptics.selectionAsync().catch(() => {});
    slide('back', () => setStepIdx((i) => i - 1));
  }

  function commit() {
    const whyText = whyOption === 'Other' ? whyOther.trim() : (whyOption ?? undefined);
    addJournal({
      gambled: gambled === true,
      text: notes.trim() || (gambled === true ? 'Gambling relapse recorded.' : 'Clean day recorded.'),
      mood,
      amountWagered: gambled === true && amountWagered ? parseFloat(amountWagered) || undefined : undefined,
      lost: gambled === true ? lost === true : undefined,
      amountLost: gambled === true && lost === true && amountLost ? parseFloat(amountLost) || undefined : undefined,
      whyGambled: gambled === true ? whyText : undefined,
    });
    router.back();
  }

  const isLastStep = stepIdx === (frozenSteps.current ?? steps).length - 1;

  // Shared input style — identical to onboarding
  const inputStyle = {
    borderRadius: radius.input,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.hairline,
    padding: spacing.lg,
    color: theme.color.text,
    fontSize: 17,
    fontFamily: 'Nunito_600SemiBold',
  } as const;


  function renderStep() {
    switch (currentStep) {

      case 'did_gamble':
        return (
          <>
            <StepHeading title="Did you gamble today?" subtitle="Be honest — this is just for you. No judgment here." />
            <YesNoToggle value={gambled} onChange={setGambled} yesLabel="Yes, I did" noLabel="No, I didn't" />
            {gambled === false && (
              <Card tone="successSoft" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: theme.color.success }}>
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.color.success} />
                <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>Another clean day. Every single one matters.</Text>
              </Card>
            )}
            {gambled === true && (
              <Card tone="accentSoft" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: theme.color.danger }}>
                <Ionicons name="heart-outline" size={22} color={theme.color.danger} />
                <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>It takes real courage to be honest. You're not alone.</Text>
              </Card>
            )}
          </>
        );

      case 'amount_wagered':
        return (
          <>
            <StepHeading title="How much did you wager?" subtitle="Enter the total amount you bet or put in." />
            <AmountInput value={amountWagered} onChange={setAmountWagered} currency={currency} />
          </>
        );

      case 'did_lose':
        return (
          <>
            <StepHeading title="Did you lose money?" subtitle="This helps track the financial impact." />
            <YesNoToggle value={lost} onChange={setLost} />
          </>
        );

      case 'amount_lost':
        return (
          <>
            <StepHeading title="How much did you lose?" subtitle="Enter the amount you lost." />
            <AmountInput value={amountLost} onChange={setAmountLost} currency={currency} />
          </>
        );

      case 'why_gamble':
        return (
          <>
            <StepHeading title="Why did you gamble?" subtitle="Understanding your trigger helps prevent it next time." />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {WHY_OPTIONS.map((opt) => (
                <Pill key={opt} label={opt} active={whyOption === opt} onPress={() => { setWhyOption(opt); if (opt !== 'Other') setWhyOther(''); }} />
              ))}
            </View>
            {whyOption === 'Other' && (
              <TextInput
                value={whyOther}
                onChangeText={setWhyOther}
                placeholder="Describe what led you to gamble…"
                placeholderTextColor={theme.color.textDim}
                multiline
                autoFocus
                underlineColorAndroid="transparent"
                selectionColor={theme.color.primary}
                style={[inputStyle, { marginTop: spacing.lg, minHeight: 110, textAlignVertical: 'top' }]}
              />
            )}
          </>
        );

      case 'mood':
        return (
          <>
            <StepHeading title="How are you feeling?" subtitle="Tap a bar to rate your mood from 1 (very low) to 10 (great)." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.xl }}>
              <Slider label="Mood" value={mood} onChange={setMood} />
            </View>
          </>
        );

      case 'reflection':
        return (
          <>
            <StepHeading title="Any reflections?" subtitle="Optional — anything on your mind today?" />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={gambled === true
                ? 'What happened? How are you feeling? What will you do differently…'
                : "What's on your mind? Wins, challenges, things you're proud of…"}
              placeholderTextColor={theme.color.textDim}
              multiline
              underlineColorAndroid="transparent"
              selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 180, textAlignVertical: 'top' }]}
            />
          </>
        );

      case 'summary': {
        const whyLabel = whyOption === 'Other' ? whyOther : (whyOption ?? undefined);
        return (
          <>
            <StepHeading title="Review your entry" subtitle="Take a moment before saving." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
              {gambled != null && (
                <SummaryRow icon={gambled ? 'alert-circle-outline' : 'checkmark-circle-outline'} iconColor={gambled ? theme.color.danger : theme.color.success} label="Today" value={gambled ? 'Relapse' : 'Clean day'} />
              )}
              {gambled === true && amountWagered !== '' && (
                <SummaryRow icon="card-outline" iconColor={theme.color.textDim} label="Wagered" value={`${currency}${parseFloat(amountWagered).toLocaleString()}`} />
              )}
              {gambled === true && lost != null && (
                <SummaryRow icon={lost ? 'trending-down-outline' : 'trending-up-outline'} iconColor={lost ? theme.color.danger : theme.color.success} label="Result" value={lost ? `Lost ${currency}${parseFloat(amountLost || '0').toLocaleString()}` : 'No net loss'} />
              )}
              {gambled === true && whyLabel && (
                <SummaryRow icon="flag-outline" iconColor={theme.color.textDim} label="Why" value={whyLabel} />
              )}
              <SummaryRow icon="bar-chart-outline" iconColor={theme.color.primary} label="Mood" value={`${mood} / 10`} />
              {notes.trim() !== '' && (
                <SummaryRow icon="document-text-outline" iconColor={theme.color.textDim} label="Notes" value={notes.trim()} />
              )}
            </View>
          </>
        );
      }

      default: return null;
    }
  }

  return (
    <Screen scroll={false}>
      {/* Header — matches onboarding: circular back + ProgressBar component + counter */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, marginBottom: spacing.xl }}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={stepIdx === 0 ? 'Close' : 'Back'}
          style={({ pressed }) => ({
            width: 40, height: 40,
            borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name={stepIdx === 0 ? 'close' : 'chevron-back'} size={22} color={theme.color.primary} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <ProgressBar progress={stepIdx / Math.max(totalSteps - 1, 1)} height={8} />
        </View>

        <Text variant="footnote" dim style={{ fontVariant: ['tabular-nums'] }}>
          {stepIdx + 1} of {totalSteps}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 16}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [-12, 0, 12],
                  outputRange: [-12, 0, 12],
                  extrapolate: 'clamp',
                }),
              }],
            }}
          >
            {renderStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Single action button — no duplicate Back below */}
      <View style={{ paddingTop: spacing.sm }}>
        <Button
          label={isLastStep ? 'Save entry' : 'Continue'}
          onPress={isLastStep ? commit : goNext}
          disabled={!canProceed()}
          full
        />
      </View>
    </Screen>
  );
}

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
  Modal,
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
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { Pill } from '@/presentation/components/Pill';
import { Slider } from '@/presentation/components/Slider';
import { Card } from '@/presentation/components/Card';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { radius, spacing, elevation } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useProfile, useTodayJournal } from '@/application/store';
import { DEFAULT_CURRENCY, formatMoney, formatMoneyInput, parseMoneyInput } from '@/domain/gambling';

// ─────────────────────────────────────────────────────────────────────────────
// Step types
// ─────────────────────────────────────────────────────────────────────────────

type StepId =
  | 'did_gamble'
  | 'money_balance'
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
    // money_balance always follows did_gamble, regardless of whether the user
    // gambled. Financial tracking is independent of recovery status.
    s.push('money_balance');
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
// AmountInput - identical to the onboarding expense step
// Displays with comma formatting (e.g. 1,000) while storing raw digits only.
// ─────────────────────────────────────────────────────────────────────────────

/** Strip commas before passing to parseFloat. */
function numericValue(formatted: string): number {
  return parseMoneyInput(formatted);
}

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
  // `value` and `onChange` both use the formatted string (e.g. "1,000").
  // Storing the formatted string as state means the TextInput's value prop
  // always equals what was just typed, so the cursor never jumps.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Text variant="title1">{currency}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(formatMoneyInput(t, true))}
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
// ConfirmModal - native iOS sheet style, no emoji
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmModal({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme  = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Scrim and sheet are siblings - nesting the sheet inside a Pressable
          would nest every button inside a button (invalid on web, confusing
          for screen readers). */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        {/* Sheet */}
        <View>
          <View
            style={{
              backgroundColor: theme.color.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xl,
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              gap: spacing.lg,
              ...elevation.e2,
            }}
          >
            {/* Pull handle */}
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: theme.color.hairline,
              alignSelf: 'center',
              marginBottom: spacing.xs,
            }} />

            {/* Title */}
            <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>
              Submit Journal Entry?
            </Text>

            {/* Description */}
            <Text variant="callout" color={theme.color.textDim} style={{ lineHeight: 23 }}>
              You can only submit one journal entry per day. After submission, this entry will become your official record for today and cannot be replaced or duplicated. Please verify your answers before continuing.
            </Text>

            {/* Divider */}
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.color.hairline }} />

            {/* Actions */}
            <View style={{ gap: spacing.sm }}>
              <Button label="Submit Entry" onPress={onConfirm} full />
              <Button label="Review Answers" onPress={onCancel} kind="secondary" full />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────────────────────

export default function JournalEntry() {
  const theme      = useTheme();
  const safeBack   = useSafeBack('/(tabs)/journal');
  const profile    = useProfile();
  const addJournal = useStore((s) => s.addJournal);
  const currency   = profile?.currency ?? DEFAULT_CURRENCY;
  const insets     = useSafeAreaInsets();
  const isGambling = profile?.addictionType === 'gambling';

  // Block entry if user already submitted today
  const todayJournal = useTodayJournal();
  const alreadySubmitted = todayJournal != null;

  // Confirmation modal state
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Debounce: prevent double-tap from firing commit twice
  const submitting = useRef(false);

  const [gambled,       setGambled]       = useState<boolean | null>(null);
  const [moneyBalance,  setMoneyBalance]  = useState('');
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

  // Slide animation - clamped ±12px, no overflow:hidden needed
  const slideAnim = useRef(new Animated.Value(0)).current;
  function slide(dir: 'forward' | 'back', cb: () => void) {
    slideAnim.setValue(dir === 'forward' ? 12 : -12);
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    cb();
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'did_gamble':     return gambled !== null;
      case 'money_balance':  return moneyBalance.trim() !== '';
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
    if (stepIdx === 0) { safeBack(); return; }
    Haptics.selectionAsync().catch(() => {});
    // If we're on the step immediately after did_gamble, going back means
    // the user wants to change their yes/no answer - unfreeze the step list
    // so buildSteps runs fresh on the next Continue press.
    const active = frozenSteps.current ?? steps;
    const prevStep = active[stepIdx - 1];
    if (prevStep === 'did_gamble') {
      frozenSteps.current = null;
    }
    slide('back', () => setStepIdx((i) => i - 1));
  }

  // Show the confirmation modal instead of saving directly
  function requestCommit() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirmVisible(true);
  }

  // Called only after the user confirms in the modal - debounced against double-tap
  function finalCommit() {
    if (submitting.current) return;
    submitting.current = true;
    setConfirmVisible(false);

    const whyText = whyOption === 'Other' ? whyOther.trim() : (whyOption ?? undefined);
    addJournal({
      gambled: gambled === true,
      text: notes.trim() || (gambled === true ? 'Gambling relapse recorded.' : 'Clean day recorded.'),
      mood,
      amountWagered: gambled === true && amountWagered ? parseFloat(amountWagered.replace(/,/g, '')) || undefined : undefined,
      lost: gambled === true ? lost === true : undefined,
      amountLost: gambled === true && lost === true && amountLost ? parseFloat(amountLost.replace(/,/g, '')) || undefined : undefined,
      whyGambled: gambled === true ? whyText : undefined,
      // moneyBalance stores the RAW answer to "How much money do you have
      // today?" for all gambling users. Financial metrics read it through
      // recoveryAdjustedBalance(): on a losing day the wager is subtracted
      // (remaining = moneyToday - wagerAmount), a win is never added. It does
      // not affect recovery status, streak, or achievements.
      moneyBalance: moneyBalance.trim() ? parseFloat(moneyBalance.replace(/,/g, '')) || undefined : undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    safeBack();
  }

  const isLastStep = stepIdx === (frozenSteps.current ?? steps).length - 1;

  // ── Already-submitted gate ────────────────────────────────────────────────
  // Show a friendly "come back tomorrow" screen instead of the wizard when
  // the user has already written today's entry. The journal list still shows
  // every historical entry - this only blocks creating a second one today.
  if (alreadySubmitted) {
    const todayStr = new Date().toLocaleDateString('en-PH', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    const timeStr = todayJournal
      ? new Date(todayJournal.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const accent = todayJournal?.gambled === true
      ? theme.color.danger
      : todayJournal?.gambled === false
        ? theme.color.success
        : theme.color.primary;

    return (
      <Screen scroll={false}>
        {/* Close button */}
        <View style={{ flexDirection: 'row', marginTop: spacing.xs, marginBottom: spacing.xl }}>
          <Pressable
            onPress={safeBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => ({
              width: 40, height: 40,
              borderRadius: radius.round,
              backgroundColor: theme.color.surfaceAlt,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="close" size={22} color={theme.color.primary} />
          </Pressable>
        </View>

        {/* Centred illustration + message */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          {/* Stacked rings */}
          <View style={{ position: 'relative', width: 110, height: 110, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              position: 'absolute', width: 110, height: 110, borderRadius: 55,
              backgroundColor: accent + '08', borderWidth: 1, borderColor: accent + '20',
            }} />
            <View style={{
              position: 'absolute', width: 80, height: 80, borderRadius: 40,
              backgroundColor: accent + '12', borderWidth: 1, borderColor: accent + '30',
            }} />
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: accent + '25',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="checkmark-circle" size={30} color={accent} />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title2" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
              Entry already written
            </Text>
            <Text variant="callout" dim center style={{ lineHeight: 22 }}>
              You submitted today's journal at {timeStr}.{'\n'}
              Come back tomorrow to write a new one.
            </Text>
            <View style={{
              marginTop: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.chip,
              backgroundColor: accent + '15',
              borderWidth: 1,
              borderColor: accent + '30',
            }}>
              <Text variant="footnote" color={accent} style={{ fontFamily: 'Nunito_700Bold' }}>
                {todayStr}
              </Text>
            </View>
          </View>

          {/* Go back to see all entries */}
          <Button
            label="View all entries"
            onPress={safeBack}
            kind="secondary"
            full
          />
        </View>
      </Screen>
    );
  }

  // Shared input style - identical to onboarding
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
            <StepHeading title="Did you gamble today?" subtitle="Be honest - this is just for you. No judgment here." />
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

      case 'money_balance':
        return (
          <>
            <StepHeading
              title="How much money do you have today?"
              subtitle="Enter your current balance. This is for financial tracking only and does not affect your recovery progress."
            />
            <AmountInput value={moneyBalance} onChange={setMoneyBalance} currency={currency} />
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
            <StepHeading title="Any reflections?" subtitle="Optional - anything on your mind today?" />
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
        // Recovery-adjusted balance preview: a lost wager is subtracted from
        // the entered balance (remaining = moneyToday - wagerAmount); a win
        // never adds anything.
        const lossApplied = gambled === true && lost === true && amountWagered !== '';
        const adjustedBalance = lossApplied && moneyBalance !== ''
          ? Math.max(0, numericValue(moneyBalance) - numericValue(amountWagered))
          : null;
        return (
          <>
            <StepHeading title="Review your entry" subtitle="Take a moment before saving." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
              {gambled != null && (
                <SummaryRow icon={gambled ? 'alert-circle-outline' : 'checkmark-circle-outline'} iconColor={gambled ? theme.color.danger : theme.color.success} label="Today" value={gambled ? 'Relapse' : 'Clean day'} />
              )}
              {moneyBalance !== '' && (
                <SummaryRow icon="wallet-outline" iconColor={theme.color.primary} label="Balance" value={formatMoney(numericValue(moneyBalance), currency)} />
              )}
              {gambled === true && amountWagered !== '' && (
                <SummaryRow icon="card-outline" iconColor={theme.color.textDim} label="Wagered" value={formatMoney(numericValue(amountWagered), currency)} />
              )}
              {gambled === true && lost != null && (
                <SummaryRow icon={lost ? 'trending-down-outline' : 'trending-up-outline'} iconColor={lost ? theme.color.danger : theme.color.success} label="Result" value={lost ? `Lost ${formatMoney(numericValue(amountLost || '0'), currency)}` : 'No net loss'} />
              )}
              {adjustedBalance != null && (
                <SummaryRow
                  icon="wallet-outline"
                  iconColor={theme.color.danger}
                  label="Tracked"
                  value={`${formatMoney(adjustedBalance, currency)} after lost wager`}
                />
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
      {/* Header - matches onboarding: circular back + ProgressBar component + counter */}
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

      {/* KeyboardAvoidingView wraps both the scroll area AND the action button
          so the button lifts above the keyboard when it appears. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 16}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.lg }}
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

        {/* Action button inside KAV so it lifts above the keyboard */}
        <View style={{ paddingTop: spacing.sm }}>
          <Button
            label={isLastStep ? 'Save entry' : 'Continue'}
            onPress={isLastStep ? requestCommit : goNext}
            disabled={!canProceed()}
            full
          />
        </View>
      </KeyboardAvoidingView>

      {/* Confirmation modal - must live inside <Screen> so safe-area insets
          are available and the sheet slides up over the wizard content. */}
      <ConfirmModal
        visible={confirmVisible}
        onConfirm={finalCommit}
        onCancel={() => setConfirmVisible(false)}
      />
    </Screen>
  );
}

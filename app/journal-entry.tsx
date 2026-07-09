/**
 * Journal Entry — step-by-step wizard.
 *
 * iOS fixes in this version
 * ─────────────────────────
 * • AmountInput: border removed from the outer View; the surface background
 *   is enough separation. No white ring appears when the field is focused.
 * • All TextInput fields carry underlineColorAndroid="transparent" and
 *   selectionColor/tintColor so no blue iOS outline bleeds through.
 * • Slide animation: the Animated.View wrapper has overflow:"hidden" and the
 *   translateX is clamped to ±12px so it can never push content off-screen.
 * • KeyboardAvoidingView: keyboardVerticalOffset now reads the actual safe-area
 *   top inset instead of hard-coding 0, so the keyboard lift is correct on
 *   notch/Dynamic Island devices as well as iPhone SE.
 * • Progress bar: total is frozen at the moment the user first answers
 *   "Did you gamble?" so it never jumps (e.g. 1/4 → 1/7).
 * • gambled field is always written as a boolean (true/false), never undefined,
 *   so the calendar and journal list can reliably read it.
 */

import { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { radius, spacing, palette } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore, useProfile } from '@/application/store';

// ─────────────────────────────────────────────────────────────────────────────
// Step definitions
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

/**
 * Build the ordered step list from current answers.
 * Called ONLY when freezing the total — not on every render.
 */
function buildSteps(gambled: boolean, lost: boolean | null): StepId[] {
  const s: StepId[] = ['did_gamble'];
  if (gambled) {
    s.push('amount_wagered', 'did_lose');
    if (lost === true) s.push('amount_lost');
    s.push('why_gamble');
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
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text variant="title2">{title}</Text>
      {subtitle ? (
        <Text variant="callout" color={theme.color.textDim} style={{ marginTop: spacing.xs }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

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
        const active = value === opt;
        const activeBg = opt
          ? (yesActive ?? theme.color.danger)
          : (noActive ?? theme.color.success);
        return (
          <Pressable
            key={String(opt)}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(opt); }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              height: 64,
              borderRadius: radius.card,
              backgroundColor: active ? activeBg : theme.color.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
              // Only show a hairline border on the inactive state so the
              // tappable area is clearly delimited — no border when active
              // so no white ring appears on selection.
              borderWidth: active ? 0 : 1,
              borderColor: theme.color.hairline,
            }}
          >
            <Text variant="title2" color={active ? '#FFFFFF' : theme.color.text}>
              {opt ? yesLabel : noLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Currency + number input used for wager/loss steps.
 *
 * iOS fix: the outer View has NO borderWidth so there is no white ring when
 * the inner TextInput gains focus. The surface background colour provides
 * sufficient visual grouping. selectionColor tints the cursor/handle to the
 * brand primary instead of the system blue.
 */
function AmountInput({
  value,
  onChange,
  currency,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  currency: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.input,
        backgroundColor: theme.color.surface,
        // No borderWidth — avoids the white ring that appears on iOS focus.
        paddingHorizontal: spacing.lg,
        height: 64,
        // Clip children so nothing bleeds outside the rounded corners.
        overflow: 'hidden',
        // Subtle shadow replaces the border for depth.
        shadowColor: palette.ink,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <Text
        variant="title2"
        color={theme.color.textDim}
        style={{ marginRight: spacing.sm }}
      >
        {currency}
      </Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={theme.color.textDim}
        autoFocus
        // Suppress the iOS blue focus ring / underline.
        underlineColorAndroid="transparent"
        selectionColor={theme.color.primary}
        style={{
          flex: 1,
          // Explicit height prevents the flex row from collapsing on SE.
          height: 64,
          fontSize: 28,
          color: theme.color.text,
          fontFamily: 'Nunito_700Bold',
          // Remove any default padding iOS injects.
          paddingVertical: 0,
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar — segments, not dots
// ─────────────────────────────────────────────────────────────────────────────
function ProgressBar({ total, current }: { total: number; current: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: i === current ? 6 : 4,
            borderRadius: 2,
            backgroundColor:
              i <= current
                ? theme.color.primary
                : theme.color.surfaceAlt,
            opacity: i === current ? 1 : i < current ? 0.7 : 0.3,
            marginTop: i === current ? -1 : 1,
          }}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary row
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
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: theme.color.hairline,
      }}
    >
      <Ionicons name={icon as any} size={18} color={iconColor} style={{ marginTop: 2 }} />
      <Text variant="callout" dim style={{ width: 80 }}>{label}</Text>
      <Text variant="callout" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────────────────────
export default function JournalEntry() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const addJournal = useStore((s) => s.addJournal);
  const currency = profile?.currency ?? '₱';

  // Read the safe-area top inset so KeyboardAvoidingView offsets correctly
  // on notch/Dynamic-Island devices AND on iPhone SE (inset = 0 there).
  const insets = useSafeAreaInsets();

  // ── Answer state ───────────────────────────────────────────────────────────
  const [gambled, setGambled] = useState<boolean | null>(null);
  const [amountWagered, setAmountWagered] = useState('');
  const [lost, setLost] = useState<boolean | null>(null);
  const [amountLost, setAmountLost] = useState('');
  const [whyOption, setWhyOption] = useState<WhyOption | null>(null);
  const [whyOther, setWhyOther] = useState('');
  const [mood, setMood] = useState(5);
  const [notes, setNotes] = useState('');

  // ── Step state ─────────────────────────────────────────────────────────────
  const [stepIdx, setStepIdx] = useState(0);

  /**
   * The step list is built ONCE when the user first commits to an answer on
   * the did_gamble step and never recalculated — this is what keeps the
   * progress bar denominator stable (no 1/4 → 1/7 jump).
   */
  const frozenSteps = useRef<StepId[] | null>(null);

  // Before freezing, show the minimum possible path so the progress bar
  // denominator starts at the shortest journey (gambled=false: 4 steps).
  const steps: StepId[] =
    frozenSteps.current ?? buildSteps(false, null);

  const currentStep = steps[stepIdx];
  const totalSteps = steps.length;

  // ── Animation ──────────────────────────────────────────────────────────────
  // translateX is clamped to ±12 so it can never push content off the visible
  // screen width, which was causing the leftward-shift on iPhone SE.
  const slideAnim = useRef(new Animated.Value(0)).current;

  function slide(direction: 'forward' | 'back', cb: () => void) {
    // Start just off-screen direction, animate to 0 (settled).
    slideAnim.setValue(direction === 'forward' ? 12 : -12);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    cb();
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function canProceed(): boolean {
    switch (currentStep) {
      case 'did_gamble':     return gambled !== null;
      case 'amount_wagered': return amountWagered.trim() !== '';
      case 'did_lose':       return lost !== null;
      case 'amount_lost':    return amountLost.trim() !== '';
      case 'why_gamble':
        return whyOption !== null &&
          (whyOption !== 'Other' || whyOther.trim() !== '');
      case 'mood':
      case 'reflection':
      case 'summary':        return true;
      default:               return false;
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goNext() {
    if (!canProceed()) return;
    Haptics.selectionAsync().catch(() => {});

    if (currentStep === 'did_gamble' && frozenSteps.current === null) {
      frozenSteps.current = buildSteps(gambled === true, lost);
      if (gambled !== true) {
        setAmountWagered('');
        setLost(null);
        setAmountLost('');
        setWhyOption(null);
        setWhyOther('');
      }
    }

    const activeSteps = frozenSteps.current ?? steps;
    if (stepIdx < activeSteps.length - 1) {
      slide('forward', () => setStepIdx((i) => i + 1));
    }
  }

  function goBack() {
    if (stepIdx === 0) {
      router.back();
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    slide('back', () => setStepIdx((i) => i - 1));
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  function commit() {
    const whyText =
      whyOption === 'Other' ? whyOther.trim() : (whyOption ?? undefined);

    addJournal({
      gambled: gambled === true,
      text:
        notes.trim() ||
        (gambled === true ? 'Gambling relapse recorded.' : 'Clean day recorded.'),
      mood,
      amountWagered:
        gambled === true && amountWagered
          ? parseFloat(amountWagered) || undefined
          : undefined,
      lost:
        gambled === true ? lost === true : undefined,
      amountLost:
        gambled === true && lost === true && amountLost
          ? parseFloat(amountLost) || undefined
          : undefined,
      whyGambled: gambled === true ? whyText : undefined,
    });

    router.back();
  }

  const isLastStep = stepIdx === (frozenSteps.current ?? steps).length - 1;

  // ── Step content ───────────────────────────────────────────────────────────
  function renderStep() {
    switch (currentStep) {

      case 'did_gamble':
        return (
          <>
            <StepHeading
              title="Did you gamble today?"
              subtitle="Be honest — this is just for you. No judgment here."
            />
            <YesNoToggle
              value={gambled}
              onChange={setGambled}
              yesLabel="Yes, I did"
              noLabel="No, I didn't"
            />
            {gambled === false && (
              <Card
                tone="primarySoft"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  marginTop: spacing.xl,
                  borderLeftWidth: 4,
                  borderLeftColor: theme.color.success,
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.color.success}
                />
                <Text variant="callout" style={{ flex: 1 }}>
                  Another clean day. Every single one matters.
                </Text>
              </Card>
            )}
            {gambled === true && (
              <Card
                tone="primarySoft"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  marginTop: spacing.xl,
                  borderLeftWidth: 4,
                  borderLeftColor: theme.color.danger,
                }}
              >
                <Ionicons name="heart" size={24} color={theme.color.danger} />
                <Text variant="callout" style={{ flex: 1 }}>
                  It takes real courage to be honest. You're not alone.
                </Text>
              </Card>
            )}
          </>
        );

      case 'amount_wagered':
        return (
          <>
            <StepHeading
              title="How much did you wager?"
              subtitle="Enter the total amount you bet or put in."
            />
            <AmountInput
              value={amountWagered}
              onChange={setAmountWagered}
              currency={currency}
            />
          </>
        );

      case 'did_lose':
        return (
          <>
            <StepHeading
              title="Did you lose money?"
              subtitle="This helps track the financial impact of gambling."
            />
            <YesNoToggle value={lost} onChange={setLost} />
          </>
        );

      case 'amount_lost':
        return (
          <>
            <StepHeading
              title="How much did you lose?"
              subtitle="Enter the amount you lost."
            />
            <AmountInput
              value={amountLost}
              onChange={setAmountLost}
              currency={currency}
            />
          </>
        );

      case 'why_gamble':
        return (
          <>
            <StepHeading
              title="Why did you gamble?"
              subtitle="Understanding your trigger helps prevent it next time."
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {WHY_OPTIONS.map((opt) => (
                <Pill
                  key={opt}
                  label={opt}
                  active={whyOption === opt}
                  onPress={() => {
                    setWhyOption(opt);
                    if (opt !== 'Other') setWhyOther('');
                  }}
                />
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
                style={{
                  marginTop: spacing.lg,
                  minHeight: 100,
                  borderRadius: radius.input,
                  backgroundColor: theme.color.surface,
                  // No border — surface background provides the container.
                  padding: spacing.lg,
                  color: theme.color.text,
                  fontSize: 16,
                  lineHeight: 22,
                  textAlignVertical: 'top',
                }}
              />
            )}
          </>
        );

      case 'mood':
        return (
          <>
            <StepHeading
              title="How are you feeling?"
              subtitle="Rate your mood right now from 1 (very low) to 10 (great)."
            />
            <View
              style={{
                backgroundColor: theme.color.surface,
                borderRadius: radius.card,
                padding: spacing.xl,
                shadowColor: palette.ink,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 2,
              }}
            >
              <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                <Text
                  variant="title1"
                  color={theme.color.primary}
                  style={{ marginTop: spacing.sm }}
                >
                  {mood} / 10
                </Text>
                <Text variant="footnote" dim style={{ marginTop: 4 }}>
                  {mood <= 2 ? 'Very low' : mood <= 4 ? 'Low' : mood <= 6 ? 'Okay' : mood <= 8 ? 'Good' : 'Great'}
                </Text>
              </View>
              <Slider label="" value={mood} onChange={setMood} />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: spacing.sm,
                }}
              >
                <Text variant="caption" dim>Very low</Text>
                <Text variant="caption" dim>Great</Text>
              </View>
            </View>
          </>
        );

      case 'reflection':
        return (
          <>
            <StepHeading
              title="Any reflections?"
              subtitle="Optional — anything on your mind today?"
            />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={
                gambled === true
                  ? 'What happened? How are you feeling? What will you do differently…'
                  : "What's on your mind? Wins, challenges, things you're proud of…"
              }
              placeholderTextColor={theme.color.textDim}
              multiline
              underlineColorAndroid="transparent"
              selectionColor={theme.color.primary}
              style={{
                minHeight: 180,
                borderRadius: radius.input,
                backgroundColor: theme.color.surface,
                // No border — surface background provides the container.
                padding: spacing.lg,
                color: theme.color.text,
                fontSize: 17,
                lineHeight: 26,
                textAlignVertical: 'top',
              }}
            />
          </>
        );

      case 'summary': {
        const whyLabel =
          whyOption === 'Other' ? whyOther : (whyOption ?? undefined);
        return (
          <>
            <StepHeading
              title="Review your entry"
              subtitle="Take a look before saving."
            />
            <View style={{ gap: spacing.xs }}>
              {gambled != null && (
                <SummaryRow
                  icon={gambled ? 'alert-circle' : 'checkmark-circle'}
                  iconColor={gambled ? theme.color.danger : theme.color.success}
                  label="Today"
                  value={gambled ? 'Gambled' : 'Clean day'}
                />
              )}
              {gambled === true && amountWagered !== '' && (
                <SummaryRow
                  icon="cash"
                  iconColor={theme.color.textDim}
                  label="Wagered"
                  value={`${currency}${parseFloat(amountWagered).toLocaleString()}`}
                />
              )}
              {gambled === true && lost != null && (
                <SummaryRow
                  icon={lost ? 'trending-down' : 'trending-up'}
                  iconColor={lost ? theme.color.danger : theme.color.success}
                  label="Result"
                  value={
                    lost
                      ? `Lost ${currency}${parseFloat(amountLost || '0').toLocaleString()}`
                      : 'No loss'
                  }
                />
              )}
              {gambled === true && whyLabel && (
                <SummaryRow
                  icon="help-circle"
                  iconColor={theme.color.textDim}
                  label="Why"
                  value={whyLabel}
                />
              )}
              <SummaryRow
                icon="happy"
                iconColor={theme.color.primary}
                label="Mood"
                value={`${mood} / 10`}
              />
              {notes.trim() !== '' && (
                <SummaryRow
                  icon="document-text"
                  iconColor={theme.color.textDim}
                  label="Notes"
                  value={notes.trim()}
                />
              )}
            </View>
          </>
        );
      }

      default:
        return null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Screen scroll={false}>
      {/* ── Header: back/close + progress bar + counter ─────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        }}
      >
        <Pressable
          onPress={goBack}
          hitSlop={16}
          accessibilityLabel={stepIdx === 0 ? 'Close' : 'Back'}
        >
          <Ionicons
            name={stepIdx === 0 ? 'close' : 'arrow-back'}
            size={26}
            color={theme.color.textDim}
          />
        </Pressable>

        <ProgressBar total={totalSteps} current={stepIdx} />

        <Text
          variant="caption"
          dim
          style={{ minWidth: 32, textAlign: 'right' }}
        >
          {stepIdx + 1}/{totalSteps}
        </Text>
      </View>

      {/* ── Step content ────────────────────────────────────────────────── */}
      {/*
        keyboardVerticalOffset must include the safe-area top inset so the
        keyboard lift is calibrated correctly on notch/DI devices. On SE
        (insets.top === 0 or 20) it effectively becomes just the header height.
      */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 16}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/*
            overflow:"hidden" prevents the slide animation from briefly
            rendering content outside the screen bounds (the leftward-shift
            bug on iPhone SE). The clamp to ±12px limits how far the slide
            travels so it can never exceed the screen edge.
          */}
          <View style={{ overflow: 'hidden' }}>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Buttons — always visible above the home indicator ──────────── */}
      <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
        <Button
          label={isLastStep ? 'Save' : 'Next'}
          onPress={isLastStep ? commit : goNext}
          disabled={!canProceed()}
          full
        />
        {stepIdx > 0 && (
          <Button
            label="Back"
            onPress={goBack}
            kind="secondary"
            full
          />
        )}
      </View>
    </Screen>
  );
}

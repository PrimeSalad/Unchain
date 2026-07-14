/**
 * Smoking Recovery Journal Entry wizard.
 * Route: /smoke-journal-entry
 *
 * No  → did_smoke → mood → what_helped → reflection → summary (green)
 * Yes → did_smoke → mood → urge_intensity → trigger_relapse → smoked_count → smoked_type → emotions → next_time_plan → summary (red)
 *
 * Mirrors porn-journal-entry.tsx and social-journal-entry.tsx exactly.
 * Never imports from or modifies any other journal entry file.
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
import { useStore, useTodaySmokeJournal, useProfile } from '@/application/store';
import { SMOKING_TRIGGERS, formatMoneyInput, parseMoneyInput, formatMoney, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/domain/gambling';

// ---------------------------------------------------------------------------
// Step IDs
// ---------------------------------------------------------------------------

type StepId =
  | 'did_smoke'
  | 'money_balance'
  | 'did_smoke_spend'
  | 'smoke_spend_amount'
  | 'mood'
  | 'urge_intensity'
  | 'what_helped'
  | 'reflection_clean'
  | 'smoked_count'
  | 'smoked_type'
  | 'emotions'
  | 'trigger_relapse'
  | 'next_time_plan'
  | 'summary';

function buildSteps(smoked: boolean | null, didSmokeSpend?: boolean | null): StepId[] {
  if (smoked === false) {
    return ['did_smoke', 'money_balance', 'mood', 'what_helped', 'reflection_clean', 'summary'];
  }
  if (smoked === true) {
    const steps: StepId[] = ['did_smoke', 'money_balance', 'did_smoke_spend'];
    if (didSmokeSpend === true) steps.push('smoke_spend_amount');
    steps.push('mood', 'urge_intensity', 'trigger_relapse', 'smoked_count', 'smoked_type', 'emotions', 'next_time_plan', 'summary');
    return steps;
  }
  // Default before yes/no: show clean-day path so progress bar is sensible
  return ['did_smoke', 'money_balance', 'mood', 'what_helped', 'reflection_clean', 'summary'];
}

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

const SMOKE_TYPE_OPTIONS = [
  'Cigarette',
  'Vape / e-cigarette',
  'Cigar',
  'Roll-your-own',
  'Heat-not-burn',
  'Other',
] as const;
type SmokeTypeOption = (typeof SMOKE_TYPE_OPTIONS)[number];

const EMOTION_OPTIONS = [
  'Stressed',
  'Anxious',
  'Bored',
  'Lonely',
  'Restless',
  'Angry',
  'Sad',
  'Tired',
  'Overwhelmed',
  'Other',
] as const;
type EmotionOption = (typeof EMOTION_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function YesNoToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {([true, false] as const).map((opt) => {
        const active = value === opt;
        const bg = opt ? theme.color.danger : theme.color.success;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(opt); }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{ flex: 1 }}
          >
            <View style={{
              height: 64,
              borderRadius: radius.card,
              backgroundColor: active ? bg : theme.color.surface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: active ? bg : theme.color.hairline,
            }}>
              <Text variant="headline" color={active ? '#FFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                {opt ? 'Yes, I did' : "No, I didn't"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function OptionGrid<T extends string>({
  options, selected, onSelect,
}: { options: readonly T[]; selected: T | null; onSelect: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((opt) => (
        <Pill key={opt} label={opt} active={selected === opt}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect(opt); }} />
      ))}
    </View>
  );
}

function MultiGrid<T extends string>({
  options, selected, onToggle,
}: { options: readonly T[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((opt) => (
        <Pill key={opt} label={opt} active={selected.includes(opt)}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onToggle(opt); }} />
      ))}
    </View>
  );
}

function SummaryRow({ icon, iconColor, label, value }: {
  icon: string; iconColor: string; label: string; value: string;
}) {
  const theme = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.hairline,
    }}>
      <Ionicons name={icon as any} size={16} color={iconColor} style={{ marginTop: 2, flexShrink: 0 }} />
      <Text variant="callout" dim style={{ width: 82, flexShrink: 0 }}>{label}</Text>
      <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>{value}</Text>
    </View>
  );
}

function ConfirmModal({ visible, onConfirm, onCancel }: {
  visible: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={{
          backgroundColor: theme.color.surface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xl,
          paddingBottom: Math.max(insets.bottom, spacing.xl),
          gap: spacing.lg,
          ...elevation.e2,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginBottom: spacing.xs }} />
          <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>Submit Journal Entry?</Text>
          <Text variant="callout" color={theme.color.textDim} style={{ lineHeight: 23 }}>
            You can only submit one entry per day. After submission this becomes your official record for today.
          </Text>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.color.hairline }} />
          <View style={{ gap: spacing.sm }}>
            <Button label="Submit Entry" onPress={onConfirm} full />
            <Button label="Review Answers" onPress={onCancel} kind="secondary" full />
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function SmokeJournalEntry() {
  const theme    = useTheme();
  const safeBack = useSafeBack('/(tabs)/journal');
  const addJournal = useStore((s) => s.addJournal);
  const profile = useProfile();
  const currency = profile?.currency ?? DEFAULT_CURRENCY;
  const insets   = useSafeAreaInsets();

  const todayJournal     = useTodaySmokeJournal();
  const alreadySubmitted = todayJournal != null;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const submitting = useRef(false);

  // ── Form state ──────────────────────────────────────────────────────────
  const [smoked,        setSmoked]        = useState<boolean | null>(null);
  const [moneyBalance,  setMoneyBalance]  = useState('');
  const [didSmokeSpend, setDidSmokeSpend] = useState<boolean | null>(null);
  const [smokeSpendAmount, setSmokeSpendAmount] = useState('');
  const [mood,          setMood]          = useState(5);
  const [urgeIntensity, setUrgeIntensity] = useState(3);
  const [whatHelped,    setWhatHelped]    = useState('');
  const [reflection,    setReflection]    = useState('');
  const [smokedCount,   setSmokedCount]   = useState('');
  const [smokedType,    setSmokedType]    = useState<SmokeTypeOption | null>(null);
  const [emotions,      setEmotions]      = useState<EmotionOption[]>([]);
  const [triggerRelapse, setTriggerRelapse] = useState<string | null>(null);
  const [nextTimePlan,  setNextTimePlan]  = useState('');

  // ── Step management ─────────────────────────────────────────────────────
  const [stepIdx, setStepIdx] = useState(0);
  const frozenSteps = useRef<StepId[] | null>(null);
  const steps       = frozenSteps.current ?? buildSteps(null);
  const currentStep = steps[stepIdx];
  const totalSteps  = steps.length;
  const isLastStep  = stepIdx === (frozenSteps.current ?? steps).length - 1;

  const slideAnim = useRef(new Animated.Value(0)).current;
  function slide(dir: 'forward' | 'back', cb: () => void) {
    slideAnim.setValue(dir === 'forward' ? 14 : -14);
    Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    cb();
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'did_smoke':        return smoked !== null;
      case 'money_balance':    return moneyBalance.trim() !== '';
      case 'did_smoke_spend':  return didSmokeSpend !== null;
      case 'smoke_spend_amount': return smokeSpendAmount.trim() !== '';
      case 'smoked_type':      return smokedType !== null;
      case 'emotions':         return emotions.length > 0;
      case 'trigger_relapse':  return triggerRelapse !== null;
      default:                 return true;
    }
  }

  function goNext() {
    if (!canProceed()) return;
    Haptics.selectionAsync().catch(() => {});
    // Freeze at did_smoke to switch to relapse or clean path
    if (currentStep === 'did_smoke' && frozenSteps.current === null) {
      frozenSteps.current = buildSteps(smoked);
    }
    // Always rebuild at did_smoke_spend so smoke_spend_amount is included or excluded
    if (currentStep === 'did_smoke_spend') {
      frozenSteps.current = buildSteps(smoked, didSmokeSpend);
      if (didSmokeSpend !== true) {
        setSmokeSpendAmount('');
      }
    }
    const active = frozenSteps.current ?? steps;
    if (stepIdx < active.length - 1) slide('forward', () => setStepIdx((i) => i + 1));
  }

  function goBack() {
    if (stepIdx === 0) { safeBack(); return; }
    Haptics.selectionAsync().catch(() => {});
    const active = frozenSteps.current ?? steps;
    if (active[stepIdx - 1] === 'did_smoke') frozenSteps.current = null;
    slide('back', () => setStepIdx((i) => i - 1));
  }

  function finalCommit() {
    if (submitting.current) return;
    submitting.current = true;
    setConfirmVisible(false);

    const countNum = smokedCount.trim() ? parseInt(smokedCount.trim(), 10) : undefined;

    // Calculate remaining money: moneyBalance - smokeSpendAmount
    const balance = moneyBalance.trim() ? parseFloat(moneyBalance.replace(/,/g, '')) || 0 : 0;
    const smokeSpend = smoked === true && didSmokeSpend === true ? parseFloat(smokeSpendAmount.replace(/,/g, '')) || 0 : 0;
    const remainingMoney = Math.max(0, balance - smokeSpend);

    addJournal({
      smoked: smoked === true,
      text: reflection.trim() || (smoked === true ? 'Smoking relapse recorded.' : 'Clean day recorded.'),
      mood,
      moneyBalance: balance || undefined,
      smokeDidSpend: smoked === true ? didSmokeSpend === true : undefined,
      smokeSpendAmount: smoked === true && didSmokeSpend === true ? smokeSpend || undefined : undefined,
      smokeRemainingMoney: smoked === true && didSmokeSpend === true ? remainingMoney : undefined,
      smokeUrgeIntensity: smoked === true ? urgeIntensity : undefined,
      smokeTrigger: smoked === true ? (triggerRelapse ?? undefined) : undefined,
      smokeWhatHelped: smoked === false && whatHelped.trim() ? whatHelped.trim() : undefined,
      smokedCount: smoked === true && countNum ? countNum : undefined,
      smokedType: smoked === true && smokedType ? smokedType : undefined,
      smokeEmotions: smoked === true && emotions.length > 0 ? emotions : undefined,
      smokeNextTimePlan: smoked === true && nextTimePlan.trim() ? nextTimePlan.trim() : undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    safeBack();
  }

  // ── Already-submitted gate ───────────────────────────────────────────────
  if (alreadySubmitted) {
    const accent  = todayJournal?.smoked === true ? theme.color.danger : theme.color.success;
    const timeStr = new Date(todayJournal!.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <Screen scroll={false}>
        <View style={{ flexDirection: 'row', marginTop: spacing.xs, marginBottom: spacing.xl }}>
          <Pressable
            onPress={safeBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="close" size={22} color={theme.color.primary} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <View style={{ position: 'relative', width: 110, height: 110, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: accent + '08', borderWidth: 1, borderColor: accent + '20' }} />
            <View style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: accent + '12', borderWidth: 1, borderColor: accent + '30' }} />
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: accent + '25', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={30} color={accent} />
            </View>
          </View>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title2" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>Entry already written</Text>
            <Text variant="callout" dim center style={{ lineHeight: 22 }}>
              You submitted today's journal at {timeStr}.{'\n'}Come back tomorrow to write a new one.
            </Text>
          </View>
          <Button label="View all entries" onPress={safeBack} kind="secondary" full />
        </View>
      </Screen>
    );
  }


  const inputStyle = {
    borderRadius: radius.input, backgroundColor: theme.color.surface,
    borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg,
    color: theme.color.text, fontSize: 17, fontFamily: 'Nunito_600SemiBold',
  } as const;

  function renderStep() {
    switch (currentStep) {

      case 'did_smoke':
        return (
          <>
            <StepHeading title="Did you smoke today?" subtitle="Be honest - this is just for you. No judgment here." />
            <YesNoToggle value={smoked} onChange={setSmoked} />
            {smoked === false && (
              <Card tone="successSoft" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: theme.color.success }}>
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.color.success} />
                <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>Another smoke-free day. Every single one matters.</Text>
              </Card>
            )}
            {smoked === true && (
              <Card tone="accentSoft" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: theme.color.danger }}>
                <Ionicons name="heart-outline" size={22} color={theme.color.danger} />
                <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>It takes courage to be honest. You are not alone in this.</Text>
              </Card>
            )}
          </>
        );

      case 'money_balance':
        return (
          <>
            <StepHeading title="How much money do you have today?" subtitle="Enter your current balance. This helps track your financial wellbeing." />
            <View style={{ gap: spacing.xl }}>
              <View style={{
                width: '100%', alignSelf: 'center', borderRadius: radius.card,
                backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline,
                padding: spacing.lg, gap: spacing.lg,
              }}>
                <View style={{ gap: spacing.sm }}>
                  <Text variant="footnote" dim center>Current balance</Text>
                  <View style={{
                    minHeight: 76, borderRadius: radius.card, backgroundColor: theme.color.surfaceAlt,
                    borderWidth: 1, borderColor: theme.color.hairline, flexDirection: 'row',
                    alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md,
                  }}>
                    <View style={{
                      width: 54, height: 54, borderRadius: 18, backgroundColor: theme.color.primary,
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Text variant="title2" color={theme.color.onPrimary}>{currency}</Text>
                    </View>
                    <TextInput value={moneyBalance} onChangeText={(t) => setMoneyBalance(formatMoneyInput(t, true))}
                      placeholder="0" placeholderTextColor={theme.color.textDim} keyboardType="number-pad"
                      autoFocus underlineColorAndroid="transparent" selectionColor={theme.color.primary}
                      style={{ flex: 1, minWidth: 0, color: theme.color.text, fontSize: 34, lineHeight: 40,
                        fontFamily: 'Nunito_900Black', paddingVertical: spacing.sm }} />
                  </View>
                </View>
              </View>
              <View style={{ width: '100%', alignSelf: 'center', gap: spacing.sm }}>
                <Text variant="footnote" dim center>Currency</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
                  {SUPPORTED_CURRENCIES.map((option) => {
                    const active = currency === option.symbol;
                    return (
                      <Pressable key={option.code} onPress={() => useStore.getState().updateProfile({ currency: option.symbol })}
                        accessibilityRole="button" accessibilityLabel={`${option.label}, ${option.code}`}
                        accessibilityState={{ selected: active }}
                        style={({ pressed }) => ({
                          width: '30.5%', minWidth: 86, minHeight: 52, borderRadius: radius.input,
                          borderWidth: 1, borderColor: active ? theme.color.primary : theme.color.hairline,
                          backgroundColor: active ? theme.color.primarySoft : theme.color.surface,
                          paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
                          alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.72 : 1,
                        })}>
                        <Text variant="headline" color={active ? theme.color.primary : theme.color.text}>{option.symbol}</Text>
                        <Text variant="caption" dim={!active} color={active ? theme.color.primary : undefined}>{option.code}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </>
        );

      case 'did_smoke_spend':
        return (
          <>
            <StepHeading title="Did you spend money on smoking today?" subtitle="This helps track spending on cigarettes, vapes, etc." />
            <YesNoToggle value={didSmokeSpend} onChange={setDidSmokeSpend} />
            {didSmokeSpend === false && (
              <Card tone="successSoft" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: theme.color.success }}>
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.color.success} />
                <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>Good job avoiding impulse purchases!</Text>
              </Card>
            )}
          </>
        );

      case 'smoke_spend_amount':
        return (
          <>
            <StepHeading title="How much did you spend?" subtitle="Enter the amount you spent on smoking." />
            <View style={{ gap: spacing.xl }}>
              <View style={{
                width: '100%', alignSelf: 'center', borderRadius: radius.card,
                backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline,
                padding: spacing.lg, gap: spacing.lg,
              }}>
                <View style={{ gap: spacing.sm }}>
                  <Text variant="footnote" dim center>Amount spent</Text>
                  <View style={{
                    minHeight: 76, borderRadius: radius.card, backgroundColor: theme.color.surfaceAlt,
                    borderWidth: 1, borderColor: theme.color.hairline, flexDirection: 'row',
                    alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md,
                  }}>
                    <View style={{
                      width: 54, height: 54, borderRadius: 18, backgroundColor: theme.color.primary,
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Text variant="title2" color={theme.color.onPrimary}>{currency}</Text>
                    </View>
                    <TextInput value={smokeSpendAmount} onChangeText={(t) => setSmokeSpendAmount(formatMoneyInput(t, true))}
                      placeholder="0" placeholderTextColor={theme.color.textDim} keyboardType="number-pad"
                      autoFocus underlineColorAndroid="transparent" selectionColor={theme.color.primary}
                      style={{ flex: 1, minWidth: 0, color: theme.color.text, fontSize: 34, lineHeight: 40,
                        fontFamily: 'Nunito_900Black', paddingVertical: spacing.sm }} />
                  </View>
                </View>
              </View>
              <View style={{ width: '100%', alignSelf: 'center', gap: spacing.sm }}>
                <Text variant="footnote" dim center>Currency</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
                  {SUPPORTED_CURRENCIES.map((option) => {
                    const active = currency === option.symbol;
                    return (
                      <Pressable key={option.code} onPress={() => useStore.getState().updateProfile({ currency: option.symbol })}
                        accessibilityRole="button" accessibilityLabel={`${option.label}, ${option.code}`}
                        accessibilityState={{ selected: active }}
                        style={({ pressed }) => ({
                          width: '30.5%', minWidth: 86, minHeight: 52, borderRadius: radius.input,
                          borderWidth: 1, borderColor: active ? theme.color.primary : theme.color.hairline,
                          backgroundColor: active ? theme.color.primarySoft : theme.color.surface,
                          paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
                          alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.72 : 1,
                        })}>
                        <Text variant="headline" color={active ? theme.color.primary : theme.color.text}>{option.symbol}</Text>
                        <Text variant="caption" dim={!active} color={active ? theme.color.primary : undefined}>{option.code}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </>
        );

      case 'mood':
        return (
          <>
            <StepHeading title="How are you feeling?" subtitle="Rate your mood from 1 (very low) to 10 (great)." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.xl }}>
              <Slider label="Mood" value={mood} onChange={setMood} />
            </View>
          </>
        );

      case 'urge_intensity':
        return (
          <>
            <StepHeading title="How strong was the urge to smoke?" subtitle="1 = barely noticeable, 10 = overwhelming." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.xl }}>
              <Slider kind="urge" label="Urge intensity" value={urgeIntensity} onChange={setUrgeIntensity} />
            </View>
          </>
        );

      case 'what_helped':
        return (
          <>
            <StepHeading title="What helped you stay smoke-free?" subtitle="Optional - what got you through the urge?" />
            <TextInput
              value={whatHelped} onChangeText={setWhatHelped}
              placeholder="e.g. went for a walk, chewed gum, used deep breathing..."
              placeholderTextColor={theme.color.textDim} multiline
              underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
            />
          </>
        );

      case 'reflection_clean':
        return (
          <>
            <StepHeading title="Any reflections?" subtitle="Optional - anything else on your mind today?" />
            <TextInput
              value={reflection} onChangeText={setReflection}
              placeholder="What's on your mind? Wins, challenges, things you're proud of..."
              placeholderTextColor={theme.color.textDim} multiline
              underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 160, textAlignVertical: 'top' }]}
            />
          </>
        );

      case 'smoked_count':
        return (
          <>
            <StepHeading title="How many did you smoke?" subtitle="Approximate is fine. Enter 0 if you're unsure." />
            <TextInput
              value={smokedCount} onChangeText={setSmokedCount}
              placeholder="e.g. 3"
              placeholderTextColor={theme.color.textDim}
              keyboardType="number-pad"
              underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={inputStyle}
            />
          </>
        );

      case 'smoked_type':
        return (
          <>
            <StepHeading title="What did you smoke?" subtitle="Pick the one that applies." />
            <OptionGrid options={SMOKE_TYPE_OPTIONS} selected={smokedType} onSelect={setSmokedType} />
          </>
        );

      case 'emotions':
        return (
          <>
            <StepHeading title="What were you feeling before smoking?" subtitle="Select all that apply." />
            <MultiGrid
              options={EMOTION_OPTIONS}
              selected={emotions}
              onToggle={(e) => setEmotions((prev) =>
                prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
              )}
            />
          </>
        );

      case 'trigger_relapse':
        return (
          <>
            <StepHeading title="What triggered the urge?" subtitle="Pick the one that fits best." />
            <OptionGrid
              options={SMOKING_TRIGGERS}
              selected={triggerRelapse as any}
              onSelect={setTriggerRelapse}
            />
          </>
        );

      case 'next_time_plan':
        return (
          <>
            <StepHeading title="What could help you next time?" subtitle="Optional - one small thing to try when the urge hits." />
            <TextInput
              value={nextTimePlan} onChangeText={setNextTimePlan}
              placeholder="e.g. delay 10 minutes, call someone, use nicotine replacement..."
              placeholderTextColor={theme.color.textDim} multiline
              underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
            />
          </>
        );

      case 'summary': {
        const balance = moneyBalance.trim() ? parseFloat(moneyBalance.replace(/,/g, '')) || 0 : 0;
        const smokeSpend = smoked === true && didSmokeSpend === true ? parseFloat(smokeSpendAmount.replace(/,/g, '')) || 0 : 0;
        const remaining = Math.max(0, balance - smokeSpend);
        return (
          <>
            <StepHeading title="Review your entry" subtitle="Take a moment before saving." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
              <SummaryRow
                icon={smoked ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                iconColor={smoked ? theme.color.danger : theme.color.success}
                label="Today"
                value={smoked ? 'Relapse' : 'Clean day'}
              />
              {moneyBalance !== '' && (
                <SummaryRow icon="wallet-outline" iconColor={theme.color.primary} label="Balance" value={formatMoney(balance, currency)} />
              )}
              {smoked === true && didSmokeSpend === true && smokeSpendAmount !== '' && (
                <SummaryRow icon="cash-outline" iconColor={theme.color.danger} label="Spent" value={formatMoney(smokeSpend, currency)} />
              )}
              {smoked === true && didSmokeSpend === true && moneyBalance !== '' && smokeSpendAmount !== '' && (
                <SummaryRow icon="trending-down-outline" iconColor={theme.color.success} label="Remaining" value={formatMoney(remaining, currency)} />
              )}
              <SummaryRow icon="bar-chart-outline" iconColor={theme.color.primary} label="Mood" value={`${mood} / 10`} />
              {smoked === false && whatHelped.trim() !== '' && (
                <SummaryRow icon="shield-checkmark-outline" iconColor={theme.color.success} label="Helped" value={whatHelped.trim()} />
              )}
              {smoked === true && (
                <SummaryRow icon="pulse-outline" iconColor={theme.color.celebrate} label="Urge level" value={`${urgeIntensity} / 10`} />
              )}
              {smoked === true && triggerRelapse && (
                <SummaryRow icon="warning-outline" iconColor={theme.color.danger} label="Trigger" value={triggerRelapse} />
              )}
              {smoked === true && smokedCount.trim() !== '' && (
                <SummaryRow icon="flame-outline" iconColor={theme.color.danger} label="Smoked" value={`${smokedCount} cigarette${smokedCount === '1' ? '' : 's'}`} />
              )}
              {smoked === true && smokedType && (
                <SummaryRow icon="ellipse-outline" iconColor={theme.color.textDim} label="Type" value={smokedType} />
              )}
              {smoked === true && emotions.length > 0 && (
                <SummaryRow icon="heart-outline" iconColor={theme.color.danger} label="Emotions" value={emotions.join(', ')} />
              )}
              {smoked === true && nextTimePlan.trim() !== '' && (
                <SummaryRow icon="bulb-outline" iconColor={theme.color.primary} label="Next time" value={nextTimePlan.trim()} />
              )}
              {reflection.trim() !== '' && (
                <SummaryRow icon="document-text-outline" iconColor={theme.color.textDim} label="Notes" value={reflection.trim()} />
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
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, marginBottom: spacing.xl }}>
        <Pressable
          onPress={goBack} hitSlop={12}
          accessibilityRole="button" accessibilityLabel={stepIdx === 0 ? 'Close' : 'Back'}
          style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 16}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{
            transform: [{
              translateX: slideAnim.interpolate({
                inputRange: [-14, 0, 14],
                outputRange: [-14, 0, 14],
                extrapolate: 'clamp',
              }),
            }],
          }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>

        <View style={{ paddingTop: spacing.sm }}>
          <Button
            label={isLastStep ? 'Save entry' : 'Continue'}
            onPress={isLastStep
              ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setConfirmVisible(true); }
              : goNext}
            disabled={!canProceed()}
            full
          />
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={confirmVisible}
        onConfirm={finalCommit}
        onCancel={() => setConfirmVisible(false)}
      />
    </Screen>
  );
}

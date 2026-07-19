/**
 * Pornography Recovery Journal Entry wizard.
 * New file - gambling journal (app/journal-entry.tsx) is never touched.
 * Route: /porn-journal-entry
 *
 * No  → did_watch → mood → urge intensity → what helped → reflection → summary (green day)
 * Yes → did_watch → mood → watch duration → lead up → emotions before → trigger → next time plan → feeling now → summary (red day)
 */

import { useEffect, useRef, useState } from 'react';
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
import { useStore, useTodayPornJournal, useProfile } from '@/application/store';
import { JournalSequenceBanner, useJournalSequence } from '@/presentation/hooks/useJournalSequence';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';
import { formatMoneyInput, parseMoneyInput, formatMoney, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/domain/gambling';

// ---------------------------------------------------------------------------
// Step IDs
// ---------------------------------------------------------------------------

type StepId =
  | 'did_watch'
  | 'money_balance'
  | 'did_buy_porn'
  | 'porn_spend_amount'
  | 'mood'
  | 'urge_intensity'
  | 'triggers_clean'
  | 'what_helped'
  | 'reflection_clean'
  | 'watch_duration'
  | 'lead_up'
  | 'emotions_before'
  | 'relapse_trigger'
  | 'next_time_plan'
  | 'feeling_now'
  | 'summary';

function buildSteps(watched: boolean | null, didBuyPorn?: boolean | null): StepId[] {
  if (watched === false) {
    // Clean day: no relapse steps
    return ['did_watch', 'money_balance', 'mood', 'urge_intensity', 'what_helped', 'reflection_clean', 'summary'];
  }
  if (watched === true) {
    // Relapse day: money balance → porn spending questions → mood → duration etc.
    const steps: StepId[] = ['did_watch', 'money_balance', 'did_buy_porn'];
    if (didBuyPorn === true) steps.push('porn_spend_amount');
    steps.push('mood', 'watch_duration', 'lead_up', 'emotions_before', 'relapse_trigger', 'next_time_plan', 'feeling_now', 'summary');
    return steps;
  }
  // Default (before yes/no answered): show clean-day path length so progress bar is sensible
  return ['did_watch', 'money_balance', 'mood', 'urge_intensity', 'what_helped', 'reflection_clean', 'summary'];
}

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = ['Less than 10 min', '10–30 min', '30–60 min', 'More than 1 hour'] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

const LEAD_UP_OPTIONS = [
  'Scrolled social media', 'Watched suggestive content', 'Was bored and restless',
  'Felt stressed or overwhelmed', 'Was alone late at night', 'Opened a site by habit',
  'Felt rejected or lonely', 'Other',
] as const;
type LeadUpOption = (typeof LEAD_UP_OPTIONS)[number];

const EMOTION_OPTIONS = [
  'Anxious', 'Lonely', 'Bored', 'Stressed', 'Sad', 'Angry', 'Numb', 'Tired', 'Restless', 'Other',
] as const;
type EmotionOption = (typeof EMOTION_OPTIONS)[number];

const FEELING_NOW_OPTIONS = [
  'Guilty', 'Ashamed', 'Relieved', 'Numb', 'Frustrated', 'Determined to do better', 'Hopeful', 'Other',
] as const;
type FeelingNowOption = (typeof FEELING_NOW_OPTIONS)[number];

function durationToMinutes(opt: DurationOption): number {
  if (opt === 'Less than 10 min') return 8;
  if (opt === '10–30 min') return 20;
  if (opt === '30–60 min') return 45;
  return 90;
}

// ---------------------------------------------------------------------------
// Small components
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
              height: 64, borderRadius: radius.card,
              backgroundColor: active ? bg : theme.color.surface,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: active ? bg : theme.color.hairline,
            }}>
              <Text variant="headline" color={active ? '#FFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                {opt ? 'Yes, I did' : 'No, I didn\'t'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function OptionGrid<T extends string>({ options, selected, onSelect }: {
  options: readonly T[]; selected: T | null; onSelect: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((opt) => (
        <Pill key={opt} label={opt} active={selected === opt}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect(opt); }} />
      ))}
    </View>
  );
}

function MultiGrid<T extends string>({ options, selected, onToggle }: {
  options: readonly T[]; selected: T[]; onToggle: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((opt) => (
        <Pill key={opt} label={opt} active={selected.includes(opt)}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onToggle(opt); }} />
      ))}
    </View>
  );
}

function SummaryRow({ icon, iconColor, label, value }: { icon: string; iconColor: string; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.hairline }}>
      <Ionicons name={icon as any} size={16} color={iconColor} style={{ marginTop: 2, flexShrink: 0 }} />
      <Text variant="callout" dim style={{ width: 82, flexShrink: 0 }}>{label}</Text>
      <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>{value}</Text>
    </View>
  );
}

function ConfirmModal({ visible, onConfirm, onCancel }: { visible: boolean; onConfirm: () => void; onCancel: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={{ backgroundColor: theme.color.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: Math.max(insets.bottom, spacing.xl), gap: spacing.lg, ...elevation.e2 }}>
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

export default function PornJournalEntry() {
  const theme    = useTheme();
  const safeBack = useSafeBack('/(tabs)/journal');
  const standaloneProfile = useProfile();
  const journalSequence = useJournalSequence('pornography', safeBack);
  const profile = journalSequence.sequence ? journalSequence.profile : standaloneProfile;
  const currency = profile?.currency ?? DEFAULT_CURRENCY;
  const insets   = useSafeAreaInsets();

  const standaloneTodayJournal = useTodayPornJournal();
  const todayJournal = journalSequence.sequence ? journalSequence.todayJournal : standaloneTodayJournal;
  const alreadySubmitted = todayJournal != null;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const submitting = useRef(false);

  // ── Form state ─────────────────────────────────────────────────────────
  const draft = journalSequence.draft;
  const [watched, setWatched] = useState<boolean | null>(() => (draft?.watched as boolean | null | undefined) ?? null);
  const [moneyBalance, setMoneyBalance] = useState(() => (draft?.moneyBalance as string | undefined) ?? '');
  const [didBuyPorn, setDidBuyPorn] = useState<boolean | null>(() => (draft?.didBuyPorn as boolean | null | undefined) ?? null);
  const [pornSpendAmount, setPornSpendAmount] = useState(() => (draft?.pornSpendAmount as string | undefined) ?? '');
  const [mood, setMood] = useState(() => (draft?.mood as number | undefined) ?? 5);
  const [urgeIntensity, setUrgeIntensity] = useState(() => (draft?.urgeIntensity as number | undefined) ?? 3);
  const [cleanTriggers, setCleanTriggers] = useState<string[]>(() => (draft?.cleanTriggers as string[] | undefined) ?? []);
  const [whatHelped, setWhatHelped] = useState(() => (draft?.whatHelped as string | undefined) ?? '');
  const [reflection, setReflection] = useState(() => (draft?.reflection as string | undefined) ?? '');
  const [durationOpt, setDurationOpt] = useState<DurationOption | null>(() => (draft?.durationOpt as DurationOption | null | undefined) ?? null);
  const [leadUp, setLeadUp] = useState<LeadUpOption | null>(() => (draft?.leadUp as LeadUpOption | null | undefined) ?? null);
  const [emotions, setEmotions] = useState<EmotionOption[]>(() => (draft?.emotions as EmotionOption[] | undefined) ?? []);
  const [relapseTrigger, setRelapseTrigger] = useState<string | null>(() => (draft?.relapseTrigger as string | null | undefined) ?? null);
  const [nextTimePlan, setNextTimePlan] = useState(() => (draft?.nextTimePlan as string | undefined) ?? '');
  const [feelingNow, setFeelingNow] = useState<FeelingNowOption | null>(() => (draft?.feelingNow as FeelingNowOption | null | undefined) ?? null);

  // ── Step management ────────────────────────────────────────────────────
  const [stepIdx, setStepIdx] = useState(() => (draft?.stepIdx as number | undefined) ?? 0);
  const frozenSteps = useRef<StepId[] | null>(draft && watched !== null ? buildSteps(watched, didBuyPorn) : null);
  const steps                     = frozenSteps.current ?? buildSteps(null);
  const currentStep               = steps[stepIdx];
  const totalSteps                = steps.length;
  const isLastStep                = stepIdx === (frozenSteps.current ?? steps).length - 1;

  useEffect(() => {
    if (!journalSequence.sequence) return;
    journalSequence.saveDraft({ watched, moneyBalance, didBuyPorn, pornSpendAmount, mood,
      urgeIntensity, cleanTriggers, whatHelped, reflection, durationOpt, leadUp,
      emotions, relapseTrigger, nextTimePlan, feelingNow, stepIdx });
  }, [cleanTriggers, didBuyPorn, durationOpt, emotions, feelingNow, journalSequence.sequence, leadUp, moneyBalance, mood, nextTimePlan, pornSpendAmount, reflection, relapseTrigger, stepIdx, urgeIntensity, watched, whatHelped]);

  const slideAnim = useRef(new Animated.Value(0)).current;
  function slide(dir: 'forward' | 'back', cb: () => void) {
    slideAnim.setValue(dir === 'forward' ? 14 : -14);
    Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    cb();
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'did_watch':       return watched !== null;
      case 'money_balance':   return moneyBalance.trim() !== '';
      case 'did_buy_porn':    return didBuyPorn !== null;
      case 'porn_spend_amount': return pornSpendAmount.trim() !== '';
      case 'watch_duration':  return durationOpt !== null;
      case 'lead_up':         return leadUp !== null;
      case 'emotions_before': return emotions.length > 0;
      case 'relapse_trigger': return relapseTrigger !== null;
      case 'feeling_now':     return feelingNow !== null;
      default:                return true;
    }
  }

  function goNext() {
    if (!canProceed()) return;
    Haptics.selectionAsync().catch(() => {});
    // Freeze at did_watch to switch to relapse or clean path
    if (currentStep === 'did_watch' && frozenSteps.current === null) {
      frozenSteps.current = buildSteps(watched);
    }
    // Always rebuild at did_buy_porn so porn_spend_amount is included or excluded
    if (currentStep === 'did_buy_porn') {
      frozenSteps.current = buildSteps(watched, didBuyPorn);
      if (didBuyPorn !== true) {
        setPornSpendAmount('');
      }
    }
    const active = frozenSteps.current ?? steps;
    if (stepIdx < active.length - 1) slide('forward', () => setStepIdx((i) => i + 1));
  }

  function goBack() {
    if (stepIdx === 0) { safeBack(); return; }
    Haptics.selectionAsync().catch(() => {});
    const active = frozenSteps.current ?? steps;
    slide('back', () => setStepIdx((i) => i - 1));
  }

  function finalCommit() {
    if (submitting.current) return;
    submitting.current = true;
    setConfirmVisible(false);

    // Calculate remaining money: moneyBalance - pornSpendAmount
    const balance = moneyBalance.trim() ? parseFloat(moneyBalance.replace(/,/g, '')) || 0 : 0;
    const pornSpend = watched === true && didBuyPorn === true ? parseFloat(pornSpendAmount.replace(/,/g, '')) || 0 : 0;
    const remainingMoney = Math.max(0, balance - pornSpend);

    journalSequence.submitJournal({
      watched: watched === true,
      gambled: undefined,
      text: reflection.trim() || (watched === true ? 'Relapse recorded.' : 'Clean day recorded.'),
      mood,
      moneyBalance: balance || undefined,
      pornDidSpend: watched === true ? didBuyPorn === true : undefined,
      pornSpendAmount: watched === true && didBuyPorn === true ? pornSpend || undefined : undefined,
      pornRemainingMoney: watched === true && didBuyPorn === true ? remainingMoney : undefined,
      urgeIntensity: watched === false ? urgeIntensity : undefined,
      triggersEncountered: watched === false && cleanTriggers.length > 0 ? cleanTriggers : undefined,
      whatHelped: watched === false && whatHelped.trim() ? whatHelped.trim() : undefined,
      watchDuration: watched === true && durationOpt ? durationToMinutes(durationOpt) : undefined,
      relapseLeadUp: watched === true && leadUp ? leadUp : undefined,
      emotionsBefore: watched === true && emotions.length > 0 ? emotions.join(', ') : undefined,
      relapseTrigger: watched === true && relapseTrigger ? relapseTrigger : undefined,
      nextTimePlan: watched === true && nextTimePlan.trim() ? nextTimePlan.trim() : undefined,
      feelingNow: watched === true && feelingNow ? feelingNow : undefined,
    });
    journalSequence.clearDraft();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    journalSequence.finishSection();
  }

  // ── Already submitted gate ─────────────────────────────────────────────
  if (alreadySubmitted) {
    const accent = todayJournal?.watched === true ? theme.color.danger : theme.color.success;
    const timeStr = todayJournal ? new Date(todayJournal.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <Screen scroll={false}>
        <View style={{ flexDirection: 'row', marginTop: spacing.xs, marginBottom: spacing.xl }}>
          <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="close" size={22} color={theme.color.primary} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: accent + '25', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={30} color={accent} />
          </View>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title2" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>Entry already written</Text>
            <Text variant="callout" dim center style={{ lineHeight: 22 }}>
              You submitted today's journal at {timeStr}.{'\n'}Come back tomorrow for a new entry.
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
      case 'did_watch':
        return (
          <>
            <StepHeading title="Did you watch porn today?" subtitle="Be honest - this is just for you. No judgment here." />
            <YesNoToggle value={watched} onChange={setWatched} />
            {watched === false && (
              <Card tone="successSoft" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: theme.color.success }}>
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.color.success} />
                <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>Another clean day. Every single one matters.</Text>
              </Card>
            )}
            {watched === true && (
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

      case 'did_buy_porn':
        return (
          <>
            <StepHeading title="Did you buy anything porn/R18 related?" subtitle="This helps track spending on adult content." />
            <YesNoToggle value={didBuyPorn} onChange={setDidBuyPorn} />
            {didBuyPorn === false && (
              <Card tone="successSoft" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: theme.color.success }}>
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.color.success} />
                <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>Good job avoiding impulse purchases!</Text>
              </Card>
            )}
          </>
        );

      case 'porn_spend_amount':
        return (
          <>
            <StepHeading title="How much did you spend?" subtitle="Enter the amount you spent on porn/R18 content." />
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
                    <TextInput value={pornSpendAmount} onChangeText={(t) => setPornSpendAmount(formatMoneyInput(t, true))}
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
            <StepHeading title="How strong were your urges today?" subtitle="1 = none at all, 10 = overwhelming." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.xl }}>
              <Slider kind="urge" label="Urge intensity" value={urgeIntensity} onChange={setUrgeIntensity} />
            </View>
          </>
        );

      case 'triggers_clean':
        return (
          <>
            <StepHeading title="Any triggers today?" subtitle="Select all that you noticed - even if you resisted them." />
            <MultiGrid
              options={PORN_TRIGGERS}
              selected={cleanTriggers}
              onToggle={(t) => setCleanTriggers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
            />
          </>
        );

      case 'what_helped':
        return (
          <>
            <StepHeading title="What helped you stay clean?" subtitle="Optional - what got you through the urge?" />
            <TextInput value={whatHelped} onChangeText={setWhatHelped}
              placeholder="e.g. went for a walk, called a friend, used the breathing tool…"
              placeholderTextColor={theme.color.textDim} multiline underlineColorAndroid="transparent"
              selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]} />
          </>
        );

      case 'reflection_clean':
        return (
          <>
            <StepHeading title="Any reflections?" subtitle="Optional - anything else on your mind today?" />
            <TextInput value={reflection} onChangeText={setReflection}
              placeholder="What's on your mind? Wins, challenges, things you're proud of…"
              placeholderTextColor={theme.color.textDim} multiline underlineColorAndroid="transparent"
              selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 160, textAlignVertical: 'top' }]} />
          </>
        );

      case 'watch_duration':
        return (
          <>
            <StepHeading title="How long did you watch?" subtitle="Approximate is fine." />
            <OptionGrid options={DURATION_OPTIONS} selected={durationOpt} onSelect={setDurationOpt} />
          </>
        );

      case 'lead_up':
        return (
          <>
            <StepHeading title="What led to the relapse?" subtitle="Understanding the build-up helps prevent the next one." />
            <OptionGrid options={LEAD_UP_OPTIONS} selected={leadUp} onSelect={setLeadUp} />
          </>
        );

      case 'emotions_before':
        return (
          <>
            <StepHeading title="What were you feeling before?" subtitle="Select all that apply." />
            <MultiGrid
              options={EMOTION_OPTIONS}
              selected={emotions}
              onToggle={(e) => setEmotions((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e])}
            />
          </>
        );

      case 'relapse_trigger':
        return (
          <>
            <StepHeading title="What triggered the relapse?" subtitle="Pick the one that fits best." />
            <OptionGrid options={PORN_TRIGGERS} selected={relapseTrigger as any} onSelect={setRelapseTrigger} />
          </>
        );

      case 'next_time_plan':
        return (
          <>
            <StepHeading title="What could help you next time?" subtitle="Optional - one small thing to try when the urge hits." />
            <TextInput value={nextTimePlan} onChangeText={setNextTimePlan}
              placeholder="e.g. close the laptop and go outside, call someone…"
              placeholderTextColor={theme.color.textDim} multiline underlineColorAndroid="transparent"
              selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]} />
          </>
        );

      case 'feeling_now':
        return (
          <>
            <StepHeading title="How are you feeling now?" subtitle="After watching - what sits with you most?" />
            <OptionGrid options={FEELING_NOW_OPTIONS} selected={feelingNow} onSelect={setFeelingNow} />
          </>
        );

      case 'summary': {
        const balance = moneyBalance.trim() ? parseFloat(moneyBalance.replace(/,/g, '')) || 0 : 0;
        const pornSpend = watched === true && didBuyPorn === true ? parseFloat(pornSpendAmount.replace(/,/g, '')) || 0 : 0;
        const remaining = Math.max(0, balance - pornSpend);
        return (
          <>
            <StepHeading title="Review your entry" subtitle="Take a moment before saving." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
              <SummaryRow icon={watched ? 'alert-circle-outline' : 'checkmark-circle-outline'} iconColor={watched ? theme.color.danger : theme.color.success} label="Today" value={watched ? 'Relapse' : 'Clean day'} />
              {moneyBalance !== '' && (
                <SummaryRow icon="wallet-outline" iconColor={theme.color.primary} label="Balance" value={formatMoney(balance, currency)} />
              )}
              {watched === true && didBuyPorn === true && pornSpendAmount !== '' && (
                <SummaryRow icon="cash-outline" iconColor={theme.color.danger} label="Spent" value={formatMoney(pornSpend, currency)} />
              )}
              {watched === true && didBuyPorn === true && moneyBalance !== '' && pornSpendAmount !== '' && (
                <SummaryRow icon="trending-down-outline" iconColor={theme.color.success} label="Remaining" value={formatMoney(remaining, currency)} />
              )}
              <SummaryRow icon="bar-chart-outline" iconColor={theme.color.primary} label="Mood" value={`${mood} / 10`} />
              {watched === false && urgeIntensity > 0 && (
                <SummaryRow icon="pulse-outline" iconColor={theme.color.celebrate} label="Urge level" value={`${urgeIntensity} / 10`} />
              )}
              {watched === false && cleanTriggers.length > 0 && (
                <SummaryRow icon="warning-outline" iconColor={theme.color.textDim} label="Triggers" value={cleanTriggers.join(', ')} />
              )}
              {watched === false && whatHelped.trim() !== '' && (
                <SummaryRow icon="shield-checkmark-outline" iconColor={theme.color.success} label="Helped" value={whatHelped.trim()} />
              )}
              {watched === true && durationOpt && (
                <SummaryRow icon="time-outline" iconColor={theme.color.textDim} label="Duration" value={durationOpt} />
              )}
              {watched === true && leadUp && (
                <SummaryRow icon="flag-outline" iconColor={theme.color.textDim} label="Lead-up" value={leadUp} />
              )}
              {watched === true && emotions.length > 0 && (
                <SummaryRow icon="heart-outline" iconColor={theme.color.danger} label="Emotions" value={emotions.join(', ')} />
              )}
              {watched === true && relapseTrigger && (
                <SummaryRow icon="warning-outline" iconColor={theme.color.danger} label="Trigger" value={relapseTrigger} />
              )}
              {watched === true && nextTimePlan.trim() !== '' && (
                <SummaryRow icon="bulb-outline" iconColor={theme.color.primary} label="Next time" value={nextTimePlan.trim()} />
              )}
              {watched === true && feelingNow && (
                <SummaryRow icon="happy-outline" iconColor={theme.color.primary} label="Feeling now" value={feelingNow} />
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
      {journalSequence.sequence ? <JournalSequenceBanner addiction="pornography" /> : null}
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, marginBottom: spacing.xl }}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={stepIdx === 0 ? 'Close' : 'Back'}
          style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 16}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={{ transform: [{ translateX: slideAnim.interpolate({ inputRange: [-14, 0, 14], outputRange: [-14, 0, 14], extrapolate: 'clamp' }) }] }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>

        {/* Action button inside KAV so it lifts above the keyboard */}
        <View style={{ paddingTop: spacing.sm }}>
          <Button label={isLastStep ? 'Save entry' : 'Continue'} onPress={isLastStep ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setConfirmVisible(true); } : goNext} disabled={!canProceed()} full />
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal visible={confirmVisible} onConfirm={finalCommit} onCancel={() => setConfirmVisible(false)} />
    </Screen>
  );
}

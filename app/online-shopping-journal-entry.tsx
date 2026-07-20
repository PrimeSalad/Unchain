/**
 * Online Shopping Recovery Journal Entry wizard.
 * Route: /online-shopping-journal-entry
 *
 * No  → did_shop → mood → urge_intensity → what_helped → reflection → summary (green)
 * Yes → did_shop → amount_spent → where_shopped → emotions → trigger → next_time_plan → feeling_now → summary (red)
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
import { useStore, useTodayOnlineShoppingJournal, useProfile } from '@/application/store';
import { JournalSequenceBanner, useJournalSequence } from '@/presentation/hooks/useJournalSequence';
import { formatMoneyInput, parseMoneyInput, formatMoney, DEFAULT_CURRENCY, ONLINE_SHOPPING_TRIGGERS, SUPPORTED_CURRENCIES } from '@/domain/gambling';

// ---------------------------------------------------------------------------
// Step IDs
// ---------------------------------------------------------------------------

type StepId =
  | 'did_shop'
  | 'money_balance'
  | 'amount_spent'
  | 'where_shopped'
  | 'mood'
  | 'urge_intensity'
  | 'what_helped'
  | 'reflection_clean'
  | 'emotions'
  | 'trigger_relapse'
  | 'next_time_plan'
  | 'feeling_now'
  | 'summary';

function buildSteps(shopped: boolean | null): StepId[] {
  if (shopped === false) {
    return ['did_shop', 'money_balance', 'mood', 'what_helped', 'reflection_clean', 'summary'];
  }
  if (shopped === true) {
    return ['did_shop', 'money_balance', 'amount_spent', 'where_shopped', 'mood', 'emotions', 'trigger_relapse', 'next_time_plan', 'feeling_now', 'summary'];
  }
  return ['did_shop', 'money_balance', 'mood', 'what_helped', 'reflection_clean', 'summary'];
}

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

const SHOP_OPTIONS = [
  'Online marketplace',
  'Social shopping feed',
  'Brand or retailer app',
  'Second-hand marketplace',
  'Livestream shopping',
  'Other',
] as const;
type ShopOption = (typeof SHOP_OPTIONS)[number];

const EMOTION_OPTIONS = [
  'Bored',
  'Anxious',
  'Lonely',
  'Stressed',
  'Restless',
  'Sad',
  'Numb',
  'Excited',
  'Tired',
  'Other',
] as const;
type EmotionOption = (typeof EMOTION_OPTIONS)[number];

type TriggerOption = (typeof ONLINE_SHOPPING_TRIGGERS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numericValue(formatted: string): number {
  return parseMoneyInput(formatted);
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{title}</Text>
      {subtitle ? (
        <Text variant="callout" color={theme.color.textDim} style={{ marginTop: spacing.xs, lineHeight: 22 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function YesNoToggle({ value, onChange, yesLabel = 'Yes', noLabel = 'No' }: {
  value: boolean | null; onChange: (v: boolean) => void; yesLabel?: string; noLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {([true, false] as const).map((opt) => {
        const active = value === opt;
        const activeBg = opt ? theme.color.danger : theme.color.success;
        return (
          <Pressable key={String(opt)} onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(opt); }}
            accessibilityRole="button" accessibilityState={{ selected: active }} style={{ flex: 1 }}>
            <View style={{
              height: 64, borderRadius: radius.card,
              backgroundColor: active ? activeBg : theme.color.surface,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: active ? activeBg : theme.color.hairline,
            }}>
              <Text variant="headline" color={active ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                {opt ? yesLabel : noLabel}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function AmountInput({ value, onChange, currency, onCurrencyChange }: {
  value: string; onChange: (v: string) => void; currency: string; onCurrencyChange?: (s: string) => void;
}) {
  const theme = useTheme();
  return (
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
            <TextInput value={value} onChangeText={(t) => onChange(formatMoneyInput(t, true))}
              placeholder="0" placeholderTextColor={theme.color.textDim} keyboardType="number-pad"
              autoFocus underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={{ flex: 1, minWidth: 0, color: theme.color.text, fontSize: 34, lineHeight: 40,
                fontFamily: 'Nunito_900Black', paddingVertical: spacing.sm }} />
          </View>
        </View>
      </View>
      {onCurrencyChange && (
        <View style={{ width: '100%', alignSelf: 'center', gap: spacing.sm }}>
          <Text variant="footnote" dim center>Currency</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
            {SUPPORTED_CURRENCIES.map((option) => {
              const active = currency === option.symbol;
              return (
                <Pressable key={option.code} onPress={() => onCurrencyChange(option.symbol)}
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
      )}
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

function SummaryRow({ icon, iconColor, label, value }: {
  icon: string; iconColor: string; label: string; value: string;
}) {
  const theme = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
      paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.hairline,
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
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={onCancel} />
        <View style={{
          backgroundColor: theme.color.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
          paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: Math.max(insets.bottom, spacing.xl),
          gap: spacing.lg, ...elevation.e2,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline, alignSelf: 'center', marginBottom: spacing.xs }} />
          <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>Submit Journal Entry?</Text>
          <Text variant="callout" color={theme.color.textDim} style={{ lineHeight: 23 }}>
            You can only submit one journal entry per day. After submission this becomes your official record for today.
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

export default function OnlineShoppingJournalEntry() {
  const theme    = useTheme();
  const safeBack = useSafeBack('/(tabs)/journal');
  const standaloneProfile = useProfile();
  const journalSequence = useJournalSequence('online_shopping', safeBack);
  const profile = journalSequence.sequence ? journalSequence.profile : standaloneProfile;
  const currency = profile?.currency ?? DEFAULT_CURRENCY;
  const insets   = useSafeAreaInsets();

  const standaloneTodayJournal = useTodayOnlineShoppingJournal();
  const todayJournal = journalSequence.sequence ? journalSequence.todayJournal : standaloneTodayJournal;
  const alreadySubmitted = todayJournal != null;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const submitting = useRef(false);

  // Form state
  const draft = journalSequence.draft;
  const [shopped, setShopped] = useState<boolean | null>(() => (draft?.shopped as boolean | null | undefined) ?? null);
  const [moneyBalance, setMoneyBalance] = useState(() => (draft?.moneyBalance as string | undefined) ?? '');
  const [mood, setMood] = useState(() => (draft?.mood as number | undefined) ?? 5);
  const [whatHelped, setWhatHelped] = useState(() => (draft?.whatHelped as string | undefined) ?? '');
  const [reflection, setReflection] = useState(() => (draft?.reflection as string | undefined) ?? '');
  const [amountSpent, setAmountSpent] = useState(() => (draft?.amountSpent as string | undefined) ?? '');
  const [whereShopped, setWhereShopped] = useState<ShopOption | null>(() => (draft?.whereShopped as ShopOption | null | undefined) ?? null);
  const [emotions, setEmotions] = useState<EmotionOption[]>(() => (draft?.emotions as EmotionOption[] | undefined) ?? []);
  const [trigger, setTrigger] = useState<TriggerOption | null>(() => (draft?.trigger as TriggerOption | null | undefined) ?? null);
  const [nextTimePlan, setNextTimePlan] = useState(() => (draft?.nextTimePlan as string | undefined) ?? '');
  const [feelingNow, setFeelingNow] = useState(() => (draft?.feelingNow as string | undefined) ?? '');

  // Step management
  const [stepIdx, setStepIdx] = useState(() => (draft?.stepIdx as number | undefined) ?? 0);
  const frozenSteps = useRef<StepId[] | null>(draft && shopped !== null ? buildSteps(shopped) : null);
  const steps       = frozenSteps.current ?? buildSteps(null);
  const currentStep = steps[stepIdx];
  const totalSteps  = steps.length;
  const isLastStep  = stepIdx === (frozenSteps.current ?? steps).length - 1;

  useEffect(() => {
    if (!journalSequence.sequence) return;
    journalSequence.saveDraft({ shopped, moneyBalance, mood, whatHelped, reflection,
      amountSpent, whereShopped, emotions, trigger, nextTimePlan, feelingNow, stepIdx });
  }, [amountSpent, emotions, feelingNow, journalSequence.sequence, moneyBalance, mood, nextTimePlan, reflection, shopped, stepIdx, trigger, whatHelped, whereShopped]);

  const slideAnim = useRef(new Animated.Value(0)).current;
  function slide(dir: 'forward' | 'back', cb: () => void) {
    slideAnim.setValue(dir === 'forward' ? 14 : -14);
    Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    cb();
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'did_shop':       return shopped !== null;
      case 'money_balance':  return moneyBalance.trim() !== '';
      case 'amount_spent':   return amountSpent.trim() !== '';
      case 'where_shopped':  return whereShopped !== null;
      case 'emotions':       return emotions.length > 0;
      case 'trigger_relapse': return trigger !== null;
      default:               return true;
    }
  }

  function goNext() {
    if (!canProceed()) return;
    Haptics.selectionAsync().catch(() => {});
    if (currentStep === 'did_shop' && frozenSteps.current === null) {
      frozenSteps.current = buildSteps(shopped);
    }
    const active = frozenSteps.current ?? steps;
    if (stepIdx < active.length - 1) slide('forward', () => setStepIdx((i) => i + 1));
  }

  function goBack() {
    if (stepIdx === 0) { safeBack(); return; }
    Haptics.selectionAsync().catch(() => {});
    const active = frozenSteps.current ?? steps;
    const prevStep = active[stepIdx - 1];
    if (prevStep === 'did_shop') frozenSteps.current = null;
    slide('back', () => setStepIdx((i) => i - 1));
  }

  function finalCommit() {
    if (submitting.current) return;
    submitting.current = true;
    setConfirmVisible(false);

    // Calculate remaining money: moneyBalance - amountSpent
    const balance = numericValue(moneyBalance);
    const spent = shopped === true ? numericValue(amountSpent) : 0;
    const remainingMoney = Math.max(0, balance - spent);

    journalSequence.submitJournal({
      shopped: shopped === true,
      text: reflection.trim() || (shopped === true ? 'Online shopping relapse recorded.' : 'Clean day recorded.'),
      mood,
      moneyBalance: balance || undefined,
      shopAmountSpent: shopped === true ? spent || undefined : undefined,
      shopSpendCurrency: shopped === true ? currency : undefined,
      shopRemainingMoney: shopped === true ? remainingMoney : undefined,
      shopWhere: shopped === true ? (whereShopped ?? undefined) : undefined,
      shopEmotions: shopped === true ? emotions : undefined,
      shopTrigger: shopped === true ? (trigger ?? undefined) : undefined,
      shopNextTimePlan: shopped === true ? nextTimePlan.trim() || undefined : undefined,
      shopFeelingNow: shopped === true ? feelingNow.trim() || undefined : undefined,
      shopWhatHelped: shopped === false ? whatHelped.trim() || undefined : undefined,
    });
    journalSequence.clearDraft();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    journalSequence.finishSection();
  }

  const inputStyle = {
    borderRadius: radius.input, backgroundColor: theme.color.surface,
    borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg,
    color: theme.color.text, fontSize: 17, fontFamily: 'Nunito_600SemiBold',
  } as const;

  // Already submitted gate
  if (alreadySubmitted) {
    const todayStr = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = todayJournal ? new Date(todayJournal.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const accent = todayJournal?.shopped === true ? theme.color.danger : todayJournal?.shopped === false ? theme.color.success : theme.color.primary;
    return (
      <Screen scroll={false}>
        <View style={{ flexDirection: 'row', marginTop: spacing.xs, marginBottom: spacing.xl }}>
          <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
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
            <View style={{ marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.chip, backgroundColor: accent + '15', borderWidth: 1, borderColor: accent + '30' }}>
              <Text variant="footnote" color={accent} style={{ fontFamily: 'Nunito_700Bold' }}>{todayStr}</Text>
            </View>
          </View>
          <Button label="View all entries" onPress={safeBack} kind="secondary" full />
        </View>
      </Screen>
    );
  }

  function renderStep() {
    switch (currentStep) {
      case 'did_shop':
        return (
          <>
            <StepHeading title="Did you shop online today?" subtitle="Be honest - this is just for you. No judgment here." />
            <YesNoToggle value={shopped} onChange={setShopped} yesLabel="Yes, I did" noLabel="No, I didn't" />
            {shopped === false && (
              <Card tone="successSoft" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: theme.color.success }}>
                <Ionicons name="checkmark-circle-outline" size={22} color={theme.color.success} />
                <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>Another clean day. Every single one matters.</Text>
              </Card>
            )}
            {shopped === true && (
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
            <StepHeading title="How much money do you have today?" subtitle="Enter your current balance. This helps track your financial wellbeing." />
            <AmountInput value={moneyBalance} onChange={setMoneyBalance} currency={currency}
              onCurrencyChange={(sym) => useStore.getState().updateProfile({ currency: sym })} />
          </>
        );

      case 'amount_spent':
        return (
          <>
            <StepHeading title="How much did you spend?" subtitle="Enter the total amount you spent on online shopping." />
            <AmountInput value={amountSpent} onChange={setAmountSpent} currency={currency}
              onCurrencyChange={(sym) => useStore.getState().updateProfile({ currency: sym })} />
          </>
        );

      case 'where_shopped':
        return (
          <>
            <StepHeading title="Where did you shop?" subtitle="Select the platform or store." />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SHOP_OPTIONS.map((opt) => (
                <Pill key={opt} label={opt} active={whereShopped === opt}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setWhereShopped(opt); }} />
              ))}
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

      case 'emotions':
        return (
          <>
            <StepHeading title="What were you feeling before shopping?" subtitle="Select all that apply." />
            <MultiGrid options={EMOTION_OPTIONS} selected={emotions}
              onToggle={(e) => setEmotions((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e])} />
          </>
        );

      case 'trigger_relapse':
        return (
          <>
            <StepHeading title="What triggered you?" subtitle="Understanding your trigger helps prevent it next time." />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {ONLINE_SHOPPING_TRIGGERS.map((opt) => (
                <Pill key={opt} label={opt} active={trigger === opt}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setTrigger(opt); }} />
              ))}
            </View>
          </>
        );

      case 'next_time_plan':
        return (
          <>
            <StepHeading title="What will you do differently next time?" subtitle="Having a plan helps you resist the urge." />
            <TextInput value={nextTimePlan} onChangeText={setNextTimePlan}
              placeholder="e.g. Wait 24 hours before buying, delete shopping apps…" placeholderTextColor={theme.color.textDim}
              multiline underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 140, textAlignVertical: 'top' }]} />
          </>
        );

      case 'feeling_now':
        return (
          <>
            <StepHeading title="How do you feel now after shopping?" subtitle="Optional - any reflections on the purchase." />
            <TextInput value={feelingNow} onChangeText={setFeelingNow}
              placeholder="e.g. Regretful, satisfied, anxious…" placeholderTextColor={theme.color.textDim}
              multiline underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 140, textAlignVertical: 'top' }]} />
          </>
        );

      case 'what_helped':
        return (
          <>
            <StepHeading title="What helped you stay shop-free?" subtitle="Optional - note what worked today." />
            <TextInput value={whatHelped} onChangeText={setWhatHelped}
              placeholder="e.g. Unfollowed stores, set a budget, called a friend…" placeholderTextColor={theme.color.textDim}
              multiline underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 140, textAlignVertical: 'top' }]} />
          </>
        );

      case 'reflection_clean':
        return (
          <>
            <StepHeading title="Any reflections?" subtitle="Optional - anything on your mind today?" />
            <TextInput value={reflection} onChangeText={setReflection}
              placeholder="What's on your mind? Wins, challenges, things you're proud of…" placeholderTextColor={theme.color.textDim}
              multiline underlineColorAndroid="transparent" selectionColor={theme.color.primary}
              style={[inputStyle, { minHeight: 180, textAlignVertical: 'top' }]} />
          </>
        );

      case 'summary': {
        const balance = numericValue(moneyBalance);
        const spent = shopped === true ? numericValue(amountSpent) : 0;
        const remaining = Math.max(0, balance - spent);
        return (
          <>
            <StepHeading title="Review your entry" subtitle="Take a moment before saving." />
            <View style={{ backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
              {shopped != null && (
                <SummaryRow icon={shopped ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  iconColor={shopped ? theme.color.danger : theme.color.success}
                  label="Today" value={shopped ? 'Relapse' : 'Clean day'} />
              )}
              {moneyBalance !== '' && (
                <SummaryRow icon="wallet-outline" iconColor={theme.color.primary} label="Balance" value={formatMoney(balance, currency)} />
              )}
              {shopped === true && amountSpent !== '' && (
                <SummaryRow icon="cash-outline" iconColor={theme.color.danger} label="Spent" value={formatMoney(spent, currency)} />
              )}
              {shopped === true && moneyBalance !== '' && amountSpent !== '' && (
                <SummaryRow icon="trending-down-outline" iconColor={theme.color.success} label="Remaining" value={formatMoney(remaining, currency)} />
              )}
              {shopped === true && whereShopped && (
                <SummaryRow icon="cart-outline" iconColor={theme.color.textDim} label="Where" value={whereShopped} />
              )}
              {shopped === true && emotions.length > 0 && (
                <SummaryRow icon="heart-outline" iconColor={theme.color.textDim} label="Emotions" value={emotions.join(', ')} />
              )}
              {shopped === true && trigger && (
                <SummaryRow icon="flash-outline" iconColor={theme.color.textDim} label="Trigger" value={trigger} />
              )}
              {shopped === true && nextTimePlan.trim() && (
                <SummaryRow icon="bookmark-outline" iconColor={theme.color.textDim} label="Plan" value={nextTimePlan.trim()} />
              )}
              {shopped === true && feelingNow.trim() && (
                <SummaryRow icon="chatbubble-outline" iconColor={theme.color.textDim} label="Feeling" value={feelingNow.trim()} />
              )}
              {shopped === false && whatHelped.trim() && (
                <SummaryRow icon="star-outline" iconColor={theme.color.success} label="Helped" value={whatHelped.trim()} />
              )}
              <SummaryRow icon="bar-chart-outline" iconColor={theme.color.primary} label="Mood" value={`${mood} / 10`} />
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
      {journalSequence.sequence ? <JournalSequenceBanner addiction="online_shopping" /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, marginBottom: spacing.xl }}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={stepIdx === 0 ? 'Close' : 'Back'}
          style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name={stepIdx === 0 ? 'close' : 'chevron-back'} size={22} color={theme.color.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar progress={stepIdx / Math.max(totalSteps - 1, 1)} height={8} />
        </View>
        <Text variant="footnote" dim style={{ fontVariant: ['tabular-nums'] }}>{stepIdx + 1} of {totalSteps}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 16}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={{ transform: [{ translateX: slideAnim.interpolate({ inputRange: [-14, 0, 14], outputRange: [-14, 0, 14], extrapolate: 'clamp' }) }] }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>
        <View style={{ paddingTop: spacing.sm }}>
          <Button label={isLastStep ? 'Save entry' : 'Continue'} onPress={isLastStep ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setConfirmVisible(true); } : goNext} disabled={!canProceed()} full />
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal visible={confirmVisible} onConfirm={finalCommit} onCancel={() => setConfirmVisible(false)} />
    </Screen>
  );
}

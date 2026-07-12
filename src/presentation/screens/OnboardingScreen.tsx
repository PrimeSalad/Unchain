import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { Mascot } from '../components/Mascot';
import { ProgressBar } from '../components/ProgressBar';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '@/application/store';
import {
  ADDICTIONS,
  addictionMeta,
  TRIGGERS,
  type AddictionType,
  type ExpensePeriod,
} from '@/domain/gambling';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';

const PERIODS: ExpensePeriod[] = ['daily', 'weekly', 'monthly'];

type StepKey =
  | 'welcome'
  | 'identity'
  | 'type'
  | 'specific'
  | 'lastUsed'
  | 'expense'
  | 'triggers'
  | 'reason'
  | 'start';

/**
 * Returns the Unix timestamp for the START (midnight 00:00:00.000) of the
 * local calendar day that was `daysAgo` days before today.
 *
 * e.g. today = July 7, daysAgo = 6  →  July 1 @ 00:00:00 local
 *      today = July 7, daysAgo = 0  →  July 7 @ 00:00:00 local
 *
 * Using calendar arithmetic (year/month/day - N) guarantees the result is
 * always a true local-calendar day, regardless of DST or time of day.
 */
function localMidnightDaysAgo(daysAgo: number): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo).getTime();
}

export function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const complete = useStore((s) => s.completeSetup);

  const [index, setIndex] = useState(0);
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [atype, setAType] = useState<AddictionType | null>(null);
  const [detail, setDetail] = useState('');
  const [daysAgo, setDaysAgo] = useState(0);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<ExpensePeriod>('weekly');
  const [triggers, setTriggers] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  const meta = atype ? addictionMeta(atype) : null;

  const steps = useMemo<StepKey[]>(() => {
    const s: StepKey[] = ['welcome', 'identity', 'type', 'specific', 'lastUsed'];
    if (!meta || meta.hasExpense) s.push('expense');
    s.push('triggers', 'reason', 'start');
    return s;
  }, [meta]);

  const step = steps[Math.min(index, steps.length - 1)];
  const next = () => setIndex((i) => Math.min(steps.length - 1, i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const toggleTrigger = (t: string) =>
    setTriggers((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));

  const finish = () => {
    complete({
      name: nickname.trim() || 'Friend',
      age: age ? parseInt(age, 10) : undefined,
      addictionType: atype ?? 'other',
      addictionDetail: detail.trim() || undefined,
      // Store as the LOCAL midnight of the day they last used.
      // e.g. daysAgo=6, today=July 7  →  startedAt = July 1 @ 00:00 local.
      // This makes calendar math exact - no fractional-day drift.
      startedAt: localMidnightDaysAgo(daysAgo),
      expenseAmount: meta && !meta.hasExpense ? 0 : parseInt(amount, 10) || 0,
      expensePeriod: period,
      currency: '₱',
      triggers,
      reason: reason.trim(),
    });
    router.replace('/(tabs)/home');
  };

  const specificDone = meta ? (meta.specificOptions ? detail.length > 0 : true) : false;

  const inputStyle = {
    borderRadius: radius.input,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.hairline,
    padding: spacing.lg,
    color: theme.color.text,
    fontSize: 17,
  } as const;

  return (
    <Screen edges={['top', 'bottom']} scroll={step === 'type' || step === 'specific' || step === 'triggers'}>
      {/* Top bar: circular back button + progress + step counter */}
      {index > 0 && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          marginTop: spacing.xs,
          marginBottom: spacing.xl,
        }}>
          <Pressable
            onPress={back}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.round,
              backgroundColor: theme.color.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.94 : 1 }],
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={index / (steps.length - 1)} height={8} />
          </View>
          <Text variant="footnote" dim style={{ fontVariant: ['tabular-nums'] }}>
            {index + 1} of {steps.length}
          </Text>
        </View>
      )}

      {/* ── Welcome ─────────────────────────────────────────────────────── */}
      {step === 'welcome' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state="happy" size={180} />
          <Text variant="display" center style={{ marginTop: spacing.lg, fontSize: 34, lineHeight: 40 }}>
            Welcome to Unchainly
          </Text>
          <Text variant="body" dim center style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
            Your private companion for breaking free - one day at a time. Everything stays on your device. No account, no internet, no judgment.
          </Text>
          <Button label="Get started" onPress={next} full style={{ marginTop: spacing.xxxl }} />
        </View>
      )}

      {/* ── Identity ────────────────────────────────────────────────────── */}
      {step === 'identity' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Text variant="title1">What's your nickname?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
            Add a nickname Unchainly can use in check-ins. This never leaves your device.
          </Text>
          <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>Nickname</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="Your nickname"
            placeholderTextColor={theme.color.textDim}
            style={inputStyle}
          />
          <Text variant="footnote" dim style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Age</Text>
          <TextInput
            value={age}
            onChangeText={(t) => setAge(t.replace(/[^0-9]/g, '').slice(0, 3))}
            placeholder="Your age"
            placeholderTextColor={theme.color.textDim}
            keyboardType="number-pad"
            style={inputStyle}
          />
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!nickname.trim()} full />
        </KeyboardAvoidingView>
      )}

      {/* ── Type ────────────────────────────────────────────────────────── */}
      {step === 'type' && (
        <View>
          <Text variant="title1">What are you overcoming?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            Choose the addiction you want to recover from.
          </Text>
          <Card padding={0}>
            {ADDICTIONS.map((a, i) => {
              const active = atype === a.key;
              return (
                <Pressable
                  key={a.key}
                  onPress={() => { setAType(a.key); setDetail(''); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline,
                  }}
                >
                  <Text variant="callout" style={{ flex: 1 }} color={active ? theme.color.primary : theme.color.text}>
                    {a.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={20} color={theme.color.primary} />}
                </Pressable>
              );
            })}
          </Card>
          <Button label="Continue" onPress={next} disabled={!atype} full style={{ marginTop: spacing.xl }} />
        </View>
      )}

      {/* ── Specific ────────────────────────────────────────────────────── */}
      {step === 'specific' && meta && (
        <View>
          <Text variant="title1">{meta.specificQuestion}</Text>
          <View style={{ height: spacing.lg }} />
          {meta.specificOptions ? (
            <Card padding={0}>
              {meta.specificOptions.map((opt, i) => {
                const active = detail === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setDetail(opt)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline,
                    }}
                  >
                    <Text variant="callout" style={{ flex: 1 }} color={active ? theme.color.primary : theme.color.text}>
                      {opt}
                    </Text>
                    {active && <Ionicons name="checkmark" size={20} color={theme.color.primary} />}
                  </Pressable>
                );
              })}
            </Card>
          ) : (
            <TextInput
              value={detail}
              onChangeText={setDetail}
              placeholder="Type here…"
              placeholderTextColor={theme.color.textDim}
              multiline
              style={[inputStyle, { minHeight: 90, textAlignVertical: 'top' }]}
            />
          )}
          <Button label="Continue" onPress={next} disabled={!specificDone} full style={{ marginTop: spacing.xl }} />
        </View>
      )}

      {/* ── Last used ───────────────────────────────────────────────────── */}
      {step === 'lastUsed' && meta && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">When did you last {meta.verb}?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
            Your streak counts from here.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Pill label="Today"     active={daysAgo === 0} onPress={() => setDaysAgo(0)} />
            <Pill label="Yesterday" active={daysAgo === 1} onPress={() => setDaysAgo(1)} />
          </View>
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="footnote" dim>Or a few days ago</Text>
              <Text variant="title2">
                {daysAgo} {daysAgo === 1 ? 'day' : 'days'} ago
              </Text>
            </View>
            <Stepper
              onDec={() => setDaysAgo((d) => Math.max(0, d - 1))}
              onInc={() => setDaysAgo((d) => d + 1)}
            />
          </Card>
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} full />
        </View>
      )}

      {/* ── Expense ─────────────────────────────────────────────────────── */}
      {step === 'expense' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Text variant="title1">How much did you spend?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
            An estimate is fine - it powers your money-saved counter.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="title1">₱</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
              placeholder="0"
              placeholderTextColor={theme.color.textDim}
              keyboardType="number-pad"
              style={[inputStyle, { flex: 1 }]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            {PERIODS.map((p) => (
              <Pill
                key={p}
                label={p[0].toUpperCase() + p.slice(1)}
                active={period === p}
                onPress={() => setPeriod(p)}
              />
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!amount} full />
        </KeyboardAvoidingView>
      )}

      {/* ── Triggers ────────────────────────────────────────────────────── */}
      {step === 'triggers' && (
        <View>
          <Text variant="title1">What usually triggers you?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            Select all that apply.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(atype === 'pornography' ? PORN_TRIGGERS : TRIGGERS).map((tr) => (
              <Pill
                key={tr}
                label={tr}
                active={triggers.includes(tr)}
                onPress={() => toggleTrigger(tr)}
              />
            ))}
          </View>
          <Button label="Continue" onPress={next} full style={{ marginTop: spacing.xl }} />
        </View>
      )}

      {/* ── Reason ──────────────────────────────────────────────────────── */}
      {step === 'reason' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Text variant="title1">Why do you want to quit?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            You'll see this whenever an urge hits. Make it personal.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="I want to quit so I can build a better future for my family."
            placeholderTextColor={theme.color.textDim}
            multiline
            style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
          />
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!reason.trim()} full />
        </KeyboardAvoidingView>
      )}

      {/* ── Start ───────────────────────────────────────────────────────── */}
      {step === 'start' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state="braced" size={170} />
          <Text variant="title1" center style={{ marginTop: spacing.lg }}>
            You're ready, {nickname.trim() || 'friend'}.
          </Text>
          <Text variant="body" dim center style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
            Your recovery begins now. One day at a time.
          </Text>
          <Button label="Start recovery" onPress={finish} full style={{ marginTop: spacing.xxxl }} />
        </View>
      )}
    </Screen>
  );
}

function Stepper({ onDec, onInc }: { onDec: () => void; onInc: () => void }) {
  const theme = useTheme();
  const btn = (icon: 'remove' | 'add', onPress: () => void, label: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: radius.round,
        backgroundColor: theme.color.surfaceAlt,
        alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={theme.color.primary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {btn('remove', onDec, 'One day fewer')}
      {btn('add', onInc, 'One day more')}
    </View>
  );
}

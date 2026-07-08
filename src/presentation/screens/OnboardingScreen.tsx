import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
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
import { GAMBLING_TYPES, TRIGGERS, type ExpensePeriod, type GamblingType } from '@/domain/gambling';

const MS_PER_DAY = 86_400_000;
const PERIODS: ExpensePeriod[] = ['daily', 'weekly', 'monthly'];
const STEPS = 7;

export function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const complete = useStore((s) => s.completeSetup);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gtype, setGType] = useState<GamblingType | null>(null);
  const [daysAgo, setDaysAgo] = useState(0); // 0 = today
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<ExpensePeriod>('weekly');
  const [triggers, setTriggers] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  const next = () => setStep((s) => Math.min(STEPS, s + 1));
  const toggleTrigger = (t: string) =>
    setTriggers((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const finish = () => {
    complete({
      name: name.trim() || 'Friend',
      age: age ? parseInt(age, 10) : undefined,
      gamblingType: gtype ?? 'other',
      startedAt: Date.now() - daysAgo * MS_PER_DAY,
      expenseAmount: parseInt(amount, 10) || 0,
      expensePeriod: period,
      currency: '₱',
      triggers,
      reason: reason.trim(),
    });
    router.replace('/(tabs)/home');
  };

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
    <Screen edges={['top', 'bottom']} scroll={step === 2 || step === 5}>
      {step > 0 && (
        <View style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          <ProgressBar progress={step / STEPS} />
        </View>
      )}

      {/* 0 — Welcome */}
      {step === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state="happy" size={180} />
          <Text variant="title1" center style={{ marginTop: spacing.lg }}>
            Welcome to Unchained
          </Text>
          <Text variant="body" dim center style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
            A private companion for quitting gambling. Everything stays on your device —
            no account, no internet required.
          </Text>
          <Button label="Get started" onPress={next} full style={{ marginTop: spacing.xxxl }} />
        </View>
      )}

      {/* 1 — Name + Age */}
      {step === 1 && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">What's your name?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
            So Unchained can speak to you personally.
          </Text>
          <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={theme.color.textDim} style={inputStyle} />
          <Text variant="footnote" dim style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Age</Text>
          <TextInput value={age} onChangeText={(t) => setAge(t.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="Your age" placeholderTextColor={theme.color.textDim} keyboardType="number-pad" style={inputStyle} />
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!name.trim()} full />
        </View>
      )}

      {/* 2 — Gambling type */}
      {step === 2 && (
        <View>
          <Text variant="title1">What do you gamble on?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            This helps tailor your recovery.
          </Text>
          <Card padding={0}>
            {GAMBLING_TYPES.map((g, i) => {
              const active = gtype === g.key;
              return (
                <Pressable key={g.key} onPress={() => setGType(g.key)} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline }}>
                  <Text variant="callout" style={{ flex: 1 }} color={active ? theme.color.primary : theme.color.text}>{g.label}</Text>
                  {active && <Ionicons name="checkmark" size={20} color={theme.color.primary} />}
                </Pressable>
              );
            })}
          </Card>
          <Button label="Continue" onPress={next} disabled={!gtype} full style={{ marginTop: spacing.xl }} />
        </View>
      )}

      {/* 3 — Last gambled */}
      {step === 3 && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">When did you last gamble?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
            Your streak counts from here.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Pill label="Today" active={daysAgo === 0} onPress={() => setDaysAgo(0)} />
            <Pill label="Yesterday" active={daysAgo === 1} onPress={() => setDaysAgo(1)} />
          </View>
          <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="footnote" dim>Or a few days ago</Text>
              <Text variant="title2">{daysAgo} {daysAgo === 1 ? 'day' : 'days'} ago</Text>
            </View>
            <Stepper onDec={() => setDaysAgo((d) => Math.max(0, d - 1))} onInc={() => setDaysAgo((d) => d + 1)} />
          </Card>
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} full />
        </View>
      )}

      {/* 4 — Expense */}
      {step === 4 && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">How much did you spend?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
            An estimate is fine — it powers your money-saved counter.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="title1">₱</Text>
            <TextInput value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))} placeholder="0" placeholderTextColor={theme.color.textDim} keyboardType="number-pad" style={[inputStyle, { flex: 1 }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            {PERIODS.map((p) => (
              <Pill key={p} label={p[0].toUpperCase() + p.slice(1)} active={period === p} onPress={() => setPeriod(p)} />
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!amount} full />
        </View>
      )}

      {/* 5 — Triggers */}
      {step === 5 && (
        <View>
          <Text variant="title1">What usually triggers you?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            Select all that apply.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {TRIGGERS.map((tr) => (
              <Pill key={tr} label={tr} active={triggers.includes(tr)} onPress={() => toggleTrigger(tr)} />
            ))}
          </View>
          <Button label="Continue" onPress={next} full style={{ marginTop: spacing.xl }} />
        </View>
      )}

      {/* 6 — Reason */}
      {step === 6 && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">Why do you want to quit?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            You'll see this whenever an urge hits. Make it personal.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="I want to stop gambling so I can build a better future for my family."
            placeholderTextColor={theme.color.textDim}
            multiline
            style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
          />
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!reason.trim()} full />
        </View>
      )}

      {/* 7 — Start */}
      {step === 7 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state="braced" size={170} />
          <Text variant="title1" center style={{ marginTop: spacing.lg }}>
            You're ready, {name.trim() || 'friend'}.
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
  const btn = (icon: 'remove' | 'add', onPress: () => void) => (
    <Pressable onPress={onPress} style={{ width: 44, height: 44, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={20} color={theme.color.primary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {btn('remove', onDec)}
      {btn('add', onInc)}
    </View>
  );
}

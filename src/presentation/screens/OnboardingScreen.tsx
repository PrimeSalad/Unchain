import { useMemo, useState } from 'react';
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
import { ADDICTIONS, addictionMeta, TRIGGERS, type AddictionType, type ExpensePeriod } from '@/domain/gambling';

const MS_PER_DAY = 86_400_000;
const PERIODS: ExpensePeriod[] = ['daily', 'weekly', 'monthly'];

type StepKey = 'welcome' | 'identity' | 'type' | 'specific' | 'lastUsed' | 'expense' | 'triggers' | 'reason' | 'start';

export function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const complete = useStore((s) => s.completeSetup);

  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [atype, setAType] = useState<AddictionType | null>(null);
  const [detail, setDetail] = useState('');
  const [daysAgo, setDaysAgo] = useState(0);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<ExpensePeriod>('weekly');
  const [triggers, setTriggers] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  const meta = atype ? addictionMeta(atype) : null;

  // Step sequence — expense is skipped for addictions with no spending.
  const steps = useMemo<StepKey[]>(() => {
    const s: StepKey[] = ['welcome', 'identity', 'type', 'specific', 'lastUsed'];
    if (!meta || meta.hasExpense) s.push('expense');
    s.push('triggers', 'reason', 'start');
    return s;
  }, [meta]);

  const step = steps[Math.min(index, steps.length - 1)];
  const next = () => setIndex((i) => Math.min(steps.length - 1, i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const toggleTrigger = (t: string) => setTriggers((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));

  const finish = () => {
    complete({
      name: name.trim() || 'Friend',
      age: age ? parseInt(age, 10) : undefined,
      addictionType: atype ?? 'other',
      addictionDetail: detail.trim() || undefined,
      startedAt: Date.now() - daysAgo * MS_PER_DAY,
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
    borderRadius: radius.input, backgroundColor: theme.color.surface, borderWidth: 1,
    borderColor: theme.color.hairline, padding: spacing.lg, color: theme.color.text, fontSize: 17,
  } as const;

  return (
    <Screen edges={['top', 'bottom']} scroll={step === 'type' || step === 'specific' || step === 'triggers'}>
      {/* Top bar: Back (every step except the first) + progress */}
      {index > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          <Pressable onPress={back} accessibilityLabel="Back" hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: spacing.md }}>
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
            <Text variant="callout" color={theme.color.primary}>Back</Text>
          </Pressable>
          <ProgressBar progress={index / (steps.length - 1)} />
          <View style={{ height: spacing.xl }} />
        </View>
      )}

      {step === 'welcome' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state="happy" size={180} />
          <Text variant="title1" center style={{ marginTop: spacing.lg }}>Welcome to Unchained</Text>
          <Text variant="body" dim center style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
            A private recovery companion. Everything stays on your device — no account, no internet required.
          </Text>
          <Button label="Get started" onPress={next} full style={{ marginTop: spacing.xxxl }} />
        </View>
      )}

      {step === 'identity' && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">What's your name?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>So Unchained can speak to you personally.</Text>
          <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={theme.color.textDim} style={inputStyle} />
          <Text variant="footnote" dim style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Age</Text>
          <TextInput value={age} onChangeText={(t) => setAge(t.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="Your age" placeholderTextColor={theme.color.textDim} keyboardType="number-pad" style={inputStyle} />
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!name.trim()} full />
        </View>
      )}

      {step === 'type' && (
        <View>
          <Text variant="title1">What are you overcoming?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Choose the addiction you want to recover from.</Text>
          <Card padding={0}>
            {ADDICTIONS.map((a, i) => {
              const active = atype === a.key;
              return (
                <Pressable key={a.key} onPress={() => { setAType(a.key); setDetail(''); }} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline }}>
                  <Text variant="callout" style={{ flex: 1 }} color={active ? theme.color.primary : theme.color.text}>{a.label}</Text>
                  {active && <Ionicons name="checkmark" size={20} color={theme.color.primary} />}
                </Pressable>
              );
            })}
          </Card>
          <Button label="Continue" onPress={next} disabled={!atype} full style={{ marginTop: spacing.xl }} />
        </View>
      )}

      {step === 'specific' && meta && (
        <View>
          <Text variant="title1">{meta.specificQuestion}</Text>
          <View style={{ height: spacing.lg }} />
          {meta.specificOptions ? (
            <Card padding={0}>
              {meta.specificOptions.map((opt, i) => {
                const active = detail === opt;
                return (
                  <Pressable key={opt} onPress={() => setDetail(opt)} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline }}>
                    <Text variant="callout" style={{ flex: 1 }} color={active ? theme.color.primary : theme.color.text}>{opt}</Text>
                    {active && <Ionicons name="checkmark" size={20} color={theme.color.primary} />}
                  </Pressable>
                );
              })}
            </Card>
          ) : (
            <TextInput value={detail} onChangeText={setDetail} placeholder="Type here…" placeholderTextColor={theme.color.textDim} multiline style={[inputStyle, { minHeight: 90, textAlignVertical: 'top' }]} />
          )}
          <Button label="Continue" onPress={next} disabled={!specificDone} full style={{ marginTop: spacing.xl }} />
        </View>
      )}

      {step === 'lastUsed' && meta && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">When did you last {meta.verb}?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>Your streak counts from here.</Text>
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

      {step === 'expense' && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">How much did you spend?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>An estimate is fine — it powers your money-saved counter.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="title1">₱</Text>
            <TextInput value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))} placeholder="0" placeholderTextColor={theme.color.textDim} keyboardType="number-pad" style={[inputStyle, { flex: 1 }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            {PERIODS.map((p) => <Pill key={p} label={p[0].toUpperCase() + p.slice(1)} active={period === p} onPress={() => setPeriod(p)} />)}
          </View>
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!amount} full />
        </View>
      )}

      {step === 'triggers' && (
        <View>
          <Text variant="title1">What usually triggers you?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Select all that apply.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {TRIGGERS.map((tr) => <Pill key={tr} label={tr} active={triggers.includes(tr)} onPress={() => toggleTrigger(tr)} />)}
          </View>
          <Button label="Continue" onPress={next} full style={{ marginTop: spacing.xl }} />
        </View>
      )}

      {step === 'reason' && (
        <View style={{ flex: 1 }}>
          <Text variant="title1">Why do you want to quit?</Text>
          <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>You'll see this whenever an urge hits. Make it personal.</Text>
          <TextInput value={reason} onChangeText={setReason} placeholder="I want to quit so I can build a better future for my family." placeholderTextColor={theme.color.textDim} multiline style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]} />
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={next} disabled={!reason.trim()} full />
        </View>
      )}

      {step === 'start' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state="braced" size={170} />
          <Text variant="title1" center style={{ marginTop: spacing.lg }}>You're ready, {name.trim() || 'friend'}.</Text>
          <Text variant="body" dim center style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>Your recovery begins now. One day at a time.</Text>
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
  return <View style={{ flexDirection: 'row', gap: spacing.sm }}>{btn('remove', onDec)}{btn('add', onInc)}</View>;
}

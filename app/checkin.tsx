import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Card } from '@/presentation/components/Card';
import { Button } from '@/presentation/components/Button';
import { Pill } from '@/presentation/components/Pill';
import { Slider } from '@/presentation/components/Slider';
import { Mascot } from '@/presentation/components/Mascot';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore, useTodayCheckIn, useProfile } from '@/application/store';
import { TRIGGERS, addictionMeta } from '@/domain/gambling';

export default function CheckIn() {
  const theme = useTheme();
  const router = useRouter();
  const submit = useStore((s) => s.submitCheckIn);
  const logRelapse = useStore((s) => s.logRelapse);
  const already = useTodayCheckIn();
  const profile = useProfile();
  const verb = profile ? addictionMeta(profile.addictionType).verb : 'gamble';

  const setTodayMood = useStore((s) => s.setTodayMood);
  const [gambled, setGambled] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [editingMood, setEditingMood] = useState(false);
  const [editMood, setEditMood] = useState(5);
  const [moodSaved, setMoodSaved] = useState(false);

  // shared
  const [triggers, setTriggers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  // clean day
  const [mood, setMood] = useState(5);
  const [urge, setUrge] = useState(3);
  // relapse
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [feeling, setFeeling] = useState('');

  const toggle = (t: string) => setTriggers((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));

  const input = {
    borderRadius: radius.input, backgroundColor: theme.color.surface, borderWidth: 1,
    borderColor: theme.color.hairline, padding: spacing.lg, color: theme.color.text, fontSize: 16, textAlignVertical: 'top' as const,
  };

  const save = () => {
    if (gambled) {
      logRelapse({ amount: amount ? parseInt(amount, 10) : undefined, whatHappened: what.trim() || undefined, cause: triggers.join(', ') || undefined, feeling: feeling.trim() || undefined });
      submit({ gambled: true, notes: what.trim() || undefined, triggers });
    } else {
      submit({ gambled: false, mood, urgeStrength: urge, triggers, notes: notes.trim() || undefined });
    }
    setSaved(true);
  };

  const Header = (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm }}>
      <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Close">
        <Ionicons name="close" size={26} color={theme.color.textDim} />
      </Pressable>
    </View>
  );

  if (already && !saved) {
    const hasMood = already.mood != null;
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        {Header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state="happy" size={140} />
          <Text variant="title2" center style={{ marginTop: spacing.lg }}>You've checked in today</Text>
          <Text variant="body" dim center style={{ marginTop: spacing.sm }}>
            {moodSaved
              ? 'Mood saved. Come back tomorrow — one day at a time.'
              : hasMood
                ? `Today's mood: ${already.mood}/10`
                : "You haven't recorded today's mood yet."}
          </Text>

          {editingMood ? (
            <Card style={{ alignSelf: 'stretch', marginTop: spacing.xl }}>
              <Slider label="How is your mood today?" value={editMood} onChange={setEditMood} />
              <Button
                label="Save mood"
                onPress={() => {
                  setTodayMood(editMood);
                  setEditingMood(false);
                  setMoodSaved(true);
                }}
                full
                style={{ marginTop: spacing.md }}
              />
            </Card>
          ) : (
            <Button
              label={hasMood ? 'Edit mood' : "Record today's mood"}
              kind="secondary"
              onPress={() => {
                setEditMood(already.mood ?? 5);
                setMoodSaved(false);
                setEditingMood(true);
              }}
              style={{ marginTop: spacing.xl }}
            />
          )}
        </View>
        <Button label="Done" onPress={() => router.back()} full />
      </Screen>
    );
  }

  if (saved) {
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot state={gambled ? 'comfort' : 'celebrate'} size={150} />
          <Text variant="title2" center style={{ marginTop: spacing.lg }}>
            {gambled ? "A slip isn't the end. Your recovery continues." : "That's another day protected."}
          </Text>
          <Text variant="body" dim center style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }}>
            Every honest check-in makes your recovery stronger.
          </Text>
        </View>
        <Button label="Done" onPress={() => router.replace('/(tabs)/home')} full />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      {Header}
      <Text variant="title1" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>Daily Check-in</Text>

      <Text variant="headline" style={{ marginBottom: spacing.md }}>Did you {verb} today?</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Choice label="No" active={gambled === false} onPress={() => setGambled(false)} good />
        <Choice label="Yes" active={gambled === true} onPress={() => setGambled(true)} />
      </View>

      {gambled === false && (
        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          <Card><Slider label="How was your mood today?" value={mood} onChange={setMood} /></Card>
          <Card><Slider label="How strong were the urges?" value={urge} onChange={setUrge} /></Card>
          <View>
            <Text variant="headline" style={{ marginBottom: spacing.md }}>What triggered them?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {TRIGGERS.map((t) => <Pill key={t} label={t} active={triggers.includes(t)} onPress={() => toggle(t)} />)}
            </View>
          </View>
          <TextInput value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={theme.color.textDim} multiline style={[input, { minHeight: 80 }]} />
          <Button label="Save check-in" onPress={save} full />
        </View>
      )}

      {gambled === true && (
        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <Text variant="body" dim>Thank you for being honest. This is data, not failure.</Text>
          <View>
            <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>How much did you spend?</Text>
            <TextInput value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))} placeholder="₱0" placeholderTextColor={theme.color.textDim} keyboardType="number-pad" style={input} />
          </View>
          <TextInput value={what} onChangeText={setWhat} placeholder="What happened?" placeholderTextColor={theme.color.textDim} multiline style={[input, { minHeight: 70 }]} />
          <View>
            <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>What caused it?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {TRIGGERS.map((t) => <Pill key={t} label={t} active={triggers.includes(t)} onPress={() => toggle(t)} />)}
            </View>
          </View>
          <TextInput value={feeling} onChangeText={setFeeling} placeholder="How do you feel right now?" placeholderTextColor={theme.color.textDim} multiline style={[input, { minHeight: 70 }]} />
          <Button label="Save" onPress={save} full />
        </View>
      )}
    </Screen>
  );
}

function Choice({ label, active, onPress, good }: { label: string; active: boolean; onPress: () => void; good?: boolean }) {
  const theme = useTheme();
  const activeColor = good ? theme.color.success : theme.color.accent;
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Card style={{ alignItems: 'center', paddingVertical: spacing.lg, borderWidth: 2, borderColor: active ? activeColor : 'transparent' }}>
        <Text variant="headline" color={active ? activeColor : theme.color.text}>{label}</Text>
      </Card>
    </Pressable>
  );
}

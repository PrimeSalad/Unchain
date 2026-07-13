import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Card } from '@/presentation/components/Card';
import { Button } from '@/presentation/components/Button';
import { Pill } from '@/presentation/components/Pill';
import { Slider } from '@/presentation/components/Slider';
import { Mascot } from '@/presentation/components/Mascot';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useTodayCheckIn, useProfile } from '@/application/store';
import { DEFAULT_CURRENCY, TRIGGERS, addictionMeta, formatMoneyInput } from '@/domain/gambling';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';

export default function CheckIn() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const submit = useStore((s) => s.submitCheckIn);
  const logRelapse = useStore((s) => s.logRelapse);
  const already = useTodayCheckIn();
  const profile = useProfile();
  const meta = profile ? addictionMeta(profile.addictionType) : null;
  const verb = meta?.verb ?? 'gamble';
  // Money questions only make sense for addictions with a spend component.
  const hasExpense = meta?.hasExpense ?? true;
  // Trigger options match the addiction, same as onboarding and the journal.
  const triggerOptions = profile?.addictionType === 'pornography' ? PORN_TRIGGERS : TRIGGERS;

  const setTodayMood = useStore((s) => s.setTodayMood);
  const [gambled, setGambled] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [editingMood, setEditingMood] = useState(false);
  const [editMood, setEditMood] = useState(5);
  const [moodSaved, setMoodSaved] = useState(false);
  const savingRef = useRef(false);

  // shared
  const [triggers, setTriggers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  // clean day
  const [mood, setMood] = useState(5);
  const [urge, setUrge] = useState(1);
  // relapse — `amount` stores raw digits only; displayed with commas
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [feeling, setFeeling] = useState('');
  const formViewportRef = useRef<View>(null);
  const formScrollRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);
  const amountInputRef = useRef<TextInput>(null);
  const whatInputRef = useRef<TextInput>(null);
  const feelingInputRef = useRef<TextInput>(null);
  const focusedInputRef = useRef<TextInput | null>(null);
  const scrollOffsetRef = useRef(0);

  const toggle = (t: string) => setTriggers((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));

  const revealInput = useCallback((input: TextInput | null, keyboardTop?: number) => {
    if (!input) return;

    if (Platform.OS === 'web') {
      setTimeout(() => {
        const active = typeof document === 'undefined' ? null : document.activeElement;
        if (active instanceof HTMLElement) {
          active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
      return;
    }

    requestAnimationFrame(() => {
      input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
        formViewportRef.current?.measureInWindow((_scrollX, scrollY, _scrollWidth, scrollHeight) => {
          const viewportBottom = scrollY + scrollHeight;
          const visibleBottom = keyboardTop && keyboardTop > scrollY
            ? Math.min(viewportBottom, keyboardTop)
            : viewportBottom;
          const hiddenBy = inputY + inputHeight - (visibleBottom - spacing.md);
          if (hiddenBy > 0) {
            formScrollRef.current?.scrollTo({
              y: scrollOffsetRef.current + hiddenBy,
              animated: true,
            });
          }
        });
      });
    });
  }, []);

  const focusInput = (input: TextInput | null) => {
    focusedInputRef.current = input;
    revealInput(input);
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const revealFocused = (event: KeyboardEvent) => {
      revealInput(focusedInputRef.current, event.endCoordinates.screenY);
    };
    const shown = Keyboard.addListener('keyboardDidShow', revealFocused);
    const changed = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardDidChangeFrame', revealFocused)
      : null;
    return () => {
      shown.remove();
      changed?.remove();
    };
  }, [revealInput]);

  const input = {
    borderRadius: radius.input,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.hairline,
    padding: spacing.lg,
    color: theme.color.text,
    fontSize: 16,
    textAlignVertical: 'top' as const,
  };

  const save = () => {
    if (gambled === null || savingRef.current) return;
    savingRef.current = true;
    Keyboard.dismiss();
    focusedInputRef.current = null;
    if (gambled) {
      logRelapse({ amount: hasExpense && amount ? parseInt(amount.replace(/,/g, ''), 10) : undefined, whatHappened: what.trim() || undefined, cause: triggers.join(', ') || undefined, feeling: feeling.trim() || undefined });
      submit({ gambled: true, mood, notes: what.trim() || undefined, triggers });
    } else {
      submit({ gambled: false, mood, urgeStrength: urge, triggers, notes: notes.trim() || undefined });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaved(true);
  };

  const Header = (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm }}>
      <Pressable
        onPress={safeBack}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: radius.round,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? theme.color.surfaceAlt : 'transparent',
        })}
      >
        <Ionicons name="close" size={26} color={theme.color.textDim} />
      </Pressable>
    </View>
  );

  if (already && !saved) {
    const hasMood = already.mood != null;
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        {Header}
        <ScrollView
          style={{ flex: 1, alignSelf: 'stretch' }}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Mascot state="happy" size={editingMood ? 96 : 140} />
          <Text variant="title2" center style={{ marginTop: editingMood ? spacing.md : spacing.lg }}>You've checked in today</Text>
          <Text variant="body" dim center style={{ marginTop: spacing.sm }}>
            {moodSaved
              ? 'Mood saved. Come back tomorrow - one day at a time.'
              : hasMood
                ? `Today's mood: ${already.mood}/10`
                : "You haven't recorded today's mood yet."}
          </Text>

          {editingMood ? (
            <Card style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
              <Slider label="How is your mood today?" value={editMood} onChange={setEditMood} />
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
        </ScrollView>
        <Button
          label={editingMood ? 'Save mood' : 'Done'}
          onPress={editingMood
            ? () => {
                setTodayMood(editMood);
                setEditingMood(false);
                setMoodSaved(true);
              }
            : safeBack}
          full
        />
      </Screen>
    );
  }

  if (saved) {
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot
            state={gambled ? 'comfort' : 'celebrate'}
            size={150}
            motion={gambled ? 'gentle' : 'celebrate'}
          />
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

  // Show Save only after the user answers the first question.
  const showSave = gambled !== null;

  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      {Header}

      <View ref={formViewportRef} collapsable={false} style={{ flex: 1 }}>
        <ScrollView
          ref={formScrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        >
          <Text variant="title1" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>Daily Check-in</Text>

          <Text variant="headline" style={{ marginBottom: spacing.md }}>Did you {verb} today?</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Choice
              label="No"
              active={gambled === false}
              onPress={() => {
                Keyboard.dismiss();
                focusedInputRef.current = null;
                setGambled(false);
              }}
              good
            />
            <Choice
              label="Yes"
              active={gambled === true}
              onPress={() => {
                Keyboard.dismiss();
                focusedInputRef.current = null;
                setGambled(true);
              }}
            />
          </View>

          {gambled === false && (
            <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
              <RatingField
                title="How are you feeling today?"
                helper="1 = very low, 10 = great."
                value={mood}
                onChange={setMood}
              />
              <RatingField
                title="How strong was your strongest urge today?"
                helper="1 = none or barely there, 10 = overwhelming."
                kind="urge"
                value={urge}
                onChange={setUrge}
              />
              <View>
                <Text variant="headline">Did anything trigger an urge?</Text>
                <Text variant="footnote" dim style={{ marginTop: spacing.xs }}>
                  Select all that apply. Skip this if you had no urge.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                  {triggerOptions.map((t) => <Pill key={t} label={t} active={triggers.includes(t)} onPress={() => toggle(t)} />)}
                </View>
              </View>
              <View>
                <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>
                  Anything you want to remember? (optional)
                </Text>
                <TextInput
                  ref={notesInputRef}
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={() => focusInput(notesInputRef.current)}
                  placeholder="What helped, what was hard, or what you noticed."
                  placeholderTextColor={theme.color.textDim}
                  multiline
                  underlineColorAndroid="transparent"
                  selectionColor={theme.color.primary}
                  style={[input, { minHeight: 88 }]}
                />
              </View>
            </View>
          )}

          {gambled === true && (
            <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
              <Text variant="body" dim>Thank you for being honest. A slip is information, not failure.</Text>
              <RatingField
                title="How are you feeling right now?"
                helper="1 = very low, 10 = great."
                value={mood}
                onChange={setMood}
              />
              {hasExpense && (
                <View>
                  <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>How much did you spend? (optional)</Text>
                  {/* Comma-formatted as you type; raw numeric value extracted on save */}
                  <TextInput
                    ref={amountInputRef}
                    value={amount}
                    onChangeText={(t) => setAmount(formatMoneyInput(t))}
                    onFocus={() => focusInput(amountInputRef.current)}
                    placeholder={`${profile?.currency ?? DEFAULT_CURRENCY}0`}
                    placeholderTextColor={theme.color.textDim}
                    keyboardType="number-pad"
                    underlineColorAndroid="transparent"
                    selectionColor={theme.color.primary}
                    style={input}
                  />
                </View>
              )}
              <View>
                <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>What happened? (optional)</Text>
                <TextInput
                  ref={whatInputRef}
                  value={what}
                  onChangeText={setWhat}
                  onFocus={() => focusInput(whatInputRef.current)}
                  placeholder="A few words are enough."
                  placeholderTextColor={theme.color.textDim}
                  multiline
                  underlineColorAndroid="transparent"
                  selectionColor={theme.color.primary}
                  style={[input, { minHeight: 80 }]}
                />
              </View>
              <View>
                <Text variant="headline">What do you think led to it? (optional)</Text>
                <Text variant="footnote" dim style={{ marginTop: spacing.xs }}>
                  Select all that fit.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                  {triggerOptions.map((t) => <Pill key={t} label={t} active={triggers.includes(t)} onPress={() => toggle(t)} />)}
                </View>
              </View>
              <View>
                <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>
                  Anything else about how you're feeling? (optional)
                </Text>
                <TextInput
                  ref={feelingInputRef}
                  value={feeling}
                  onChangeText={setFeeling}
                  onFocus={() => focusInput(feelingInputRef.current)}
                  placeholder="A few words, if you want."
                  placeholderTextColor={theme.color.textDim}
                  multiline
                  underlineColorAndroid="transparent"
                  selectionColor={theme.color.primary}
                  style={[input, { minHeight: 80 }]}
                />
              </View>
            </View>
          )}

          {showSave && (
            <View style={{ marginTop: spacing.xl }}>
              <Button label="Save check-in" onPress={save} full />
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

function RatingField({
  title,
  helper,
  value,
  onChange,
  kind = 'mood',
}: {
  title: string;
  helper: string;
  value: number;
  onChange: (value: number) => void;
  kind?: 'mood' | 'urge';
}) {
  return (
    <View>
      <Text variant="headline">{title}</Text>
      <Text variant="footnote" dim style={{ marginTop: spacing.xs }}>
        {helper}
      </Text>
      <Card style={{ marginTop: spacing.md }}>
        <Slider kind={kind} label={title} value={value} onChange={onChange} />
      </Card>
    </View>
  );
}

function Choice({ label, active, onPress, good }: { label: string; active: boolean; onPress: () => void; good?: boolean }) {
  const theme = useTheme();
  const activeColor = good ? theme.color.success : theme.color.accent;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{ flex: 1 }}
    >
      <Card style={{ alignItems: 'center', paddingVertical: spacing.lg, borderWidth: 2, borderColor: active ? activeColor : 'transparent' }}>
        <Text variant="headline" color={active ? activeColor : theme.color.text}>{label}</Text>
      </Card>
    </Pressable>
  );
}

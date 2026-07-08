import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { Pill } from '@/presentation/components/Pill';
import { Slider } from '@/presentation/components/Slider';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import { TRIGGERS } from '@/domain/gambling';

export default function JournalEntry() {
  const theme = useTheme();
  const router = useRouter();
  const addJournal = useStore((s) => s.addJournal);

  const [text, setText] = useState('');
  const [mood, setMood] = useState(5);
  const [trigger, setTrigger] = useState<string>();

  const save = () => {
    if (!text.trim()) return;
    addJournal({ text: text.trim(), mood, trigger });
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={theme.color.textDim} />
        </Pressable>
        <Text variant="headline">New entry</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Slider label="Mood" value={mood} onChange={setMood} />

        <Text variant="footnote" dim style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Trigger (optional)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {TRIGGERS.map((t) => <Pill key={t} label={t} active={trigger === t} onPress={() => setTrigger(trigger === t ? undefined : t)} />)}
        </View>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What's on your mind? Challenges, wins, reflections…"
          placeholderTextColor={theme.color.textDim}
          multiline
          autoFocus
          style={{ marginTop: spacing.xl, minHeight: 160, borderRadius: radius.input, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg, color: theme.color.text, fontSize: 17, lineHeight: 24, textAlignVertical: 'top' }}
        />
      </ScrollView>

      <Button label="Save entry" onPress={save} disabled={!text.trim()} full />
    </Screen>
  );
}

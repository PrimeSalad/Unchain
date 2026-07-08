import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { Mascot } from '../components/Mascot';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '@/application/store';
import { TRIGGERS } from '@/domain/gambling';

export function JournalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const entries = useStore((s) => s.journal);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter && e.trigger !== filter) return false;
      if (query && !e.text.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [entries, query, filter]);

  return (
    <Screen tabPadding>
      <Text variant="title1" style={{ marginTop: spacing.sm }}>Journal</Text>

      <Button label="Write an entry" onPress={() => router.push('/journal-entry')} full style={{ marginTop: spacing.lg }} />

      {/* Search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, borderRadius: radius.input, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline, paddingHorizontal: spacing.md }}>
        <Ionicons name="search" size={18} color={theme.color.textDim} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search entries" placeholderTextColor={theme.color.textDim} style={{ flex: 1, padding: spacing.md, color: theme.color.text, fontSize: 16 }} />
      </View>

      {/* Trigger filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
        <Pill label="All" active={filter === null} onPress={() => setFilter(null)} />
        {TRIGGERS.map((t) => <Pill key={t} label={t} active={filter === t} onPress={() => setFilter(filter === t ? null : t)} />)}
      </ScrollView>

      {/* Entries */}
      {filtered.length === 0 ? (
        <Card tone="primarySoft" style={{ alignItems: 'center', paddingVertical: spacing.xl, marginTop: spacing.sm }}>
          <Mascot state="happy" size={96} still />
          <Text variant="callout" dim center style={{ marginTop: spacing.md }}>
            {entries.length === 0 ? 'Your first entry is the hardest. Even one line counts.' : 'No entries match your filter.'}
          </Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {filtered.map((e) => (
            <Card key={e.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                <Text variant="footnote" dim style={{ flex: 1 }}>
                  {new Date(e.at).toLocaleDateString()} · {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {e.mood != null && <Text variant="footnote" color={theme.color.primary}>Mood {e.mood}/10</Text>}
              </View>
              {e.trigger ? <Text variant="caption" dim style={{ marginBottom: 4 }}>{e.trigger}</Text> : null}
              <Text variant="callout" numberOfLines={5}>{e.text}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Card } from '@/presentation/components/Card';
import { Button } from '@/presentation/components/Button';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';

/**
 * Emergency Reflection — its own local data, fully separate from the Journal.
 * Capturing a moment of crisis in words. Nothing here touches Journal data.
 */
export default function ReflectionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const reflections = useStore((s) => s.reflections);
  const add = useStore((s) => s.addReflection);
  const remove = useStore((s) => s.deleteReflection);

  const [text, setText] = useState('');

  const save = () => {
    if (!text.trim()) return;
    add(text);
    setText('');
  };

  // Deleting a reflection is irreversible — always confirm with a native alert.
  const confirmDelete = (id: string) => {
    Alert.alert('Delete this reflection?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={16} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={theme.color.textDim} />
        </Pressable>
        <Text variant="headline">Emergency Reflection</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text variant="body" dim style={{ marginTop: spacing.lg }}>
        Right now, in this moment — what are you feeling, and what do you want to remember?
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write it out. No one else will ever see this."
        placeholderTextColor={theme.color.textDim}
        multiline
        style={{ marginTop: spacing.md, minHeight: 120, borderRadius: radius.input, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg, color: theme.color.text, fontSize: 17, lineHeight: 24, textAlignVertical: 'top' }}
      />
      <Button label="Save reflection" onPress={save} disabled={!text.trim()} full style={{ marginTop: spacing.md }} />

      {reflections.length > 0 && (
        <>
          <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Past reflections</Text>
          <View style={{ gap: spacing.sm }}>
            {reflections.map((r) => (
              <Card key={r.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                  <Text variant="footnote" dim style={{ flex: 1 }}>
                    {new Date(r.at).toLocaleDateString()} · {new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Pressable onPress={() => confirmDelete(r.id)} hitSlop={14} accessibilityRole="button" accessibilityLabel="Delete reflection">
                    <Ionicons name="trash-outline" size={18} color={theme.color.danger} />
                  </Pressable>
                </View>
                <Text variant="callout">{r.text}</Text>
              </Card>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

import { Alert, Platform, Pressable, Share, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore, useProfile } from '@/application/store';
import { streakDays, addictionMeta, TRIGGERS } from '@/domain/gambling';

const THEMES: { key: 'system' | 'light' | 'dark'; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const update = useStore((s) => s.updateProfile);
  const themePref = useStore((s) => s.themePref);
  const setTheme = useStore((s) => s.setTheme);
  const resetAll = useStore((s) => s.resetAll);

  if (!profile) return null;
  const days = streakDays(profile.startedAt);
  const typeLabel = addictionMeta(profile.addictionType).label;

  const exportData = async () => {
    const snap = useStore.getState();
    const data = {
      profile: snap.profile, checkIns: snap.checkIns, urges: snap.urges, relapses: snap.relapses,
      journal: snap.journal, reflections: snap.reflections, timeline: snap.timeline, points: snap.points, longestStreak: snap.longestStreak,
    };
    await Share.share({ message: JSON.stringify(data) }).catch(() => {});
  };

  const importData = () => {
    if (Platform.OS !== 'ios' || !Alert.prompt) {
      Alert.alert('Import', 'Importing a backup is available on iOS.');
      return;
    }
    Alert.prompt('Import backup', 'Paste your exported backup data.', (text) => {
      try {
        const data = JSON.parse(text);
        useStore.setState({ ...data, onboarded: true });
        Alert.alert('Imported', 'Your backup has been restored.');
      } catch {
        Alert.alert('Import failed', 'That backup could not be read.');
      }
    });
  };

  const confirmReset = (label: string) =>
    Alert.alert(label, 'This permanently deletes all local recovery data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { resetAll(); router.replace('/onboarding'); } },
    ]);

  const input = {
    borderRadius: radius.input, backgroundColor: theme.color.surface, borderWidth: 1,
    borderColor: theme.color.hairline, padding: spacing.md, color: theme.color.text, fontSize: 16,
  };

  return (
    <Screen tabPadding>
      <Text variant="title1" style={{ marginTop: spacing.sm }}>Profile</Text>

      {/* Recovery Information */}
      <Text variant="headline" style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>Recovery Information</Text>
      <Card>
        <Field label="Name">
          <TextInput defaultValue={profile.name} onEndEditing={(e) => update({ name: e.nativeEvent.text.trim() || profile.name })} style={input} placeholderTextColor={theme.color.textDim} />
        </Field>
        <View style={{ height: spacing.md }} />
        <ReadRow label="Addiction" value={typeLabel} />
        {profile.addictionDetail ? <ReadRow label="Specifically" value={profile.addictionDetail} /> : null}
        <ReadRow label="Current streak" value={`${days} days`} />
        <ReadRow label="Recovery start" value={new Date(profile.startedAt).toLocaleDateString()} />
        <ReadRow label="Average expense" value={`${profile.currency}${profile.expenseAmount} / ${profile.expensePeriod}`} />
      </Card>

      {/* Reason */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Personal Recovery Reason</Text>
      <TextInput
        defaultValue={profile.reason}
        onEndEditing={(e) => update({ reason: e.nativeEvent.text })}
        multiline
        placeholder="Your reason…"
        placeholderTextColor={theme.color.textDim}
        style={[input, { minHeight: 90, padding: spacing.lg, textAlignVertical: 'top' }]}
      />

      {/* Triggers */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Trigger Preferences</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {TRIGGERS.map((t) => {
          const active = profile.triggers.includes(t);
          return (
            <Pill key={t} label={t} active={active} onPress={() => update({ triggers: active ? profile.triggers.filter((x) => x !== t) : [...profile.triggers, t] })} />
          );
        })}
      </View>

      {/* Theme */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Appearance</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {THEMES.map((t) => <Pill key={t.key} label={t.label} active={themePref === t.key} onPress={() => setTheme(t.key)} />)}
      </View>

      {/* Data */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Your Data</Text>
      <Card padding={0}>
        <ActionRow icon="share-outline" label="Export local data" onPress={exportData} first />
        <ActionRow icon="download-outline" label="Import backup" onPress={importData} />
        <ActionRow icon="trash-outline" label="Reset recovery data" danger onPress={() => confirmReset('Reset recovery data')} />
        <ActionRow icon="close-circle-outline" label="Delete all local data" danger onPress={() => confirmReset('Delete all local data')} />
      </Card>

      {/* About / Privacy */}
      <Card tone="primarySoft" style={{ marginTop: spacing.xl }}>
        <Text variant="footnote" color={theme.color.primary}>Privacy</Text>
        <Text variant="callout" dim style={{ marginTop: 4 }}>
          Everything stays on this device. No account, no internet, no data ever leaves your phone.
        </Text>
      </Card>
      <Text variant="caption" dim center style={{ marginTop: spacing.lg }}>Unchained · Gambling Recovery · v1</Text>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>{label}</Text>
      {children}
    </View>
  );
}
function ReadRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text variant="callout" dim>{label}</Text>
      <Text variant="callout" color={theme.color.text}>{value}</Text>
    </View>
  );
}
function ActionRow({ icon, label, onPress, danger, first }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; first?: boolean }) {
  const theme = useTheme();
  const color = danger ? theme.color.danger : theme.color.primary;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderTopWidth: first ? 0 : 1, borderTopColor: theme.color.hairline }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }} color={color}>{label}</Text>
    </Pressable>
  );
}

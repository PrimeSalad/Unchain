import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Card } from '@/presentation/components/Card';
import { Button } from '@/presentation/components/Button';
import { Pill } from '@/presentation/components/Pill';
import { Slider } from '@/presentation/components/Slider';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useProfile } from '@/application/store';
import { TRIGGERS, urgeLevel } from '@/domain/gambling';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';

export default function LogUrge() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const logUrge = useStore((s) => s.logUrge);
  const profile = useProfile();

  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState<string>();
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const level = urgeLevel(intensity);

  const save = () => {
    logUrge({ intensity, trigger, notes: notes.trim() || undefined, resisted: true });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaved(true);
  };

  if (saved) {
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {level === 'low' && (
            <>
              <Text variant="title1" center>You caught it early.</Text>
              <Text variant="body" dim center style={{ marginTop: spacing.md }}>Nice awareness. Carry on with your day — you've got this.</Text>
            </>
          )}
          {level === 'medium' && (
            <>
              <Text variant="title1" center>Let's take the edge off.</Text>
              <Text variant="body" dim center style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>Pick one — the urge will pass.</Text>
              <View style={{ gap: spacing.md }}>
                <ActionBtn icon="leaf" label="Take a Mindful Pause" onPress={() => router.replace('/mindful-pause' as Href)} />
                <ActionBtn icon="book" label="Open Journal" onPress={() => router.replace('/(tabs)/journal')} />
                {profile?.reason ? (
                  <Card tone="primarySoft"><Text variant="footnote" dim>Your reason</Text><Text variant="callout" style={{ marginTop: 4 }}>“{profile.reason}”</Text></Card>
                ) : null}
              </View>
            </>
          )}
          {level === 'high' && (
            <>
              <Text variant="title1" center color={theme.color.accentText}>This is a strong urge.</Text>
              <Text variant="body" dim center style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>Don't decide anything yet. Do this first.</Text>
              <View style={{ gap: spacing.md }}>
                <ActionBtn icon="warning" label="Open SOS now" accent onPress={() => router.replace('/sos')} />
                <ActionBtn icon="time" label="Start a Mindful Pause" onPress={() => router.replace('/mindful-pause' as Href)} />
                <ActionBtn icon="book" label="Journal it out" onPress={() => router.replace('/(tabs)/journal')} />
              </View>
              {profile?.reason ? (
                <Card tone="primarySoft" style={{ marginTop: spacing.lg }}><Text variant="footnote" dim>Remember why</Text><Text variant="callout" style={{ marginTop: 4 }}>“{profile.reason}”</Text></Card>
              ) : null}
            </>
          )}
          <Button label="Back to Home" kind="tertiary" onPress={() => router.replace('/(tabs)/home')} full style={{ marginTop: spacing.xxl }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm }}>
        <Pressable onPress={safeBack} hitSlop={16} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={theme.color.textDim} />
        </Pressable>
      </View>
      <Text variant="title1" style={{ marginTop: spacing.sm }}>Log an urge</Text>
      <Text variant="body" dim style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        Logging it before acting is a win in itself.
      </Text>

      <Card><Slider label="How strong is the urge?" value={intensity} onChange={setIntensity} /></Card>

      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>What triggered it?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(profile?.addictionType === 'pornography' ? PORN_TRIGGERS : TRIGGERS).map((t) => (
          <Pill key={t} label={t} active={trigger === t} onPress={() => setTrigger(trigger === t ? undefined : t)} />
        ))}
      </View>

      <TextInput
        value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={theme.color.textDim} multiline
        style={{ marginTop: spacing.xl, minHeight: 80, borderRadius: radius.input, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.lg, color: theme.color.text, fontSize: 16, textAlignVertical: 'top' }}
      />

      <Button label="Save" onPress={save} full style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

function ActionBtn({ icon, label, onPress, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; accent?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card tone={accent ? 'accentSoft' : 'surface'} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={22} color={accent ? theme.color.accentText : theme.color.primary} />
        <Text variant="headline" style={{ flex: 1, marginLeft: spacing.md }} color={accent ? theme.color.accentText : theme.color.text}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
      </Card>
    </Pressable>
  );
}

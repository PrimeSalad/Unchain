import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
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

// ---------------------------------------------------------------------------
// Mood label helpers
// ---------------------------------------------------------------------------

function moodLabel(mood: number): string {
  if (mood <= 2) return 'Very low';
  if (mood <= 4) return 'Low';
  if (mood <= 6) return 'Moderate';
  if (mood <= 8) return 'Good';
  return 'Great';
}

function moodEmoji(mood: number): string {
  if (mood <= 2) return '😔';
  if (mood <= 4) return '😕';
  if (mood <= 6) return '😐';
  if (mood <= 8) return '🙂';
  return '😊';
}

// ---------------------------------------------------------------------------
// Mood picker - 10 tap-able dots
// ---------------------------------------------------------------------------

function MoodPicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="caption" dim>Low</Text>
        <Text variant="caption" dim>High</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const active = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(n);
              }}
              accessibilityRole="radio"
              accessibilityLabel={`Mood ${n}: ${moodLabel(n)}`}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                flex: 1,
                aspectRatio: 1,
                borderRadius: radius.chip,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active
                  ? theme.color.primary
                  : theme.color.surfaceAlt,
                opacity: pressed ? 0.75 : 1,
                borderWidth: active ? 0 : 1,
                borderColor: theme.color.hairline,
              })}
            >
              <Text
                variant="caption"
                style={{ fontSize: 11, fontVariant: ['tabular-nums'] }}
                color={active ? theme.color.onPrimary : theme.color.textDim}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value != null && (
        <Text variant="caption" dim center>
          {moodEmoji(value)} {moodLabel(value)} mood ({value}/10)
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function LogUrge() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const safeBack = useSafeBack();
  const logUrge = useStore((s) => s.logUrge);
  const updateUrge = useStore((s) => s.updateUrge);
  const existing = useStore((s) => id ? s.urges.find((urge) => urge.id === id) : undefined);
  const profile = useProfile();

  const [intensity, setIntensity] = useState(existing?.intensity ?? 5);
  const [triggers, setTriggers] = useState<string[]>(existing?.triggers ?? (existing?.trigger ? [existing.trigger] : []));
  const [mood, setMood] = useState(existing?.mood ?? 5);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saved, setSaved] = useState(false);

  const level = urgeLevel(intensity);

  const save = () => {
    const data = {
      intensity,
      trigger: triggers[0],
      triggers,
      notes: notes.trim() || undefined,
      resisted: true,
      mood,
    };
    if (existing) {
      updateUrge(existing.id, data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      safeBack();
      return;
    }
    logUrge(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaved(true);
  };

  if (saved) {
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {level === 'low' && (
            <>
              <Text variant="headline" center>You caught it early.</Text>
              <Text variant="footnote" dim center style={{ marginTop: spacing.sm, lineHeight: 19 }}>Awareness logged. Keep moving with your day.</Text>
            </>
          )}
          {level === 'medium' && (
            <>
              <Text variant="headline" center>Take the edge off.</Text>
              <Text variant="footnote" dim center style={{ marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 19 }}>Pick one action before the urge gets louder.</Text>
              <View style={{ gap: spacing.sm }}>
                <ActionBtn icon="leaf" label="Take a Mindful Pause" onPress={() => router.replace('/mindful-pause' as Href)} />
                <ActionBtn icon="book" label="Open Journal" onPress={() => router.replace('/(tabs)/journal')} />
                {profile?.reason ? (
                  <Card tone="primarySoft"><Text variant="footnote" dim>Your reason</Text><Text variant="callout" style={{ marginTop: 4 }}>"{profile.reason}"</Text></Card>
                ) : null}
              </View>
            </>
          )}
          {level === 'high' && (
            <>
              <Text variant="headline" center color={theme.color.accentText}>Strong urge detected.</Text>
              <Text variant="footnote" dim center style={{ marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 19 }}>Do not decide yet. Start with one stabilizing action.</Text>
              <View style={{ gap: spacing.sm }}>
                <ActionBtn icon="warning" label="Open SOS now" accent onPress={() => router.replace('/sos')} />
                <ActionBtn icon="time" label="Start a Mindful Pause" onPress={() => router.replace('/mindful-pause' as Href)} />
                <ActionBtn icon="book" label="Journal it out" onPress={() => router.replace('/(tabs)/journal')} />
              </View>
              {profile?.reason ? (
                <Card tone="primarySoft" style={{ marginTop: spacing.lg }}><Text variant="footnote" dim>Remember why</Text><Text variant="callout" style={{ marginTop: 4 }}>"{profile.reason}"</Text></Card>
              ) : null}
            </>
          )}
          <Button label="Back to Home" kind="tertiary" onPress={() => router.replace('/(tabs)/home')} full style={{ marginTop: spacing.xxl }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm }}>
        <Pressable onPress={safeBack} hitSlop={16} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={theme.color.textDim} />
        </Pressable>
      </View>

      {/* Scrollable content area - shrinks when keyboard appears */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: spacing.lg }}
        >
          <Text variant="headline" style={{ marginTop: spacing.xs }}>{existing ? 'Edit urge' : 'Log an urge'}</Text>
          <Text variant="footnote" dim style={{ marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 19 }}>
            Logging it before acting is a win in itself.
          </Text>

          {/* Urge intensity */}
          <Text variant="callout" style={{ marginBottom: spacing.xs, fontFamily: 'Nunito_700Bold' }}>
            How strong is your urge?
          </Text>
          <Text variant="caption" dim style={{ marginBottom: spacing.md }}>
            1 = barely there, 10 = overwhelming.
          </Text>
          <Card>
            <Slider kind="urge" label="How strong is the urge?" value={intensity} onChange={setIntensity} />
          </Card>

          {/* Trigger */}
          <Text variant="callout" style={{ marginTop: spacing.lg, marginBottom: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
            What triggered it?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(profile?.addictionType === 'pornography' ? PORN_TRIGGERS : TRIGGERS).map((t) => (
              <Pill
                key={t}
                label={t}
                active={triggers.includes(t)}
                size="compact"
                onPress={() => setTriggers((current) => current.includes(t) ? current.filter((value) => value !== t) : [...current, t])}
              />
            ))}
          </View>

          {/* Mood */}
          <Text variant="callout" style={{ marginTop: spacing.lg, marginBottom: spacing.xs, fontFamily: 'Nunito_700Bold' }}>
            How's your mood right now?
          </Text>
          <Text variant="caption" dim style={{ marginBottom: spacing.md }}>
            Tracking mood helps identify patterns in your urges.
          </Text>
          <Card>
            <Slider kind="mood" label="Mood" value={mood} onChange={setMood} />
          </Card>

          {/* Notes */}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={theme.color.textDim}
            multiline
            style={{
              marginTop: spacing.lg,
              minHeight: 74,
              borderRadius: radius.input,
              backgroundColor: theme.color.surface,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              padding: spacing.md,
              color: theme.color.text,
              fontSize: 16,
              textAlignVertical: 'top',
            }}
          />
        </ScrollView>

        {/* Save button pinned above keyboard */}
        <Button label={existing ? 'Save changes' : 'Save'} onPress={save} full style={{ marginTop: spacing.sm }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card tone={accent ? 'accentSoft' : 'surface'} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={22} color={accent ? theme.color.accentText : theme.color.primary} />
        <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md, fontFamily: 'Nunito_700Bold' }} color={accent ? theme.color.accentText : theme.color.text}>
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
      </Card>
    </Pressable>
  );
}

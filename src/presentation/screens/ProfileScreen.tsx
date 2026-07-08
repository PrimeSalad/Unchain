import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  Share,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore, useProfile } from '@/application/store';
import { streakDays, addictionMeta, TRIGGERS } from '@/domain/gambling';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THEMES: { key: 'system' | 'light' | 'dark'; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

type ModalConfig = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
};

type ToastConfig = {
  message: string;
  type: 'success' | 'error';
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const update = useStore((s) => s.updateProfile);
  const themePref = useStore((s) => s.themePref);
  const setTheme = useStore((s) => s.setTheme);
  const resetRecovery = useStore((s) => s.resetRecovery);
  const resetAll = useStore((s) => s.resetAll);

  // Name edit state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameRef = useRef<TextInput>(null);

  // Modal state
  const [modal, setModal] = useState<ModalConfig | null>(null);

  // Toast state
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!profile) return null;

  const days = streakDays(profile.startedAt);
  const typeLabel = addictionMeta(profile.addictionType).label;

  // ── Toast ────────────────────────────────────────────────────────────────

  const showToast = (message: string, type: ToastConfig['type'] = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastAnim.setValue(0);
    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 140,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 3000);
  };

  // ── Name editing ─────────────────────────────────────────────────────────

  const startEditName = () => {
    setNameValue(profile.name);
    setEditingName(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const commitName = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== profile.name) {
      try {
        update({ name: trimmed });
        showToast('Name updated');
      } catch {
        showToast('Failed to update name', 'error');
      }
    }
    setEditingName(false);
  };

  const cancelName = () => {
    setEditingName(false);
  };

  // ── Modals ────────────────────────────────────────────────────────────────

  const openResetRecoveryModal = () =>
    setModal({
      title: 'Reset recovery data?',
      body: 'Your streak, check-ins, urges, relapses, and journal will be cleared and your streak will restart from today.\n\nYour name, addiction type, and personal reason will be kept.\n\nThis cannot be undone.',
      confirmLabel: 'Reset',
      onConfirm: () => {
        try {
          resetRecovery();
          showToast('Recovery data reset successfully');
        } catch (e) {
          showToast('Something went wrong — data was not reset', 'error');
        }
      },
    });

  const openDeleteAllModal = () =>
    setModal({
      title: 'Delete all local data?',
      body: 'Every piece of data will be permanently deleted — your profile, streak, journal, check-ins, and all records.\n\nThe app will return to the welcome screen.\n\nThis cannot be undone.',
      confirmLabel: 'Delete everything',
      onConfirm: () => {
        try {
          resetAll();
          router.replace('/loading');
        } catch (e) {
          showToast('Something went wrong — data was not deleted', 'error');
        }
      },
    });

  // ── Data export / import ──────────────────────────────────────────────────

  const exportData = async () => {
    try {
      const snap = useStore.getState();
      const data = {
        profile: snap.profile,
        checkIns: snap.checkIns,
        urges: snap.urges,
        relapses: snap.relapses,
        journal: snap.journal,
        reflections: snap.reflections,
        timeline: snap.timeline,
        points: snap.points,
        longestStreak: snap.longestStreak,
      };
      await Share.share({ message: JSON.stringify(data) });
      showToast('Data exported');
    } catch {
      showToast('Export cancelled or failed', 'error');
    }
  };

  const importData = () => {
    if (Platform.OS !== 'ios' || !('prompt' in Object.getPrototypeOf(Object))) {
      // Alert.prompt is iOS-only; show a polite notice on other platforms
      showToast('Import is only available on iOS', 'error');
      return;
    }
    // @ts-ignore — Alert.prompt is typed in RN but not always visible
    const { Alert } = require('react-native');
    Alert.prompt('Import backup', 'Paste your exported backup data.', (text: string) => {
      try {
        const data = JSON.parse(text);
        useStore.setState({ ...data, onboarded: true });
        showToast('Backup restored successfully');
      } catch {
        showToast('Could not read that backup', 'error');
      }
    });
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const inputStyle = {
    borderRadius: radius.input,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.primary,
    padding: spacing.md,
    color: theme.color.text,
    fontSize: 16,
    flex: 1,
  } as const;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Screen tabPadding>
      <Text variant="title1" style={{ marginTop: spacing.sm }}>Profile</Text>

      {/* Recovery Information */}
      <Text variant="headline" style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
        Recovery Information
      </Text>
      <Card>
        {/* Name row — display or edit mode */}
        <View style={{ marginBottom: spacing.md }}>
          <Text variant="footnote" dim style={{ marginBottom: spacing.sm }}>Name</Text>
          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TextInput
                ref={nameRef}
                value={nameValue}
                onChangeText={setNameValue}
                onSubmitEditing={commitName}
                returnKeyType="done"
                style={inputStyle}
                placeholderTextColor={theme.color.textDim}
              />
              {/* Confirm */}
              <Pressable
                onPress={commitName}
                hitSlop={8}
                style={{
                  width: 36, height: 36, borderRadius: radius.round,
                  backgroundColor: theme.color.success,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
              </Pressable>
              {/* Cancel */}
              <Pressable
                onPress={cancelName}
                hitSlop={8}
                style={{
                  width: 36, height: 36, borderRadius: radius.round,
                  backgroundColor: theme.color.surfaceAlt,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color={theme.color.textDim} />
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="callout" style={{ flex: 1 }} color={theme.color.text}>
                {profile.name}
              </Text>
              <Pressable onPress={startEditName} hitSlop={8}>
                <Ionicons name="pencil-outline" size={18} color={theme.color.primary} />
              </Pressable>
            </View>
          )}
        </View>

        <ReadRow label="Addiction" value={typeLabel} />
        {profile.addictionDetail ? (
          <ReadRow label="Specifically" value={profile.addictionDetail} />
        ) : null}
        <ReadRow label="Current streak" value={`${days} days`} />
        <ReadRow label="Recovery start" value={new Date(profile.startedAt).toLocaleDateString()} />
        <ReadRow
          label="Average expense"
          value={`${profile.currency}${profile.expenseAmount} / ${profile.expensePeriod}`}
        />
      </Card>

      {/* Reason */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Personal Recovery Reason
      </Text>
      <TextInput
        defaultValue={profile.reason}
        onEndEditing={(e) => {
          try {
            update({ reason: e.nativeEvent.text });
            showToast('Reason saved');
          } catch {
            showToast('Failed to save reason', 'error');
          }
        }}
        multiline
        placeholder="Your reason…"
        placeholderTextColor={theme.color.textDim}
        style={{
          borderRadius: radius.input,
          backgroundColor: theme.color.surface,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          minHeight: 90,
          padding: spacing.lg,
          color: theme.color.text,
          fontSize: 16,
          textAlignVertical: 'top',
        }}
      />

      {/* Triggers */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Trigger Preferences
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {TRIGGERS.map((t) => {
          const active = profile.triggers.includes(t);
          return (
            <Pill
              key={t}
              label={t}
              active={active}
              onPress={() =>
                update({
                  triggers: active
                    ? profile.triggers.filter((x) => x !== t)
                    : [...profile.triggers, t],
                })
              }
            />
          );
        })}
      </View>

      {/* Theme */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Appearance
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {THEMES.map((t) => (
          <Pill
            key={t.key}
            label={t.label}
            active={themePref === t.key}
            onPress={() => setTheme(t.key)}
          />
        ))}
      </View>

      {/* Data */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Your Data
      </Text>
      <Card padding={0}>
        <ActionRow icon="share-outline" label="Export local data" onPress={exportData} first />
        <ActionRow icon="download-outline" label="Import backup" onPress={importData} />
        <ActionRow
          icon="trash-outline"
          label="Reset recovery data"
          danger
          onPress={openResetRecoveryModal}
        />
        <ActionRow
          icon="close-circle-outline"
          label="Delete all local data"
          danger
          onPress={openDeleteAllModal}
        />
      </Card>

      {/* Privacy */}
      <Card tone="primarySoft" style={{ marginTop: spacing.xl }}>
        <Text variant="footnote" color={theme.color.primary}>Privacy</Text>
        <Text variant="callout" dim style={{ marginTop: 4 }}>
          Everything stays on this device. No account, no internet, no data ever leaves your phone.
        </Text>
      </Card>
      <Text variant="caption" dim center style={{ marginTop: spacing.lg }}>
        Unchained · Recovery Companion · v1
      </Text>

      {/* ── Confirmation modal ─────────────────────────────────────────── */}
      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
          }}
          onPress={() => setModal(null)}
        >
          {/* Stop tap-through to the backdrop */}
          <Pressable
            style={{
              backgroundColor: theme.color.surface,
              borderRadius: radius.sheet,
              padding: spacing.xl,
              width: '100%',
              maxWidth: 380,
              ...elevation.e2,
            }}
            onPress={() => {/* noop — prevent backdrop close */}}
          >
            <Text variant="title2" style={{ marginBottom: spacing.md }}>
              {modal?.title}
            </Text>
            <Text variant="body" dim style={{ marginBottom: spacing.xl, lineHeight: 24 }}>
              {modal?.body}
            </Text>

            {/* Confirm (destructive) */}
            <Pressable
              onPress={() => {
                const fn = modal?.onConfirm;
                setModal(null);
                fn?.();
              }}
              style={{
                backgroundColor: theme.color.danger,
                borderRadius: radius.button,
                paddingVertical: spacing.md,
                alignItems: 'center',
                marginBottom: spacing.sm,
              }}
            >
              <Text variant="headline" color="#fff">
                {modal?.confirmLabel}
              </Text>
            </Pressable>

            {/* Cancel */}
            <Pressable
              onPress={() => setModal(null)}
              style={{
                backgroundColor: theme.color.surfaceAlt,
                borderRadius: radius.button,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text variant="headline" color={theme.color.textDim}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 100,
            left: spacing.xl,
            right: spacing.xl,
            backgroundColor:
              toast.type === 'success' ? theme.color.success : theme.color.danger,
            borderRadius: radius.card,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            ...elevation.e2,
            opacity: toastAnim,
            transform: [
              {
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color="#fff"
          />
          <Text variant="callout" color="#fff" style={{ flex: 1 }}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReadRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text variant="callout" dim>{label}</Text>
      <Text variant="callout" color={theme.color.text}>{value}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  danger,
  first,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  first?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? theme.color.danger : theme.color.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.color.hairline,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }} color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore, useProfile, initialGames } from '@/application/store';
import { streakDays, addictionMeta, TRIGGERS, currentStreakStart } from '@/domain/gambling';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';

const BACKUP_MARKER = 'unchain-backup';

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
  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);

  // Name edit state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameRef = useRef<TextInput>(null);

  // Reason edit state (mirrors the name editor)
  const [editingReason, setEditingReason] = useState(false);
  const [reasonValue, setReasonValue] = useState('');
  const reasonRef = useRef<TextInput>(null);

  // Modal state
  const [modal, setModal] = useState<ModalConfig | null>(null);

  // Toast state
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Never let a pending toast timer fire against an unmounted screen.
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  if (!profile) return null;

  // Same event-derived streak as Home/Progress - never counts through a relapse.
  const days = streakDays(currentStreakStart(profile.startedAt, relapses, journal));
  const typeLabel = addictionMeta(profile.addictionType).label;

  // ── Toast ────────────────────────────────────────────────────────────────

  const showToast = (message: string, type: ToastConfig['type'] = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    // Screen readers can't see the transient toast - announce it.
    AccessibilityInfo.announceForAccessibility(message);
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

  // ── Reason editing (mirrors the name editor) ─────────────────────────────

  const startEditReason = () => {
    setReasonValue(profile.reason ?? '');
    setEditingReason(true);
    setTimeout(() => reasonRef.current?.focus(), 50);
  };

  const commitReason = () => {
    const trimmed = reasonValue.trim();
    if (trimmed !== (profile.reason ?? '')) {
      try {
        update({ reason: trimmed });
        showToast('Reason updated');
      } catch {
        showToast('Failed to update reason', 'error');
      }
    }
    setEditingReason(false);
  };

  const cancelReason = () => {
    setEditingReason(false);
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
          showToast('Something went wrong - data was not reset', 'error');
        }
      },
    });

  const openDeleteAllModal = () =>
    setModal({
      title: 'Delete all local data?',
      body: 'Every piece of data will be permanently deleted - your profile, streak, journal, check-ins, and all records.\n\nThe app will return to the welcome screen.\n\nThis cannot be undone.',
      confirmLabel: 'Delete everything',
      onConfirm: () => {
        try {
          resetAll();
          router.replace('/loading');
        } catch (e) {
          showToast('Something went wrong - data was not deleted', 'error');
        }
      },
    });

  // ── Data export / import ──────────────────────────────────────────────────

  const exportData = async () => {
    try {
      const s = useStore.getState();
      // A single self-describing backup file with every locally-stored slice.
      const backup = {
        app: BACKUP_MARKER,
        version: 2,
        exportedAt: Date.now(),
        data: {
          profile: s.profile,
          checkIns: s.checkIns,
          urges: s.urges,
          relapses: s.relapses,
          journal: s.journal,
          reflections: s.reflections,
          timeline: s.timeline,
          points: s.points,
          longestStreak: s.longestStreak,
          goals: s.goals,
          celebratedBadges: s.celebratedBadges,
          games: s.games,
          themePref: s.themePref,
          alternatives: s.alternatives,
          altCounts: s.altCounts,
          altAchievements: s.altAchievements,
          altSeconds: s.altSeconds,
          altSessions: s.altSessions,
          walkSteps: s.walkSteps,
          walkMeters: s.walkMeters,
          waterToday: s.waterToday,
          waterGlassesTotal: s.waterGlassesTotal,
          lastCheckedIn: s.lastCheckedIn,
          urgesResisted: s.urgesResisted,
          urgesResistedWeek: s.urgesResistedWeek,
          healthyHabitsCount: s.healthyHabitsCount,
          eduBookmarks: s.eduBookmarks,
          eduProgress: s.eduProgress,
          eduLastGuideId: s.eduLastGuideId,
          blockedSites: s.blockedSites,
          dailyMissions: s.dailyMissions,
          missionXp: s.missionXp,
          favoriteQuotes: s.favoriteQuotes,
          dailyQuote: s.dailyQuote,
          recentQuotes: s.recentQuotes,
        },
      };
      const json = JSON.stringify(backup, null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
      const fileUri = `${dir}unchain-backup-${stamp}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save your Unchain backup',
          UTI: 'public.json',
        });
      } else {
        await Share.share({ message: json });
      }
      showToast('Backup file ready');
    } catch {
      showToast('Export cancelled or failed', 'error');
    }
  };

  const importData = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;

      const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
      const parsed = JSON.parse(text);
      // Accept both the wrapped backup and a raw data object.
      const data = parsed?.app === BACKUP_MARKER || parsed?.data ? parsed.data : parsed;

      // Validate before touching the store, so a bad file can't corrupt state.
      if (!data || typeof data !== 'object' || !data.profile || typeof data.profile.startedAt !== 'number') {
        showToast('That file is not a valid Unchain backup', 'error');
        return;
      }

      const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
      const obj = <T extends object>(v: unknown, fallback: T): T =>
        v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : fallback;
      // Replace state wholesale (no merge) so nothing duplicates and no slice
      // from the pre-import state leaks into the restored one. Slices missing
      // from older (v1) backups restore to clean defaults.
      useStore.setState({
        onboarded: true,
        profile: data.profile,
        checkIns: arr(data.checkIns),
        urges: arr(data.urges),
        relapses: arr(data.relapses),
        journal: arr(data.journal),
        reflections: arr(data.reflections),
        timeline: arr(data.timeline),
        points: typeof data.points === 'number' ? data.points : 0,
        longestStreak: typeof data.longestStreak === 'number' ? data.longestStreak : 0,
        goals: arr(data.goals),
        celebratedBadges: arr(data.celebratedBadges),
        games: data.games && typeof data.games === 'object' ? { ...initialGames, ...data.games } : initialGames,
        themePref: ['system', 'light', 'dark'].includes(data.themePref) ? data.themePref : 'system',
        alternatives: obj(data.alternatives, {}),
        altCounts: obj(data.altCounts, {}),
        altAchievements: obj(data.altAchievements, {}),
        altSeconds: obj(data.altSeconds, {}),
        altSessions: obj(data.altSessions, {}),
        walkSteps: typeof data.walkSteps === 'number' ? data.walkSteps : 0,
        walkMeters: typeof data.walkMeters === 'number' ? data.walkMeters : 0,
        waterToday:
          data.waterToday && typeof data.waterToday.day === 'string' && typeof data.waterToday.glasses === 'number'
            ? data.waterToday
            : { day: '', glasses: 0 },
        waterGlassesTotal: typeof data.waterGlassesTotal === 'number' ? data.waterGlassesTotal : 0,
        lastCheckedIn: typeof data.lastCheckedIn === 'number' ? data.lastCheckedIn : null,
        urgesResisted: typeof data.urgesResisted === 'number' ? data.urgesResisted : 0,
        urgesResistedWeek: typeof data.urgesResistedWeek === 'number' ? data.urgesResistedWeek : 0,
        healthyHabitsCount: typeof data.healthyHabitsCount === 'number' ? data.healthyHabitsCount : 0,
        eduBookmarks: arr(data.eduBookmarks),
        eduProgress: obj(data.eduProgress, {}),
        eduLastGuideId: typeof data.eduLastGuideId === 'string' ? data.eduLastGuideId : null,
        blockedSites: arr(data.blockedSites),
        dailyMissions:
          data.dailyMissions && typeof data.dailyMissions.day === 'string' && Array.isArray(data.dailyMissions.completed)
            ? data.dailyMissions
            : { day: '', completed: [] },
        missionXp: typeof data.missionXp === 'number' ? data.missionXp : 0,
        favoriteQuotes: arr(data.favoriteQuotes),
        dailyQuote:
          data.dailyQuote && typeof data.dailyQuote.day === 'string' && typeof data.dailyQuote.index === 'number'
            ? data.dailyQuote
            : null,
        recentQuotes: arr(data.recentQuotes),
      });
      showToast('Backup restored successfully');
    } catch {
      showToast('Could not read that backup', 'error');
    }
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
        {/* Name row - display or edit mode */}
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
                accessibilityRole="button"
                accessibilityLabel="Save name"
                style={{
                  width: 44, height: 44, borderRadius: radius.round,
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
                accessibilityRole="button"
                accessibilityLabel="Cancel editing name"
                style={{
                  width: 44, height: 44, borderRadius: radius.round,
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
              <Pressable onPress={startEditName} hitSlop={14} accessibilityRole="button" accessibilityLabel="Edit name">
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
      {editingReason ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <TextInput
            ref={reasonRef}
            value={reasonValue}
            onChangeText={setReasonValue}
            multiline
            placeholder="Your reason…"
            placeholderTextColor={theme.color.textDim}
            style={{
              ...inputStyle,
              minHeight: 90,
              padding: spacing.lg,
              textAlignVertical: 'top',
            }}
          />
          {/* Confirm */}
          <Pressable
            onPress={commitReason}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Save reason"
            style={{
              width: 44, height: 44, borderRadius: radius.round,
              backgroundColor: theme.color.success,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
          </Pressable>
          {/* Cancel */}
          <Pressable
            onPress={cancelReason}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel editing reason"
            style={{
              width: 44, height: 44, borderRadius: radius.round,
              backgroundColor: theme.color.surfaceAlt,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color={theme.color.textDim} />
          </Pressable>
        </View>
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="callout" style={{ flex: 1 }} color={profile.reason ? theme.color.text : theme.color.textDim}>
              {profile.reason || 'Add your reason…'}
            </Text>
            <Pressable onPress={startEditReason} hitSlop={14} accessibilityRole="button" accessibilityLabel="Edit reason">
              <Ionicons name="pencil-outline" size={18} color={theme.color.primary} />
            </Pressable>
          </View>
        </Card>
      )}

      {/* Triggers */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Trigger Preferences
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(profile.addictionType === 'pornography' ? PORN_TRIGGERS : TRIGGERS).map((t) => {
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
        Unchain · Recovery Companion · v1.0
      </Text>

      {/* ── Confirmation modal ─────────────────────────────────────────── */}
      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
      >
        {/* Scrim and dialog are siblings - nesting the dialog inside a
            Pressable nests buttons inside a button (invalid on web). */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
          }}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={() => setModal(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View
            style={{
              backgroundColor: theme.color.surface,
              borderRadius: radius.sheet,
              padding: spacing.xl,
              width: '100%',
              maxWidth: 380,
              ...elevation.e2,
            }}
          >
            <Text variant="title2" style={{ marginBottom: spacing.md }}>
              {modal?.title}
            </Text>
            <Text variant="body" dim style={{ marginBottom: spacing.xl, lineHeight: 24 }}>
              {modal?.body}
            </Text>

            {/* Confirm (destructive) */}
            <Pressable
              accessibilityRole="button"
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
              accessibilityRole="button"
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
          </View>
        </View>
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
      accessibilityRole="button"
      accessibilityLabel={label}
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

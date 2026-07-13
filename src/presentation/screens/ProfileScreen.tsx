import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { Pill } from '../components/Pill';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useStore, useProfile, initialGames } from '@/application/store';
import { shareCapturedContent } from '@/application/shareMedia';
import { DEFAULT_CURRENCY, formatMoney, streakDays, addictionMeta, TRIGGERS, currentStreakStart } from '@/domain/gambling';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';

const BACKUP_MARKER = 'unchainly-backup';
const LEGACY_BACKUP_MARKER = 'unchain-backup';

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
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'U';
  const currency = profile.currency ?? DEFAULT_CURRENCY;
  const formatProfileMoney = (value: number) => formatMoney(Math.max(0, value), currency);

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
    setTimeout(() => nameRef.current?.focus(), 140);
  };

  const commitName = () => {
    const trimmed = nameValue.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    if (trimmed !== profile.name) {
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
      const fileUri = `${dir}unchainly-backup-${stamp}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json);

      await shareCapturedContent({
        uri: fileUri,
        summary: json,
        dialogTitle: 'Save your Unchainly backup',
        mimeType: 'application/json',
      });
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
      const data =
        parsed?.app === BACKUP_MARKER || parsed?.app === LEGACY_BACKUP_MARKER || parsed?.data
          ? parsed.data
          : parsed;

      // Validate before touching the store, so a bad file can't corrupt state.
      if (!data || typeof data !== 'object' || !data.profile || typeof data.profile.startedAt !== 'number') {
        showToast('That file is not a valid Unchainly backup', 'error');
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
      <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
        <View
          style={{
            backgroundColor: 'transparent',
            borderBottomWidth: 1,
            borderBottomColor: theme.color.hairline,
            paddingBottom: spacing.md,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                backgroundColor: theme.color.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="headline" color={theme.color.primary}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {editingName ? (
                <View style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <TextInput
                      ref={nameRef}
                      value={nameValue}
                      onChangeText={setNameValue}
                      placeholder="Nickname"
                      placeholderTextColor={theme.color.textDim}
                      returnKeyType="done"
                      onSubmitEditing={commitName}
                      selectTextOnFocus
                      maxLength={32}
                      style={{
                        ...inputStyle,
                        minHeight: 44,
                        minWidth: 0,
                        flex: 1,
                        paddingVertical: 8,
                        paddingHorizontal: spacing.sm,
                      }}
                    />
                    <Pressable
                      onPress={commitName}
                      accessibilityRole="button"
                      accessibilityLabel="Save profile name"
                      style={({ pressed }) => ({
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: theme.color.success,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="checkmark" size={19} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={cancelName}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel editing profile name"
                      style={({ pressed }) => ({
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: theme.color.surfaceAlt,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="close" size={19} color={theme.color.textDim} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text variant="title2" numberOfLines={1}>{profile.name}</Text>
                  <Text variant="footnote" dim numberOfLines={1} style={{ marginTop: 2 }}>
                    {typeLabel} recovery · {days} day streak
                  </Text>
                </>
              )}
            </View>
            {editingName ? null : (
              <Pressable
                onPress={startEditName}
                accessibilityRole="button"
                accessibilityLabel="Edit profile name"
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: theme.color.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="pencil-outline" size={18} color={theme.color.primary} />
              </Pressable>
            )}
          </View>

          <Text variant="footnote" dim style={{ lineHeight: 19 }}>
            {profile.reason || 'Add your recovery reason so the app can keep it visible when it matters most.'}
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <ProfileStat label="Streak" value={`${days} days`} first />
            <ProfileStat label="Start" value={new Date(profile.startedAt).toLocaleDateString()} />
            <ProfileStat label="Expense" value={formatProfileMoney(profile.expenseAmount)} />
          </View>
        </View>

        <SectionTitle title="Recovery Details" />
        <FlatGroup>
          <ReadRow label="Name" value={profile.name} first onPress={startEditName} actionLabel="Edit profile name" />
          <ReadRow label="Addiction" value={typeLabel} />
          {profile.addictionDetail ? <ReadRow label="Specifically" value={profile.addictionDetail} /> : null}
          <ReadRow label="Current streak" value={`${days} days`} />
          <ReadRow label="Recovery start" value={new Date(profile.startedAt).toLocaleDateString()} />
          <ReadRow label="Currency" value={currency} />
          <ReadRow
            label="Average expense"
            value={`${formatProfileMoney(profile.expenseAmount)} / ${profile.expensePeriod}`}
          />
        </FlatGroup>

        <SectionTitle title="Personal Recovery Reason" />
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
                minHeight: 88,
                padding: spacing.md,
                textAlignVertical: 'top',
                backgroundColor: theme.color.surface,
              }}
            />
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
          <View
            style={{
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              backgroundColor: theme.color.surface,
              padding: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <View
                style={{
                  width: 4,
                  alignSelf: 'stretch',
                  borderRadius: 999,
                  backgroundColor: theme.color.primarySoft,
                }}
              />
              <Text variant="footnote" style={{ flex: 1, lineHeight: 20 }} color={profile.reason ? theme.color.text : theme.color.textDim}>
                {profile.reason || 'Add your reason…'}
              </Text>
              <Pressable onPress={startEditReason} hitSlop={14} accessibilityRole="button" accessibilityLabel="Edit reason">
                <Ionicons name="pencil-outline" size={18} color={theme.color.primary} />
              </Pressable>
            </View>
          </View>
        )}

        <SectionTitle title="Trigger Preferences" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(profile.addictionType === 'pornography' ? PORN_TRIGGERS : TRIGGERS).map((t) => {
            const active = profile.triggers.includes(t);
            return (
              <Pill
                key={t}
                label={t}
                active={active}
                size="compact"
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

        <SectionTitle title="Appearance" />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {THEMES.map((t) => (
            <Pill
              key={t.key}
              label={t.label}
              active={themePref === t.key}
              size="compact"
              onPress={() => setTheme(t.key)}
            />
          ))}
        </View>

        <SectionTitle title="Your Data" />
        <FlatGroup>
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
        </FlatGroup>

        <View
          style={{
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            backgroundColor: theme.color.surfaceAlt,
            padding: spacing.md,
            marginTop: spacing.xs,
          }}
        >
          <Text variant="footnote" color={theme.color.primary}>Privacy</Text>
          <Text variant="footnote" dim style={{ marginTop: 4, lineHeight: 19 }}>
            Everything stays on this device. No account, no internet, no data ever leaves your phone.
          </Text>
        </View>
        <Text variant="caption" dim center style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
          Unchainly · Recovery Companion · v1.0
        </Text>
      </View>

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

function ReadRow({
  label,
  value,
  first,
  onPress,
  actionLabel,
}: {
  label: string;
  value: string;
  first?: boolean;
  onPress?: () => void;
  actionLabel?: string;
}) {
  const theme = useTheme();
  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    gap: spacing.md,
    borderTopWidth: first ? 0 : 1,
    borderTopColor: theme.color.hairline,
  };
  const content = (
    <>
      <Text variant="footnote" dim>{label}</Text>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs }}>
        <Text variant="footnote" color={theme.color.text} numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
          {value}
        </Text>
        {onPress ? <Ionicons name="pencil-outline" size={16} color={theme.color.primary} /> : null}
      </View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={actionLabel ?? label}
        style={({ pressed }) => ({
          ...rowStyle,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={rowStyle}>
      {content}
    </View>
  );
}

function FlatGroup({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        backgroundColor: theme.color.surface,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text variant="caption" color={theme.color.textDim} style={{ textTransform: 'uppercase', marginTop: spacing.xs }}>
      {title}
    </Text>
  );
}

function ProfileStat({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderLeftWidth: first ? 0 : 1,
        borderLeftColor: theme.color.hairline,
        paddingLeft: first ? 0 : spacing.sm,
        paddingVertical: 2,
        gap: 2,
      }}
    >
      <Text variant="callout" color={theme.color.text} numberOfLines={1} style={{ fontVariant: ['tabular-nums'], fontSize: 15 }}>
        {value}
      </Text>
      <Text variant="caption" dim numberOfLines={1}>
        {label}
      </Text>
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
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
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

import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  findNodeHandle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useReliableSafeAreaInsets } from '../hooks/useReliableSafeAreaInsets';
import { useStore, useProfile, initialGames } from '@/application/store';
import { shareCapturedContent } from '@/application/shareMedia';
import {
  DEFAULT_CURRENCY,
  addictionMeta,
  currentStreakStart,
  formatMoney,
  streakDays,
  triggersForAddiction,
} from '@/domain/gambling';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';

const BACKUP_MARKER = 'unchainly-backup';
const LEGACY_BACKUP_MARKER = 'unchain-backup';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THEMES: {
  key: 'system' | 'light' | 'dark';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
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
  const insets = useReliableSafeAreaInsets();
  const reduceMotion = useReducedMotion();
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
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<TextInput>(null);

  // Reason edit state (mirrors the name editor)
  const [editingReason, setEditingReason] = useState(false);
  const [reasonValue, setReasonValue] = useState('');
  const reasonRef = useRef<TextInput>(null);
  const screenScrollRef = useRef<ScrollView>(null);

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
  const meta = addictionMeta(profile.addictionType);
  const typeLabel = meta.label;
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'U';
  const currency = profile.currency ?? DEFAULT_CURRENCY;
  const formatProfileMoney = (value: number) => formatMoney(Math.max(0, value), currency);
  const recoveryStart = new Date(profile.startedAt).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const standardTriggerOptions: readonly string[] = profile.addictionType === 'pornography'
    ? PORN_TRIGGERS
    : triggersForAddiction(profile.addictionType);
  // Keep saved legacy/custom values editable instead of silently hiding them.
  const triggerOptions = [...new Set<string>([...standardTriggerOptions, ...profile.triggers])];
  const selectedTriggerCount = triggerOptions.filter((trigger) => profile.triggers.includes(trigger)).length;
  const filledTextColor = theme.color.textInverse;

  // ── Toast ────────────────────────────────────────────────────────────────

  const showToast = (message: string, type: ToastConfig['type'] = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    // Screen readers can't see the transient toast - announce it.
    AccessibilityInfo.announceForAccessibility(message);
    toastAnim.setValue(0);
    if (reduceMotion) {
      toastAnim.setValue(1);
    } else {
      Animated.spring(toastAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 140,
      }).start();
    }
    toastTimer.current = setTimeout(() => {
      if (reduceMotion) {
        setToast(null);
      } else {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }
    }, 3000);
  };

  // ── Name editing ─────────────────────────────────────────────────────────

  const startEditName = () => {
    setNameValue(profile.name);
    setNameError(null);
    setEditingName(true);
    setTimeout(() => nameRef.current?.focus(), 140);
  };

  const commitName = () => {
    const trimmed = nameValue.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      setNameError('Enter a name before saving.');
      AccessibilityInfo.announceForAccessibility('Enter a name before saving.');
      nameRef.current?.focus();
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
    Keyboard.dismiss();
    setNameError(null);
    setEditingName(false);
  };

  const cancelName = () => {
    Keyboard.dismiss();
    setNameError(null);
    setEditingName(false);
  };

  // ── Reason editing (mirrors the name editor) ─────────────────────────────

  const startEditReason = () => {
    setReasonValue(profile.reason ?? '');
    setEditingReason(true);
    setTimeout(() => {
      const input = reasonRef.current;
      input?.focus();
      if (Platform.OS === 'web') {
        const active = typeof document === 'undefined' ? null : document.activeElement;
        if (active instanceof HTMLElement) active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const node = findNodeHandle(input);
      if (node != null) {
        screenScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(node, 112, true);
      }
    }, 180);
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
    Keyboard.dismiss();
    setEditingReason(false);
  };

  const cancelReason = () => {
    Keyboard.dismiss();
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
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <Screen scrollRef={screenScrollRef} tabPadding contentStyle={{ paddingTop: spacing.md }}>
        <Text variant="title1" accessibilityRole="header">Profile</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.button,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="title2" color={theme.color.primary}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="title2" numberOfLines={2}>{profile.name}</Text>
            <Text variant="footnote" dim style={{ marginTop: 2 }}>{typeLabel} recovery</Text>
          </View>
          {!editingName && (
            <IconAction
              icon="pencil-outline"
              label={`Edit profile name, ${profile.name}`}
              onPress={startEditName}
            />
          )}
        </View>

        {editingName && (
          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.md,
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              backgroundColor: theme.color.surface,
            }}
          >
            <Text variant="footnote" dim>Display name</Text>
            <TextInput
              ref={nameRef}
              value={nameValue}
              onChangeText={(value) => {
                setNameValue(value);
                if (nameError) setNameError(null);
              }}
              accessibilityLabel="Profile name"
              placeholder="Nickname"
              placeholderTextColor={theme.color.textDim}
              returnKeyType="done"
              onSubmitEditing={commitName}
              selectTextOnFocus
              autoCapitalize="words"
              textContentType="name"
              maxLength={32}
              style={[
                inputStyle,
                {
                  flex: 0,
                  minHeight: 48,
                  marginTop: spacing.sm,
                  borderColor: nameError ? theme.color.danger : theme.color.primary,
                },
              ]}
            />
            {nameError && (
              <Text
                variant="footnote"
                color={theme.color.danger}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={{ marginTop: spacing.sm }}
              >
                {nameError}
              </Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md }}>
              <IconAction icon="close" label="Cancel editing profile name" onPress={cancelName} tone="neutral" />
              <IconAction icon="checkmark" label="Save profile name" onPress={commitName} tone="success" />
            </View>
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing.lg,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: theme.color.hairline,
          }}
        >
          <ProfileMetric label="Current streak" value={`${days} day${days === 1 ? '' : 's'}`} first />
          <ProfileMetric label="Recovery start" value={recoveryStart} />
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title="Recovery details" />
          <FlatGroup>
            <ReadRow icon="shield-checkmark-outline" label="Addiction" value={typeLabel} first />
            {profile.addictionDetail ? (
              <ReadRow icon="locate-outline" label="Focus" value={profile.addictionDetail} />
            ) : null}
            {meta.hasExpense ? (
              <>
                <ReadRow
                  icon="wallet-outline"
                  label="Average expense"
                  value={`${formatProfileMoney(profile.expenseAmount)} / ${profile.expensePeriod}`}
                />
                <ReadRow icon="cash-outline" label="Currency" value={currency} />
              </>
            ) : null}
          </FlatGroup>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title="Recovery reason" />
          {editingReason ? (
            <View
              style={{
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                backgroundColor: theme.color.surface,
                padding: spacing.md,
              }}
            >
              <Text variant="footnote" dim>Your reason</Text>
              <TextInput
                ref={reasonRef}
                value={reasonValue}
                onChangeText={setReasonValue}
                accessibilityLabel="Recovery reason"
                multiline
                maxLength={320}
                autoCapitalize="sentences"
                placeholder="What keeps you committed?"
                placeholderTextColor={theme.color.textDim}
                style={[
                  inputStyle,
                  {
                    flex: 0,
                    minHeight: 112,
                    marginTop: spacing.sm,
                    textAlignVertical: 'top',
                  },
                ]}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md }}>
                <IconAction icon="close" label="Cancel editing reason" onPress={cancelReason} tone="neutral" />
                <IconAction icon="checkmark" label="Save recovery reason" onPress={commitReason} tone="success" />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={startEditReason}
              accessibilityRole="button"
              accessibilityLabel={`Recovery reason, ${profile.reason || 'not set'}`}
              accessibilityHint="Edits your recovery reason"
              style={({ pressed }) => ({
                minHeight: 72,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                borderRadius: radius.input,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                backgroundColor: pressed ? theme.color.surfaceAlt : theme.color.surface,
                padding: spacing.md,
              })}
            >
              <Ionicons name="heart-outline" size={22} color={theme.color.primary} />
              <Text
                variant="callout"
                style={{ flex: 1, lineHeight: 22 }}
                color={profile.reason ? theme.color.text : theme.color.textDim}
              >
                {profile.reason || 'Add a personal recovery reason'}
              </Text>
              <Ionicons name="pencil-outline" size={18} color={theme.color.primary} />
            </Pressable>
          )}
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title="Triggers" trailing={`${selectedTriggerCount} selected`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {triggerOptions.map((trigger) => {
              const active = profile.triggers.includes(trigger);
              return (
                <TriggerOption
                  key={trigger}
                  label={trigger}
                  active={active}
                  onPress={() =>
                    update({
                      triggers: active
                        ? profile.triggers.filter((value) => value !== trigger)
                        : [...profile.triggers, trigger],
                    })
                  }
                />
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title="Appearance" />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Appearance"
            style={{
              flexDirection: 'row',
              gap: spacing.xs,
              padding: spacing.xs,
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              backgroundColor: theme.color.surfaceAlt,
            }}
          >
            {THEMES.map((option) => (
              <ThemeOption
                key={option.key}
                label={option.label}
                icon={option.icon}
                active={themePref === option.key}
                onPress={() => setTheme(option.key)}
              />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title="Backup" />
          <FlatGroup>
            <ActionRow icon="share-outline" label="Export local data" onPress={exportData} first />
            <ActionRow icon="download-outline" label="Import backup" onPress={importData} />
          </FlatGroup>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title="Danger zone" danger />
          <FlatGroup>
            <ActionRow icon="refresh-outline" label="Reset recovery data" danger onPress={openResetRecoveryModal} first />
            <ActionRow icon="trash-outline" label="Delete all local data" danger onPress={openDeleteAllModal} />
          </FlatGroup>
        </View>

        <View
          accessible
          accessibilityLabel="Private by design. Everything stays on this device."
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xs }}
        >
          <Ionicons name="lock-closed-outline" size={18} color={theme.color.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="footnote" color={theme.color.text}>Private by design</Text>
            <Text variant="caption" dim style={{ marginTop: 2 }}>Everything stays on this device.</Text>
          </View>
        </View>
        <Text variant="caption" dim center style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
          Unchainly · v1.0
        </Text>
      </Screen>

      <Modal
        visible={modal !== null}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setModal(null)}
      >
        <View
          onAccessibilityEscape={() => setModal(null)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}
        >
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={() => setModal(null)}
          />
          <View
            accessibilityViewIsModal
            style={{
              width: '100%',
              maxWidth: 380,
              maxHeight: '84%',
              overflow: 'hidden',
              borderRadius: radius.card,
              backgroundColor: theme.color.surface,
              ...elevation.e2,
            }}
          >
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              <Text variant="title2" accessibilityRole="header">{modal?.title}</Text>
              <Text variant="body" dim style={{ marginTop: spacing.md, lineHeight: 24 }}>{modal?.body}</Text>
            </ScrollView>
            <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => setModal(null)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  borderRadius: radius.input,
                  backgroundColor: theme.color.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Text variant="headline">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={modal?.confirmLabel}
                onPress={() => {
                  const fn = modal?.onConfirm;
                  setModal(null);
                  fn?.();
                }}
                style={({ pressed }) => ({
                  minHeight: 48,
                  borderRadius: radius.input,
                  backgroundColor: theme.color.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <Text variant="headline" color={filledTextColor}>{modal?.confirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {toast && modal === null && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            bottom: Math.max(104, insets.bottom + 80),
            left: spacing.lg,
            right: spacing.lg,
            minHeight: 52,
            backgroundColor: toast.type === 'success' ? theme.color.success : theme.color.danger,
            borderRadius: radius.input,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            ...elevation.e2,
            opacity: toastAnim,
            transform: [{
              translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
            }],
          }}
        >
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color={filledTextColor}
          />
          <Text variant="callout" color={filledTextColor} style={{ flex: 1 }}>{toast.message}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReadRow({
  icon,
  label,
  value,
  first,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  first?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={{
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.color.hairline,
      }}
    >
      <View
        accessible={false}
        style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name={icon} size={19} color={theme.color.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="caption" dim>{label}</Text>
        <Text variant="callout" style={{ marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  );
}

function FlatGroup({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: radius.input,
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

function SectionTitle({
  title,
  trailing,
  danger,
}: {
  title: string;
  trailing?: string;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.xs }}>
      <Text
        variant="caption"
        accessibilityRole="header"
        color={danger ? theme.color.danger : theme.color.textDim}
        style={{ flex: 1, textTransform: 'uppercase' }}
      >
        {title}
      </Text>
      {trailing ? <Text variant="caption" dim>{trailing}</Text> : null}
    </View>
  );
}

function ProfileMetric({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={{
        flex: 1,
        minWidth: 0,
        borderLeftWidth: first ? 0 : 1,
        borderLeftColor: theme.color.hairline,
        paddingHorizontal: spacing.md,
        gap: 2,
      }}
    >
      <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text variant="caption" dim>{label}</Text>
    </View>
  );
}

function IconAction({
  icon,
  label,
  onPress,
  tone = 'primary',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'neutral' | 'success';
}) {
  const theme = useTheme();
  const backgroundColor = tone === 'success'
    ? theme.color.success
    : tone === 'neutral'
      ? theme.color.surfaceAlt
      : theme.color.primarySoft;
  const color = tone === 'success'
    ? theme.color.textInverse
    : tone === 'neutral'
      ? theme.color.textDim
      : theme.color.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.input,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

function TriggerOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        minWidth: 0,
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radius.input,
        borderWidth: 1,
        borderColor: active ? theme.color.primary : theme.color.hairline,
        backgroundColor: active ? theme.color.primarySoft : theme.color.surface,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: active ? theme.color.primary : theme.color.textDim,
          backgroundColor: active ? theme.color.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active ? <Ionicons name="checkmark" size={15} color={theme.color.onPrimary} /> : null}
      </View>
      <Text variant="footnote" style={{ flex: 1, lineHeight: 18 }} color={active ? theme.color.primary : theme.color.text}>
        {label}
      </Text>
    </Pressable>
  );
}

function ThemeOption({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${label} appearance`}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.xs,
        borderRadius: radius.chip,
        borderWidth: 1,
        borderColor: active ? theme.color.primary : 'transparent',
        backgroundColor: active ? theme.color.surface : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={17} color={active ? theme.color.primary : theme.color.textDim} />
      <Text
        variant="footnote"
        color={active ? theme.color.primary : theme.color.textDim}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        style={{ flexShrink: 1 }}
      >
        {label}
      </Text>
    </Pressable>
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
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.color.hairline,
        backgroundColor: pressed ? theme.color.surfaceAlt : 'transparent',
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.chip,
          backgroundColor: danger ? theme.color.accentSoft : theme.color.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }} color={color}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={danger ? theme.color.danger : theme.color.textDim} />
    </Pressable>
  );
}

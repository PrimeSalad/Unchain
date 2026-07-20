import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
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
import { useRouter, type Href } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { ActionSheet } from '../components/ActionSheet';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useReliableSafeAreaInsets } from '../hooks/useReliableSafeAreaInsets';
import { useStore, useProfile, materializeRecoveryByAddiction } from '@/application/store';
import { shareCapturedContent } from '@/application/shareMedia';
import {
  DEFAULT_CURRENCY,
  ADDICTIONS,
  addictionMeta,
  currentStreakStart,
  formatMoney,
  streakDays,
  triggersForAddiction,
  type AddictionType,
} from '@/domain/gambling';
import { PORN_TRIGGERS } from '@/domain/pornRecovery';
import { normalizeSelectedAddictions } from '@/domain/multiAddiction';
import { isCompleteRecoveryTrackSetup } from '@/domain/recoveryTrackSetup';
import { RECOVERY_STATE_SCHEMA_VERSION, migrateRecoveryState } from '@/domain/recoveryStateMigration';

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

type PendingTrackSwitch = {
  source: AddictionType;
  target: AddictionType;
};


// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function ProfileScreen() {
  const theme = useTheme();
  const insets = useReliableSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const navigation = useNavigation();
  const profile = useProfile();
  const update = useStore((s) => s.updateProfile);
  const recoveryByAddiction = useStore((s) => s.recoveryByAddiction);
  const setActiveAddiction = useStore((s) => s.setActiveAddiction);
  const archiveRecoveryTrack = useStore((s) => s.archiveRecoveryTrack);
  const resumeRecoveryTrack = useStore((s) => s.resumeRecoveryTrack);
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

  // Triggers draft state — keeps edits local until explicitly saved
  const [triggersDraft, setTriggersDraft] = useState<string[]>(() => profile?.triggers ?? []);
  const [savingTriggers, setSavingTriggers] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<PendingTrackSwitch | null>(null);

  // Sync draft if profile triggers change externally (e.g. backup restore)
  useEffect(() => {
    if (profile) setTriggersDraft(profile.triggers);
  }, [profile?.addictionType, profile?.triggers]);

  // Dirty check: compare sorted arrays by content
  const triggersDirty = profile
    ? [...triggersDraft].sort().join('\0') !== [...profile.triggers].sort().join('\0')
    : false;
  const reasonDirty = Boolean(
    profile
    && editingReason
    && reasonValue.trim() !== (profile.reason ?? '').trim(),
  );
  const trackEditsDirty = triggersDirty || reasonDirty;

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

  // Guard navigation away when there are unsaved trigger changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!trackEditsDirty) return;
      // Prevent the default back action
      e.preventDefault();
      Alert.alert(
        'Unsaved recovery changes',
        'You have unsaved changes to this recovery track. Discard them and leave?',
        [
          {
            text: 'Keep editing',
            style: 'cancel',
            onPress: () => {},
          },
          {
            text: 'Discard changes',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, trackEditsDirty]);

  // A store restore or another screen can change the active track while the
  // sheet is open. Close the stale prompt instead of applying its draft to a
  // different source track.
  useEffect(() => {
    if (pendingSwitch && profile?.addictionType !== pendingSwitch.source) {
      setPendingSwitch(null);
    }
  }, [pendingSwitch, profile?.addictionType]);

  if (!profile) return null;

  // Same event-derived streak as Home/Progress - never counts through a relapse.
  const days = streakDays(currentStreakStart(profile.startedAt, relapses, journal));
  const meta = addictionMeta(profile.addictionType);
  const typeLabel = meta.label;
  const selectedTracks = normalizeSelectedAddictions(profile.addictionType, profile.selectedAddictions);
  const selectedTrackSet = new Set(selectedTracks);
  const archivedTracks = ADDICTIONS.filter(
    (addiction) => !selectedTrackSet.has(addiction.key) && recoveryByAddiction[addiction.key] != null,
  );
  const newTrackCount = ADDICTIONS.filter(
    (addiction) => !selectedTrackSet.has(addiction.key) && recoveryByAddiction[addiction.key] == null,
  ).length;
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
  const selectedTriggerCount = triggersDraft.length;
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

  // ── Recovery track lifecycle ─────────────────────────────────────────────

  const openRecoveryTrackSetup = (mode: 'add' | 'review', addiction?: AddictionType) => {
    const query = addiction
      ? `?mode=${mode}&type=${encodeURIComponent(addiction)}`
      : `?mode=${mode}`;
    router.push(`/recovery-track-setup${query}` as Href);
  };

  const performRecoveryTrackSwitch = (
    addiction: AddictionType,
    expectedSource?: AddictionType,
  ): boolean => {
    const before = useStore.getState();
    const currentProfile = before.profile;
    if (!currentProfile) {
      setPendingSwitch(null);
      showToast('Could not switch recovery tracks', 'error');
      return false;
    }
    if (currentProfile.addictionType === addiction) {
      setPendingSwitch(null);
      return true;
    }
    if (expectedSource && currentProfile.addictionType !== expectedSource) {
      setPendingSwitch(null);
      setTriggersDraft(currentProfile.triggers);
      setReasonValue(currentProfile.reason ?? '');
      setEditingReason(false);
      showToast('The active track changed. Review it before editing.', 'error');
      return false;
    }

    const target = before.recoveryByAddiction[addiction];
    if (!target) {
      setPendingSwitch(null);
      showToast(`${addictionMeta(addiction).label} setup data is unavailable`, 'error');
      return false;
    }
    if (!isCompleteRecoveryTrackSetup(target.setup)) {
      setPendingSwitch(null);
      openRecoveryTrackSetup('review', addiction);
      return false;
    }

    Keyboard.dismiss();
    setActiveAddiction(addiction);
    const switchedProfile = useStore.getState().profile;
    if (switchedProfile?.addictionType !== addiction) {
      setPendingSwitch(null);
      showToast(`Could not switch to ${addictionMeta(addiction).label}`, 'error');
      return false;
    }

    // Update local editors immediately as well as through the profile effect,
    // so no frame can show the previous track's reason or trigger draft.
    setPendingSwitch(null);
    setEditingReason(false);
    setReasonValue(switchedProfile.reason ?? '');
    setTriggersDraft(switchedProfile.triggers);
    showToast(`${addictionMeta(addiction).label} is now active`);
    return true;
  };

  const switchRecoveryTrack = (addiction: AddictionType) => {
    const current = useStore.getState().profile;
    if (!current || addiction === current.addictionType) return;

    if (!trackEditsDirty) {
      setEditingReason(false);
      performRecoveryTrackSwitch(addiction, current.addictionType);
      return;
    }

    // Dismiss first so iOS does not present the sheet against a keyboard-
    // reduced viewport. The ActionSheet itself owns the modal safe areas.
    Keyboard.dismiss();
    setPendingSwitch({ source: current.addictionType, target: addiction });
  };

  const discardAndSwitchRecoveryTrack = () => {
    if (!pendingSwitch) return;
    const current = useStore.getState().profile;
    if (!current || current.addictionType !== pendingSwitch.source) {
      setPendingSwitch(null);
      if (current) {
        setTriggersDraft(current.triggers);
        setReasonValue(current.reason ?? '');
      }
      setEditingReason(false);
      showToast('The active track changed. Nothing was discarded.', 'error');
      return;
    }

    const target = pendingSwitch.target;
    setTriggersDraft(current.triggers);
    setReasonValue(current.reason ?? '');
    setEditingReason(false);
    performRecoveryTrackSwitch(target, pendingSwitch.source);
  };

  const saveAndSwitchRecoveryTrack = () => {
    if (!pendingSwitch) return;
    const current = useStore.getState().profile;
    if (!current || current.addictionType !== pendingSwitch.source) {
      setPendingSwitch(null);
      if (current) {
        setTriggersDraft(current.triggers);
        setReasonValue(current.reason ?? '');
      }
      setEditingReason(false);
      showToast('The active track changed. Review it before saving.', 'error');
      return;
    }

    const nextReason = editingReason ? reasonValue.trim() : current.reason.trim();
    if (!nextReason) {
      setPendingSwitch(null);
      AccessibilityInfo.announceForAccessibility('Add a recovery reason before switching.');
      showToast('Add a recovery reason before switching', 'error');
      setTimeout(() => reasonRef.current?.focus(), 180);
      return;
    }

    const target = pendingSwitch.target;
    try {
      update({
        ...(reasonDirty ? { reason: nextReason } : {}),
        ...(triggersDirty ? { triggers: [...triggersDraft] } : {}),
      });
    } catch {
      setPendingSwitch(null);
      showToast('Could not save this recovery track', 'error');
      return;
    }
    setEditingReason(false);
    performRecoveryTrackSwitch(target, pendingSwitch.source);
  };

  const confirmArchiveRecoveryTrack = (addiction: AddictionType) => {
    const label = addictionMeta(addiction).label;
    if (selectedTracks.length <= 1) {
      Alert.alert('Keep one recovery track', 'Add another recovery track before archiving this one.');
      return;
    }
    if (addiction === profile.addictionType) {
      Alert.alert('Switch tracks first', 'Make another recovery track active before archiving this one.');
      return;
    }
    Alert.alert(
      `Archive ${label}?`,
      'Its history stays saved. It will no longer appear in your daily recovery tracks, and you can resume it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            const result = archiveRecoveryTrack(addiction);
            if (result === 'archived') {
              showToast(`${label} archived`);
            } else if (result === 'only_track') {
              Alert.alert('Keep one recovery track', 'Add another recovery track before archiving this one.');
            } else {
              showToast(`Could not archive ${label}`, 'error');
            }
          },
        },
      ],
    );
  };

  const resumeArchivedTrack = (addiction: AddictionType) => {
    const label = addictionMeta(addiction).label;
    const result = resumeRecoveryTrack(addiction);
    if (result === 'resumed') {
      showToast(`${label} resumed`);
      return;
    }
    if (result === 'needs_review') {
      openRecoveryTrackSetup('review', addiction);
      return;
    }
    if (result === 'already_selected') {
      showToast(`${label} is already in your recovery tracks`);
      return;
    }
    showToast(`Could not resume ${label}`, 'error');
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
    if (!trimmed) {
      AccessibilityInfo.announceForAccessibility('Add a recovery reason before saving.');
      reasonRef.current?.focus();
      showToast('Recovery reason cannot be empty', 'error');
      return;
    }
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

  // ── Trigger draft handlers ────────────────────────────────────────────────

  const toggleTriggerDraft = (trigger: string) => {
    setTriggersDraft((prev) =>
      prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger],
    );
  };

  const saveTriggers = async () => {
    setSavingTriggers(true);
    try {
      update({ triggers: triggersDraft });
      showToast('Triggers saved');
    } catch {
      showToast('Failed to save triggers', 'error');
    } finally {
      setSavingTriggers(false);
    }
  };

  const discardTriggers = () => {
    setTriggersDraft(profile.triggers);
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
      const backup = {
        app: BACKUP_MARKER,
        version: RECOVERY_STATE_SCHEMA_VERSION,
        exportedAt: Date.now(),
        data: {
          // Keep future data slices automatically; JSON serialization omits
          // store action functions. Explicit fields below document/override
          // the recovery-critical portions of the backup.
          ...s,
          profile: s.profile,
          recoveryByAddiction: materializeRecoveryByAddiction(s),
          dailyJournalPlan: s.dailyJournalPlan,
          journalDrafts: s.journalDrafts,
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
      const rawData =
        parsed?.app === BACKUP_MARKER || parsed?.app === LEGACY_BACKUP_MARKER || parsed?.data
          ? parsed.data
          : parsed;
      const backupVersion = typeof parsed?.version === 'number' ? parsed.version : 0;
      const preview = migrateRecoveryState(rawData, backupVersion) as any;
      const previewProfile = preview?.profile;
      const validType = typeof previewProfile?.addictionType === 'string'
        && ADDICTIONS.some((item) => item.key === previewProfile.addictionType);
      if (!validType || typeof previewProfile.startedAt !== 'number') {
        showToast('That file is not a valid Unchainly backup', 'error');
        return;
      }
      const previewTracks = normalizeSelectedAddictions(
        previewProfile.addictionType,
        Array.isArray(previewProfile.selectedAddictions) ? previewProfile.selectedAddictions : undefined,
      );
      const exportedLabel = typeof parsed?.exportedAt === 'number'
        ? new Date(parsed.exportedAt).toLocaleString()
        : 'Unknown date';
      const journalCount = Array.isArray(preview.journal) ? preview.journal.length : 0;
      setModal({
        title: 'Restore this backup?',
        body: [
          `Profile: ${previewProfile.name || 'Friend'}`,
          `Recovery tracks: ${previewTracks.length}`,
          `Active journal entries: ${journalCount}`,
          `Exported: ${exportedLabel}`,
          '',
          'This replaces the local data currently on this device. This cannot be undone unless you export the current data first.',
        ].join('\n'),
        confirmLabel: 'Restore backup',
        onConfirm: () => {
          const result = useStore.getState().restoreBackup(rawData, backupVersion);
          showToast(
            result === 'restored' ? 'Backup restored successfully' : 'Backup could not be restored',
            result === 'restored' ? 'success' : 'error',
          );
        },
      });
    } catch {
      showToast('Could not read that backup', 'error');
    }
  };


  // ── Shared input style ────────────────────────────────────────────────────

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

        {/* ── Avatar + name row ── */}
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

        {/* ── Inline name editor ── */}
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

        {/* ── Streak / start metrics ── */}
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

        {/* ── Recovery details ── */}
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
          <SectionTitle title="Recovery tracks" trailing={`${selectedTracks.length} selected`} />
          <Text variant="footnote" dim style={{ marginBottom: spacing.md }}>
            Tap a track to make it active. Added or archived tracks apply to your next daily journal.
          </Text>
          <View style={{ gap: spacing.sm }}>
            {selectedTracks.map((addiction) => {
              const snapshot = recoveryByAddiction[addiction];
              const active = addiction === profile.addictionType;
              const trackProfile = active ? profile : snapshot?.profile;
              const needsReview = snapshot == null
                || !isCompleteRecoveryTrackSetup(snapshot.setup);
              return (
                <RecoveryTrackCard
                  key={addiction}
                  label={addictionMeta(addiction).label}
                  detail={trackProfile?.addictionDetail}
                  active={active}
                  needsReview={needsReview}
                  canArchive={!active && selectedTracks.length > 1}
                  onSelect={() => needsReview
                    ? openRecoveryTrackSetup('review', addiction)
                    : switchRecoveryTrack(addiction)}
                  onFinishSetup={() => openRecoveryTrackSetup('review', addiction)}
                  onArchive={() => confirmArchiveRecoveryTrack(addiction)}
                />
              );
            })}
          </View>

          <AddRecoveryTrackButton
            disabled={newTrackCount === 0}
            onPress={() => openRecoveryTrackSetup('add')}
          />
        </View>

        {archivedTracks.length > 0 ? (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionTitle title="Archived" trailing={`${archivedTracks.length} saved`} />
            <Text variant="footnote" dim style={{ marginBottom: spacing.md }}>
              Archived history stays on this device until you choose to resume it.
            </Text>
            <View style={{ gap: spacing.sm }}>
              {archivedTracks.map((addiction) => {
                const snapshot = recoveryByAddiction[addiction.key]!;
                const needsReview = !isCompleteRecoveryTrackSetup({
                  ...snapshot.setup,
                  setupStatus: 'complete',
                });
                return (
                  <ArchivedRecoveryTrackRow
                    key={addiction.key}
                    label={addiction.label}
                    needsReview={needsReview}
                    onPress={() => needsReview
                      ? openRecoveryTrackSetup('review', addiction.key)
                      : resumeArchivedTrack(addiction.key)}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── Recovery reason ── */}
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

        {/* ── Triggers ── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle
            title="Triggers"
            trailing={`${selectedTriggerCount} selected${triggersDirty ? ' · unsaved' : ''}`}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {triggerOptions.map((trigger) => {
              const active = triggersDraft.includes(trigger);
              return (
                <TriggerOption
                  key={trigger}
                  label={trigger}
                  active={active}
                  onPress={() => toggleTriggerDraft(trigger)}
                />
              );
            })}
          </View>

          {/* Save / Discard row — only visible when dirty */}
          {triggersDirty && (
            <Reanimated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                marginTop: spacing.md,
              }}
            >
              {/* Discard button */}
              <Pressable
                onPress={discardTriggers}
                accessibilityRole="button"
                accessibilityLabel="Discard trigger changes"
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 48,
                  borderRadius: radius.button,
                  borderWidth: 1,
                  borderColor: theme.color.hairline,
                  backgroundColor: pressed ? theme.color.surfaceAlt : theme.color.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text variant="callout" color={theme.color.textDim}>Discard</Text>
              </Pressable>

              {/* Save button */}
              <Pressable
                onPress={saveTriggers}
                disabled={savingTriggers}
                accessibilityRole="button"
                accessibilityLabel="Save trigger changes"
                style={({ pressed }) => ({
                  flex: 2,
                  minHeight: 48,
                  borderRadius: radius.button,
                  backgroundColor: theme.color.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  opacity: pressed || savingTriggers ? 0.75 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                {savingTriggers ? (
                  <ActivityIndicator size="small" color={theme.color.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={theme.color.onPrimary} />
                    <Text variant="callout" color={theme.color.onPrimary}>Save triggers</Text>
                  </>
                )}
              </Pressable>
            </Reanimated.View>
          )}
        </View>


        {/* ── Appearance ── */}
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

        {/* ── Backup ── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title="Backup" />
          <FlatGroup>
            <ActionRow icon="share-outline" label="Export local data" onPress={exportData} first />
            <ActionRow icon="download-outline" label="Import backup" onPress={importData} />
          </FlatGroup>
        </View>

        {/* ── Danger zone ── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title="Danger zone" danger />
          <FlatGroup>
            <ActionRow icon="refresh-outline" label="Reset recovery data" danger onPress={openResetRecoveryModal} first />
            <ActionRow icon="trash-outline" label="Delete all local data" danger onPress={openDeleteAllModal} />
          </FlatGroup>
        </View>

        {/* ── Privacy note ── */}
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

      {/* ── Unsaved recovery-track switch ── */}
      <ActionSheet
        visible={pendingSwitch !== null}
        onClose={() => setPendingSwitch(null)}
        closeLabel="Keep editing"
        title={pendingSwitch
          ? `Switch to ${addictionMeta(pendingSwitch.target).label}?`
          : 'Switch recovery track?'}
        description={pendingSwitch
          ? `Your unsaved reason or triggers belong to ${addictionMeta(pendingSwitch.source).label}. Choose what to do before switching.`
          : undefined}
      >
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={saveAndSwitchRecoveryTrack}
            accessibilityRole="button"
            accessibilityLabel="Save changes and switch recovery track"
            accessibilityHint="Saves this track’s reason and triggers, then makes the selected track active"
            style={({ pressed }) => ({
              minHeight: 52,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.input,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.color.primary,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <Text variant="headline" color={theme.color.onPrimary} center>
              Save changes and switch
            </Text>
          </Pressable>
          <Pressable
            onPress={discardAndSwitchRecoveryTrack}
            accessibilityRole="button"
            accessibilityLabel="Discard changes and switch recovery track"
            accessibilityHint="Discards only the unsaved reason and trigger changes for the current track"
            style={({ pressed }) => ({
              minHeight: 52,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: theme.color.danger,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.68 : 1,
            })}
          >
            <Text variant="headline" color={theme.color.danger} center>
              Discard changes and switch
            </Text>
          </Pressable>
        </View>
      </ActionSheet>

      {/* ── Confirmation modal ── */}
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

      {/* ── Toast ── */}
      {toast && modal === null && pendingSwitch === null && (
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
      <View accessible={false} style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
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

function RecoveryTrackCard({
  label,
  detail,
  active,
  needsReview,
  canArchive,
  onSelect,
  onFinishSetup,
  onArchive,
}: {
  label: string;
  detail?: string;
  active: boolean;
  needsReview: boolean;
  canArchive: boolean;
  onSelect: () => void;
  onFinishSetup: () => void;
  onArchive: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: radius.input,
        borderWidth: 1,
        borderColor: active ? theme.color.primary : theme.color.hairline,
        backgroundColor: active ? theme.color.primarySoft : theme.color.surface,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onSelect}
        disabled={active}
        accessibilityRole="button"
        accessibilityLabel={`${label} recovery track${active ? ', active' : needsReview ? ', setup required' : ''}`}
        accessibilityHint={active
          ? 'This is your active recovery track'
          : needsReview
            ? `Opens the remaining setup questions for ${label}`
            : `Makes ${label} your active recovery track`}
        accessibilityState={{ selected: active, disabled: active }}
        style={({ pressed }) => ({
          minHeight: 68,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: pressed ? theme.color.surfaceAlt : 'transparent',
        })}
      >
        <View
          accessible={false}
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? theme.color.primary : theme.color.surfaceAlt,
          }}
        >
          <Ionicons
            name={active ? 'checkmark' : 'shield-checkmark-outline'}
            size={21}
            color={active ? theme.color.onPrimary : theme.color.primary}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="callout" color={active ? theme.color.primary : theme.color.text}>
            {label}
          </Text>
          <Text variant="caption" dim style={{ marginTop: 2 }}>
            {detail?.trim() || (active
              ? 'Currently active'
              : needsReview
                ? 'Finish setup before making active'
                : 'Tap to make active')}
          </Text>
        </View>
        {active ? (
          <View
            style={{
              minHeight: 28,
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
              borderRadius: radius.round,
              backgroundColor: theme.color.primary,
            }}
          >
            <Text variant="caption" color={theme.color.onPrimary}>Active</Text>
          </View>
        ) : (
          <Ionicons
            name={needsReview ? 'clipboard-outline' : 'chevron-forward'}
            size={19}
            color={needsReview ? theme.color.accentText : theme.color.textDim}
          />
        )}
      </Pressable>

      {needsReview || canArchive ? (
        <View
          style={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: theme.color.hairline,
          }}
        >
          {needsReview ? (
            <Pressable
              onPress={onFinishSetup}
              accessibilityRole="button"
              accessibilityLabel={`Finish setup for ${label}`}
              accessibilityHint="Opens the recovery track setup questions"
              style={({ pressed }) => ({
                minHeight: 44,
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.chip,
                backgroundColor: theme.color.accentSoft,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Ionicons name="clipboard-outline" size={17} color={theme.color.accentText} />
              <Text variant="footnote" color={theme.color.accentText}>Finish setup</Text>
            </Pressable>
          ) : null}
          {canArchive ? (
            <Pressable
              onPress={onArchive}
              accessibilityRole="button"
              accessibilityLabel={`Archive ${label} recovery track`}
              accessibilityHint="Keeps its history saved and removes it from your selected tracks"
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                borderRadius: radius.chip,
                borderWidth: 1,
                borderColor: theme.color.danger,
                opacity: pressed ? 0.68 : 1,
              })}
            >
              <Ionicons name="archive-outline" size={17} color={theme.color.danger} />
              <Text variant="footnote" color={theme.color.danger}>Archive</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AddRecoveryTrackButton({
  disabled,
  onPress,
}: {
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={disabled ? 'No new recovery categories available' : 'Add recovery track'}
      accessibilityHint={disabled ? undefined : 'Opens setup for another recovery track'}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: 52,
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.input,
        backgroundColor: theme.color.primary,
        opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
      })}
    >
      <Ionicons name={disabled ? 'checkmark' : 'add'} size={21} color={theme.color.onPrimary} />
      <Text variant="callout" color={theme.color.onPrimary}>
        {disabled ? 'No new categories available' : 'Add recovery track'}
      </Text>
    </Pressable>
  );
}

function ArchivedRecoveryTrackRow({
  label,
  needsReview,
  onPress,
}: {
  label: string;
  needsReview: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const action = needsReview ? 'Finish setup' : 'Resume';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${action} ${label} recovery track`}
      accessibilityHint={needsReview ? 'Completes setup before restoring this track' : 'Restores this track with its saved history'}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.input,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        backgroundColor: pressed ? theme.color.surfaceAlt : theme.color.surface,
      })}
    >
      <View
        accessible={false}
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: needsReview ? theme.color.accentSoft : theme.color.surfaceAlt,
        }}
      >
        <Ionicons
          name={needsReview ? 'clipboard-outline' : 'archive-outline'}
          size={19}
          color={needsReview ? theme.color.accentText : theme.color.primary}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="callout">{label}</Text>
        <Text variant="caption" dim style={{ marginTop: 2 }}>History saved on this device</Text>
      </View>
      <Text variant="footnote" color={needsReview ? theme.color.accentText : theme.color.primary}>
        {action}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
    </Pressable>
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

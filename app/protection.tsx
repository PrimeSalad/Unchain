/**
 * Focus Protection — a permanent, consent-first website blocklist.
 *
 * Blocking model: a website on the list is protected the moment it is added
 * and stays protected indefinitely. There are no timers, no sessions, no
 * expiry, and no pause switch — the ONLY way a site stops being protected is
 * the user deleting it, behind a destructive confirmation. The user builds
 * the whole list themselves; suggestions require an explicit Add tap. No
 * browsing data is read or collected, and the list never leaves the device.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { Card } from '@/presentation/components/Card';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { elevation, radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useProfile, useTodayAnyJournal } from '@/application/store';
import { currentStreakStart, streakDays } from '@/domain/gambling';
import { ALTERNATIVES } from '@/domain/alternatives';
import { sameDay } from '@/domain/records';
import { SUGGESTED_SITES, siteLabel, type BlockedSite } from '@/domain/protection';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

type SortMode = 'az' | 'recent';

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-platform confirmation dialog
//
// React Native's Alert.alert is a no-op on web — this custom Modal works on
// iOS, Android, AND web. It blocks interaction behind a dark scrim and shows
// a centred card with Cancel + Remove buttons.
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  visible: boolean;
  siteName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({ visible, siteName, onCancel, onConfirm }: ConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Scrim */}
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
        }}
      >
        {/* Dialog card — stopPropagation so taps inside don't hit the scrim */}
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            overflow: 'hidden',
            ...elevation.e2,
          }}
        >
          {/* Stop scrim from firing when user taps inside the card */}
          <Pressable onPress={() => {}}>
            <View style={{ padding: spacing.xl, gap: spacing.sm }}>
              {/* Icon */}
              <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
                <View
                  style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: theme.color.danger + '18',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={26} color={theme.color.danger} />
                </View>
              </View>

              {/* Title */}
              <Text
                variant="title2"
                center
                style={{ fontFamily: 'Nunito_800ExtraBold' }}
              >
                Remove Protection?
              </Text>

              {/* Message */}
              <Text variant="callout" dim center style={{ lineHeight: 22 }}>
                Are you sure you want to remove{' '}
                <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold', color: theme.color.text }}>
                  {siteName}
                </Text>
                {' '}from your blocklist?
              </Text>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: theme.color.hairline }} />

            {/* Buttons */}
            <View style={{ flexDirection: 'row' }}>
              {/* Cancel */}
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: spacing.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                  borderRightWidth: 1,
                  borderRightColor: theme.color.hairline,
                })}
              >
                <Text variant="callout" color={theme.color.primary}>Cancel</Text>
              </Pressable>

              {/* Remove */}
              <Pressable
                onPress={onConfirm}
                accessibilityRole="button"
                accessibilityLabel="Remove from blocklist"
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: spacing.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold', color: theme.color.danger }}>
                  Remove
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared domain/nickname fields
// ─────────────────────────────────────────────────────────────────────────────

function DomainFields({
  domain,
  nickname,
  error,
  autoFocus = true,
  onDomain,
  onNickname,
}: {
  domain: string;
  nickname: string;
  error: string | null;
  autoFocus?: boolean;
  onDomain: (v: string) => void;
  onNickname: (v: string) => void;
}) {
  const theme = useTheme();
  const inputStyle = {
    borderRadius: radius.input,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: error ? theme.color.danger : theme.color.hairline,
    padding: spacing.lg,
    color: theme.color.text,
    fontSize: 17,
    fontFamily: 'Nunito_600SemiBold',
  } as const;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="footnote" dim>Website URL</Text>
      <TextInput
        value={domain}
        onChangeText={onDomain}
        placeholder="e.g. casino.com"
        placeholderTextColor={theme.color.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        autoFocus={autoFocus}
        underlineColorAndroid="transparent"
        selectionColor={theme.color.primary}
        accessibilityLabel="Website URL"
        style={inputStyle}
      />
      {error ? (
        <Text variant="footnote" color={theme.color.danger}>{error}</Text>
      ) : null}
      <Text variant="footnote" dim style={{ marginTop: spacing.sm }}>Nickname (optional)</Text>
      <TextInput
        value={nickname}
        onChangeText={onNickname}
        placeholder="e.g. Online Casino"
        placeholderTextColor={theme.color.textDim}
        underlineColorAndroid="transparent"
        selectionColor={theme.color.primary}
        accessibilityLabel="Nickname, optional"
        style={[inputStyle, { borderColor: theme.color.hairline }]}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add sheet
// ─────────────────────────────────────────────────────────────────────────────

function AddSiteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const addBlockedSite = useStore((s) => s.addBlockedSite);
  const [domain, setDomain] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDomain('');
      setNickname('');
      setError(null);
    }
  }, [visible]);

  const save = () => {
    const result = addBlockedSite(domain, nickname);
    if (result === 'invalid') {
      setError('That does not look like a website address. Try something like casino.com.');
      return;
    }
    if (result === 'duplicate') {
      setError('This website is already protected.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  return (
    <ActionSheet visible={visible} onClose={onClose}>
      <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.xs }}>
        Add Website
      </Text>
      <Text variant="footnote" dim style={{ marginBottom: spacing.lg, lineHeight: 19 }}>
        Protection starts the moment you add it and stays on until you remove it. The list never leaves this device.
      </Text>
      <DomainFields
        domain={domain}
        nickname={nickname}
        error={error}
        onDomain={(v) => { setDomain(v); setError(null); }}
        onNickname={setNickname}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <Button label="Add & Protect" onPress={save} disabled={!domain.trim()} full />
        <Button label="Cancel" kind="secondary" onPress={onClose} full />
      </View>
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit sheet — subscribes to the live store entry by id (never a stale copy),
// so every change is reflected instantly and deletion closes cleanly.
// The "Remove from Blocklist" button has been intentionally removed here —
// the only deletion path is the trash icon on each row in the list.
// ─────────────────────────────────────────────────────────────────────────────

function EditSiteSheet({ siteId, onClose }: { siteId: string | null; onClose: () => void }) {
  const updateBlockedSite = useStore((s) => s.updateBlockedSite);
  const site = useStore((s) => (siteId ? s.blockedSites.find((b) => b.id === siteId) : undefined));

  const [domain, setDomain] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Track whether the sheet should be open independently of the store lookup.
  // This prevents the race where removing a site makes `site` undefined before
  // the sheet closes, causing the Modal to unmount unexpectedly.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (siteId != null) setOpen(true);
  }, [siteId]);

  useEffect(() => {
    if (siteId && site) {
      setDomain(site.domain);
      setNickname(site.nickname ?? '');
      setError(null);
      setSaveStatus('idle');
    }
    // Re-seed only when a different site is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  const save = () => {
    if (!site) return;
    setSaveStatus('saving');
    const result = updateBlockedSite(site.id, { domain, nickname });
    if (result === 'invalid') {
      setError('That does not look like a website address.');
      setSaveStatus('idle');
      return;
    }
    if (result === 'duplicate') {
      setError('Another entry already uses this domain.');
      setSaveStatus('idle');
      return;
    }
    setSaveStatus('saved');
    Haptics.selectionAsync().catch(() => {});
    // Brief pause so the user sees "Saved" before the sheet closes.
    setTimeout(handleClose, 600);
  };

  const theme = useTheme();
  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved'  ? '✓ Saved' :
    'Save Changes';

  return (
    <ActionSheet visible={open} onClose={handleClose}>
      <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.lg }}>
        Edit Website
      </Text>
      <DomainFields
        domain={domain}
        nickname={nickname}
        error={error}
        autoFocus={false}
        onDomain={(v) => { setDomain(v); setError(null); }}
        onNickname={setNickname}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <Button
          label={saveLabel}
          onPress={save}
          disabled={!domain.trim() || saveStatus !== 'idle'}
          full
        />
        <Button label="Close" kind="secondary" onPress={handleClose} full />
      </View>
      {saveStatus === 'saved' && (
        <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
          <Text variant="caption" color={theme.color.success}>Changes saved successfully.</Text>
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Site row — always Protected; tap card to edit, tap trash to remove directly.
//
// Web / nested-button fix: the trash icon must NOT be a Pressable nested
// inside another Pressable — that produces the "button cannot contain a
// nested button" warning on React Native Web.  Instead both interactive
// zones are SIBLINGS inside the Animated.View:
//   [ Pressable:card-content ]  [ Pressable:trash ]
// The card Pressable occupies flex:1 so it fills all remaining space and
// the layout looks identical to the old nested approach.
// ─────────────────────────────────────────────────────────────────────────────

function SiteRow({
  site,
  index,
  onEdit,
  onRemove,
}: {
  site: BlockedSite;
  index: number;
  onEdit: () => void;
  onRemove: (id: string, label: string) => void;
}) {
  const theme = useTheme();
  const cardStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    backgroundColor: theme.color.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: theme.color.hairline,
    padding: spacing.lg,
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(18)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
    >
      {/* Card — tapping opens the edit sheet */}
      <Pressable
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onEdit(); }}
        accessibilityRole="button"
        accessibilityLabel={`${siteLabel(site)}, protected. Tap to edit`}
        style={({ pressed }) => [cardStyle, { flex: 1, opacity: pressed ? 0.85 : 1 }]}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: theme.color.success + '18',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="shield-checkmark" size={20} color={theme.color.success} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="headline" numberOfLines={1}>{siteLabel(site)}</Text>
          {site.nickname ? (
            <Text variant="caption" dim numberOfLines={1}>{site.domain}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
            <Ionicons name="checkmark-circle" size={12} color={theme.color.success} />
            <Text variant="caption" color={theme.color.success}>Protected</Text>
            <Text variant="caption" dim>· Added {fmtDate(site.addedAt)}</Text>
          </View>
        </View>
      </Pressable>

      {/* Trash — sibling of the card Pressable, never nested inside it */}
      <Pressable
        onPress={() => onRemove(site.id, siteLabel(site))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${siteLabel(site)} from blocklist`}
        style={({ pressed }) => ({
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: theme.color.accentSoft,
          alignItems: 'center', justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="trash-outline" size={17} color={theme.color.accentText} />
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function Protection() {
  const theme = useTheme();
  const safeBack = useSafeBack();
  const profile = useProfile();
  const blockedSites = useStore((s) => s.blockedSites);
  const addBlockedSite = useStore((s) => s.addBlockedSite);
  const removeBlockedSite = useStore((s) => s.removeBlockedSite);
  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);
  const completions = useStore((s) => s.alternatives);
  // Any addiction type's entry counts toward "activities today".
  const todayJournal = useTodayAnyJournal();

  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('az');

  // ── Deletion confirmation dialog ───────────────────────────────────────────
  // We use a custom Modal instead of Alert.alert because Alert is a no-op on
  // React Native Web — the Modal works identically on iOS, Android, and web.
  const [confirmPending, setConfirmPending] = useState<{ id: string; label: string } | null>(null);

  const handleRemove = (id: string, label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirmPending({ id, label });
  };

  const handleConfirmDelete = () => {
    if (!confirmPending) return;
    const { id } = confirmPending;
    setConfirmPending(null);
    removeBlockedSite(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleCancelDelete = () => {
    setConfirmPending(null);
  };

  const streak = profile ? streakDays(currentStreakStart(profile.startedAt, relapses, journal)) : 0;
  const activitiesToday = ALTERNATIVES.filter((a) =>
    a.id === 'journal'
      ? todayJournal != null
      : completions[a.id] != null && sameDay(completions[a.id]!, Date.now()),
  ).length;

  const visibleSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? blockedSites.filter(
          (s) => s.domain.includes(q) || (s.nickname ?? '').toLowerCase().includes(q),
        )
      : blockedSites;
    return [...filtered].sort((a, b) =>
      sort === 'az' ? siteLabel(a).localeCompare(siteLabel(b)) : b.addedAt - a.addedAt,
    );
  }, [blockedSites, query, sort]);

  const suggestions = SUGGESTED_SITES.filter(
    (d) => !blockedSites.some((s) => s.domain === d),
  );

  const hasSites = blockedSites.length > 0;

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="title1">Focus Protection</Text>
          <Text variant="footnote" dim style={{ marginTop: 2 }}>
            Permanent by design — protection only ends when you remove a website.
          </Text>
        </View>
        <Pressable
          onPress={safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            width: 40, height: 40, borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="close" size={22} color={theme.color.primary} />
        </Pressable>
      </View>

      {/* Dashboard */}
      <Card tone={hasSites ? 'successSoft' : 'surface'} style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 46, height: 46, borderRadius: 23,
              backgroundColor: (hasSites ? theme.color.success : theme.color.primary) + '20',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons
              name={hasSites ? 'shield-checkmark' : 'shield-outline'}
              size={24}
              color={hasSites ? theme.color.success : theme.color.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline">
              {hasSites ? 'Protection Always On' : 'No websites protected yet'}
            </Text>
            <Text variant="footnote" dim style={{ marginTop: 1 }}>
              {hasSites
                ? `${blockedSites.length} website${blockedSites.length === 1 ? '' : 's'} protected — no timers, no expiry`
                : 'Add websites below to start protecting yourself'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <DashStat value={`${blockedSites.length}`} label="Websites" />
          <DashStat value={`${streak}`} label="Day streak" />
          <DashStat value={`${activitiesToday}/${ALTERNATIVES.length}`} label="Activities today" />
        </View>
      </Card>

      {/* Blocklist */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md }}>
        <Text variant="headline" style={{ flex: 1 }}>
          My Blocklist · {blockedSites.length}
        </Text>
        <Pressable
          onPress={() => setAddOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Add website"
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: spacing.md, height: 40, borderRadius: radius.round,
            backgroundColor: theme.color.primarySoft, opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="add-circle" size={18} color={theme.color.primary} />
          <Text variant="footnote" color={theme.color.primary}>Add Website</Text>
        </Pressable>
      </View>

      {hasSites && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {/* Search */}
          <View
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              backgroundColor: theme.color.surface, borderRadius: radius.input,
              borderWidth: 1, borderColor: theme.color.hairline, paddingHorizontal: spacing.md,
            }}
          >
            <Ionicons name="search" size={15} color={theme.color.textDim} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search blocklist…"
              placeholderTextColor={theme.color.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              underlineColorAndroid="transparent"
              selectionColor={theme.color.primary}
              accessibilityLabel="Search blocklist"
              style={{ flex: 1, paddingVertical: spacing.md, color: theme.color.text, fontSize: 15, fontFamily: 'Nunito_600SemiBold' }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={theme.color.textDim} />
              </Pressable>
            )}
          </View>
          {/* Sort */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setSort((s) => (s === 'az' ? 'recent' : 'az'));
            }}
            accessibilityRole="button"
            accessibilityLabel={sort === 'az' ? 'Sorted alphabetically. Switch to most recent' : 'Sorted by most recent. Switch to alphabetical'}
            style={({ pressed }) => ({
              width: 44, borderRadius: radius.input,
              backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline,
              alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name={sort === 'az' ? 'text' : 'time-outline'} size={18} color={theme.color.primary} />
          </Pressable>
        </View>
      )}

      {!hasSites ? (
        <Card tone="primarySoft" style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
          <Ionicons name="shield-outline" size={30} color={theme.color.primary} />
          <Text variant="callout" center>Your blocklist is empty</Text>
          <Text variant="footnote" dim center style={{ paddingHorizontal: spacing.lg, lineHeight: 19 }}>
            Add the websites you want out of your life. Once added, they stay protected until you remove them yourself.
          </Text>
          <Button label="Add your first website" onPress={() => setAddOpen(true)} style={{ marginTop: spacing.sm }} />
        </Card>
      ) : visibleSites.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Text variant="callout" dim>No websites match your search.</Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {visibleSites.map((s, i) => (
            <SiteRow
              key={s.id}
              site={s}
              index={i}
              onEdit={() => setEditingId(s.id)}
              onRemove={handleRemove}
            />
          ))}
        </View>
      )}

      {/* Suggestions — optional, never auto-added */}
      {suggestions.length > 0 && (
        <>
          <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
            Suggested Gambling Websites
          </Text>
          <Text variant="footnote" dim style={{ marginBottom: spacing.md, lineHeight: 19 }}>
            Common gambling sites people choose to block. These are only suggestions — nothing is added unless you tap Add.
          </Text>
          <Card padding={0}>
            {suggestions.map((d, i) => (
              <View
                key={d}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.color.hairline,
                }}
              >
                <Ionicons name="globe-outline" size={18} color={theme.color.textDim} />
                <Text variant="callout" style={{ flex: 1, marginLeft: spacing.md }}>{d}</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    addBlockedSite(d);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${d} to blocklist`}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
                    borderRadius: radius.round, backgroundColor: theme.color.primarySoft,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text variant="footnote" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>Add</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Privacy */}
      <Card tone="primarySoft" style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
        <Text variant="footnote" color={theme.color.primary}>Private by design</Text>
        <Text variant="callout" dim style={{ marginTop: 4, lineHeight: 22 }}>
          Your blocklist never leaves this device. Unchain does not read your browsing history, collect analytics about
          blocked websites, or upload anything anywhere.
        </Text>
      </Card>

      {/* Sheets */}
      <AddSiteSheet visible={addOpen} onClose={() => setAddOpen(false)} />
      <EditSiteSheet siteId={editingId} onClose={() => setEditingId(null)} />

      {/* Deletion confirmation — cross-platform Modal (Alert.alert is a no-op on web) */}
      <ConfirmDialog
        visible={confirmPending !== null}
        siteName={confirmPending?.label ?? ''}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </Screen>
  );
}

function DashStat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={`${value} ${label}`}
      style={{
        flex: 1,
        backgroundColor: theme.color.surfaceAlt + '80',
        borderRadius: radius.input,
        paddingVertical: spacing.md,
        alignItems: 'center',
      }}
    >
      <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text variant="caption" dim style={{ marginTop: 1 }}>{label}</Text>
    </View>
  );
}

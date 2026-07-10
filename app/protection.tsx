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
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { Card } from '@/presentation/components/Card';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore, useProfile, useTodayJournal } from '@/application/store';
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
// ─────────────────────────────────────────────────────────────────────────────

function EditSiteSheet({ siteId, onClose }: { siteId: string | null; onClose: () => void }) {
  const updateBlockedSite = useStore((s) => s.updateBlockedSite);
  const removeBlockedSite = useStore((s) => s.removeBlockedSite);
  const site = useStore((s) => (siteId ? s.blockedSites.find((b) => b.id === siteId) : undefined));

  const [domain, setDomain] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (siteId && site) {
      setDomain(site.domain);
      setNickname(site.nickname ?? '');
      setError(null);
    }
    // Re-seed the fields only when a different site is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const save = () => {
    if (!site) return;
    const result = updateBlockedSite(site.id, { domain, nickname });
    if (result === 'invalid') {
      setError('That does not look like a website address.');
      return;
    }
    if (result === 'duplicate') {
      setError('Another entry already uses this domain.');
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    onClose();
  };

  const confirmDelete = () => {
    if (!site) return;
    Alert.alert(
      'Remove Blocked Website?',
      'This website will no longer be protected. This is the only way a blocked website becomes accessible again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // Removal is immediate: the store filter updates every subscribed
            // screen in the same frame — no restart or refresh needed.
            removeBlockedSite(site.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            onClose();
          },
        },
      ],
    );
  };

  return (
    <ActionSheet visible={siteId != null && site != null} onClose={onClose}>
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
        <Button label="Save Changes" onPress={save} disabled={!domain.trim()} full />
        <Button label="Remove from Blocklist" kind="destructive" onPress={confirmDelete} full />
        <Button label="Close" kind="secondary" onPress={onClose} full />
      </View>
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Site row — always Protected; tap to edit
// ─────────────────────────────────────────────────────────────────────────────

function SiteRow({ site, index, onEdit }: { site: BlockedSite; index: number; onEdit: () => void }) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(18)}>
      <Pressable
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onEdit(); }}
        accessibilityRole="button"
        accessibilityLabel={`${siteLabel(site)}, protected. Edit`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          padding: spacing.lg,
          opacity: pressed ? 0.85 : 1,
        })}
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
        <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function Protection() {
  const theme = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const blockedSites = useStore((s) => s.blockedSites);
  const addBlockedSite = useStore((s) => s.addBlockedSite);
  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);
  const completions = useStore((s) => s.alternatives);
  const todayJournal = useTodayJournal();

  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('az');

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
          onPress={() => router.back()}
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
            <SiteRow key={s.id} site={s} index={i} onEdit={() => setEditingId(s.id)} />
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

/**
 * Focus Protection — a voluntary, consent-first website blocklist.
 *
 * The user builds their own list; nothing is ever added or blocked
 * automatically (suggestions require an explicit Add tap). No browsing data
 * is read or collected — the app only knows the list the user typed in, and
 * it never leaves the device.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Switch, TextInput, View } from 'react-native';
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
import {
  MAX_CUSTOM_MINUTES,
  SESSION_PRESETS,
  SUGGESTED_SITES,
  formatRemaining,
  sessionActive,
  sessionRemainingSec,
  siteLabel,
  siteStatus,
  type BlockedSite,
} from '@/domain/protection';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

type SortMode = 'az' | 'recent';

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit sheets
// ─────────────────────────────────────────────────────────────────────────────

function DomainFields({
  domain,
  nickname,
  error,
  onDomain,
  onNickname,
}: {
  domain: string;
  nickname: string;
  error: string | null;
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
        autoFocus
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

function AddSiteSheet({
  visible,
  initialDomain,
  onClose,
}: {
  visible: boolean;
  initialDomain?: string;
  onClose: () => void;
}) {
  const addBlockedSite = useStore((s) => s.addBlockedSite);
  const [domain, setDomain] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDomain(initialDomain ?? '');
      setNickname('');
      setError(null);
    }
  }, [visible, initialDomain]);

  const save = () => {
    const result = addBlockedSite(domain, nickname);
    if (result === 'invalid') {
      setError('That does not look like a website address. Try something like casino.com.');
      return;
    }
    if (result === 'duplicate') {
      setError('This website is already in your blocklist.');
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
        Only websites you add here are protected. The list stays on this device.
      </Text>
      <DomainFields
        domain={domain}
        nickname={nickname}
        error={error}
        onDomain={(v) => { setDomain(v); setError(null); }}
        onNickname={setNickname}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <Button label="Add to Blocklist" onPress={save} disabled={!domain.trim()} full />
        <Button label="Cancel" kind="secondary" onPress={onClose} full />
      </View>
    </ActionSheet>
  );
}

function EditSiteSheet({
  site,
  onClose,
}: {
  site: BlockedSite | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const updateBlockedSite = useStore((s) => s.updateBlockedSite);
  const toggleBlockedSite = useStore((s) => s.toggleBlockedSite);
  const removeBlockedSite = useStore((s) => s.removeBlockedSite);
  const [domain, setDomain] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (site) {
      setDomain(site.domain);
      setNickname(site.nickname ?? '');
      setError(null);
    }
  }, [site]);

  if (!site) return <ActionSheet visible={false} onClose={onClose}><View /></ActionSheet>;

  const save = () => {
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
    Alert.alert(
      'Remove Blocked Website?',
      'This website will no longer be protected during your recovery sessions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeBlockedSite(site.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            onClose();
          },
        },
      ],
    );
  };

  return (
    <ActionSheet visible={site != null} onClose={onClose}>
      <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.lg }}>
        Edit Website
      </Text>
      <DomainFields
        domain={domain}
        nickname={nickname}
        error={error}
        onDomain={(v) => { setDomain(v); setError(null); }}
        onNickname={setNickname}
      />

      {/* Temporarily disable without deleting */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.lg,
          backgroundColor: theme.color.surfaceAlt,
          borderRadius: radius.card,
          padding: spacing.lg,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="callout">Protection</Text>
          <Text variant="caption" dim style={{ marginTop: 1 }}>
            {site.enabled ? 'On — included in recovery sessions' : 'Temporarily disabled'}
          </Text>
        </View>
        <Switch
          value={site.enabled}
          onValueChange={() => {
            Haptics.selectionAsync().catch(() => {});
            toggleBlockedSite(site.id);
          }}
          trackColor={{ true: theme.color.primary }}
          accessibilityLabel={`Protection for ${siteLabel(site)}`}
        />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <Button label="Save Changes" onPress={save} disabled={!domain.trim()} full />
        <Button label="Delete Website" kind="destructive" onPress={confirmDelete} full />
        <Button label="Close" kind="secondary" onPress={onClose} full />
      </View>
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom duration sheet
// ─────────────────────────────────────────────────────────────────────────────

function CustomDurationSheet({
  visible,
  onClose,
  onStart,
}: {
  visible: boolean;
  onClose: () => void;
  onStart: (minutes: number) => void;
}) {
  const theme = useTheme();
  const [minutes, setMinutes] = useState('');

  useEffect(() => {
    if (visible) setMinutes('');
  }, [visible]);

  const parsed = parseInt(minutes, 10);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_CUSTOM_MINUTES;

  return (
    <ActionSheet visible={visible} onClose={onClose}>
      <Text variant="title2" style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.xs }}>
        Custom Duration
      </Text>
      <Text variant="footnote" dim style={{ marginBottom: spacing.lg }}>
        How many minutes should this session last? Up to {MAX_CUSTOM_MINUTES / 60} hours.
      </Text>
      <TextInput
        value={minutes}
        onChangeText={(t) => setMinutes(t.replace(/[^0-9]/g, ''))}
        placeholder="e.g. 45"
        placeholderTextColor={theme.color.textDim}
        keyboardType="number-pad"
        autoFocus
        underlineColorAndroid="transparent"
        selectionColor={theme.color.primary}
        accessibilityLabel="Session length in minutes"
        style={{
          borderRadius: radius.input,
          backgroundColor: theme.color.surfaceAlt,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          padding: spacing.lg,
          color: theme.color.text,
          fontSize: 17,
          fontFamily: 'Nunito_600SemiBold',
        }}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <Button
          label="Start Protection"
          onPress={() => { onStart(parsed); onClose(); }}
          disabled={!valid}
          full
        />
        <Button label="Cancel" kind="secondary" onPress={onClose} full />
      </View>
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Site row
// ─────────────────────────────────────────────────────────────────────────────

function SiteRow({
  site,
  index,
  active,
  onEdit,
}: {
  site: BlockedSite;
  index: number;
  active: boolean;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const toggleBlockedSite = useStore((s) => s.toggleBlockedSite);
  const status = siteStatus(site, active);

  const statusMeta = {
    active:    { label: 'Currently Active',      color: theme.color.success,  icon: 'shield-checkmark' as const },
    protected: { label: 'Protected',             color: theme.color.primary,  icon: 'shield-checkmark' as const },
    disabled:  { label: 'Temporarily Disabled',  color: theme.color.textDim,  icon: 'shield-outline' as const },
  }[status];

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(18)}>
      <Pressable
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onEdit(); }}
        accessibilityRole="button"
        accessibilityLabel={`${siteLabel(site)}, ${statusMeta.label}. Edit`}
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
            backgroundColor: statusMeta.color + '18',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={statusMeta.icon} size={20} color={statusMeta.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="headline" numberOfLines={1}>{siteLabel(site)}</Text>
          {site.nickname ? (
            <Text variant="caption" dim numberOfLines={1}>{site.domain}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
            <Text variant="caption" color={statusMeta.color}>{statusMeta.label}</Text>
            <Text variant="caption" dim>· Added {fmtDate(site.addedAt)}</Text>
          </View>
        </View>
        <Switch
          value={site.enabled}
          onValueChange={() => {
            Haptics.selectionAsync().catch(() => {});
            toggleBlockedSite(site.id);
          }}
          trackColor={{ true: theme.color.primary }}
          accessibilityLabel={`Protection for ${siteLabel(site)}`}
        />
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
  const session = useStore((s) => s.protectionSession);
  const startProtection = useStore((s) => s.startProtection);
  const stopProtection = useStore((s) => s.stopProtection);
  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);
  const completions = useStore((s) => s.alternatives);
  const addBlockedSite = useStore((s) => s.addBlockedSite);
  const todayJournal = useTodayJournal();

  const [addOpen, setAddOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<BlockedSite | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('az');

  // 1-second tick while a session is running so the countdown stays live.
  const [now, setNow] = useState(Date.now());
  const active = sessionActive(session, now);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const enabledCount = blockedSites.filter((s) => s.enabled).length;
  const streak = profile ? streakDays(currentStreakStart(profile.startedAt, relapses, journal)) : 0;
  const activitiesToday = ALTERNATIVES.filter((a) =>
    a.id === 'journal'
      ? todayJournal != null
      : completions[a.id] != null && sameDay(completions[a.id]!, now),
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

  const start = (opts: { minutes?: number; untilTomorrow?: boolean }) => {
    if (enabledCount === 0) {
      Alert.alert(
        'No websites to protect',
        'Add at least one website to your blocklist first — only websites you choose are ever protected.',
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startProtection({ ...opts, trigger: 'manual' });
    setNow(Date.now());
  };

  const confirmStop = () => {
    Alert.alert('End protection early?', 'Your blocked websites will no longer be in an active session.', [
      { text: 'Keep Protecting', style: 'cancel' },
      { text: 'End Session', style: 'destructive', onPress: () => stopProtection() },
    ]);
  };

  const remaining = sessionRemainingSec(session, now);

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="title1">Focus Protection</Text>
          <Text variant="footnote" dim style={{ marginTop: 2 }}>
            You choose every website. Everything stays on this device.
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
      <Card
        tone={active ? 'successSoft' : 'surface'}
        style={{ marginTop: spacing.lg, gap: spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 46, height: 46, borderRadius: 23,
              backgroundColor: (active ? theme.color.success : theme.color.primary) + '20',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons
              name={active ? 'shield-checkmark' : 'shield-outline'}
              size={24}
              color={active ? theme.color.success : theme.color.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headline">
              {active ? 'Protection Active' : 'Protection on Standby'}
            </Text>
            <Text variant="footnote" dim style={{ marginTop: 1 }}>
              {active
                ? `${formatRemaining(remaining)} remaining · ${enabledCount} website${enabledCount === 1 ? '' : 's'} protected`
                : enabledCount > 0
                  ? `${enabledCount} website${enabledCount === 1 ? '' : 's'} ready to protect`
                  : 'Add websites below to get started'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <DashStat value={`${enabledCount}/${blockedSites.length}`} label="Websites" />
          <DashStat value={`${streak}`} label="Day streak" />
          <DashStat value={`${activitiesToday}/${ALTERNATIVES.length}`} label="Activities today" />
        </View>

        {active ? (
          <Button label="End Protection Early" kind="destructive" onPress={confirmStop} full />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SESSION_PRESETS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => start({ minutes: m })}
                  accessibilityRole="button"
                  accessibilityLabel={`Protect for ${m >= 60 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} minutes`}`}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    borderRadius: radius.round,
                    backgroundColor: theme.color.primarySoft,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text variant="callout" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>
                    {m >= 60 ? `${m / 60} hr${m > 60 ? 's' : ''}` : `${m} min`}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => start({ untilTomorrow: true })}
                accessibilityRole="button"
                accessibilityLabel="Protect until tomorrow"
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.round,
                  backgroundColor: theme.color.primarySoft,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text variant="callout" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>
                  Until tomorrow
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCustomOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Custom duration"
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.round,
                  borderWidth: 1,
                  borderColor: theme.color.primary,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text variant="callout" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>
                  Custom…
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </Card>

      {/* Blocklist */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md }}>
        <Text variant="headline" style={{ flex: 1 }}>
          My Blocklist · {blockedSites.length}
        </Text>
        <Pressable
          onPress={() => { setAddPrefill(undefined); setAddOpen(true); }}
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

      {blockedSites.length > 0 && (
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

      {blockedSites.length === 0 ? (
        <Card tone="primarySoft" style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
          <Ionicons name="shield-outline" size={30} color={theme.color.primary} />
          <Text variant="callout" center>Your blocklist is empty</Text>
          <Text variant="footnote" dim center style={{ paddingHorizontal: spacing.lg, lineHeight: 19 }}>
            Add the websites you want to keep at a distance. You are always in control — nothing is ever blocked without your say-so.
          </Text>
          <Button label="Add your first website" onPress={() => { setAddPrefill(undefined); setAddOpen(true); }} style={{ marginTop: spacing.sm }} />
        </Card>
      ) : visibleSites.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Text variant="callout" dim>No websites match your search.</Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {visibleSites.map((s, i) => (
            <SiteRow key={s.id} site={s} index={i} active={active} onEdit={() => setEditing(s)} />
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
      <AddSiteSheet visible={addOpen} initialDomain={addPrefill} onClose={() => setAddOpen(false)} />
      <EditSiteSheet site={editing} onClose={() => setEditing(null)} />
      <CustomDurationSheet
        visible={customOpen}
        onClose={() => setCustomOpen(false)}
        onStart={(m) => start({ minutes: m })}
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

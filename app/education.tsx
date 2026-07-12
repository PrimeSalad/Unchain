/**
 * Education Hub - evidence-based learning, personalized to the user's
 * addiction. Built-in guides and Reading Shelf resources are fully offline
 * and open inside the app.
 * Categories, guides, and resources all derive from profile.addictionType,
 * so profile changes re-personalize the hub automatically.
 */

import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useProfile, useStore } from '@/application/store';
import { addictionMeta } from '@/domain/gambling';
import {
  guidesFor,
  resourcesFor,
  type Guide,
  type Resource,
} from '@/domain/education';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// Guide card - progress ring + bookmark
// ─────────────────────────────────────────────────────────────────────────────

function GuideCard({ guide, index, onOpen }: { guide: Guide; index: number; onOpen: () => void }) {
  const theme = useTheme();
  const toggleEduBookmark = useStore((s) => s.toggleEduBookmark);
  const bookmarked = useStore((s) => s.eduBookmarks.includes(guide.id));
  const pct = useStore((s) => s.eduProgress[guide.id]?.pct ?? 0);
  const done = pct >= 0.97;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().damping(18)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${guide.title}, ${guide.minutes} minute read${done ? ', finished' : pct > 0 ? `, ${Math.round(pct * 100)}% read` : ''}`}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row', alignItems: 'center', gap: spacing.md,
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1, borderColor: theme.color.hairline,
          padding: spacing.lg,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{
          width: 44, height: 44, borderRadius: 13,
          backgroundColor: done ? theme.color.successSoft : theme.color.primarySoft,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons
            name={(done ? 'checkmark' : guide.icon) as keyof typeof Ionicons.glyphMap}
            size={20}
            color={done ? theme.color.success : theme.color.primary}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text variant="callout" numberOfLines={1}>{guide.title}</Text>
          <Text variant="caption" dim numberOfLines={1}>{guide.subtitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <ProgressBar progress={pct} height={4} color={done ? theme.color.success : undefined} />
            </View>
            <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
              {done ? 'Read' : pct > 0 ? `${Math.round(pct * 100)}%` : `${guide.minutes} min`}
            </Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          toggleEduBookmark(guide.id);
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={bookmarked ? `Remove bookmark from ${guide.title}` : `Bookmark ${guide.title}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
      >
        <Ionicons
          name={bookmarked ? 'bookmark' : 'bookmark-outline'}
          size={20}
          color={bookmarked ? theme.color.primary : theme.color.textDim}
        />
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource card - generated cover (offline, no rights issues), meta, actions
// ─────────────────────────────────────────────────────────────────────────────

function ResourceCard({ res, index }: { res: Resource; index: number }) {
  const theme = useTheme();
  const router = useRouter();
  const toggleEduBookmark = useStore((s) => s.toggleEduBookmark);
  const bookmarked = useStore((s) => s.eduBookmarks.includes(res.id));
  const initials = res.title.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().damping(18)}>
      <Pressable
        onPress={() => router.push({ pathname: '/education-resource', params: { id: res.id } } as never)}
        accessibilityRole="button"
        accessibilityLabel={`Read ${res.title} in the app`}
        style={({ pressed }) => ({
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          padding: spacing.lg,
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <View
            accessibilityLabel={`Cover for ${res.title}`}
            style={{
              width: 74,
              height: 104,
              borderRadius: 12,
              backgroundColor: res.tint,
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 36, backgroundColor: 'rgba(255,255,255,0.14)' }} />
            <Text color="#FFFFFF" style={{ fontSize: 22, fontFamily: 'Nunito_900Black' }}>{initials}</Text>
            <Ionicons name="book" size={15} color="rgba(255,255,255,0.82)" style={{ marginTop: 4 }} />
          </View>

          <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={theme.color.primary}>FULL BOOK · OFFLINE</Text>
                <Text variant="headline" numberOfLines={2} style={{ marginTop: spacing.xs, lineHeight: 23 }}>
                  {res.title}
                </Text>
                <Text variant="caption" dim style={{ marginTop: spacing.xs }}>{res.author}</Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.selectionAsync().catch(() => {});
                  toggleEduBookmark(res.id);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={bookmarked ? `Remove bookmark from ${res.title}` : `Bookmark ${res.title}`}
              >
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={bookmarked ? theme.color.primary : theme.color.textDim}
                />
              </Pressable>
            </View>
            <Text variant="footnote" dim numberOfLines={3} style={{ marginTop: spacing.md, lineHeight: 18 }}>
              {res.desc}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md }}>
              <Text variant="footnote" color={theme.color.primary}>Read now</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.color.primary} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub
// ─────────────────────────────────────────────────────────────────────────────

export default function EducationHub() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const profile = useProfile();
  const type = profile?.addictionType ?? 'other';
  const typeLabel = addictionMeta(type).label;

  const eduLastGuideId = useStore((s) => s.eduLastGuideId);
  const eduProgress = useStore((s) => s.eduProgress);

  const [query, setQuery] = useState('');

  const allGuides = useMemo(() => guidesFor(type), [type]);
  const allResources = useMemo(() => resourcesFor(type), [type]);

  const q = query.trim().toLowerCase();
  const guides = allGuides.filter(
    (g) =>
      !q || g.title.toLowerCase().includes(q) || g.subtitle.toLowerCase().includes(q),
  );
  const resources = allResources.filter((r) => {
    if (q && !`${r.title} ${r.author} ${r.desc}`.toLowerCase().includes(q)) return false;
    return true;
  });

  // Continue Reading - the last opened guide, when unfinished.
  const lastGuide = allGuides.find(
    (g) => g.id === eduLastGuideId && (eduProgress[g.id]?.pct ?? 0) > 0.02 && (eduProgress[g.id]?.pct ?? 0) < 0.97,
  );

  const openGuide = (id: string) =>
    router.push({ pathname: '/education-reader', params: { id } } as never);

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="title1">Education Hub</Text>
          <Text variant="footnote" dim style={{ marginTop: 2 }}>
            For your {typeLabel.toLowerCase()} recovery · guides work fully offline
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

      {/* Search */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          backgroundColor: theme.color.surface, borderRadius: radius.input,
          borderWidth: 1, borderColor: theme.color.hairline,
          paddingHorizontal: spacing.md, marginTop: spacing.lg,
        }}
      >
        <Ionicons name="search" size={15} color={theme.color.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search guides and books…"
          placeholderTextColor={theme.color.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          underlineColorAndroid="transparent"
          selectionColor={theme.color.primary}
          accessibilityLabel="Search education content"
          style={{ flex: 1, paddingVertical: spacing.md, color: theme.color.text, fontSize: 15, fontFamily: 'Nunito_600SemiBold' }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={theme.color.textDim} />
          </Pressable>
        )}
      </View>

      {/* Continue reading */}
      {lastGuide && !q && (
        <Pressable
          onPress={() => openGuide(lastGuide.id)}
          accessibilityRole="button"
          accessibilityLabel={`Continue reading ${lastGuide.title}, ${Math.round((eduProgress[lastGuide.id]?.pct ?? 0) * 100)}% done`}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginBottom: spacing.lg })}
        >
          <View
            style={{
              backgroundColor: theme.color.primarySoft,
              borderRadius: radius.card,
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="play-circle" size={16} color={theme.color.primary} />
              <Text variant="footnote" color={theme.color.primary}>Continue reading</Text>
              <View style={{ flex: 1 }} />
              <Text variant="caption" color={theme.color.primary} style={{ fontVariant: ['tabular-nums'] }}>
                {Math.round((eduProgress[lastGuide.id]?.pct ?? 0) * 100)}%
              </Text>
            </View>
            <Text variant="callout" numberOfLines={1}>{lastGuide.title}</Text>
            <ProgressBar progress={eduProgress[lastGuide.id]?.pct ?? 0} height={5} />
          </View>
        </Pressable>
      )}

      {/* Guides */}
      {guides.length > 0 ? (
        <>
          <Text variant="headline" style={{ marginBottom: spacing.md }}>
            Guides for {typeLabel} Recovery
          </Text>
          <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
            {guides.map((g, i) => (
              <GuideCard key={g.id} guide={g} index={i} onOpen={() => openGuide(g.id)} />
            ))}
          </View>
        </>
      ) : null}

      {/* Free reading */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.xs }}>
        <Text variant="headline" style={{ flex: 1 }}>Reading Shelf</Text>
        <Text variant="caption" dim>Offline</Text>
      </View>
      <Text variant="footnote" dim style={{ marginBottom: spacing.md, lineHeight: 18 }}>
        Read curated books and recovery resources directly in the app. No browser handoff.
      </Text>
      {resources.length === 0 ? (
        <View
          style={{
            backgroundColor: theme.color.surface, borderRadius: radius.card,
            borderWidth: 1, borderColor: theme.color.hairline,
            alignItems: 'center', padding: spacing.xl, gap: spacing.sm,
          }}
        >
          <Ionicons name="book-outline" size={26} color={theme.color.textDim} />
          <Text variant="callout" dim center>
            Nothing matches your search.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          {resources.map((r, i) => (
            <ResourceCard key={r.id} res={r} index={i} />
          ))}
        </View>
      )}

      {/* Tone note */}
      <View
        style={{
          backgroundColor: theme.color.primarySoft, borderRadius: radius.card,
          padding: spacing.lg, marginBottom: spacing.xl,
        }}
      >
        <Text variant="footnote" color={theme.color.primary}>Evidence-based, judgment-free</Text>
        <Text variant="callout" dim style={{ marginTop: 4, lineHeight: 22 }}>
          Everything here is grounded in habit science and public-health research, written to inform -
          never to shame. Understanding the mechanics is part of beating them.
        </Text>
      </View>
    </Screen>
  );
}

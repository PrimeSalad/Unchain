/**
 * Education Reader — distraction-free reading for built-in guides. Tracks
 * how far the user has read (thin progress bar up top) and restores the
 * exact scroll position next time, powering the hub's Continue Reading card.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/presentation/components/Text';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import { guideById } from '@/domain/education';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

export default function EducationReader() {
  const theme = useTheme();
  const safeBack = useSafeBack();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const guide = id ? guideById(id) : undefined;

  const setEduProgress = useStore((s) => s.setEduProgress);
  const toggleEduBookmark = useStore((s) => s.toggleEduBookmark);
  const bookmarked = useStore((s) => (guide ? s.eduBookmarks.includes(guide.id) : false));
  const saved = useStore((s) => (guide ? s.eduProgress[guide.id] : undefined));
  const savedPct = saved?.pct ?? 0;

  const scrollRef = useRef<ScrollView>(null);
  const lastRef = useRef({ pct: savedPct, offset: saved?.offset ?? 0 });
  const restoredRef = useRef(false);

  // Navigation is a side effect — never call it during render.
  useEffect(() => {
    if (!guide) safeBack();
  }, [guide, safeBack]);

  // Persist the final position when the reader closes.
  useEffect(
    () => () => {
      if (guide) setEduProgress(guide.id, lastRef.current.pct, lastRef.current.offset);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guide?.id],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const denom = Math.max(1, contentSize.height - layoutMeasurement.height);
    const pct = Math.min(1, Math.max(0, contentOffset.y / denom));
    lastRef.current = { pct, offset: contentOffset.y };
  }, []);

  const persist = useCallback(() => {
    if (guide) setEduProgress(guide.id, lastRef.current.pct, lastRef.current.offset);
  }, [guide, setEduProgress]);

  if (!guide) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <Pressable
            onPress={() => { persist(); safeBack(); }}
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
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={savedPct} height={6} />
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              toggleEduBookmark(guide.id);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark this guide'}
            accessibilityState={{ selected: bookmarked }}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={bookmarked ? theme.color.primary : theme.color.textDim}
            />
          </Pressable>
        </View>

        {/* Distraction-free content */}
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          onMomentumScrollEnd={persist}
          onScrollEndDrag={persist}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            // Continue exactly where the reader left off, once, after layout.
            if (!restoredRef.current && (saved?.offset ?? 0) > 0) {
              restoredRef.current = true;
              scrollRef.current?.scrollTo({ y: saved!.offset, animated: false });
            }
          }}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.huge }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={guide.icon as keyof typeof Ionicons.glyphMap} size={17} color={theme.color.primary} />
            </View>
            <Text variant="caption" dim>{guide.minutes} min read · works offline</Text>
          </View>
          <Text variant="title1" style={{ lineHeight: 36 }}>{guide.title}</Text>
          <Text variant="callout" dim style={{ marginTop: spacing.xs, lineHeight: 22 }}>
            {guide.subtitle}
          </Text>

          {guide.sections.map((s) => (
            <View key={s.heading} style={{ marginTop: spacing.xl }}>
              <Text variant="title2" style={{ marginBottom: spacing.sm }}>{s.heading}</Text>
              {s.body.map((p, i) => (
                <Text key={i} variant="body" style={{ lineHeight: 26, marginBottom: spacing.md }}>
                  {p}
                </Text>
              ))}
              {s.bullets && (
                <View style={{ gap: spacing.sm }}>
                  {s.bullets.map((b, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={{
                        width: 6, height: 6, borderRadius: 3,
                        backgroundColor: theme.color.primary, marginTop: 9,
                      }} />
                      <Text variant="body" style={{ flex: 1, lineHeight: 24 }}>{b}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Gentle close */}
          <View
            style={{
              marginTop: spacing.xxl, padding: spacing.lg,
              backgroundColor: theme.color.primarySoft, borderRadius: radius.card,
              flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            }}
          >
            <Ionicons name="heart" size={18} color={theme.color.primary} />
            <Text variant="callout" color={theme.color.primary} style={{ flex: 1, lineHeight: 21 }}>
              Learning about it is already working on it. One day at a time.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

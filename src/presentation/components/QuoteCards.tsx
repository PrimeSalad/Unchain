/**
 * Recovery Motivation - a single quote feed.
 *
 * One carousel: today's quote always first, permanently saved favorites after
 * it (a favorite that IS today's quote is not duplicated). Hearting today's
 * quote saves it with a gentle confirmation toast; today's quote can never be
 * removed while it is the active daily quote - removal (with a destructive
 * confirmation) applies to favorites from previous days only.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  LayoutAnimation,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Mascot } from './Mascot';
import { useStore } from '@/application/store';
import { QUOTES, type FavoriteQuote, type Quote } from '@/domain/quotes';

const GAP = spacing.md;

// ─────────────────────────────────────────────────────────────────────────────
// Heart button - Apple-style favorite spring
// ─────────────────────────────────────────────────────────────────────────────

function HeartButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = active ? theme.color.accent : theme.color.textDim;

  const press = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scale.value = withSequence(
      withSpring(1.35, { damping: 9, stiffness: 260 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    );
    onToggle();
  };

  return (
    <Pressable
      onPress={press}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Remove from favorite quotes' : 'Add to favorite quotes'}
      accessibilityState={{ selected: active }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={anim}>
        <Ionicons name={active ? 'heart' : 'heart-outline'} size={22} color={color} />
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feed
// ─────────────────────────────────────────────────────────────────────────────

type FeedItem =
  | { key: string; kind: 'today'; quote: Quote; favorited: boolean }
  | { key: string; kind: 'favorite'; fav: FavoriteQuote };

export function QuoteFeed() {
  const theme = useTheme();
  const dailyQuote = useStore((s) => s.dailyQuote);
  const ensureDailyQuote = useStore((s) => s.ensureDailyQuote);
  const favorites = useStore((s) => s.favoriteQuotes);
  const toggleFavorite = useStore((s) => s.toggleFavoriteQuote);
  const removeFavorite = useStore((s) => s.removeFavoriteQuote);

  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Pick today's quote on mount and re-check every minute so the feed rolls
  // over naturally if the app stays open across midnight.
  useEffect(() => {
    ensureDailyQuote();
    const id = setInterval(ensureDailyQuote, 60_000);
    return () => clearInterval(id);
  }, [ensureDailyQuote]);

  // Auto-hide the confirmation toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  // A persisted index can outlive a shrunken quote pool after an update -
  // never index blindly.
  const today = QUOTES[dailyQuote?.index ?? 0] ?? QUOTES[0];

  // Today's quote first; saved favorites after it (today's never duplicated).
  const feed = useMemo<FeedItem[]>(
    () => [
      {
        key: 'today',
        kind: 'today',
        quote: today,
        favorited: favorites.some((f) => f.text === today.text),
      },
      ...favorites
        .filter((f) => f.text !== today.text)
        .map((f): FeedItem => ({ key: String(f.savedAt), kind: 'favorite', fav: f })),
    ],
    [today, favorites],
  );

  const heartToday = () => {
    if (!feed[0] || feed[0].kind !== 'today') return;
    if (!feed[0].favorited) {
      toggleFavorite(today);
      setToast('Quote added to favorites.');
      AccessibilityInfo.announceForAccessibility('Quote added to favorites.');
    } else {
      // The active daily quote is protected - removable starting tomorrow.
      Alert.alert(
        "Today's quote is protected",
        'This is your recovery message for today. You can remove it from your favorites starting tomorrow.',
      );
    }
  };

  const unheartFavorite = (fav: FavoriteQuote) => {
    Alert.alert(
      'Remove Favorite Quote?',
      'Are you sure you want to remove this quote from your favorites?\n\nYou may not see this quote again in the future.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Favorite',
          style: 'destructive',
          onPress: () => {
            try {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            } catch {
              /* layout animation is decorative */
            }
            removeFavorite(fav.savedAt);
            setPage((p) => Math.max(0, Math.min(p, feed.length - 2)));
          },
        },
      ],
    );
  };

  const renderCard = (item: FeedItem) => {
    const isToday = item.kind === 'today';
    const text = isToday ? item.quote.text : item.fav.text;
    const author = isToday ? item.quote.author : item.fav.author;
    const chip = isToday
      ? 'Unchainly says'
      : `Saved ${new Date(item.fav.savedAt).toLocaleDateString()}`;
    const hearted = isToday ? item.favorited : true;

    return (
      <View
        style={{
          width,
          borderRadius: radius.card,
          backgroundColor: theme.color.surface,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          padding: spacing.md,
          shadowColor: theme.color.primaryDeep,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: theme.mode === 'light' ? 0.08 : 0,
          shadowRadius: 12,
          elevation: theme.mode === 'light' ? 2 : 0,
        }}
        accessibilityLabel={`${isToday ? 'Daily recovery quote' : 'Favorite quote'}: ${text}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              backgroundColor: theme.color.primarySoft,
              borderRadius: radius.round,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
            }}
          >
            <Text variant="caption" color={theme.color.primary}>
              {chip}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <HeartButton
            active={hearted}
            onToggle={() => (isToday ? heartToday() : unheartFavorite(item.fav))}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm }}>
          <Mascot state={isToday ? 'happy' : 'comfort'} size={52} still />
          <View
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 18,
              borderTopLeftRadius: 8,
              backgroundColor: theme.color.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          >
            <Text variant="callout" color={theme.color.text} style={{ lineHeight: 21, fontFamily: 'Nunito_700Bold' }}>
              {text}
            </Text>
            {author ? (
              <Text variant="caption" dim style={{ marginTop: spacing.xs }}>
                - {author}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width + GAP}
          decelerationRate="fast"
          disableIntervalMomentum
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          onMomentumScrollEnd={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / (width + GAP));
            setPage(Math.max(0, Math.min(feed.length - 1, p)));
          }}
          renderItem={({ item }) => renderCard(item)}
        />
      )}

      {/* Page indicator - dots for small sets, a counter for large ones */}
      {feed.length > 1 && (
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md, gap: 6 }}
          accessibilityLabel={`Quote ${page + 1} of ${feed.length}`}
        >
          {feed.length <= 8 ? (
            feed.map((item, i) => (
              <View
                key={item.key}
                style={{
                  width: i === page ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: i === page ? theme.color.primary : theme.color.hairline,
                }}
              />
            ))
          ) : (
            <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
              {page + 1} / {feed.length}
            </Text>
          )}
        </View>
      )}

      {/* Confirmation toast */}
      {toast && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(220)}
          style={{
            alignSelf: 'center',
            marginTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: theme.color.successSoft,
            borderRadius: radius.round,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          }}
        >
          <Ionicons name="heart" size={14} color={theme.color.success} />
          <Text variant="footnote" color={theme.color.success}>
            {toast}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

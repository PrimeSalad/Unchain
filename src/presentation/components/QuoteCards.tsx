/**
 * Recovery Motivation — daily quote card + favorite-quotes carousel.
 *
 * The daily quote rotates once per local calendar day (no repeats until the
 * bundled pool has reasonably cycled) and is identical everywhere in the app
 * for that day. Favorites persist offline through the store.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, LayoutAnimation, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { palette, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Text } from './Text';
import { useStore } from '@/application/store';
import { QUOTES, type FavoriteQuote } from '@/domain/quotes';

// ─────────────────────────────────────────────────────────────────────────────
// Heart button — Apple-style favorite spring
// ─────────────────────────────────────────────────────────────────────────────

function HeartButton({
  active,
  onToggle,
  color = '#FFFFFF',
}: {
  active: boolean;
  onToggle: () => void;
  color?: string;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={anim}>
        <Ionicons name={active ? 'heart' : 'heart-outline'} size={24} color={color} />
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily quote card
// ─────────────────────────────────────────────────────────────────────────────

export function DailyQuoteCard() {
  const reduce = useReducedMotion();
  const dailyQuote = useStore((s) => s.dailyQuote);
  const ensureDailyQuote = useStore((s) => s.ensureDailyQuote);
  const favorites = useStore((s) => s.favoriteQuotes);
  const toggleFavorite = useStore((s) => s.toggleFavoriteQuote);

  // Pick today's quote on mount and re-check every minute so the card rolls
  // over naturally if the app stays open across midnight.
  useEffect(() => {
    ensureDailyQuote();
    const id = setInterval(ensureDailyQuote, 60_000);
    return () => clearInterval(id);
  }, [ensureDailyQuote]);

  // Gentle floating animation — disabled under Reduce Motion.
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      float.value = 0;
      return;
    }
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [float, reduce]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value * -3 }] }));

  const quote = QUOTES[dailyQuote?.index ?? 0];
  const isFavorite = favorites.some((f) => f.text === quote.text);

  return (
    <Animated.View style={floatStyle}>
      <View
        accessibilityLabel={`Daily recovery quote: ${quote.text}`}
        style={{
          borderRadius: radius.card,
          overflow: 'hidden',
          shadowColor: palette.grapeDeep,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 18,
          elevation: 6,
        }}
      >
        <LinearGradient
          colors={[palette.grape, palette.grapeDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: spacing.xl, minHeight: 150 }}
        >
          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              variant="caption"
              color="rgba(255,255,255,0.75)"
              style={{ flex: 1, letterSpacing: 1.5, textTransform: 'uppercase' }}
            >
              Daily Recovery Quote
            </Text>
            <HeartButton active={isFavorite} onToggle={() => toggleFavorite(quote)} />
          </View>

          {/* Oversized quotation mark */}
          <Text
            color="rgba(255,255,255,0.22)"
            style={{ fontSize: 64, lineHeight: 64, fontFamily: 'Nunito_900Black', marginTop: -6 }}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            “
          </Text>

          <Text
            variant="title2"
            color={palette.white}
            style={{ marginTop: -30, lineHeight: 30, fontFamily: 'Nunito_700Bold' }}
          >
            {quote.text}
          </Text>
          {quote.author ? (
            <Text variant="footnote" color="rgba(255,255,255,0.75)" style={{ marginTop: spacing.sm }}>
              — {quote.author}
            </Text>
          ) : null}
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Favorites carousel — native paging, snap scrolling, page indicator
// ─────────────────────────────────────────────────────────────────────────────

const GAP = spacing.md;

export function FavoriteQuotesCarousel() {
  const theme = useTheme();
  const favorites = useStore((s) => s.favoriteQuotes);
  const remove = useStore((s) => s.removeFavoriteQuote);

  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<FavoriteQuote>>(null);

  if (favorites.length === 0) return null;

  const confirmRemove = (f: FavoriteQuote) => {
    Alert.alert(
      'Remove Favorite Quote?',
      'Are you sure you want to remove this quote from your favorites?\n\nYou may not see this quote again for some time.',
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
            remove(f.savedAt);
          },
        },
      ],
    );
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <FlatList
          ref={listRef}
          data={favorites}
          keyExtractor={(f) => String(f.savedAt)}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width + GAP}
          decelerationRate="fast"
          disableIntervalMomentum
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          onMomentumScrollEnd={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / (width + GAP));
            setPage(Math.max(0, Math.min(favorites.length - 1, p)));
          }}
          renderItem={({ item }) => (
            <View
              style={{
                width,
                backgroundColor: theme.color.surface,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                padding: spacing.lg,
              }}
              accessibilityLabel={`Favorite quote: ${item.text}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                <Ionicons name="heart" size={16} color={theme.color.accent} />
                <Text variant="caption" dim style={{ flex: 1, marginLeft: spacing.sm }}>
                  Saved {new Date(item.savedAt).toLocaleDateString()}
                </Text>
                <Pressable
                  onPress={() => confirmRemove(item)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Remove this favorite quote"
                >
                  <Ionicons name="close-circle" size={20} color={theme.color.textDim} />
                </Pressable>
              </View>
              <Text variant="callout" style={{ lineHeight: 23 }} numberOfLines={5}>
                “{item.text}”
              </Text>
              {item.author ? (
                <Text variant="footnote" dim style={{ marginTop: spacing.sm }}>
                  — {item.author}
                </Text>
              ) : null}
            </View>
          )}
        />
      )}

      {/* Page indicator — dots for small sets, a counter for large ones */}
      {favorites.length > 1 && (
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md, gap: 6 }}
          accessibilityLabel={`Quote ${page + 1} of ${favorites.length}`}
        >
          {favorites.length <= 8 ? (
            favorites.map((f, i) => (
              <View
                key={f.savedAt}
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
              {page + 1} / {favorites.length}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * In-app resource reader for curated public-domain and open-access readings.
 * Everything shown here is bundled in the app. No browser handoff.
 */

import { useCallback, useState } from 'react';
import { FlatList, Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/presentation/components/Text';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { resourceById } from '@/domain/education';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

interface BookPayload {
  title: string;
  author: string;
  source: string;
  sourceId: string;
  paragraphs: string[];
}

const BOOKS: Record<string, BookPayload> = {
  'gambler': require('../assets/books/gambler.json'),
  'money-getting': require('../assets/books/money-getting.json'),
  'john-barleycorn': require('../assets/books/john-barleycorn.json'),
  'alcohol-dangerous': require('../assets/books/alcohol-dangerous.json'),
  'opium-eater': require('../assets/books/opium-eater.json'),
  'opium-notebook': require('../assets/books/opium-notebook.json'),
  'social-history-smoking': require('../assets/books/social-history-smoking.json'),
  'tobacco-alcohol': require('../assets/books/tobacco-alcohol.json'),
  'social-emergency': require('../assets/books/social-emergency.json'),
  'sex-education': require('../assets/books/sex-education.json'),
  'walden': require('../assets/books/walden.json'),
  'as-a-man-thinketh': require('../assets/books/as-a-man-thinketh.json'),
  'talks-to-teachers': require('../assets/books/talks-to-teachers.json'),
  'self-help': require('../assets/books/self-help.json'),
};

export default function EducationResource() {
  const theme = useTheme();
  const safeBack = useSafeBack();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const resource = id ? resourceById(id) : undefined;
  const book = resource ? BOOKS[resource.bookId] : undefined;
  const [progress, setProgress] = useState(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const denom = Math.max(1, contentSize.height - layoutMeasurement.height);
    setProgress(Math.min(1, Math.max(0, contentOffset.y / denom)));
  }, []);

  if (!resource || !book) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
          <Pressable
            onPress={safeBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
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
            <Text variant="title2">Reading Shelf</Text>
            <ProgressBar progress={progress} height={6} />
          </View>
        </View>

        <FlatList
          data={book.paragraphs}
          keyExtractor={(_, index) => `${resource.id}-${index}`}
          onScroll={onScroll}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.huge }}
          initialNumToRender={14}
          maxToRenderPerBatch={18}
          windowSize={9}
          removeClippedSubviews
          ListHeaderComponent={(
            <View>
              <View
                style={{
                  alignSelf: 'flex-start',
                  width: 68, height: 92, borderRadius: 10,
                  backgroundColor: resource.tint,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: spacing.lg,
                }}
              >
                <Ionicons name="book" size={26} color="#FFFFFF" />
              </View>

              <Text variant="title1" style={{ lineHeight: 36 }}>{resource.title}</Text>
              <Text variant="callout" dim style={{ marginTop: spacing.xs }}>
                {resource.author} · {resource.length}
              </Text>
              <Text variant="caption" dim style={{ marginTop: spacing.sm }}>
                {book.sourceId} · bundled for offline reading
              </Text>

              <View
                style={{
                  marginTop: spacing.xl,
                  marginBottom: spacing.lg,
                  padding: spacing.lg,
                  backgroundColor: theme.color.surface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: theme.color.hairline,
                }}
              >
                <Text variant="footnote" color={theme.color.primary}>Why this book is here</Text>
                <Text variant="callout" dim style={{ marginTop: spacing.xs, lineHeight: 22 }}>
                  {resource.desc}
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => (
            <Text variant="body" style={{ lineHeight: 27, marginTop: spacing.md }}>
              {item}
            </Text>
          )}
          ListFooterComponent={(
            <View
              style={{
                marginTop: spacing.xxl,
                padding: spacing.lg,
                backgroundColor: theme.color.primarySoft,
                borderRadius: radius.card,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <Ionicons name="book" size={18} color={theme.color.primary} />
              <Text variant="callout" color={theme.color.primary} style={{ flex: 1, lineHeight: 21 }}>
                Saved in the app for offline reading. Come back anytime.
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

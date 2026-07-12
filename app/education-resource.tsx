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

type ParagraphKind = 'body' | 'heading' | 'frontMatter';

function paragraphKind(text: string, index: number): ParagraphKind {
  const trimmed = text.trim();
  const normalized = trimmed.replace(/[_"'.:,;!?()\[\]\s-]/g, '');
  const hasLetters = /[A-Za-z]/.test(trimmed);
  const isShort = trimmed.length <= 92;
  const isUpper = hasLetters && normalized.length > 0 && normalized === normalized.toUpperCase();
  const startsLikeHeading = /^(chapter|book|part|section|contents|preface|introduction|conclusion)\b/i.test(trimmed);
  const romanHeading = /^[IVXLCDM]+\.?$/.test(trimmed);

  if ((isUpper && isShort) || startsLikeHeading || romanHeading) return index < 8 ? 'frontMatter' : 'heading';
  if (index < 6 && isShort) return 'frontMatter';
  return 'body';
}

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
            <Text variant="caption" dim>Reading Shelf</Text>
            <Text variant="callout" numberOfLines={1}>{resource.title}</Text>
            <ProgressBar progress={progress} height={6} />
          </View>
        </View>

        <FlatList
          data={book.paragraphs}
          keyExtractor={(_, index) => `${resource.id}-${index}`}
          onScroll={onScroll}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.huge }}
          initialNumToRender={18}
          maxToRenderPerBatch={20}
          windowSize={9}
          removeClippedSubviews
          ListHeaderComponent={(
            <View style={{ width: '100%', maxWidth: 680 }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  width: 76, height: 104, borderRadius: 12,
                  backgroundColor: resource.tint,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: spacing.xl,
                }}
              >
                <Ionicons name="book" size={30} color="#FFFFFF" />
              </View>

              <Text variant="title1" style={{ lineHeight: 37 }}>{resource.title}</Text>
              <Text variant="callout" dim style={{ marginTop: spacing.sm, lineHeight: 23 }}>
                {resource.author}
              </Text>
              <Text variant="caption" dim style={{ marginTop: spacing.xs }}>
                Full book · Offline · {book.sourceId}
              </Text>

              <View
                style={{
                  marginTop: spacing.xl,
                  marginBottom: spacing.xl,
                  padding: spacing.lg,
                  backgroundColor: theme.color.surface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: theme.color.hairline,
                }}
              >
                <Text variant="footnote" color={theme.color.primary}>Why it is in your shelf</Text>
                <Text variant="callout" dim style={{ marginTop: spacing.xs, lineHeight: 22 }}>
                  {resource.desc}
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item, index }) => {
            const kind = paragraphKind(item, index);
            if (kind === 'heading') {
              return (
                <Text
                  variant="title2"
                  style={{
                    width: '100%',
                    maxWidth: 680,
                    marginTop: spacing.xxl,
                    marginBottom: spacing.xs,
                    lineHeight: 30,
                  }}
                >
                  {item}
                </Text>
              );
            }

            if (kind === 'frontMatter') {
              return (
                <Text
                  variant="callout"
                  dim
                  style={{
                    width: '100%',
                    maxWidth: 680,
                    marginTop: spacing.sm,
                    lineHeight: 23,
                  }}
                >
                  {item}
                </Text>
              );
            }

            return (
              <Text
                variant="body"
                style={{
                  width: '100%',
                  maxWidth: 680,
                  fontSize: 18,
                  lineHeight: 31,
                  marginTop: spacing.lg,
                }}
              >
                {item}
              </Text>
            );
          }}
          ListFooterComponent={(
            <View
              style={{
                width: '100%',
                maxWidth: 680,
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

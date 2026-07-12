/**
 * In-app resource reader for curated public-domain and open-access readings.
 * Everything shown here is bundled in the app. No browser handoff.
 */

import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
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
const READER_WIDTH = 620;
const readerFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

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

function displayParagraph(text: string) {
  return text.replace(/\s+/g, ' ').trim();
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.color.hairline,
            backgroundColor: theme.color.bg,
          }}
        >
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
          <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'right' }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>

        <FlatList
          data={book.paragraphs}
          keyExtractor={(_, index) => `${resource.id}-${index}`}
          onScroll={onScroll}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.huge }}
          initialNumToRender={18}
          maxToRenderPerBatch={20}
          windowSize={9}
          removeClippedSubviews
          ListHeaderComponent={(
            <View style={{ width: '100%', maxWidth: READER_WIDTH, alignSelf: 'center' }}>
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.lg,
                  alignItems: 'flex-end',
                  marginBottom: spacing.xl,
                }}
              >
                <View
                  style={{
                    width: 86,
                    height: 124,
                    borderRadius: 14,
                    backgroundColor: resource.tint,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 38, backgroundColor: 'rgba(255,255,255,0.13)' }} />
                  <Ionicons name="book" size={34} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingBottom: spacing.xs }}>
                  <Text variant="caption" color={theme.color.primary}>FULL BOOK · OFFLINE</Text>
                  <Text variant="title1" style={{ marginTop: spacing.xs, lineHeight: 36 }}>
                    {resource.title}
                  </Text>
                  <Text variant="callout" dim style={{ marginTop: spacing.sm, lineHeight: 22 }}>
                    {resource.author}
                  </Text>
                </View>
              </View>

              <Text variant="caption" dim style={{ marginBottom: spacing.md }}>
                {book.sourceId}
              </Text>

              <View
                style={{
                  marginTop: spacing.sm,
                  marginBottom: spacing.xl,
                  paddingLeft: spacing.lg,
                  borderLeftWidth: 3,
                  borderLeftColor: theme.color.primary,
                }}
              >
                <Text variant="callout" dim style={{ lineHeight: 24 }}>
                  {resource.desc}
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item, index }) => {
            const kind = paragraphKind(item, index);
            const text = displayParagraph(item);
            if (kind === 'heading') {
              return (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Text
                    variant="title2"
                    style={{
                      width: '100%',
                      maxWidth: READER_WIDTH,
                      marginTop: spacing.xxl,
                      marginBottom: spacing.sm,
                      lineHeight: 30,
                    }}
                  >
                    {text}
                  </Text>
                </View>
              );
            }

            if (kind === 'frontMatter') {
              return (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Text
                    variant="callout"
                    dim
                    style={{
                      width: '100%',
                      maxWidth: READER_WIDTH,
                      marginTop: spacing.sm,
                      lineHeight: 23,
                    }}
                  >
                    {text}
                  </Text>
                </View>
              );
            }

            return (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text
                  variant="body"
                  style={{
                    width: '100%',
                    maxWidth: READER_WIDTH,
                    fontFamily: readerFont,
                    fontSize: 19,
                    lineHeight: 32,
                    marginTop: spacing.lg,
                  }}
                >
                  {text}
                </Text>
              </View>
            );
          }}
          ListFooterComponent={(
            <View
              style={{
                width: '100%',
                maxWidth: READER_WIDTH,
                alignSelf: 'center',
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

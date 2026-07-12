/**
 * In-app resource reader for curated public-domain and open-access readings.
 * Everything shown here is bundled in the app. No browser handoff.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
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

type ParagraphKind = 'body' | 'heading' | 'frontMatter' | 'chapter';
interface ReaderBlock {
  key: string;
  text: string;
  kind: ParagraphKind;
  chapterIndex: number;
}

interface ReaderChapter {
  index: number;
  title: string;
  startBlock: number;
}

const READER_WIDTH = 620;
const readerFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

function MetaPill({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.round,
        backgroundColor: theme.color.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.color.hairline,
      }}
    >
      <Text variant="caption" color={theme.color.textDim}>
        {children}
      </Text>
    </View>
  );
}

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

function isChapterBreak(text: string, index: number, kind: ParagraphKind) {
  if (kind !== 'heading') return false;
  const trimmed = displayParagraph(text);
  const normalized = trimmed.replace(/[_"'.:,;!?()\[\]\s-]/g, '');
  const isUpper = /[A-Za-z]/.test(trimmed) && normalized.length > 0 && normalized === normalized.toUpperCase();
  return (
    /^(chapter|book|part|section|preface|introduction|conclusion)\b/i.test(trimmed) ||
    /^[IVXLCDM]+\.?$/.test(trimmed) ||
    (index > 8 && isUpper && trimmed.length <= 96)
  );
}

function chapterTitle(text: string, fallback: string) {
  const cleaned = displayParagraph(text);
  if (!cleaned) return fallback;
  if (/^[IVXLCDM]+\.?$/.test(cleaned)) return `Chapter ${cleaned.replace(/\.$/, '')}`;
  if (/^\d+\.?$/.test(cleaned)) return `Chapter ${cleaned.replace(/\.$/, '')}`;
  if (/^contents$/i.test(cleaned)) return 'Contents';
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned;
}

function buildReaderModel(paragraphs: string[]) {
  const chapters: ReaderChapter[] = [{ index: 0, title: 'Opening', startBlock: 0 }];
  let chapterIndex = 0;

  const blocks = paragraphs.map((paragraph, index): ReaderBlock => {
    const kind = paragraphKind(paragraph, index);
    if (isChapterBreak(paragraph, index, kind)) {
      const duplicateOpening = chapters.length === 1 && chapters[0].startBlock === 0 && index <= 8;
      chapterIndex = duplicateOpening ? 0 : chapters.length;
      if (duplicateOpening) {
        chapters[0] = { index: 0, title: chapterTitle(paragraph, 'Opening'), startBlock: index };
      } else {
        chapters.push({ index: chapterIndex, title: chapterTitle(paragraph, `Chapter ${chapterIndex + 1}`), startBlock: index });
      }
    }

    return {
      key: `${index}-${chapterIndex}`,
      text: paragraph,
      kind: isChapterBreak(paragraph, index, kind) ? 'chapter' : kind,
      chapterIndex,
    };
  });

  return { blocks, chapters };
}

export default function EducationResource() {
  const theme = useTheme();
  const safeBack = useSafeBack();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const resource = id ? resourceById(id) : undefined;
  const book = resource ? BOOKS[resource.bookId] : undefined;
  const [progress, setProgress] = useState(0);
  const [currentChapter, setCurrentChapter] = useState(0);
  const { blocks, chapters } = useMemo(() => buildReaderModel(book?.paragraphs ?? []), [book]);
  const listRef = useRef<FlatList<ReaderBlock>>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<ReaderBlock>[] }) => {
    const visible = viewableItems.find((item) => item.item && item.item.kind !== 'frontMatter')?.item;
    if (visible) setCurrentChapter(visible.chapterIndex);
  }).current;

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
            <Text variant="caption" dim numberOfLines={1}>
              Chapter {Math.min(currentChapter + 1, chapters.length)} of {chapters.length}
            </Text>
            <ProgressBar progress={progress} height={6} />
          </View>
          <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'right' }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>

        <FlatList
          ref={listRef}
          data={blocks}
          keyExtractor={(item) => item.key}
          onScroll={onScroll}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 35 }}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: true,
            });
          }}
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

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl }}>
                <MetaPill>{book.source}</MetaPill>
                <MetaPill>{resource.length}</MetaPill>
                <MetaPill>{`${chapters.length} chapters`}</MetaPill>
              </View>

              <View
                style={{
                  marginBottom: spacing.xl,
                  padding: spacing.md,
                  backgroundColor: theme.color.surface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: theme.color.hairline,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="list" size={16} color={theme.color.primary} />
                  <Text variant="footnote" color={theme.color.primary} style={{ flex: 1 }}>
                    Chapters
                  </Text>
                  <Text variant="caption" dim>{chapters.length}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}
                >
                  {chapters.map((chapter) => {
                    const on = chapter.index === currentChapter;
                    return (
                      <Pressable
                        key={chapter.index}
                        onPress={() => listRef.current?.scrollToIndex({ index: chapter.startBlock, animated: true, viewPosition: 0.1 })}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to ${chapter.title}`}
                        style={({ pressed }) => ({
                          minHeight: 34,
                          maxWidth: 240,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.round,
                          backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt,
                          justifyContent: 'center',
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <Text variant="caption" color={on ? theme.color.onPrimary : theme.color.text} numberOfLines={1}>
                          {chapter.index + 1}. {chapter.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

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
          renderItem={({ item }) => {
            const kind = item.kind;
            const text = displayParagraph(item.text);
            if (kind === 'chapter') {
              return (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View
                    style={{
                      width: '100%',
                      maxWidth: READER_WIDTH,
                      marginTop: spacing.xl,
                      marginBottom: spacing.sm,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.card,
                      borderWidth: 1,
                      borderColor: theme.color.hairline,
                      backgroundColor: theme.color.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                    }}
                  >
                    <Ionicons name="book" size={18} color={theme.color.primary} />
                    <Text variant="headline" style={{ flex: 1, lineHeight: 22 }}>
                      {text}
                    </Text>
                  </View>
                </View>
              );
            }
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
                    fontSize: 18,
                    lineHeight: 31,
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

/**
 * In-app resource reader for curated public-domain and open-access readings.
 * Everything shown here is bundled in the app. No browser handoff.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useStore } from '@/application/store';
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

type ParagraphKind = 'body' | 'heading' | 'frontMatter' | 'chapter' | 'note';
interface ReaderBlock {
  key: string;
  text: string;
  kind: ParagraphKind;
  chapterIndex: number;
  sourceIndex: number;
  firstInChapter: boolean;
}

interface ReaderChapter {
  index: number;
  title: string;
  startBlock: number;
}

interface ChapterDisplay {
  marker?: string;
  title: string;
}

const READER_WIDTH = 620;
const readerFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

interface BookRule {
  startAt: number;
  skipRanges?: Array<[number, number]>;
  openingTitle?: string;
  allowRomanChapters?: boolean;
  allowNumberedRomanChapters?: boolean;
  allowAllCapsChapters?: boolean;
  chapterTitles?: string[];
  chapterPatterns?: RegExp[];
  headingPatterns?: RegExp[];
}

const BOOK_RULES: Record<string, BookRule> = {
  'gambler': {
    startAt: 9,
    allowRomanChapters: true,
  },
  'money-getting': {
    startAt: 4,
    openingTitle: 'Opening',
    allowAllCapsChapters: true,
  },
  'john-barleycorn': {
    startAt: 4,
    chapterPatterns: [/^chapter\s+[ivxlcdm]+$/i],
  },
  'alcohol-dangerous': {
    startAt: 68,
    skipRanges: [[79, 81]],
    chapterPatterns: [/^introduction\.?$/i, /^preface\b/i, /^chapter\s+[ivxlcdm]+\.?$/i],
  },
  'opium-eater': {
    startAt: 4,
    allowAllCapsChapters: true,
    chapterPatterns: [/^to the reader$/i, /^part\s+[ivxlcdm]+$/i],
  },
  'opium-notebook': {
    startAt: 4,
    chapterPatterns: [
      /^three memorable murders\.?$/i,
      /^the true relations of the bible to merely human science\.?$/i,
      /^schlosser's literary history of the eighteenth century\.?$/i,
      /^fox and burke\.?$/i,
      /^junius\.?$/i,
      /^the antigone of sophocles/i,
      /^the marquess wellesley\.?\s*(?:\[\d+\])?$/i,
      /^milton versus southey and landor\.?$/i,
      /^falsification of english history\.?$/i,
      /^a peripatetic philosopher\.?$/i,
      /^on suicide\.?$/i,
      /^superficial knowledge\.?$/i,
      /^english dictionaries\.?$/i,
      /^dryden's hexastich\.?$/i,
      /^pope's retort upon addison\.?$/i,
    ],
    headingPatterns: [/^a sequel to/i, /^footnotes?[:.]?$/i],
  },
  'social-history-smoking': {
    startAt: 19,
    skipRanges: [[27, 44]],
    allowRomanChapters: true,
    chapterPatterns: [/^preface$/i],
  },
  'tobacco-alcohol': {
    startAt: 9,
    chapterPatterns: [
      /^essay on tobacco\.?$/i,
      /^history\.?$/i,
      /^effects of tobacco upon animal life\.?$/i,
      /^cases illustrative of the effects of tobacco\.?$/i,
    ],
    headingPatterns: [/^experiment\s+\d+\.?$/i],
  },
  'social-emergency': {
    startAt: 8,
    skipRanges: [[15, 31], [500, 980]],
    chapterPatterns: [/^preface$/i, /^introduction$/i, /^chapter\s+[ivxlcdm]+$/i],
  },
  'sex-education': {
    startAt: 24,
    skipRanges: [[31, 56]],
    allowRomanChapters: true,
    chapterPatterns: [/^prefatory note$/i],
    headingPatterns: [/^§\s*\d+\./],
  },
  'walden': {
    startAt: 10,
    chapterTitles: [
      'Economy',
      'Where I Lived, and What I Lived For',
      'Reading',
      'Sounds',
      'Solitude',
      'Visitors',
      'The Bean-Field',
      'The Village',
      'The Ponds',
      'Baker Farm',
      'Higher Laws',
      'Brute Neighbors',
      'House-Warming',
      'Former Inhabitants; and Winter Visitors',
      'Winter Animals',
      'The Pond in Winter',
      'Spring',
      'Conclusion',
      'ON THE DUTY OF CIVIL DISOBEDIENCE',
    ],
  },
  'as-a-man-thinketh': {
    startAt: 15,
    skipRanges: [[19, 23]],
    allowAllCapsChapters: true,
  },
  'talks-to-teachers': {
    startAt: 5,
    skipRanges: [[14, 50]],
    allowNumberedRomanChapters: true,
    chapterPatterns: [/^preface\.?$/i, /^talks to teachers$/i, /^talks to students\.?$/i],
  },
  'self-help': {
    startAt: 12,
    skipRanges: [[30, 44]],
    chapterPatterns: [/^preface\.?$/i, /^introduction to the first edition\.?$/i, /^chapter\s+[ivxlcdm]+\.?\s+/i],
  },
};

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

function isInRange(index: number, ranges?: Array<[number, number]>) {
  return ranges?.some(([start, end]) => index >= start && index <= end) ?? false;
}

function displayParagraph(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[_#]/g, '')
    .replace(/[‐‑‒–—―]/g, ' - ')
    .replace(/--+/g, ' - ')
    .replace(/\bCHAPTER III\. HE GREAT POTTERS\b/i, 'CHAPTER III. THE GREAT POTTERS')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function canonical(text: string) {
  return displayParagraph(text)
    .replace(/[."'“”‘’:,;!?()[\]\s-]/g, '')
    .toLowerCase();
}

function isDecorative(text: string) {
  const trimmed = displayParagraph(text);
  return (
    trimmed.length === 0 ||
    /^[*+\-= ]+$/.test(trimmed) ||
    /^\[illustration\b/i.test(trimmed) ||
    /^transcriber'?s note/i.test(trimmed) ||
    /^release date:/i.test(trimmed) ||
    /^language:/i.test(trimmed) ||
    /^credits:/i.test(trimmed)
  );
}

function shouldSkipParagraph(index: number, raw: string, rule: BookRule) {
  return index < rule.startAt || isInRange(index, rule.skipRanges) || isDecorative(raw);
}

function isAllCapsTitle(text: string) {
  const trimmed = displayParagraph(text);
  const normalized = trimmed.replace(/[_"'.:,;!?()[\]\s-]/g, '');
  return /[A-Za-z]/.test(trimmed) && normalized.length > 0 && normalized === normalized.toUpperCase() && trimmed.length <= 110;
}

function titleCase(text: string) {
  const small = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);
  const roman = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)$/;
  const cleaned = displayParagraph(text);
  if (!isAllCapsTitle(cleaned)) return cleaned;
  return cleaned
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      const bare = word.replace(/^[^a-z]+|[^a-z]+$/g, '');
      if (roman.test(bare)) return word.replace(/[a-z]+/i, (part) => part.toUpperCase());
      if (index > 0 && small.has(bare)) return word;
      return word.replace(/[a-z]/i, (char) => char.toUpperCase());
    })
    .join(' ');
}

function romanLabel(text: string) {
  const marker = displayParagraph(text).replace(/\.$/, '').toUpperCase();
  return `Chapter ${marker}`;
}

function isFootnoteHeading(text: string) {
  return /^footnotes?[:.]?$/i.test(displayParagraph(text));
}

function isChapterCandidate(text: string, rule: BookRule) {
  const cleaned = displayParagraph(text);
  if (isFootnoteHeading(cleaned)) return false;
  if (rule.chapterTitles?.some((title) => canonical(title) === canonical(cleaned))) return true;
  if (rule.chapterPatterns?.some((pattern) => pattern.test(cleaned))) return true;
  if (rule.allowRomanChapters && /^[IVXLCDM]+\.?$/.test(cleaned)) return true;
  if (rule.allowNumberedRomanChapters && cleaned.length <= 120 && /^[IVXLCDM]+\.\s+/.test(cleaned)) return true;
  if (rule.allowAllCapsChapters && isAllCapsTitle(cleaned) && !/^(by|copyright|contents|page)$/i.test(cleaned)) return true;
  return /^(foreword|preface|introduction|conclusion|to the reader)\.?$/i.test(cleaned);
}

function isHeadingCandidate(text: string, rule: BookRule) {
  const cleaned = displayParagraph(text);
  return (
    isFootnoteHeading(cleaned) ||
    /^\[?sidenote:/i.test(cleaned) ||
    rule.headingPatterns?.some((pattern) => pattern.test(cleaned)) ||
    false
  );
}

function nextReadable(paragraphs: string[], from: number, rule: BookRule) {
  for (let i = from; i < paragraphs.length; i += 1) {
    if (!shouldSkipParagraph(i, paragraphs[i], rule)) {
      const text = displayParagraph(paragraphs[i]);
      if (text) return { index: i, text };
    }
  }
  return null;
}

function shouldUseNextAsChapterTitle(current: string, next?: string) {
  if (!next) return false;
  const cleaned = displayParagraph(current);
  const nextClean = displayParagraph(next);
  if (nextClean.length > 130) return false;
  const markerOnly = /^(chapter\s+[ivxlcdm]+\.?|[ivxlcdm]+\.?)$/i.test(cleaned);
  return markerOnly && (isAllCapsTitle(nextClean) || (!/[.!?]$/.test(nextClean) && nextClean.length <= 120));
}

function chapterTitle(text: string, nextTitle?: string) {
  const raw = displayParagraph(text);
  const rawChapterOnly = raw.match(/^chapter\s+([ivxlcdm]+)\.?$/i);
  const rawChapterWithTitle = raw.match(/^chapter\s+([ivxlcdm]+)\.?\s+(.+)$/i);
  const rawNumberedRoman = raw.match(/^([ivxlcdm]+)\.\s+(.+)$/i);
  const cleaned = titleCase(text);
  const next = nextTitle ? titleCase(nextTitle) : undefined;
  const rawPart = raw.match(/^part\s+([ivxlcdm]+)\.?$/i);
  if (rawPart) return `Part ${rawPart[1].toUpperCase()}`;
  if (rawChapterOnly && next) return `Chapter ${rawChapterOnly[1].toUpperCase()}: ${next.replace(/\.$/, '')}`;
  if (rawChapterOnly) return `Chapter ${rawChapterOnly[1].toUpperCase()}`;
  if (rawChapterWithTitle) return `Chapter ${rawChapterWithTitle[1].toUpperCase()}. ${titleCase(rawChapterWithTitle[2]).replace(/\.$/, '')}`;
  if (rawNumberedRoman) return `${rawNumberedRoman[1].toUpperCase()}. ${titleCase(rawNumberedRoman[2]).replace(/\.$/, '')}`;
  if (next && /^[IVXLCDM]+\.?$/i.test(raw)) return `${romanLabel(raw)}: ${next.replace(/\.$/, '')}`;
  if (/^[IVXLCDM]+\.?$/i.test(raw)) return romanLabel(raw);
  if (/^\d+\.?$/.test(cleaned)) return `Chapter ${cleaned.replace(/\.$/, '')}`;
  return cleaned.replace(/\.$/, '');
}

function chapterDisplay(title: string, fallbackIndex: number): ChapterDisplay {
  const clean = displayParagraph(title);
  const chapterWithTitle = clean.match(/^(chapter\s+[ivxlcdm]+)[:.]\s+(.+)$/i);
  if (chapterWithTitle) {
    return {
      marker: chapterWithTitle[1].replace(/^chapter/i, 'Chapter'),
      title: chapterWithTitle[2],
    };
  }

  const partWithTitle = clean.match(/^(part\s+[ivxlcdm]+)[:.]\s+(.+)$/i);
  if (partWithTitle) {
    return {
      marker: partWithTitle[1].replace(/^part/i, 'Part'),
      title: partWithTitle[2],
    };
  }

  const romanWithTitle = clean.match(/^([ivxlcdm]+)\.\s+(.+)$/i);
  if (romanWithTitle) {
    return {
      marker: romanWithTitle[1].toUpperCase(),
      title: romanWithTitle[2],
    };
  }

  return { marker: `Section ${fallbackIndex + 1}`, title: clean };
}

function chapterChipTitle(title: string) {
  const display = chapterDisplay(title, 0);
  return display.title || title;
}

function paragraphKind(text: string, rule: BookRule): ParagraphKind {
  if (/^\[?sidenote:/i.test(text) || /^\[?footnote\b/i.test(text)) return 'note';
  if (isHeadingCandidate(text, rule)) return 'heading';
  return 'body';
}

function bookParagraphs(book?: BookPayload) {
  return Array.isArray(book?.paragraphs) ? book.paragraphs : [];
}

function buildReaderModel(bookId: string, paragraphs?: string[]) {
  const sourceParagraphs = Array.isArray(paragraphs) ? paragraphs : [];
  const rule = BOOK_RULES[bookId] ?? { startAt: 0 };
  const chapters: ReaderChapter[] = [];
  const blocks: ReaderBlock[] = [];
  let chapterIndex = -1;
  let skipNextTitleIndex = -1;

  sourceParagraphs.forEach((paragraph, sourceIndex) => {
    if (sourceIndex === skipNextTitleIndex || shouldSkipParagraph(sourceIndex, paragraph, rule)) return;

    const text = displayParagraph(paragraph);
    if (!text) return;

    if (isChapterCandidate(text, rule)) {
      const next = nextReadable(sourceParagraphs, sourceIndex + 1, rule);
      const nextTitle = shouldUseNextAsChapterTitle(text, next?.text) ? next?.text : undefined;
      if (nextTitle && next) skipNextTitleIndex = next.index;

      chapterIndex = chapters.length;
      const title = chapterTitle(text, nextTitle);
      chapters.push({ index: chapterIndex, title, startBlock: blocks.length });
      blocks.push({
        key: `${sourceIndex}-chapter-${chapterIndex}`,
        text: title,
        kind: 'chapter',
        chapterIndex,
        sourceIndex,
        firstInChapter: true,
      });
      return;
    }

    if (chapterIndex < 0) {
      chapterIndex = 0;
      chapters.push({ index: 0, title: rule.openingTitle ?? 'Opening', startBlock: blocks.length });
    }

    const chapterStart = chapters[chapterIndex]?.startBlock ?? 0;
    const startsWithChapterBlock = blocks[chapterStart]?.kind === 'chapter';
    const firstInChapter = blocks.length === chapterStart || (startsWithChapterBlock && blocks.length === chapterStart + 1);

    blocks.push({
      key: `${sourceIndex}-${chapterIndex}`,
      text,
      kind: paragraphKind(text, rule),
      chapterIndex,
      sourceIndex,
      firstInChapter,
    });
  });

  if (chapters.length === 0) chapters.push({ index: 0, title: 'Opening', startBlock: 0 });
  return { blocks, chapters };
}

export default function EducationResource() {
  const theme = useTheme();
  const safeBack = useSafeBack();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const resource = id ? resourceById(id) : undefined;
  const book = resource ? BOOKS[resource.bookId] : undefined;
  const setEduProgress = useStore((s) => s.setEduProgress);
  const saved = useStore((s) => (resource ? s.eduProgress[resource.id] : undefined));
  const savedPct = saved?.pct ?? 0;
  const [progress, setProgress] = useState(savedPct);
  const [currentChapter, setCurrentChapter] = useState(0);
  const { blocks, chapters } = useMemo(() => buildReaderModel(resource?.bookId ?? '', bookParagraphs(book)), [book, resource?.bookId]);
  const listRef = useRef<FlatList<ReaderBlock>>(null);
  const lastRef = useRef({ pct: savedPct, offset: saved?.offset ?? 0 });
  const restoredRef = useRef(false);
  const pendingScrollRef = useRef<{ index: number; attempts: number } | null>(null);

  useEffect(() => {
    restoredRef.current = false;
    pendingScrollRef.current = null;
    lastRef.current = { pct: saved?.pct ?? 0, offset: saved?.offset ?? 0 };
    setProgress(saved?.pct ?? 0);
    setCurrentChapter(0);
    // Intentionally keyed to the resource. Store updates while reading should
    // not reset the restore flag or pull the reader away from the live scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource?.id]);

  useEffect(
    () => () => {
      if (resource) setEduProgress(resource.id, lastRef.current.pct, lastRef.current.offset);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resource?.id],
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<ReaderBlock>[] }) => {
    const visible = viewableItems.find((item) => item.item && item.item.kind !== 'frontMatter')?.item;
    if (visible) setCurrentChapter(visible.chapterIndex);
  }).current;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const denom = Math.max(1, contentSize.height - layoutMeasurement.height);
    const pct = Math.min(1, Math.max(0, contentOffset.y / denom));
    lastRef.current = { pct, offset: contentOffset.y };
    setProgress(pct);
  }, []);

  const persist = useCallback(() => {
    if (resource) setEduProgress(resource.id, lastRef.current.pct, lastRef.current.offset);
  }, [resource, setEduProgress]);

  const jumpToChapter = useCallback((chapter: ReaderChapter) => {
    setCurrentChapter(chapter.index);
    pendingScrollRef.current = { index: chapter.startBlock, attempts: 0 };
    listRef.current?.scrollToIndex({
      index: chapter.startBlock,
      animated: true,
      viewPosition: 0.02,
    });
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
            paddingTop: spacing.md,
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
              width: 44, height: 44, borderRadius: radius.round,
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
            <Text variant="caption" dim numberOfLines={1} style={{ marginTop: 1 }}>
              Section {Math.min(currentChapter + 1, chapters.length)} of {chapters.length}
            </Text>
            <ProgressBar progress={progress} height={5} />
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
          onMomentumScrollEnd={persist}
          onScrollEndDrag={persist}
          onContentSizeChange={() => {
            if (!restoredRef.current && (saved?.offset ?? 0) > 0) {
              restoredRef.current = true;
              listRef.current?.scrollToOffset({ offset: saved!.offset, animated: false });
              setProgress(savedPct);
            }
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 35 }}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: false,
            });

            const current = pendingScrollRef.current;
            const attempts = current?.index === info.index ? current.attempts + 1 : 1;
            pendingScrollRef.current = { index: info.index, attempts };

            setTimeout(() => {
              if (pendingScrollRef.current?.index !== info.index || attempts > 4) return;
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.02,
              });
            }, 80 + attempts * 80);
          }}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.huge }}
          initialNumToRender={72}
          maxToRenderPerBatch={32}
          windowSize={12}
          removeClippedSubviews={Platform.OS === 'android'}
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
                {savedPct > 0 ? <MetaPill>{`${Math.round(savedPct * 100)}% saved`}</MetaPill> : null}
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
                  contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md, paddingRight: spacing.md }}
                >
                  {chapters.map((chapter) => {
                    const on = chapter.index === currentChapter;
                    return (
                      <Pressable
                        key={chapter.index}
                        onPress={() => jumpToChapter(chapter)}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to ${chapter.title}`}
                        style={({ pressed }) => ({
                          minHeight: 44,
                          maxWidth: 260,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.round,
                          backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt,
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: on ? theme.color.primary : theme.color.hairline,
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <Text variant="caption" color={on ? theme.color.onPrimary : theme.color.text} numberOfLines={1} style={{ lineHeight: 16 }}>
                          {chapter.index + 1}. {chapterChipTitle(chapter.title)}
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
            const text = item.text;
            if (kind === 'chapter') {
              const display = chapterDisplay(text, item.chapterIndex);
              return (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View
                    style={{
                      width: '100%',
                      maxWidth: READER_WIDTH,
                      marginTop: item.sourceIndex === blocks[0]?.sourceIndex ? spacing.sm : spacing.xxl,
                      marginBottom: spacing.md,
                      paddingTop: spacing.md,
                      borderTopWidth: item.sourceIndex === blocks[0]?.sourceIndex ? 0 : 1,
                      borderTopColor: theme.color.hairline,
                    }}
                  >
                    <Text
                      variant="caption"
                      color={theme.color.primary}
                      style={{ textTransform: 'uppercase', marginBottom: spacing.xs }}
                    >
                      {display.marker}
                    </Text>
                    <Text variant="title1" style={{ lineHeight: 34 }}>
                      {display.title}
                    </Text>
                  </View>
                </View>
              );
            }
            if (kind === 'heading') {
              return (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Text
                    variant="headline"
                    style={{
                      width: '100%',
                      maxWidth: READER_WIDTH,
                      marginTop: spacing.xl,
                      marginBottom: spacing.xs,
                      lineHeight: 24,
                    }}
                  >
                    {text}
                  </Text>
                </View>
              );
            }

            if (kind === 'frontMatter' || kind === 'note') {
              return (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View
                    style={{
                      width: '100%',
                      maxWidth: READER_WIDTH,
                      marginTop: spacing.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderLeftWidth: 3,
                      borderLeftColor: theme.color.primary,
                      backgroundColor: theme.color.surface,
                      borderRadius: radius.input,
                    }}
                  >
                    <Text variant="footnote" dim style={{ lineHeight: 20 }}>
                      {text.replace(/^\[?sidenote:\s*/i, '').replace(/\]?$/, '')}
                    </Text>
                  </View>
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
                    lineHeight: 32,
                    marginTop: item.firstInChapter ? spacing.sm : spacing.lg,
                    includeFontPadding: false,
                    textAlign: 'justify',
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

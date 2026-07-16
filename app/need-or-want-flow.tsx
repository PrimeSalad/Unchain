/**
 * Need or Want? Flow - the multi-step reflection questions.
 *
 * 1. Category selection
 * 2. Item information (name, price, reason)
 * 3. Category-specific follow-up questions
 * 4. Personalized summary
 * 5. 24-hour cooldown with persistent countdown
 * 6. Post-cooldown follow-up
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { radius, spacing, fonts } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import {
  NEED_OR_WANT_CATEGORY_QUESTION,
  CATEGORY_LABEL_TO_KEY,
  NEED_OR_WANT_CATEGORIES,
  NEED_OR_WANT_COOLDOWN_MS,
  needOrWantSummary,
  type NeedOrWantCategory,
  type NeedOrWantQuestion,
  type NeedOrWantResponses,
} from '@/domain/alternatives';
import { scheduleNeedOrWantReminder, cancelNeedOrWantReminder } from '@/application/needOrWantReminder';
import {
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  formatMoneyInput,
} from '@/domain/gambling';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function successHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function fmtElapsed(totalMs: number): string {
  const totalSecs = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  if (hours >= 24) return '1 day';
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} min`;
  return `${minutes} min`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Phase =
  | 'category'
  | 'item-info'
  | 'question'
  | 'summary'
  | 'cooldown'
  | 'followup';

// ─────────────────────────────────────────────────────────────────────────────
// Progress Ring
// ─────────────────────────────────────────────────────────────────────────────

function ProgressRing({
  progress,
  size = 140,
  strokeWidth = 10,
  color,
  bgColor,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: bgColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderTopColor: progress > 0 ? color : bgColor,
          borderRightColor: progress > 0.25 ? color : bgColor,
          borderBottomColor: progress > 0.5 ? color : bgColor,
          borderLeftColor: progress > 0.75 ? color : bgColor,
          transform: [{ rotate: '-90deg' }],
        }}
      />
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cart" size={28} color={color} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Card
// ─────────────────────────────────────────────────────────────────────────────

function CategoryCard({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: selected ? theme.color.primary : theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: selected ? theme.color.primary : theme.color.hairline,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: selected ? theme.color.onPrimary + '20' : theme.color.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={selected ? theme.color.onPrimary : theme.color.primary}
        />
      </View>
      <Text
        variant="callout"
        color={selected ? theme.color.onPrimary : theme.color.text}
        style={{ fontFamily: 'Nunito_700Bold', flex: 1 }}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={22} color={theme.color.onPrimary} />
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Flow
// ─────────────────────────────────────────────────────────────────────────────

export default function NeedOrWantFlowScreen() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const needOrWantCooldown = useStore((s) => s.needOrWantCooldown);
  const startNeedOrWantCooldown = useStore((s) => s.startNeedOrWantCooldown);
  const saveNeedOrWantEntry = useStore((s) => s.saveNeedOrWantEntry);
  const decideNeedOrWantEntry = useStore((s) => s.decideNeedOrWantEntry);
  const activeNeedOrWantId = useStore((s) => s.activeNeedOrWantId);

  const [phase, setPhase] = useState<Phase>('category');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [itemReason, setItemReason] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NeedOrWantCategory | null>(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [responses, setResponses] = useState<NeedOrWantResponses>({});
  const [summary, setSummary] = useState('');
  const [cooldownElapsed, setCooldownElapsed] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [stillWantAnswer, setStillWantAnswer] = useState<boolean | null>(null);
  const entryIdRef = useRef<string | null>(null);

  const scrollRef = useRef<any>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [phase, questionIdx]);

  const categoryQuestions: NeedOrWantQuestion[] = selectedCategory
    ? NEED_OR_WANT_CATEGORIES[selectedCategory].questions
    : [];
  const categoryMeta = selectedCategory ? NEED_OR_WANT_CATEGORIES[selectedCategory] : null;

  // Check if there's an active cooldown on mount
  useFocusEffect(
    useCallback(() => {
      if (needOrWantCooldown != null) {
        const elapsed = Date.now() - needOrWantCooldown;
        if (elapsed >= NEED_OR_WANT_COOLDOWN_MS) {
          if (activeNeedOrWantId) {
            const entries = useStore.getState().needOrWantEntries;
            const entry = entries.find((e) => e.id === activeNeedOrWantId);
            if (entry) {
              entryIdRef.current = entry.id;
              setItemName(entry.itemName);
              setItemPrice(entry.itemPrice);
              setCurrency(entry.currency);
              setItemReason(entry.itemReason);
              setSelectedCategory(entry.category);
              setCategoryLabel(entry.categoryLabel);
              setResponses(entry.responses);
              setSummary(entry.summary);
            }
          }
          setPhase('followup');
        } else {
          setCooldownElapsed(elapsed);
          setPhase('cooldown');
        }
      } else {
        entryIdRef.current = null;
        setPhase('category');
        setItemName('');
        setItemPrice('');
        setCurrency(DEFAULT_CURRENCY);
        setItemReason('');
        setSelectedCategory(null);
        setCategoryLabel('');
        setQuestionIdx(0);
        setResponses({});
        setSummary('');
        setCooldownElapsed(0);
        setCelebrating(false);
        setStillWantAnswer(null);
      }
    }, [needOrWantCooldown, activeNeedOrWantId]),
  );

  // Cooldown timer
  useEffect(() => {
    if (phase !== 'cooldown') return;
    const id = setInterval(() => {
      if (needOrWantCooldown == null) return;
      const elapsed = Date.now() - needOrWantCooldown;
      setCooldownElapsed(elapsed);
      if (elapsed >= NEED_OR_WANT_COOLDOWN_MS) {
        clearInterval(id);
        const activeId = useStore.getState().activeNeedOrWantId;
        if (activeId) {
          const entry = useStore.getState().needOrWantEntries.find((e) => e.id === activeId);
          if (entry) {
            entryIdRef.current = entry.id;
            setItemName(entry.itemName);
            setItemPrice(entry.itemPrice);
            setCurrency(entry.currency);
            setItemReason(entry.itemReason);
            setSelectedCategory(entry.category);
            setCategoryLabel(entry.categoryLabel);
            setResponses(entry.responses);
            setSummary(entry.summary);
          }
        }
        setPhase('followup');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, needOrWantCooldown]);

  const handleCategorySelect = (label: string) => {
    Haptics.selectionAsync().catch(() => {});
    const catKey = CATEGORY_LABEL_TO_KEY[label];
    if (catKey) {
      setSelectedCategory(catKey);
      setCategoryLabel(label);
      successHaptic();
      setPhase('item-info');
    }
  };

  const handleItemInfoContinue = () => {
    if (!itemName.trim()) return;
    successHaptic();
    setPhase('question');
    setQuestionIdx(0);
  };

  const handleQuestionAnswer = (answer: string) => {
    Haptics.selectionAsync().catch(() => {});
    const question = categoryQuestions[questionIdx];
    const newResponses = { ...responses, [question.id]: answer };
    setResponses(newResponses);

    if (questionIdx < categoryQuestions.length - 1) {
      setQuestionIdx((i) => i + 1);
    } else {
      if (selectedCategory) {
        const s = needOrWantSummary(newResponses, selectedCategory);
        setSummary(s);
        setPhase('summary');
      }
    }
  };

  const handleStartCooldown = () => {
    successHaptic();
    const id = saveNeedOrWantEntry({
      itemName: itemName.trim(),
      itemPrice,
      currency,
      itemReason: itemReason.trim(),
      category: selectedCategory!,
      categoryLabel,
      responses,
      summary,
    });
    entryIdRef.current = id;
    startNeedOrWantCooldown();
    scheduleNeedOrWantReminder(itemName.trim(), itemPrice, currency);
    setPhase('cooldown');
  };

  const handleFollowupAnswer = (stillWant: boolean) => {
    successHaptic();
    cancelNeedOrWantReminder();
    if (entryIdRef.current) {
      decideNeedOrWantEntry(entryIdRef.current, stillWant);
    } else if (activeNeedOrWantId) {
      decideNeedOrWantEntry(activeNeedOrWantId, stillWant);
    }
    setStillWantAnswer(stillWant);
    setCelebrating(true);
  };

  const totalSteps = 2 + categoryQuestions.length;
  const stepProgress = phase === 'category' ? 1 / totalSteps
    : phase === 'item-info' ? 2 / totalSteps
    : phase === 'question' ? (2 + questionIdx + 1) / totalSteps
    : 0;

  const displayPrice = itemPrice ? `${currency}${itemPrice}` : '';
  const cooldownProgress = phase === 'cooldown' ? cooldownElapsed / NEED_OR_WANT_COOLDOWN_MS : 0;

  return (
    <Screen scrollRef={scrollRef} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable
          onPress={safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="headline">Before You Buy</Text>
          <Text variant="footnote" dim style={{ marginTop: 2 }}>
            Take a moment to think through this purchase.
          </Text>
        </View>
      </View>

      {/* ── Step 1: Category Selection ────────────────────────────────── */}
      {phase === 'category' && (
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <ProgressBar progress={stepProgress} height={6} />
            <Text variant="caption" dim>Step 1 of {totalSteps}</Text>
          </View>

          <Text
            variant="headline"
            center
            style={{ fontFamily: 'Nunito_800ExtraBold', paddingHorizontal: spacing.sm, lineHeight: 26 }}
          >
            {NEED_OR_WANT_CATEGORY_QUESTION.question}
          </Text>

          <View style={{ gap: spacing.sm }}>
            {NEED_OR_WANT_CATEGORY_QUESTION.options.map((option) => {
              const catKey = CATEGORY_LABEL_TO_KEY[option];
              const meta = catKey ? NEED_OR_WANT_CATEGORIES[catKey] : null;
              return (
                <CategoryCard
                  key={option}
                  icon={meta?.icon ?? 'help-circle'}
                  label={option}
                  selected={false}
                  onPress={() => handleCategorySelect(option)}
                />
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* ── Step 2: Item Information ──────────────────────────────────── */}
      {phase === 'item-info' && (
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <ProgressBar progress={stepProgress} height={6} />
            <Text variant="caption" dim>Step 2 of {totalSteps}</Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: theme.color.primarySoft,
              borderRadius: radius.card,
              padding: spacing.sm,
            }}
          >
            {categoryMeta && (
              <Ionicons name={categoryMeta.icon as keyof typeof Ionicons.glyphMap} size={16} color={theme.color.primary} />
            )}
            <Text variant="footnote" color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>
              {categoryLabel}
            </Text>
          </View>

          <Text variant="footnote" dim style={{ lineHeight: 19 }}>
            What are you thinking about buying? This stays on your device only.
          </Text>

          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>What is it?</Text>
            <TextInput
              value={itemName}
              onChangeText={setItemName}
              placeholder="Item name"
              placeholderTextColor={theme.color.textDim}
              style={{
                backgroundColor: theme.color.surfaceAlt,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                fontSize: 16,
                color: theme.color.text,
                fontFamily: 'Nunito_600SemiBold',
              }}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>How much does it cost?</Text>
            <View
              style={{
                borderRadius: radius.card,
                backgroundColor: theme.color.surface,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  minHeight: 76,
                  borderRadius: radius.card,
                  backgroundColor: theme.color.surfaceAlt,
                  borderWidth: 1,
                  borderColor: theme.color.hairline,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: spacing.md,
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: theme.color.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Text variant="title2" color={theme.color.onPrimary}>{currency}</Text>
                </View>
                <TextInput
                  value={itemPrice}
                  onChangeText={(t) => setItemPrice(formatMoneyInput(t))}
                  placeholder="0"
                  placeholderTextColor={theme.color.textDim}
                  keyboardType="number-pad"
                  accessibilityLabel="Item price"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: theme.color.text,
                    fontSize: 34,
                    lineHeight: 40,
                    fontFamily: fonts.displayHeavy,
                    paddingVertical: spacing.sm,
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
                {SUPPORTED_CURRENCIES.map((option) => {
                  const active = currency === option.symbol;
                  return (
                    <Pressable
                      key={option.code}
                      onPress={() => setCurrency(option.symbol)}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.label}, ${option.code}`}
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => ({
                        width: '30.5%',
                        minWidth: 86,
                        minHeight: 44,
                        borderRadius: radius.input,
                        borderWidth: 1,
                        borderColor: active ? theme.color.primary : theme.color.hairline,
                        backgroundColor: active ? theme.color.primarySoft : theme.color.surface,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.72 : 1,
                      })}
                    >
                      <Text variant="callout" color={active ? theme.color.primary : theme.color.text}>
                        {option.symbol}
                      </Text>
                      <Text variant="caption" dim={!active} color={active ? theme.color.primary : undefined}>
                        {option.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>Why do you want it?</Text>
            <TextInput
              value={itemReason}
              onChangeText={setItemReason}
              placeholder="What's drawing you to this?"
              placeholderTextColor={theme.color.textDim}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                backgroundColor: theme.color.surfaceAlt,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                fontSize: 16,
                color: theme.color.text,
                fontFamily: 'Nunito_600SemiBold',
                minHeight: 80,
              }}
            />
          </View>

          <Button
            label="Continue"
            onPress={handleItemInfoContinue}
            disabled={!itemName.trim()}
            full
          />
          <Button label="Back" kind="tertiary" onPress={() => setPhase('category')} full />
        </Animated.View>
      )}

      {/* ── Step 3: Category-Specific Questions ───────────────────────── */}
      {phase === 'question' && categoryQuestions[questionIdx] && (
        <Animated.View
          key={categoryQuestions[questionIdx].id}
          entering={FadeInDown.springify().damping(18)}
          style={{ marginTop: spacing.lg, gap: spacing.lg }}
        >
          <View style={{ gap: spacing.xs }}>
            <ProgressBar progress={stepProgress} height={6} />
            <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
              Question {questionIdx + 1} of {categoryQuestions.length} · {categoryMeta?.label}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: theme.color.surfaceAlt,
              borderRadius: radius.card,
              padding: spacing.sm,
            }}
          >
            {categoryMeta && (
              <Ionicons name={categoryMeta.icon as keyof typeof Ionicons.glyphMap} size={16} color={theme.color.primary} />
            )}
            <Text variant="footnote" numberOfLines={1} style={{ flex: 1 }}>
              {itemName}
              {displayPrice ? ` · ${displayPrice}` : ''}
            </Text>
          </View>

          <Text
            variant="headline"
            center
            style={{ fontFamily: 'Nunito_800ExtraBold', paddingHorizontal: spacing.sm, lineHeight: 26 }}
          >
            {categoryQuestions[questionIdx].question}
          </Text>

          <View style={{ gap: spacing.sm }}>
            {categoryQuestions[questionIdx].options.map((option) => {
              const isSelected = responses[categoryQuestions[questionIdx].id] === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleQuestionAnswer(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => ({
                    backgroundColor: isSelected ? theme.color.primary : theme.color.surface,
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.color.primary : theme.color.hairline,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    variant="callout"
                    color={isSelected ? theme.color.onPrimary : theme.color.text}
                    style={{ fontFamily: 'Nunito_700Bold' }}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* ── Step 4: Reflection Summary ────────────────────────────────── */}
      {phase === 'summary' && (
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: spacing.lg, gap: spacing.lg }}>
          <View
            style={{
              backgroundColor: theme.color.surfaceAlt,
              borderRadius: radius.card,
              padding: spacing.md,
              gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {categoryMeta && (
                <Ionicons name={categoryMeta.icon as keyof typeof Ionicons.glyphMap} size={18} color={theme.color.primary} />
              )}
              <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold', flex: 1 }}>{itemName}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginLeft: categoryMeta ? 26 : 0 }}>
              {displayPrice ? (
                <Text variant="footnote" dim>{displayPrice}</Text>
              ) : null}
              <Text variant="footnote" dim>{categoryLabel}</Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: theme.color.primarySoft,
              borderRadius: radius.card,
              padding: spacing.lg,
              borderLeftWidth: 3,
              borderLeftColor: theme.color.primary,
            }}
          >
            <Text variant="callout" style={{ lineHeight: 22 }}>
              {summary}
            </Text>
          </View>

          <Button label="Start 24-Hour Cooldown" onPress={handleStartCooldown} full />
          <Button label="Cancel" kind="tertiary" onPress={safeBack} full />
        </Animated.View>
      )}

      {/* ── Step 5: Active Cooldown ───────────────────────────────────── */}
      {phase === 'cooldown' && (
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: spacing.lg, gap: spacing.lg, alignItems: 'center' }}>
          <ProgressRing
            progress={cooldownProgress}
            size={140}
            strokeWidth={10}
            color={theme.color.primary}
            bgColor={theme.color.surfaceAlt}
          />

          <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>
            {itemName}
          </Text>

          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text variant="footnote" dim>You've waited:</Text>
            <Text
              variant="display"
              style={{ fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums'] }}
              accessibilityLabel={`${fmtElapsed(cooldownElapsed)} elapsed`}
            >
              {fmtElapsed(cooldownElapsed)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: '2 hours', ms: 2 * 60 * 60 * 1000 },
              { label: '12 hours', ms: 12 * 60 * 60 * 1000 },
              { label: '18 hours', ms: 18 * 60 * 60 * 1000 },
              { label: '1 day', ms: 24 * 60 * 60 * 1000 },
            ].map((m) => {
              const reached = cooldownElapsed >= m.ms;
              return (
                <View
                  key={m.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: reached ? theme.color.successSoft : theme.color.surfaceAlt,
                    borderRadius: radius.round,
                    paddingVertical: 4,
                    paddingHorizontal: spacing.sm,
                  }}
                >
                  <Ionicons
                    name={reached ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={reached ? theme.color.success : theme.color.textDim}
                  />
                  <Text
                    variant="caption"
                    color={reached ? theme.color.success : theme.color.textDim}
                  >
                    {m.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ alignSelf: 'stretch', gap: spacing.xs }}>
            <ProgressBar progress={cooldownProgress} height={8} color={theme.color.primary} />
            <Text variant="caption" dim center style={{ fontVariant: ['tabular-nums'] }}>
              {Math.max(0, Math.ceil((NEED_OR_WANT_COOLDOWN_MS - cooldownElapsed) / 1000 / 60))} minutes remaining
            </Text>
          </View>

          <Button label="Back to History" kind="tertiary" onPress={safeBack} full />
        </Animated.View>
      )}

      {/* ── Step 6: Post-Cooldown Follow-up ───────────────────────────── */}
      {phase === 'followup' && (
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: spacing.lg, gap: spacing.lg }}>
          <View
            style={{
              backgroundColor: theme.color.surfaceAlt,
              borderRadius: radius.card,
              padding: spacing.md,
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <Ionicons name="cart" size={24} color={theme.color.primary} />
            <Text variant="callout" style={{ fontFamily: 'Nunito_700Bold' }}>{itemName}</Text>
            {displayPrice ? (
              <Text variant="footnote" dim>{displayPrice}</Text>
            ) : null}
          </View>

          <Text
            variant="headline"
            center
            style={{ fontFamily: 'Nunito_800ExtraBold', paddingHorizontal: spacing.md, lineHeight: 26 }}
          >
            Did you buy it?
          </Text>

          <View style={{ gap: spacing.sm }}>
            <Pressable
              onPress={() => handleFollowupAnswer(true)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: theme.color.danger,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: theme.color.danger,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text variant="callout" color="#FFFFFF" style={{ fontFamily: 'Nunito_700Bold' }}>
                Yes
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleFollowupAnswer(false)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: theme.color.success,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: theme.color.success,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text variant="callout" color="#FFFFFF" style={{ fontFamily: 'Nunito_700Bold' }}>
                No
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Celebration overlay */}
      <ActionSheet visible={celebrating} onClose={() => { setCelebrating(false); safeBack(); }}>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
          <Animated.View entering={FadeInDown.springify().damping(14)}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: stillWantAnswer === false ? theme.color.successSoft : theme.color.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={stillWantAnswer === false ? 'checkmark' : 'time'}
                size={30}
                color={stillWantAnswer === false ? theme.color.success : theme.color.primary}
              />
            </View>
          </Animated.View>

          {stillWantAnswer === false ? (
            <>
              <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                Nice! You resisted the urge.
              </Text>
              <Text variant="footnote" dim center style={{ lineHeight: 19, paddingHorizontal: spacing.sm }}>
                You saved {displayPrice || 'money'} by not buying it. Every resisted purchase strengthens your recovery.
              </Text>
            </>
          ) : (
            <>
              <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                Logged as a relapse.
              </Text>
              <Text variant="footnote" dim center style={{ lineHeight: 19, paddingHorizontal: spacing.sm }}>
                It takes courage to be honest. Every relapse is a learning moment — you'll get it next time.
              </Text>
            </>
          )}

          <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              label="Done"
              onPress={() => {
                setCelebrating(false);
                safeBack();
              }}
              full
            />
          </View>
        </View>
      </ActionSheet>
    </Screen>
  );
}

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '../Text';
import { Button } from '../Button';
import { elevation, radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { useStore } from '@/application/store';
import type { GameId } from '@/domain/games/achievements';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// ─────────────────────────────────────────────────────────────────────────────
// Per-game "How to play" content - short, concrete, no jargon.
// ─────────────────────────────────────────────────────────────────────────────

interface TutorialStep {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

const TUTORIALS: Record<GameId, { title: string; steps: TutorialStep[] }> = {
  clarity: {
    title: 'How to play Clarity',
    steps: [
      { icon: 'text', text: 'Guess the hidden five-letter word in six tries.' },
      { icon: 'checkmark-circle', text: 'Green is correct. Yellow is the right letter in the wrong spot.' },
      { icon: 'flame', text: 'Daily keeps your streak. Practice gives unlimited words.' },
    ],
  },
  checkers: {
    title: 'How to play Checkers',
    steps: [
      { icon: 'hand-left', text: 'You play the coral pieces. Tap a piece, then tap a green dot to move.' },
      { icon: 'flash', text: 'Jump over an AI piece to capture it. Chain jumps when available.' },
      { icon: 'ribbon', text: 'Reach the far row to crown a King and win by trapping the AI.' },
    ],
  },
  sudoku: {
    title: 'How to play Sudoku',
    steps: [
      { icon: 'grid', text: 'Fill every row, column, and 3x3 box with 1 to 9.' },
      { icon: 'hand-left', text: 'Tap an empty cell, then tap a number below to place it.' },
      { icon: 'pencil', text: 'Use Notes for possibilities. Erase and hints are in the control row.' },
    ],
  },
  blocks: {
    title: 'How to play Block Puzzle',
    steps: [
      { icon: 'move', text: 'Drag a piece, or tap a piece then tap its board position.' },
      { icon: 'reorder-four', text: 'Fill a whole row or column to clear it and score.' },
      { icon: 'alert-circle-outline', text: 'The game ends when none of your pieces fit. Plan ahead.' },
    ],
  },
  gonogo: {
    title: 'How to play Go / No-Go',
    steps: [
      { icon: 'radio-button-on', text: 'Green means tap fast. Red means hold back.' },
      { icon: 'heart', text: 'A wrong tap or missed green costs focus.' },
      { icon: 'speedometer', text: 'Extreme mode is faster and rewards cleaner streaks.' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Popup
// ─────────────────────────────────────────────────────────────────────────────

interface GameTutorialProps {
  game: GameId;
  visible: boolean;
  onClose: () => void;
  /** True when the popup auto-opened on the game's first visit - only then
   *  is the "Don't show this again" checkbox offered. Opening via the header
   *  info button is deliberate, so it just shows the guide + a Close button. */
  showOptOut?: boolean;
}

/**
 * "How to play" popup. Auto-shown on a game's first open (see
 * useGameTutorial) with a persistent "Don't show this again" checkbox; the
 * header info button re-opens it on demand at any time (without the checkbox).
 */
export function GameTutorial({ game, visible, onClose, showOptOut = true }: GameTutorialProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const setTutorialHidden = useStore((s) => s.setTutorialHidden);
  const hidden = useStore((s) => !!s.games.tutorialsHidden[game]);
  const [dontShow, setDontShow] = useState(hidden);

  // Re-seed the checkbox from the persisted value each time the popup opens.
  useEffect(() => {
    if (visible) setDontShow(hidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const { title, steps } = TUTORIALS[game];

  const close = () => {
    // Only the auto-shown popup carries the checkbox - never overwrite the
    // saved preference from an info-button viewing.
    if (showOptOut) setTutorialHidden(game, dontShow);
    onClose();
  };

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    setDontShow((v) => !v);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.58)' }]}
          onPress={close}
          accessible={false}
        />
        <View
          style={{
            width: '100%',
            maxWidth: 430,
            maxHeight: '82%',
            alignSelf: 'center',
            backgroundColor: theme.color.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderWidth: 1,
            borderColor: theme.color.hairline,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.sm),
            ...elevation.e2,
          }}
          accessibilityViewIsModal
        >
          <View style={{ alignItems: 'center', paddingBottom: spacing.sm }}>
            <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: theme.color.hairline }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.color.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="school" size={17} color={theme.color.primary} />
            </View>
            <Text variant="headline" style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold' }}>
              {title}
            </Text>
            <Pressable
              onPress={close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close tutorial"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.color.surfaceAlt,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="close" size={18} color={theme.color.textDim} />
            </Pressable>
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.xs }}
          >
            <View style={{ gap: spacing.sm }}>
              {steps.map((s, i) => (
                <View
                  key={s.text}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    minHeight: 52,
                    paddingVertical: spacing.xs,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: theme.color.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={s.icon} size={16} color={theme.color.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" color={theme.color.primary} style={{ fontVariant: ['tabular-nums'], fontFamily: 'Nunito_800ExtraBold' }}>
                      {i + 1} / {steps.length}
                    </Text>
                    <Text variant="callout" style={{ lineHeight: 21 }}>
                      {s.text}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {showOptOut && (
            <Pressable
              onPress={toggle}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: dontShow }}
              accessibilityLabel="Don't show this again"
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                marginTop: spacing.md,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: dontShow ? theme.color.primary : theme.color.textDim,
                  backgroundColor: dontShow ? theme.color.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {dontShow && <Ionicons name="checkmark" size={15} color={theme.color.onPrimary} />}
              </View>
              <Text variant="footnote" dim>
                Don't show this again
              </Text>
            </Pressable>
          )}

          <Button
            label={showOptOut ? 'Got it' : 'Close'}
            onPress={close}
            full
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header info button - re-opens the tutorial on demand
// ─────────────────────────────────────────────────────────────────────────────

export function TutorialInfoButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="How to play"
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name="information-circle-outline" size={22} color={theme.color.textDim} />
    </Pressable>
  );
}

/**
 * Tutorial visibility for a game screen: auto-open on first visit (unless the
 * user opted out), plus an `open()` for the header info button. `auto` tells
 * the popup whether to offer the "Don't show this again" checkbox - only the
 * automatic first-visit showing does; info-button viewings just get Close.
 */
export function useGameTutorial(game: GameId) {
  // Read once on mount - the root layout gates rendering on store hydration,
  // so the persisted opt-out is always available here.
  const [state, setState] = useState(() => ({
    visible: !useStore.getState().games.tutorialsHidden[game],
    auto: true,
  }));
  return {
    visible: state.visible,
    auto: state.auto,
    open: () => setState({ visible: true, auto: false }),
    close: () => setState((s) => ({ ...s, visible: false })),
  };
}

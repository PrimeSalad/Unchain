import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '../Text';
import { Button } from '../Button';
import { elevation, radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { useStore } from '@/application/store';
import type { GameId } from '@/domain/games/achievements';

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
      { icon: 'text', text: 'Guess the hidden five-letter word. You have six tries.' },
      { icon: 'checkmark-circle', text: 'Green tile - right letter in the right spot.' },
      { icon: 'swap-horizontal', text: 'Yellow tile - the letter is in the word, but in a different spot.' },
      { icon: 'close-circle-outline', text: 'Gray tile - the letter is not in the word at all.' },
      { icon: 'flame', text: 'One daily word keeps your streak; Practice mode gives unlimited words.' },
    ],
  },
  checkers: {
    title: 'How to play Checkers',
    steps: [
      { icon: 'hand-left', text: 'You play the coral pieces. Tap a piece, then tap a green dot to move.' },
      { icon: 'arrow-up', text: 'Pieces move diagonally forward on the dark squares.' },
      { icon: 'flash', text: 'Jump over an AI piece to capture it - chains of jumps are allowed.' },
      { icon: 'ribbon', text: 'Reach the far row to crown a King, which can also move backward.' },
      { icon: 'trophy', text: 'Win by capturing every AI piece or leaving it no legal move.' },
    ],
  },
  sudoku: {
    title: 'How to play Sudoku',
    steps: [
      { icon: 'grid', text: 'Fill the grid so every row, column, and 3×3 box has the numbers 1–9 exactly once.' },
      { icon: 'hand-left', text: 'Tap an empty cell, then tap a number below to place it.' },
      { icon: 'pencil', text: 'Notes mode writes small pencil marks instead - great for possibilities.' },
      { icon: 'bulb', text: 'Stuck? You have 3 hints per puzzle. Erase clears a cell.' },
      { icon: 'time', text: 'Solve it to log your time - beat your best on each difficulty.' },
    ],
  },
  blocks: {
    title: 'How to play Block Puzzle',
    steps: [
      { icon: 'move', text: 'Drag pieces from the tray anywhere they fit on the board.' },
      { icon: 'reorder-four', text: 'Fill a whole row or column to clear it and score.' },
      { icon: 'flame', text: 'Clear lines back-to-back to build combos for bonus points.' },
      { icon: 'alert-circle-outline', text: 'The game ends when none of your pieces fit - plan ahead!' },
    ],
  },
  gonogo: {
    title: 'How to play Go / No-Go',
    steps: [
      { icon: 'radio-button-on', text: 'A GREEN circle means TAP - as fast as you can.' },
      { icon: 'close-circle', text: 'A RED circle means DO NOT tap. Hold back, even mid-reach.' },
      { icon: 'speedometer', text: 'The pace quickens every level - shorter windows, trickier timing.' },
      { icon: 'flame', text: 'Consecutive correct answers build a combo multiplier (up to ×5).' },
      { icon: 'heart', text: 'You have 3 focus points. A wrong tap or a miss costs one.' },
      { icon: 'fitness', text: 'This trains real impulse control - the same "wait" muscle recovery uses.' },
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
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      {/* Scrim and card are SIBLINGS - nesting the card in a Pressable would
          nest buttons inside a button (invalid on web). */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={{
            width: '100%',
            maxWidth: 380,
            maxHeight: '85%',
            backgroundColor: theme.color.surface,
            borderRadius: radius.sheet,
            padding: spacing.xl,
            ...elevation.e2,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
            <View
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: theme.color.primarySoft,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="school" size={20} color={theme.color.primary} />
            </View>
            <Text variant="title2" style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold' }}>
              {title}
            </Text>
          </View>

          {/* Steps */}
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <View style={{ gap: spacing.md }}>
              {steps.map((s) => (
                <View key={s.text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <View
                    style={{
                      width: 30, height: 30, borderRadius: 15,
                      backgroundColor: theme.color.surfaceAlt,
                      alignItems: 'center', justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    <Ionicons name={s.icon} size={15} color={theme.color.primary} />
                  </View>
                  <Text variant="callout" style={{ flex: 1, lineHeight: 22 }}>
                    {s.text}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Don't show again - first-visit popup only */}
          {showOptOut && (
          <Pressable
            onPress={toggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dontShow }}
            accessibilityLabel="Don't show this again"
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              marginTop: spacing.xl, opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 22, height: 22, borderRadius: 6,
                borderWidth: 2,
                borderColor: dontShow ? theme.color.primary : theme.color.textDim,
                backgroundColor: dontShow ? theme.color.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {dontShow && <Ionicons name="checkmark" size={15} color={theme.color.onPrimary} />}
            </View>
            <Text variant="callout" dim>
              Don't show this again
            </Text>
          </Pressable>
          )}

          <Button
            label={showOptOut ? 'Got it' : 'Close'}
            onPress={close}
            full
            style={{ marginTop: showOptOut ? spacing.lg : spacing.xl }}
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
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
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

import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Button } from './Button';

interface BackButtonProps {
  fallback?: string;
  confirmExit?: boolean;
  title?: string;
  message?: string;
  /** Lets active screens pause timers/AI while the blocking confirmation is
   * visible. Existing callers can omit it. */
  onConfirmVisibilityChange?: (visible: boolean) => void;
}

/**
 * Circular back button used across the game screens for a consistent header.
 *
 * Hardened: going back when there is no history entry (or while navigation is
 * mid-transition) used to crash or dead-end the screen. Now it (1) debounces
 * rapid double-taps, (2) checks canGoBack() first, and (3) falls back to a
 * known-good route - and never lets a navigation error escape.
 */
export function BackButton({
  fallback = '/(tabs)/home',
  confirmExit = false,
  title = 'Quit game?',
  message = 'Your current round will stop. You can start a fresh one anytime.',
  onConfirmVisibilityChange,
}: BackButtonProps) {
  const router = useRouter();
  const theme = useTheme();
  const busy = useRef(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const setConfirmation = (visible: boolean) => {
    setConfirmVisible(visible);
    onConfirmVisibilityChange?.(visible);
  };

  const goBack = () => {
    if (busy.current) return; // swallow double-taps while a pop is in flight
    busy.current = true;
    setTimeout(() => { busy.current = false; }, 600);
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(fallback as Href);
      }
    } catch {
      // Navigation state was unusable - hard-reset to the fallback.
      try {
        router.replace(fallback as Href);
      } catch {
        /* nothing left to do; never crash the screen over a back press */
      }
    }
  };

  const requestBack = () => {
    if (confirmExit) {
      setConfirmation(true);
      return;
    }
    goBack();
  };

  return (
    <>
      <Pressable
        onPress={requestBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={confirmExit ? 'Quit game' : 'Go back'}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: radius.round,
          backgroundColor: theme.color.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
      </Pressable>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setConfirmation(false)}
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.58)' }]}
            onPress={() => setConfirmation(false)}
            accessibilityRole="button"
            accessibilityLabel="Stay in game"
          />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              borderRadius: radius.sheet,
              backgroundColor: theme.color.surface,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              padding: spacing.lg,
              gap: spacing.md,
              ...elevation.e2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.color.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="exit-outline" size={19} color={theme.color.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="headline">{title}</Text>
                <Text variant="footnote" dim style={{ marginTop: 2, lineHeight: 19 }}>
                  {message}
                </Text>
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Button label="Stay" kind="secondary" onPress={() => setConfirmation(false)} full />
              <Button
                label="Quit game"
                kind="destructive"
                onPress={() => {
                  setConfirmation(false);
                  goBack();
                }}
                full
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

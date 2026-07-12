import { useRef } from 'react';
import { Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Circular back button used across the game screens for a consistent header.
 *
 * Hardened: going back when there is no history entry (or while navigation is
 * mid-transition) used to crash or dead-end the screen. Now it (1) debounces
 * rapid double-taps, (2) checks canGoBack() first, and (3) falls back to a
 * known-good route - and never lets a navigation error escape.
 */
export function BackButton({ fallback = '/(tabs)/home' }: { fallback?: string }) {
  const router = useRouter();
  const theme = useTheme();
  const busy = useRef(false);

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

  return (
    <Pressable
      onPress={goBack}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
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
  );
}

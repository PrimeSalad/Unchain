import { Platform, StatusBar, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Safe-area-context can briefly report zero insets on cold launch before native
 * layout settles. These fallbacks match modern iPhones closely enough to keep
 * first-render controls out of the status bar and home indicator.
 */
export function useReliableSafeAreaInsets() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const longSide = Math.max(width, height);
  const portrait = height >= width;
  const likelyHomeIndicator = Platform.OS === 'ios' && longSide >= 812;

  const topFallback = Platform.select({
    ios: portrait ? (likelyHomeIndicator ? 47 : 20) : 0,
    android: StatusBar.currentHeight ?? 0,
    default: 0,
  });
  const bottomFallback = Platform.OS === 'ios' && likelyHomeIndicator ? (portrait ? 34 : 21) : 0;

  return {
    ...insets,
    top: insets.top || topFallback || 0,
    bottom: insets.bottom || bottomFallback,
  };
}

import { useWindowDimensions } from 'react-native';

/**
 * One responsive primitive for the whole app (docs/improvements.md §2).
 * Adapts from a 320px phone → large phone → tablet → web, and reacts to the
 * OS text-size setting (fontScale) so layouts reflow instead of clipping
 * therapeutic copy (research §10.2 - "no truncation… ever").
 */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  return {
    width,
    isTablet,
    /** Reading-column cap; content centers on wide screens (research §10.2). */
    contentMax: 600,
    /** Recovery ring scales with the viewport, clamped so it never dominates. */
    ringSize: Math.max(140, Math.min(width * 0.44, 200)),
    /** Screen gutter - 16 on phones, 20 on large (research §8.2). */
    gutter: isTablet ? 20 : 16,
  };
}

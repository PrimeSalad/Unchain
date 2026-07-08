import { useWindowDimensions } from 'react-native';

/**
 * One responsive primitive for the whole app (docs/improvements.md §2).
 * Adapts from a 320px phone → large phone → tablet → web, and reacts to the
 * OS text-size setting (fontScale) so layouts reflow instead of clipping
 * therapeutic copy (research §10.2 — "no truncation… ever").
 */
export function useResponsive() {
  const { width, fontScale } = useWindowDimensions();
  const isTablet = width >= 700;
  return {
    width,
    isSmall: width < 360,
    isTablet,
    /** Habit grid columns. */
    columns: isTablet ? 3 : 2,
    /** Reading-column cap; content centers on wide screens (research §10.2). */
    contentMax: 600,
    /** Strength ring scales with the viewport, clamped. */
    ringSize: Math.max(140, Math.min(width * 0.44, 200)),
    /** At large accessibility text sizes, switch horizontal rows to stacked. */
    stacked: fontScale >= 1.6,
    /** Screen gutter — 16 on phones, 20 on large (research §8.2). */
    gutter: isTablet ? 20 : 16,
  };
}

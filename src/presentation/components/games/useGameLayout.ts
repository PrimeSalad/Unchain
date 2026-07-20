import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useGameMetrics() {
  const { width, height } = useWindowDimensions();
  const compact = height < 700 || width < 360;
  const tiny = height < 620 || width < 340;

  return { width, height, compact, tiny };
}

export function useSquareBoardSize({
  reservedHeight,
  horizontalPadding = 32,
  max = 340,
}: {
  reservedHeight: number;
  horizontalPadding?: number;
  max?: number;
}) {
  const metrics = useGameMetrics();
  const insets = useSafeAreaInsets();
  const byWidth = metrics.width - horizontalPadding;
  const usableHeight = metrics.height - insets.top - insets.bottom;
  const byHeight = usableHeight - reservedHeight;
  const boardSize = Math.floor(Math.max(160, Math.min(max, byWidth, byHeight)));

  return { ...metrics, boardSize, usableHeight, insets };
}

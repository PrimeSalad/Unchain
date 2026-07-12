import { useWindowDimensions } from 'react-native';

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
  const byWidth = metrics.width - horizontalPadding;
  const byHeight = metrics.height - reservedHeight;
  const boardSize = Math.floor(Math.max(160, Math.min(max, byWidth, byHeight)));

  return { ...metrics, boardSize };
}

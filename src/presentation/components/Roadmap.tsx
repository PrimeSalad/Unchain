import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MILESTONES, nextMilestone } from '@/domain/gambling';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface RoadmapProps {
  days: number;
  /** Colour overrides for use on a dark share card. */
  reachedColor?: string;
  trackColor?: string;
  nodeColor?: string;
  textColor?: string;
  dimColor?: string;
  accentColor?: string;
}

/**
 * A Strava-style recovery "route" - the road of milestones the user is
 * travelling. Reached nodes are filled, the next target glows, the rest wait
 * ahead. Horizontally scrollable so the whole 365-day journey is visible.
 */
export function Roadmap({
  days,
  reachedColor,
  trackColor,
  nodeColor,
  textColor,
  dimColor,
  accentColor,
}: RoadmapProps) {
  const theme = useTheme();
  const reached = reachedColor ?? theme.color.primary;
  const track = trackColor ?? theme.color.surfaceAlt;
  const node = nodeColor ?? theme.color.surfaceAlt;
  const txt = textColor ?? theme.color.text;
  const dim = dimColor ?? theme.color.textDim;
  const accent = accentColor ?? theme.color.accent;
  const target = nextMilestone(days);

  const SIZE = 44;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: spacing.sm, paddingRight: spacing.md, alignItems: 'flex-start' }}
    >
      {MILESTONES.map((m, i) => {
        const isReached = days >= m;
        const isNext = m === target;
        const prevReached = i === 0 ? true : days >= MILESTONES[i - 1];
        return (
          <View key={m} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Connector from previous node */}
            {i > 0 && (
              <View
                style={{
                  width: 26,
                  height: 4,
                  borderRadius: 2,
                  marginTop: SIZE / 2 - 2,
                  alignSelf: 'flex-start',
                  backgroundColor: prevReached && isReached ? reached : track,
                }}
              />
            )}
            <View style={{ alignItems: 'center', width: SIZE + 8 }}>
              <View
                style={{
                  width: SIZE,
                  height: SIZE,
                  borderRadius: radius.round,
                  backgroundColor: isReached ? reached : node,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isNext ? 2 : 0,
                  borderColor: accent,
                }}
              >
                {isReached ? (
                  <Ionicons name="checkmark" size={22} color={theme.color.onPrimary} />
                ) : (
                  <Text variant="footnote" color={isNext ? accent : dim} style={{ fontVariant: ['tabular-nums'] }}>
                    {m}
                  </Text>
                )}
              </View>
              <Text
                variant="caption"
                style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}
                color={isReached ? txt : isNext ? accent : dim}
              >
                {m}d
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

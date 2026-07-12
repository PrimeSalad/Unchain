import { View } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { spacing } from '../theme/tokens';

interface StatTileProps {
  value: string;
  label: string;
  emoji?: string;
  tone?: 'surface' | 'celebrateSoft' | 'successSoft' | 'primarySoft';
}

/** Compact metric tile - monospaced-feel numerals so live counters don't jitter. */
export function StatTile({ value, label, emoji, tone = 'surface' }: StatTileProps) {
  return (
    <Card tone={tone} padding={spacing.lg} style={{ flex: 1 }}>
      {emoji ? <Text style={{ fontSize: 20, marginBottom: spacing.xs }}>{emoji}</Text> : null}
      <View accessibilityRole="text" accessibilityLabel={`${value} ${label}`}>
        <Text variant="title2" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        <Text variant="footnote" dim style={{ marginTop: 2 }}>
          {label}
        </Text>
      </View>
    </Card>
  );
}

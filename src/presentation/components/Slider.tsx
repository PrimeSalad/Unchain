import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface SliderProps {
  value: number; // 1..max
  onChange: (v: number) => void;
  max?: number;
  label?: string;
}

/** 1–max scale as tappable segments — reliable, large targets, one-handed. */
export function Slider({ value, onChange, max = 10, label }: SliderProps) {
  const theme = useTheme();
  const segments = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        {label ? <Text variant="callout" dim>{label}</Text> : <View />}
        <Text variant="headline" color={theme.color.primary}>{value}/{max}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {segments.map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(n);
            }}
            accessibilityRole="adjustable"
            accessibilityLabel={`${label ?? 'Level'} ${n} of ${max}`}
            style={{ flex: 1, height: 40, justifyContent: 'center' }}
          >
            <View
              style={{
                height: 14,
                borderRadius: radius.chip,
                backgroundColor: n <= value ? theme.color.primary : theme.color.surfaceAlt,
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

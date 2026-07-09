import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius, spacing, motion } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface SliderProps {
  value: number;   // 1..max
  onChange: (v: number) => void;
  max?: number;
  label?: string;
}

/** Map a 1–10 value to an expressive emoji. */
function moodEmoji(v: number): string {
  if (v <= 1) return '😔';
  if (v <= 2) return '😞';
  if (v <= 3) return '😕';
  if (v <= 4) return '😐';
  if (v <= 5) return '🙂';
  if (v <= 6) return '😊';
  if (v <= 7) return '😄';
  if (v <= 8) return '😁';
  if (v <= 9) return '🥰';
  return '🤩';
}

function moodLabel(v: number): string {
  if (v <= 2)  return 'Very low';
  if (v <= 4)  return 'Low';
  if (v <= 6)  return 'Okay';
  if (v <= 8)  return 'Good';
  return 'Great';
}

function moodColor(v: number, danger: string, celebrate: string, primary: string, success: string): string {
  if (v <= 3) return danger;
  if (v <= 5) return celebrate;
  if (v <= 7) return primary;
  return success;
}

interface SegmentProps {
  n: number;
  value: number;
  label: string;
  max: number;
  onChange: (v: number) => void;
  activeColor: string;
  inactiveColor: string;
}

function Segment({ n, value, label, max, onChange, activeColor, inactiveColor }: SegmentProps) {
  const pressed = useSharedValue(0);
  const isActive = n <= value;
  const isCurrent = n === value;

  const barStyle = useAnimatedStyle(() => ({
    height: withSpring(isCurrent ? 18 : isActive ? 14 : 10, motion.spring),
    backgroundColor: withTiming(isActive ? activeColor : inactiveColor, { duration: 200 }),
    transform: [{ scaleY: withSpring(pressed.value ? 1.15 : 1, motion.spring) }],
    opacity: withTiming(isActive ? 1 : 0.35, { duration: 200 }),
  }));

  const onIn  = useCallback(() => { pressed.value = 1; }, [pressed]);
  const onOut = useCallback(() => { pressed.value = 0; }, [pressed]);
  const handle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onChange(n);
  }, [n, onChange]);

  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={handle}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} ${n} of ${max}`}
      style={{ flex: 1, height: 48, justifyContent: 'center', alignItems: 'center' }}
      hitSlop={2}
    >
      <Animated.View
        style={[
          {
            width: '100%',
            borderRadius: radius.chip,
          },
          barStyle,
        ]}
      />
    </Pressable>
  );
}

/**
 * Premium segmented mood selector.
 * Each segment animates height and colour; the selected one stands taller.
 * Emoji label updates smoothly with the value.
 */
export function Slider({ value, onChange, max = 10, label }: SliderProps) {
  const theme = useTheme();
  const c = theme.color;

  const color = moodColor(value, c.danger, c.celebrate, c.primary, c.success);

  return (
    <View>
      {/* Emoji + label row */}
      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <Text style={{ fontSize: 52, lineHeight: 60 }}>{moodEmoji(value)}</Text>
        <Text
          variant="title2"
          color={color}
          style={{ marginTop: spacing.sm, fontFamily: 'Nunito_700Bold' }}
        >
          {value} / {max}
        </Text>
        <Text variant="footnote" dim style={{ marginTop: spacing.xs }}>
          {moodLabel(value)}
        </Text>
      </View>

      {/* Segments */}
      <View style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-end' }}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <Segment
            key={n}
            n={n}
            value={value}
            label={label ?? 'Mood'}
            max={max}
            onChange={onChange}
            activeColor={color}
            inactiveColor={c.surfaceAlt}
          />
        ))}
      </View>

      {/* Scale labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Text variant="caption" dim>1</Text>
        <Text variant="caption" dim>{max}</Text>
      </View>
    </View>
  );
}

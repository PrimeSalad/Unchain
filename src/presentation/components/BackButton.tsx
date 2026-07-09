import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/** Circular back button used across the game screens for a consistent header. */
export function BackButton() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.back()}
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

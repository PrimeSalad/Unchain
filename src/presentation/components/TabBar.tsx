import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

const TABS: Record<string, { label: string; on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  home: { label: 'Home', on: 'home', off: 'home-outline' },
  progress: { label: 'Progress', on: 'stats-chart', off: 'stats-chart-outline' },
  journal: { label: 'Journal', on: 'book', off: 'book-outline' },
  profile: { label: 'Profile', on: 'person', off: 'person-outline' },
};

/** Floating bar with a raised, center-docked SOS action. Home · Progress | SOS | Journal · Profile. */
export function TabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeName = state.routes[state.index]?.name;
  const has = (name: string) => state.routes.some((r) => r.name === name);

  const go = (name: string) => {
    Haptics.selectionAsync().catch(() => {});
    navigation.navigate(name);
  };
  const tab = (name: string) =>
    has(name) ? <Tab name={name} focused={activeName === name} onPress={() => go(name)} /> : null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: insets.bottom + 8 }]}>
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.color.surface, borderRadius: radius.round },
          theme.mode === 'light' ? elevation.e2 : { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.hairline },
        ]}
      >
        <View style={styles.side}>
          {tab('home')}
          {tab('progress')}
        </View>
        <View style={{ width: 76 }} />
        <View style={styles.side}>
          {tab('journal')}
          {tab('profile')}
        </View>
      </View>

      <SosButton onPress={() => router.push('/sos')} />
    </View>
  );
}

function Tab({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const theme = useTheme();
  const meta = TABS[name];
  const color = focused ? theme.color.primary : theme.color.textDim;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={meta.label} style={styles.tab}>
      <Ionicons name={focused ? meta.on : meta.off} size={23} color={color} />
      <Text variant="caption" color={color} style={{ marginTop: 2, fontSize: 11 }}>
        {meta.label}
      </Text>
    </Pressable>
  );
}

function SosButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.sosWrap, anim]}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.92))}
        onPressOut={() => (scale.value = withSpring(1))}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel="SOS"
        style={[styles.sos, { backgroundColor: theme.color.accent, borderColor: theme.color.bg }, elevation.e2]}
      >
        <Ionicons name="warning" size={24} color="#FFFFFF" />
        <Text variant="caption" color="#FFFFFF" style={{ fontSize: 11, marginTop: -1 }}>
          SOS
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.lg },
  bar: { flexDirection: 'row', alignItems: 'center', height: 66, alignSelf: 'stretch', paddingHorizontal: spacing.sm },
  side: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  tab: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, flex: 1 },
  sosWrap: { position: 'absolute', bottom: 44, alignSelf: 'center' },
  sos: { width: 68, height: 68, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
});

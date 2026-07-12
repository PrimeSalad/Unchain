import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useResponsive } from '../hooks/useResponsive';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  background?: string;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /** Extra bottom padding to clear the floating tab bar + SOS button. */
  tabPadding?: boolean;
}

/**
 * Safe-area screen wrapper. Adapts gutters to device size and centers the
 * content in a capped reading column on tablets/web.
 *
 * scroll=true  → SafeAreaView + ScrollView (most screens)
 * scroll=false → SafeAreaView for top only + manual bottom inset so the
 *                content and buttons never hide behind the iOS home indicator.
 *
 * iOS layout notes
 * ────────────────
 * • The inner View on the non-scroll path uses overflow:"hidden" so that
 *   animated children (e.g. the journal slide animation) can never bleed
 *   outside the gutter on small devices like iPhone SE.
 * • hPad is applied to the inner View (not SafeAreaView) so maxWidth
 *   centering works correctly without fighting the safe-area insets.
 * • paddingHorizontal comes from useResponsive().gutter (16 on phones,
 *   20 on tablets) - never hardcoded.
 */
export function Screen({
  children,
  scroll = true,
  background,
  edges = ['top'],
  contentStyle,
  tabPadding,
}: ScreenProps) {
  const theme = useTheme();
  const { gutter, contentMax } = useResponsive();
  const insets = useSafeAreaInsets();
  const bg = background ?? theme.color.bg;

  // Horizontal padding + reading-column cap, centred on wide screens.
  const hPad: ViewStyle = {
    paddingHorizontal: gutter,
    width: '100%',
    maxWidth: contentMax + gutter * 2,
    alignSelf: 'center',
  };

  if (scroll) {
    const scrollPad: ViewStyle = {
      ...hPad,
      paddingBottom: tabPadding ? 120 : 32,
    };
    return (
      <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg }}>
        <ScrollView
          contentContainerStyle={[scrollPad, contentStyle]}
          showsVerticalScrollIndicator={false}
          style={{ alignSelf: 'stretch' }}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Non-scroll: use top-only SafeAreaView and add the bottom inset manually
  // so buttons/content are never hidden behind the iOS home indicator.
  // Math.max(insets.bottom, 16) ensures a minimum breathing room even on
  // devices with no home indicator (iPhone SE, older iPads).
  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: bg }}>
      <View
        style={[
          {
            flex: 1,
            paddingBottom: bottomInset,
            // overflow:hidden prevents animated children from painting
            // outside the screen gutter on narrow devices (iPhone SE).
            overflow: 'hidden',
          },
          hPad,
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useResponsive } from '../hooks/useResponsive';
import { useReliableSafeAreaInsets } from '../hooks/useReliableSafeAreaInsets';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  scrollRef?: React.Ref<ScrollView>;
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
 * Keyboard handling
 * ─────────────────
 * KeyboardAvoidingView is placed INSIDE SafeAreaView on both paths so it
 * only compensates for the keyboard height — never for the safe-area inset.
 * behavior="padding" on iOS pushes the content up by exactly the keyboard
 * height. keyboardVerticalOffset=0 is correct because KAV is already below
 * the safe area.
 *
 * scroll=true
 *   KAV → ScrollView.
 *   keyboardDismissMode="on-drag" dismisses the keyboard when the user scrolls.
 *   keyboardShouldPersistTaps="handled" keeps buttons tappable while the
 *   keyboard is open.
 *
 * scroll=false
 *   KAV → View. Screens that contain their own ScrollView should use
 *   the dismissal mode appropriate for their form. On iOS, "interactive"
 *   keeps focused fields reachable while the keyboard follows the drag.
 */
export function Screen({
  children,
  scroll = true,
  scrollRef,
  background,
  edges = ['top'],
  contentStyle,
  tabPadding,
}: ScreenProps) {
  const theme = useTheme();
  const { gutter, contentMax } = useResponsive();
  const insets = useReliableSafeAreaInsets();
  const bg = background ?? theme.color.bg;
  const tabClearance = Math.max(132, insets.bottom + 108);
  const pageBottomPad = Math.max(32, insets.bottom + 24);
  const containerEdges = edges.filter((edge) => edge !== 'top' && edge !== 'bottom');
  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: bg,
    paddingTop: edges.includes('top') ? insets.top : 0,
  };

  const hPad: ViewStyle = {
    paddingHorizontal: gutter,
    width: '100%',
    maxWidth: contentMax + gutter * 2,
    alignSelf: 'center',
  };

  // ── Scroll path ───────────────────────────────────────────────────────────
  if (scroll) {
    const scrollPad: ViewStyle = {
      ...hPad,
      paddingBottom: tabPadding ? tabClearance : pageBottomPad,
    };
    return (
      <SafeAreaView edges={containerEdges} style={containerStyle}>
        {/* KAV inside SafeAreaView → only keyboard height, not safe-area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[scrollPad, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={{ alignSelf: 'stretch' }}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Non-scroll path ───────────────────────────────────────────────────────
  const bottomInset = tabPadding ? tabClearance : Math.max(insets.bottom, 16);

  return (
    <SafeAreaView edges={containerEdges} style={containerStyle}>
      {/* KAV inside SafeAreaView → only keyboard height, not safe-area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            { flex: 1, paddingBottom: bottomInset, overflow: 'hidden' },
            hPad,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

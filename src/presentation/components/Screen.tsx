import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
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
 *   KAV → View with onTouchStart.
 *   onTouchStart calls Keyboard.dismiss() only when the keyboard is visible,
 *   without claiming the responder, so child TextInputs still receive taps
 *   and open the keyboard normally.
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
      paddingBottom: tabPadding ? 120 : 32,
    };
    return (
      <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg }}>
        {/* KAV inside SafeAreaView → only keyboard height, not safe-area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
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
  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: bg }}>
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
          onTouchStart={() => {
            // Fires before children claim the touch — does NOT block them.
            // Only dismisses when the keyboard is actually visible.
            if (Keyboard.isVisible()) Keyboard.dismiss();
          }}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

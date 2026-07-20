import { Platform, ScrollView, View, type ViewStyle } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { Screen } from './Screen';
import { spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

interface KeyboardFormScreenProps {
  children: React.ReactNode;
  footer: React.ReactNode;
  scrollRef?: React.Ref<ScrollView>;
  edges?: Edge[];
  contentContainerStyle?: ViewStyle;
  footerStyle?: ViewStyle;
}

/**
 * iPhone-safe form shell with one keyboard owner.
 *
 * Screen owns the sole KeyboardAvoidingView. This component supplies the
 * scrollable body and a safe-area-cleared sticky footer, so callers must not
 * add another KeyboardAvoidingView or keyboard inset adjustment.
 */
export function KeyboardFormScreen({
  children,
  footer,
  scrollRef,
  edges = ['top', 'bottom'],
  contentContainerStyle,
  footerStyle,
}: KeyboardFormScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={edges} scroll={false}>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            { paddingBottom: spacing.xl },
            contentContainerStyle,
          ]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {children}
        </ScrollView>

        <View
          style={[
            {
              flexShrink: 0,
              paddingTop: spacing.sm,
              paddingBottom: spacing.md,
              borderTopWidth: 1,
              borderTopColor: theme.color.hairline,
              backgroundColor: theme.color.bg,
            },
            footerStyle,
          ]}
        >
          {footer}
        </View>
      </View>
    </Screen>
  );
}

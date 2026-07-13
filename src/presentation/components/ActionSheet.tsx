import type { ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { elevation, radius, spacing } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** When false the scrim tap and hardware back are ignored (e.g. while a
   *  timed session is running) - the sheet's own buttons must dismiss it. */
  dismissable?: boolean;
  children: ReactNode;
}

/**
 * iOS-style bottom sheet built on a transparent Modal - pull handle, sheet
 * radius, safe-area bottom padding, scrim tap to dismiss.
 *
 * Layout note: the scrim and the sheet are SIBLINGS, not parent/child. The
 * scrim is an absolutely-filled Pressable behind a keyboard-aware sheet.
 * Wrapping the sheet in a Pressable (the old
 * pattern) nests every button inside another button, which is invalid HTML
 * on react-native-web ("<button> cannot contain a nested <button>") and
 * confuses screen readers everywhere.
 */
export function ActionSheet({
  visible,
  onClose,
  dismissable = true,
  children,
}: ActionSheetProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const requestClose = () => {
    if (!dismissable) return;
    Keyboard.dismiss();
    onClose();
  };
  const sheetMaxHeight = Math.max(
    360,
    height - insets.top - Math.max(insets.bottom, spacing.xl) - 72,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {/* Scrim - a sibling BEHIND the sheet. Taps on the sheet never reach
            it, so no tap-swallowing wrapper is needed around the content. */}
        <Pressable
          onPress={requestClose}
          accessible={false}
          importantForAccessibility="no"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.45)" },
          ]}
        />

        {/* Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          pointerEvents="box-none"
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={requestClose}
            style={{
              backgroundColor: theme.color.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              ...elevation.e2,
            }}
          >
            {/* Pull handle */}
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.color.hairline,
                alignSelf: "center",
                marginBottom: spacing.md,
              }}
            />
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              style={{ maxHeight: sheetMaxHeight }}
              contentContainerStyle={{ paddingBottom: spacing.xs }}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

import { useEffect, useRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  findNodeHandle,
  useWindowDimensions,
} from "react-native";
import { elevation, radius, spacing } from "../theme/tokens";
import { useTheme } from "../theme/ThemeProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useReliableSafeAreaInsets } from "../hooks/useReliableSafeAreaInsets";
import { Text } from "./Text";

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional built-in heading. Supplying it also gives VoiceOver a stable
   *  initial focus target when the sheet opens. */
  title?: string;
  description?: string;
  closeLabel?: string;
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
  title,
  description,
  closeLabel = "Cancel",
  dismissable = true,
  children,
}: ActionSheetProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useReliableSafeAreaInsets();
  const { height } = useWindowDimensions();
  const headingRef = useRef<View>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestClose = () => {
    if (!dismissable) return;
    Keyboard.dismiss();
    onClose();
  };
  // Constrain the whole sheet, including its safe-area padding. The previous
  // 360pt floor could exceed the usable height on landscape/small iPhones and
  // push the top of the popup off screen.
  const sheetMaxHeight = Math.max(
    1,
    height - Math.max(insets.top, spacing.lg) - spacing.lg,
  );

  useEffect(
    () => () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!visible && focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, [visible]);

  const focusHeading = () => {
    if (!title) return;
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      const node = findNodeHandle(headingRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, reduceMotion ? 0 : 60);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      statusBarTranslucent
      onRequestClose={requestClose}
      onShow={focusHeading}
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
            accessibilityLabel={title ? `${title} dialog` : "Action sheet"}
            onAccessibilityEscape={requestClose}
            style={{
              backgroundColor: theme.color.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              maxHeight: sheetMaxHeight,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
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
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: spacing.sm }}
            >
              {title ? (
                <View
                  ref={headingRef}
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={description ? `${title}. ${description}` : title}
                >
                  <Text variant="title2">{title}</Text>
                  {description ? (
                    <Text variant="footnote" dim style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
                      {description}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {children}
            </ScrollView>
            {dismissable ? (
              <Pressable
                onPress={requestClose}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                style={({ pressed }) => ({
                  minHeight: 48,
                  marginTop: spacing.xs,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.input,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.color.surfaceAlt,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Text variant="headline">{closeLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

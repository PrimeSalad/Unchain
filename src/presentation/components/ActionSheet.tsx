import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { elevation, radius, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** When false the scrim tap and hardware back are ignored (e.g. while a
   *  timed session is running) — the sheet's own buttons must dismiss it. */
  dismissable?: boolean;
  children: ReactNode;
}

/**
 * iOS-style bottom sheet built on a transparent Modal — pull handle, sheet
 * radius, safe-area bottom padding, scrim tap to dismiss. Matches the pattern
 * used by the journal-entry confirmation sheet so all sheets feel identical.
 */
export function ActionSheet({ visible, onClose, dismissable = true, children }: ActionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const requestClose = () => {
    if (dismissable) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      {/* Scrim */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={requestClose}
        accessibilityRole={dismissable ? 'button' : undefined}
        accessibilityLabel={dismissable ? 'Dismiss' : undefined}
      >
        {/* Sheet — stops tap propagation to the scrim */}
        <Pressable onPress={() => {}}>
          <View
            style={{
              backgroundColor: theme.color.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.lg,
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
                alignSelf: 'center',
                marginBottom: spacing.lg,
              }}
            />
            {children}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

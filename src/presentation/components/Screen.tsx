import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
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
 * content in a capped reading column on tablets/web (research §10.2, §8.2).
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
  const bg = background ?? theme.color.bg;

  const pad: ViewStyle = {
    paddingHorizontal: gutter,
    paddingBottom: tabPadding ? 120 : 32,
    width: '100%',
    maxWidth: contentMax + gutter * 2,
    alignSelf: 'center',
  };

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          style={{ alignSelf: 'stretch' }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

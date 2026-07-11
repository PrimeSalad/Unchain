import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';

// Any uncaught render error anywhere in the app lands on a friendly recovery
// screen instead of a crash (App Review: no unhandled exceptions).
export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Status bar text follows the RESOLVED app theme (system pref + in-app
 *  override), so forcing dark mode on a light-system device stays legible. */
function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Wait for the persisted store to rehydrate from AsyncStorage before any
 * route renders. Without this gate, app/index.tsx reads `onboarded` while it
 * is still the default `false` and cold launches race returning users onto
 * the onboarding screen. The splash stays up during the (brief) wait.
 */
function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}

export default function RootLayout() {
  const hydrated = useStoreHydrated();
  const [loaded] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  const ready = loaded && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="loading" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="sos" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen
              name="mindful-pause"
              options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
            />
            <Stack.Screen name="celebrate" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="alternatives" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="protection" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="log-urge" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="reflection" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="share" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="share-achievement" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="share-activity" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

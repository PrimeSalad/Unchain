import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, Platform, Text as NativeText, View, type AppStateStatus } from 'react-native';
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
import {
  syncPredictionNotifications,
  registerPredictionNotificationHandler,
} from '@/application/triggerPrediction';

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
    // Corrupt/blocked browser storage must not leave the root returning null
    // forever. Native hydration normally completes long before this fallback.
    const fallback = setTimeout(() => setHydrated(true), 5000);
    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, []);
  return hydrated;
}

export default function RootLayout() {
  const hydrated = useStoreHydrated();
  const [loaded, fontError] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // A font-loading failure should fall back to the system font, never a blank
  // application. This is especially important for browser URL testing.
  const ready = (loaded || fontError != null) && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Record every foreground event as the "Last Check-in" timestamp for porn
  // recovery users. Fires on cold launch and every return from background.
  const updateLastCheckedIn = useStore((s) => s.updateLastCheckedIn);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    updateLastCheckedIn();
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current !== 'active' && next === 'active') {
        updateLastCheckedIn();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [updateLastCheckedIn]);

  // ── Trigger Prediction Scheduler ──────────────────────────────────────────
  // Re-syncs notification schedule whenever the urges array changes.
  // Gracefully no-ops if expo-notifications is not installed or permission
  // is not granted. All data stays 100 % local.
  const urges = useStore((s) => s.urges);
  useEffect(() => {
    // Debounce slightly so rapid consecutive log actions don't spawn multiple
    // scheduling runs (e.g., two urges logged within the same second).
    const timer = setTimeout(() => {
      syncPredictionNotifications(urges).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [urges]);

  // Also re-sync whenever the app returns to the foreground.
  const urgesRef = useRef(urges);
  urgesRef.current = urges;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncPredictionNotifications(urgesRef.current).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  if (!ready) {
    // iOS keeps the native splash visible. Web has no equivalent guarantee,
    // so render an explicit startup state instead of a white page.
    if (Platform.OS !== 'web') return null;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1420' }}>
        <ActivityIndicator color="#B98FD6" />
        <NativeText style={{ marginTop: 12, color: '#ECE6F2', fontFamily: 'system-ui' }}>Opening Unchainly...</NativeText>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <ThemedStatusBar />
          <NotificationHandlerSetup />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="loading" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="sos"
              options={{ presentation: 'card', animation: 'fade', gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="mindful-pause"
              options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
            />
            <Stack.Screen name="celebrate" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="alternatives" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="protection" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="checkin" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="log-urge" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="porn-journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="alcohol-journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="smoke-journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="social-journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="drug-journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="game-journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="reflection" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="share"
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="share-achievement"
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="share-activity"
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="games"
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
                animationTypeForReplace: 'push',
                gestureEnabled: false,
                fullScreenGestureEnabled: false,
              }}
            />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Mounts the notification tap handler inside the navigation tree so the
 * router is available. Renders nothing - side effects only.
 */
function NotificationHandlerSetup() {
  const router = useRouter();
  useEffect(() => {
    const unsub = registerPredictionNotificationHandler(router);
    return unsub;
  // router is stable; exhaustive-deps would make this re-register on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

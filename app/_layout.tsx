import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import {
  useFonts,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '@/presentation/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const [loaded] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="loading" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="sos" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="delay" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="breathing" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="celebrate" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="log-urge" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="journal-entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="reflection" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="share" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

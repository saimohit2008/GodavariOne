import { useEffect } from 'react';
import { Platform, BackHandler } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppProvider, useApp } from '@/context/app-context';

try {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  // Safe in environments where native splash is unavailable
}

function LayoutContent() {
  const { isDark } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  // Global Android hardware back button listener
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onHardwareBack = () => {
      // 1. If stack history exists, go back within the stack
      if (router.canGoBack()) {
        router.back();
        return true;
      }

      // 2. Identify if currently on root Home screen
      const currentPath = pathname || '';
      const isRootHome =
        currentPath === '/' ||
        currentPath === '/(tabs)' ||
        currentPath === '/(tabs)/' ||
        (segments.length === 1 && segments[0] === '(tabs)');

      if (isRootHome) {
        // Allow Android to perform native exit or minimize
        return false;
      }

      // 3. For any other tab or screen without prior stack history, fallback to Home tab
      router.replace('/(tabs)');
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [router, pathname, segments]);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="category/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="emergency" options={{ headerShown: false }} />
        <Stack.Screen name="favorites" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="ghat-operations" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <LayoutContent />
    </AppProvider>
  );
}

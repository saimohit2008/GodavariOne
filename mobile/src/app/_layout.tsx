import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AppProvider, useApp } from '@/context/app-context';

if (typeof window !== 'undefined') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

function LayoutContent() {
  const { isDark } = useApp();
  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <AppProvider>
      <LayoutContent />
    </AppProvider>
  );
}

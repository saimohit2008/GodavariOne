import { version } from 'expo/package.json';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import badgeWhite from '@/assets/images/expo-badge-white.png';
import badgeDark from '@/assets/images/expo-badge.png';

export function WebBadge() {
  const scheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.versionText}>
        v{version}
      </ThemedText>
      <Image
        alt="Expo Badge"
        source={scheme === 'dark' ? badgeWhite : badgeDark}
        style={styles.badgeImage}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  versionText: {
    textAlign: 'center',
  },
  badgeImage: {
    width: 123,
    height: 24,
  },
});

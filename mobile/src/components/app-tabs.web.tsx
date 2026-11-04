import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
} from 'expo-router/ui';
import { View, StyleSheet, Text } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  const { colors } = useApp();

  const tabs = [
    { name: 'index', href: '/', label: 'Home' },
    { name: 'explore', href: '/explore', label: 'Explore' },
    { name: 'ghats', href: '/ghats', label: 'Ghats' },
    { name: 'bookings', href: '/bookings', label: 'Bookings' },
    { name: 'profile', href: '/profile', label: 'Profile' },
  ];

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList style={styles.tabListContainer}>
        <ThemedView type="backgroundElement" style={styles.innerContainer}>
          <Text style={[styles.brandText, { color: colors.primary }]}>
            Godavari One
          </Text>

          {tabs.map((tab) => (
            <TabTrigger
              key={tab.name}
              name={tab.name}
              href={tab.href as any}
              style={styles.tabButton}
            >
              <ThemedText type="smallBold" themeColor="text">
                {tab.label}
              </ThemedText>
            </TabTrigger>
          ))}
        </ThemedView>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  brandText: {
    marginRight: 'auto',
    fontWeight: '800',
    fontSize: 14,
  },
  tabButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});

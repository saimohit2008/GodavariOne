import React from 'react';
import { Image, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useApp } from '@/context/app-context';

import homeIcon from '@/assets/images/tabIcons/home.png';
import exploreIcon from '@/assets/images/tabIcons/explore.png';
import ghatsIcon from '@/assets/images/tabIcons/ghats.png';
import bookingsIcon from '@/assets/images/tabIcons/bookings.png';
import profileIcon from '@/assets/images/tabIcons/profile.png';

export default function AppTabs() {
  const { colors, t } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 86 : 62,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home') || 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Image
              alt="Home tab"
              source={homeIcon}
              style={[
                styles.icon,
                { tintColor: color, opacity: focused ? 1 : 0.8 },
              ]}
              resizeMode="contain"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: t('explore') || 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <Image
              alt="Explore tab"
              source={exploreIcon}
              style={[
                styles.icon,
                { tintColor: color, opacity: focused ? 1 : 0.8 },
              ]}
              resizeMode="contain"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="ghats"
        options={{
          title: t('ghats') || 'Ghats',
          tabBarIcon: ({ color, focused }) => (
            <Image
              alt="Ghats tab"
              source={ghatsIcon}
              style={[
                styles.icon,
                { tintColor: color, opacity: focused ? 1 : 0.8 },
              ]}
              resizeMode="contain"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="bookings"
        options={{
          title: t('bookings') || 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <Image
              alt="Bookings tab"
              source={bookingsIcon}
              style={[
                styles.icon,
                { tintColor: color, opacity: focused ? 1 : 0.8 },
              ]}
              resizeMode="contain"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile') || 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Image
              alt="Profile tab"
              source={profileIcon}
              style={[
                styles.icon,
                { tintColor: color, opacity: focused ? 1 : 0.8 },
              ]}
              resizeMode="contain"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 22,
    height: 22,
  },
});

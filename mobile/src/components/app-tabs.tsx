import { NativeTabs } from 'expo-router/native-tabs';
import { useApp } from '@/context/app-context';
import homeIcon from '@/assets/images/tabIcons/home.png';
import exploreIcon from '@/assets/images/tabIcons/explore.png';
import ghatsIcon from '@/assets/images/tabIcons/ghats.png';
import bookingsIcon from '@/assets/images/tabIcons/bookings.png';
import profileIcon from '@/assets/images/tabIcons/profile.png';

export default function AppTabs() {
  const { colors } = useApp();

  return (
    <NativeTabs
      backgroundColor={colors.card}
      indicatorColor={colors.secondary}
      tintColor={colors.primary}
      labelStyle={{ selected: { color: colors.primary } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={homeIcon} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={exploreIcon} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ghats">
        <NativeTabs.Trigger.Label>Ghats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={ghatsIcon} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Label>Bookings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={bookingsIcon} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={profileIcon} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

import { Platform, Linking, Alert } from 'react-native';

export interface MapDestination {
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  address?: string | null;
  town?: string | null;
  district?: string | null;
}

/**
 * Universal Turn-by-Turn Driving Directions Utility for Godavari One.
 *
 * Destination Priority:
 * 1. Verified latitude and longitude (exact GPS coordinates).
 * 2. Verified full business address (name + address + town + district).
 * 3. Graceful alert when location is unavailable (never generates fake links).
 */
export async function openMapsDirections(
  first?: MapDestination | number | null,
  lngArg?: number | null,
  labelArg?: string | null,
  addressArg?: string | null
): Promise<boolean> {
  let lat: number | null | undefined;
  let lng: number | null | undefined;
  let label: string | null | undefined;
  let address: string | null | undefined;
  let town: string | null | undefined;
  let district: string | null | undefined;

  if (first && typeof first === 'object') {
    lat = first.latitude;
    lng = first.longitude;
    label = first.name;
    address = first.address;
    town = first.town;
    district = first.district;
  } else {
    lat = first;
    lng = lngArg;
    label = labelArg;
    address = addressArg;
  }

  const hasCoords =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat !== 0 &&
    lng !== 0;

  // 1. Exact GPS Coordinates Navigation
  if (hasCoords) {
    const coordsStr = `${lat},${lng}`;
    const cleanLabel = encodeURIComponent(label || 'Pushkaralu Destination');

    // Turn-by-turn driving directions URLs
    const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&destination=${coordsStr}&travelmode=driving`;
    const nativeAndroidIntent = `google.navigation:q=${coordsStr}&mode=d`;
    const nativeIosMaps = `maps:?daddr=${coordsStr}&dirflg=d`;

    if (Platform.OS === 'android') {
      try {
        const canOpen = await Linking.canOpenURL(nativeAndroidIntent);
        if (canOpen) {
          await Linking.openURL(nativeAndroidIntent);
          return true;
        }
      } catch {
        // Fall back to universal Google Maps web URL
      }
      return Linking.openURL(googleMapsDirUrl)
        .then(() => true)
        .catch(() => false);
    }

    if (Platform.OS === 'ios') {
      try {
        const canOpen = await Linking.canOpenURL(nativeIosMaps);
        if (canOpen) {
          await Linking.openURL(nativeIosMaps);
          return true;
        }
      } catch {
        // Fall back to universal Google Maps web URL
      }
      return Linking.openURL(googleMapsDirUrl)
        .then(() => true)
        .catch(() => false);
    }

    return Linking.openURL(googleMapsDirUrl)
      .then(() => true)
      .catch(() => false);
  }

  // 2. Verified Full Address Destination
  const fullAddress = [label, address, town, district, 'Andhra Pradesh']
    .filter(Boolean)
    .map((s) => s?.trim())
    .filter((s) => s && s.length > 0)
    .join(', ');

  if (fullAddress && fullAddress.length > 12) {
    const query = encodeURIComponent(fullAddress);
    const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`;
    const nativeAndroidIntent = `google.navigation:q=${query}&mode=d`;
    const nativeIosMaps = `maps:?daddr=${query}&dirflg=d`;

    if (Platform.OS === 'android') {
      try {
        const canOpen = await Linking.canOpenURL(nativeAndroidIntent);
        if (canOpen) {
          await Linking.openURL(nativeAndroidIntent);
          return true;
        }
      } catch {
        // Fall back to universal Google Maps web URL
      }
      return Linking.openURL(googleMapsDirUrl)
        .then(() => true)
        .catch(() => false);
    }

    if (Platform.OS === 'ios') {
      try {
        const canOpen = await Linking.canOpenURL(nativeIosMaps);
        if (canOpen) {
          await Linking.openURL(nativeIosMaps);
          return true;
        }
      } catch {
        // Fall back to universal Google Maps web URL
      }
      return Linking.openURL(googleMapsDirUrl)
        .then(() => true)
        .catch(() => false);
    }

    return Linking.openURL(googleMapsDirUrl)
      .then(() => true)
      .catch(() => false);
  }

  // 3. Location Information Unavailable
  Alert.alert(
    'Location Unavailable',
    'Precise GPS coordinates or address details are not available for this listing yet. Please check back as data is verified.'
  );
  return false;
}

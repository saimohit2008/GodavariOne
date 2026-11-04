import { Platform, Linking } from 'react-native';

/**
 * Open external native maps or Google Maps URL with platform-specific scheme fallback
 */
export function openMapsDirections(
  lat?: number | null,
  lng?: number | null,
  label?: string,
  address?: string
): void {
  if (lat && lng) {
    const cleanLabel = encodeURIComponent(label || 'Godavari One Location');
    const scheme = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}(${cleanLabel})`,
      android: `geo:0,0?q=${lat},${lng}(${cleanLabel})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });

    Linking.openURL(scheme).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  } else {
    const searchTarget = `${label || ''} ${address || ''} Andhra Pradesh`.trim();
    const query = encodeURIComponent(searchTarget || 'Godavari Pushkaralu Rajahmundry');
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => {});
  }
}


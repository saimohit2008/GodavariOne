// mobile/src/services/api-url.ts
// Pure URL resolution utilities for Godavari One Mobile
// Provides host isolation, LAN IP synchronization, and production HTTPS preservation.

export const DEV_LAN_IP = '192.168.137.1';

/**
 * Determines whether a URL or hostname points to a private development environment
 * (localhost, loopback, emulator alias, or RFC 1918 private IPv4 addresses).
 * Public production URLs (including https://*.vercel.app, https://*.supabase.co, etc.) return false.
 */
export function isPrivateOrDevHost(urlOrHost?: string | null): boolean {
  if (!urlOrHost || typeof urlOrHost !== 'string') return false;
  const trimmed = urlOrHost.trim().toLowerCase();

  let hostname = trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      hostname = parsed.hostname.toLowerCase();
    } catch {
      const match = trimmed.match(/^https?:\/\/([^/:]+)/i);
      if (match) hostname = match[1].toLowerCase();
    }
  } else {
    hostname = trimmed.split(':')[0].toLowerCase();
  }

  // 1. Loopback and Android Emulator aliases
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '10.0.2.2'
  ) {
    return true;
  }

  // 2. RFC 1918 Private IPv4 address ranges
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  // 3. mDNS local network domains
  if (hostname.endsWith('.local')) {
    return true;
  }

  return false;
}

/**
 * Pure resolver for the API base URL supporting testability and safe host isolation.
 */
export function resolveApiBaseUrl(options?: {
  envUrl?: string | null;
  devHost?: string | null;
  platform?: string;
  windowOrigin?: string | null;
  windowPort?: string | null;
}): string {
  const envUrl = options?.envUrl;
  const devHost = options?.devHost || DEV_LAN_IP;
  const platform = options?.platform || 'android';

  // Web platform resolution
  if (platform === 'web') {
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
      const trimmed = envUrl.trim().replace(/\/+$/, '');
      if (!isPrivateOrDevHost(trimmed)) {
        return trimmed;
      }
    }

    const origin = options?.windowOrigin;
    const port = options?.windowPort;

    if (origin) {
      if (port === '3000' || origin.includes(':3000')) {
        return `${origin}/api/v1`;
      }
      return `${origin}/api/v1`;
    }

    return 'http://localhost:3000/api/v1';
  }

  // Native Android and iOS
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    let resolved = envUrl.trim().replace(/\/+$/, '');

    // PRESERVE PRODUCTION HTTPS URLS:
    // If the configured URL is a public/production URL (HTTPS, public domain, Vercel, etc.),
    // NEVER overwrite it with the local development host.
    if (!isPrivateOrDevHost(resolved)) {
      return resolved;
    }

    // Only apply LAN IP substitution when the configured URL is an explicit private/dev host
    if (devHost && devHost !== 'localhost' && devHost !== '127.0.0.1') {
      resolved = resolved.replace(/https?:\/\/[^/:]+(:[0-9]+)?/, (match, port) => {
        const portStr = port || ':3000';
        return `http://${devHost}${portStr}`;
      });
    }

    if (platform === 'android' && (devHost === 'localhost' || devHost === '127.0.0.1')) {
      resolved = resolved.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
    }

    return resolved;
  }

  if (platform === 'android' && (devHost === 'localhost' || devHost === '127.0.0.1')) {
    return 'http://10.0.2.2:3000/api/v1';
  }

  return `http://${devHost}:3000/api/v1`;
}

/**
 * Pure helper to resolve image URLs against an API base URL or web origin.
 */
export function resolveImageUrlWithBase(
  url: string | null | undefined,
  apiBaseUrl: string,
  isWeb = false,
  windowOrigin?: string | null
): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (isWeb && windowOrigin) {
    return `${windowOrigin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  }
  const base = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}


// Godavari One Mobile — API Integration Service
// Communicates directly with the existing Next.js backend under /api/v1.
// Transparently handles network connection states and database snapshot fallbacks.

import {
  ListingItem,
  AnnouncementItem,
  CarouselBannerItem,
  HeroSettings,
  HomepageData,
  AuthUser,
  PriorityBookingItem,
  HotelBookingItem,
  RestaurantBookingItem,
  AccommodationBookingItem,
} from '../types';
import {
  AUTHENTIC_ANNOUNCEMENTS,
  AUTHENTIC_CAROUSEL_BANNERS,
  AUTHENTIC_PUBLISHED_LISTINGS,
} from './mock-data';
import {
  cacheListings,
  getCachedListings,
  cacheBookings,
  getCachedBookings,
  getSecureItem,
  setSecureItem,
  removeSecureItem,
  AUTH_TOKEN_KEY,
} from '../lib/storage';

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEV_LAN_IP = '192.168.137.1';

/**
 * Dynamically resolves the development host IP address.
 * Prioritizes the active Expo Metro bundler hostUri that served the app bundle,
 * automatically adapting to Windows Hotspot, LAN Wi-Fi reassignments, and Android emulators.
 */
export function getDynamicDevHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).experienceUrl;

  if (hostUri && typeof hostUri === 'string') {
    const candidate = hostUri.split(':')[0];
    if (candidate && candidate !== 'localhost' && candidate !== '127.0.0.1') {
      return candidate;
    }
  }

  return DEV_LAN_IP;
}

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  const devHost = getDynamicDevHost();

  // Web platform resolution
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      if (window.location.port !== '3000') {
        return `http://${window.location.hostname}:3000/api/v1`;
      }
      return `${window.location.origin}/api/v1`;
    }
    return 'http://localhost:3000/api/v1';
  }

  // Native Android and iOS
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    let resolved = envUrl.trim().replace(/\/+$/, '');

    // Synchronize hardcoded LAN IPs with active devHost that served the bundle
    if (devHost && devHost !== 'localhost' && devHost !== '127.0.0.1') {
      resolved = resolved.replace(/https?:\/\/[^/:]+(:[0-9]+)?/, (match, port) => {
        const portStr = port || ':3000';
        return `http://${devHost}${portStr}`;
      });
    }

    if (Platform.OS === 'android' && (devHost === 'localhost' || devHost === '127.0.0.1')) {
      resolved = resolved.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
    }

    return resolved;
  }

  if (Platform.OS === 'android') {
    return `http://${devHost}:3000/api/v1`;
  }

  return `http://${devHost}:3000/api/v1`;
}

export function resolveImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  }
  const base = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

const REQUEST_TIMEOUT_MS = 6000;

async function fetchWithTimeout(
  url: string,
  timeout = REQUEST_TIMEOUT_MS,
  options?: RequestInit,
  retries = 1
): Promise<Response> {
  const isGet = !options?.method || options.method === 'GET';
  let lastErr: any;

  for (let attempt = 0; attempt <= (isGet ? retries : 0); attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const extraHeaders: Record<string, string> = {
        'X-Godavari-Client': 'godavari-mobile-native-v1',
      };
      if (Platform.OS !== 'web') {
        extraHeaders['X-Client-Platform'] = 'native';
      } else {
        extraHeaders['X-Client-Platform'] = 'mobile-web';
      }
      try {
        const token = await getSecureItem(AUTH_TOKEN_KEY);
        if (token) {
          extraHeaders['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // safe fallback if storage unreadable
      }

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...extraHeaders,
          ...(options?.headers || {}),
        },
      });
      clearTimeout(timer);
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      if (!isGet || attempt >= retries) break;
    }
  }

  if (
    lastErr?.name === 'AbortError' ||
    lastErr?.message?.includes('aborted') ||
    lastErr?.message?.includes('canceled')
  ) {
    throw new Error(`Request timed out after ${timeout}ms: ${url}`);
  }
  throw lastErr;
}

export interface ApiResponse<T> {
  data: T;
  isLive: boolean;
  error?: string | null;
}

export interface GetListingsParams {
  category?: string;
  q?: string;
  district?: string;
  town?: string;
  accessibility?: boolean | string;
  crowdStatus?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  verifiedOnly?: boolean;
  foodType?: string;
  transportType?: string;
  limit?: number;
  page?: number;
}

/**
 * Fetch all published listings or filtered by category/query/filters/sort
 */
export async function getListings(params?: GetListingsParams): Promise<ApiResponse<ListingItem[]>> {
  const baseUrl = getApiBaseUrl();
  const searchParams = new URLSearchParams();
  if (params?.category && params.category !== 'ALL') {
    searchParams.set('category', params.category);
  }
  if (params?.q && params.q.trim()) {
    searchParams.set('q', params.q.trim());
  }
  if (params?.district && params.district !== 'ALL') {
    searchParams.set('district', params.district);
  }
  if (params?.town && params.town !== 'ALL') {
    searchParams.set('town', params.town);
  }
  if (params?.accessibility) {
    searchParams.set('accessibility', 'true');
  }
  if (params?.crowdStatus && params.crowdStatus !== 'ALL') {
    searchParams.set('crowdStatus', params.crowdStatus);
  }
  if (params?.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }
  if (params?.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder);
  }
  if (params?.limit) {
    searchParams.set('limit', String(params.limit));
  }
  if (params?.page) {
    searchParams.set('page', String(params.page));
  }

  const url = `${baseUrl}/listings${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const json = await res.json();
    let items: ListingItem[] = Array.isArray(json.items) ? json.items : [];

    // Client-side attribute refinement if needed
    if (params?.verifiedOnly) {
      items = items.filter((item) => item.locationVerified || item.publicationStatus === 'PUBLISHED');
    }
    if (params?.foodType && params.foodType !== 'ALL') {
      items = items.filter((item) => (item.restaurant as any)?.foodType === params.foodType);
    }
    if (params?.transportType && params.transportType !== 'ALL') {
      items = items.filter((item) => (item as any)?.transport?.transportType === params.transportType);
    }

    if (!params?.q && (!params?.category || params.category === 'ALL')) {
      cacheListings(items);
    }

    return {
      data: items,
      isLive: true,
    };
  } catch (err: any) {
    // Return cached listings or authentic database snapshot filtered by user params
    const cached = getCachedListings();
    let fallback = cached && cached.length > 0 ? [...cached] : [...AUTHENTIC_PUBLISHED_LISTINGS];
    if (params?.category && params.category !== 'ALL') {
      fallback = fallback.filter((item) => item.category === params.category);
    }
    if (params?.q && params.q.trim()) {
      const qLower = params.q.trim().toLowerCase();
      fallback = fallback.filter(
        (item) =>
          item.name.toLowerCase().includes(qLower) ||
          item.description.toLowerCase().includes(qLower) ||
          item.address.toLowerCase().includes(qLower) ||
          (item.town && item.town.toLowerCase().includes(qLower)) ||
          (item.district && item.district.toLowerCase().includes(qLower))
      );
    }
    if (params?.town && params.town !== 'ALL') {
      fallback = fallback.filter((item) => item.town === params.town || item.address.includes(params.town!));
    }
    if (params?.district && params.district !== 'ALL') {
      fallback = fallback.filter((item) => item.district === params.district);
    }
    if (params?.crowdStatus && params.crowdStatus !== 'ALL') {
      fallback = fallback.filter((item) => item.ghat?.currentCrowdStatus === params.crowdStatus);
    }
    if (params?.accessibility) {
      fallback = fallback.filter((item) => (item as any).accessibility != null);
    }
    if (params?.verifiedOnly) {
      fallback = fallback.filter((item) => item.locationVerified || item.publicationStatus === 'PUBLISHED');
    }
    if (params?.sortBy === 'name') {
      fallback.sort((a, b) =>
        params.sortOrder === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
      );
    }
    if (params?.limit) {
      fallback = fallback.slice(0, params.limit);
    }
    return {
      data: fallback,
      isLive: false,
      error: `Could not reach ${baseUrl}. Displaying local database snapshot.`,
    };
  }
}

/**
 * Fetch a single listing by its unique ID
 */
export async function getListingById(id: string): Promise<ApiResponse<ListingItem | null>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/listings/${encodeURIComponent(id)}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      if (res.status === 404) {
        return { data: null, isLive: true, error: 'Listing not found' };
      }
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const item = await res.json();
    return {
      data: item,
      isLive: true,
    };
  } catch (err: any) {
    // Look up in authentic published snapshot
    const fallback = AUTHENTIC_PUBLISHED_LISTINGS.find((l) => l.id === id) || null;
    return {
      data: fallback,
      isLive: false,
      error: fallback ? `Using offline snapshot for ${id}` : 'Listing not found',
    };
  }
}

/**
 * Fetch ghat listings from /api/v1/listings?category=GHAT
 */
export async function getGhats(params?: {
  crowdStatus?: string;
}): Promise<ApiResponse<ListingItem[]>> {
  const res = await getListings({ category: 'GHAT' });
  if (params?.crowdStatus) {
    return {
      ...res,
      data: res.data.filter((item) => item.ghat?.currentCrowdStatus === params.crowdStatus),
    };
  }
  return res;
}

/**
 * Fetch sliding carousel banners from /api/v1/carousel
 */
export async function getCarouselBanners(): Promise<ApiResponse<CarouselBannerItem[]>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/carousel`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const json = await res.json();
    const items: CarouselBannerItem[] = Array.isArray(json.items) ? json.items : [];
    return {
      data: items.length > 0 ? items : AUTHENTIC_CAROUSEL_BANNERS,
      isLive: true,
    };
  } catch {
    return {
      data: AUTHENTIC_CAROUSEL_BANNERS,
      isLive: false,
      error: `Unable to connect to ${baseUrl}/carousel`,
    };
  }
}

/**
 * Fetch full homepage aggregated data matching website home-view.tsx
 */
export async function getHomepageData(): Promise<HomepageData> {
  const baseUrl = getApiBaseUrl();
  const homepageContentUrl = `${baseUrl}/homepage-content`;

  try {
    const [homepageResult, carouselResult, listingsResult] = await Promise.allSettled([
      fetchWithTimeout(homepageContentUrl),
      fetchWithTimeout(`${baseUrl}/carousel`),
      fetchWithTimeout(`${baseUrl}/listings?limit=24`),
    ]);

    let homepageJson: any = null;
    let carouselJson: any = { items: [] };
    let listingsJson: any = { items: [] };

    let atLeastOneSuccess = false;

    if (homepageResult.status === 'fulfilled' && homepageResult.value.ok) {
      homepageJson = await homepageResult.value.json().catch(() => null);
      atLeastOneSuccess = true;
    }

    if (carouselResult.status === 'fulfilled' && carouselResult.value.ok) {
      carouselJson = await carouselResult.value.json().catch(() => ({ items: [] }));
    }

    if (listingsResult.status === 'fulfilled' && listingsResult.value.ok) {
      listingsJson = await listingsResult.value.json().catch(() => ({ items: [] }));
      atLeastOneSuccess = true;
    }

    if (!atLeastOneSuccess) {
      throw new Error(`Failed to reach backend API at ${baseUrl}`);
    }

    const sections = Array.isArray(homepageJson?.sections) ? homepageJson.sections : [];
    const items = Array.isArray(homepageJson?.items) ? homepageJson.items : [];
    const allListings: ListingItem[] = Array.isArray(listingsJson?.items) && listingsJson.items.length > 0
      ? listingsJson.items
      : AUTHENTIC_PUBLISHED_LISTINGS;

    // Cache latest live listings into offline storage
    if (Array.isArray(listingsJson?.items) && listingsJson.items.length > 0) {
      cacheListings(listingsJson.items);
    }

    // Extract Hero settings
    const heroSection = sections.find((s: any) => s.id === 'hero');
    let heroSettings: HeroSettings | undefined;
    if (heroSection?.settings) {
      try {
        heroSettings = typeof heroSection.settings === 'string'
          ? JSON.parse(heroSection.settings)
          : heroSection.settings;
      } catch {
        heroSettings = undefined;
      }
    }

    const announcements: AnnouncementItem[] = items
      .filter((i: any) => i.section === 'ANNOUNCEMENT' || i.section === 'PROMO_BANNER')
      .map((i: any) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        badgeText: i.badgeText,
        destinationUrl: i.destinationUrl,
        buttonText: i.buttonText,
      }));

    const carouselBanners: CarouselBannerItem[] = Array.isArray(carouselJson.items) && carouselJson.items.length > 0
      ? carouselJson.items
      : AUTHENTIC_CAROUSEL_BANNERS;

    const ghats = allListings.filter((l) => l.category === 'GHAT');
    const freeAccommodationListings = allListings.filter((l) => l.category === 'FREE_ACCOMMODATION');
    const annadanamListings = allListings.filter((l) => l.category === 'ANNADANAM');

    console.log('[API] getHomepageData SUCCESS! Loaded live data:', {
      announcements: announcements.length,
      carousel: carouselBanners.length,
      listings: allListings.length,
    });
    return {
      announcements: announcements.length > 0 ? announcements : AUTHENTIC_ANNOUNCEMENTS,
      carouselBanners,
      heroSettings,
      featuredListings: allListings,
      ghats,
      freeAccommodationListings,
      annadanamListings,
      isLive: true,
      apiUrl: baseUrl,
    };
  } catch (err: any) {
    console.warn('[API] getHomepageData fallback to cached data:', err?.message || err);
    // Offline / unreachable fallback using authentic database snapshot
    const allListings = AUTHENTIC_PUBLISHED_LISTINGS;
    return {
      announcements: AUTHENTIC_ANNOUNCEMENTS,
      carouselBanners: AUTHENTIC_CAROUSEL_BANNERS,
      heroSettings: {
        heroTitle: 'Welcome to Godavari One',
        heroSubtitle:
          'Your complete guide to Godavari Pushkaralu 2027 — ghats, stay, food, transport and emergency services in one place.',
        tagline: 'Godavari Pushkaralu 2027 · Digital Platform',
        showStatue: true,
        statueImageUrl: '/uploads/1792288701815-73f89477df61cc5796c9dd18.jpg',
        statueAlt: 'Goddess Godavari Devi authentic statue with flower garlands and decorative base',
        statueGlow: true,
        statueAlignment: 'right',
        searchBarVisible: true,
      },
      featuredListings: allListings,
      ghats: allListings.filter((l) => l.category === 'GHAT'),
      freeAccommodationListings: allListings.filter((l) => l.category === 'FREE_ACCOMMODATION'),
      annadanamListings: allListings.filter((l) => l.category === 'ANNADANAM'),
      isLive: false,
      apiUrl: baseUrl,
      connectionError: `Unable to connect to backend at ${baseUrl}. Showing local database snapshot.`,
    };
  }
}

export const getHomepageContent = getHomepageData;

/**
 * Fetch current authenticated user session from /api/v1/auth/me
 */
export async function getCurrentUser(): Promise<ApiResponse<AuthUser | null>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/me`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { data: null, isLive: true, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    return {
      data: json.data?.user || json.user || null,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Could not reach authentication service',
    };
  }
}

/**
 * Log in with mobile number and password via POST /api/v1/auth/login
 */
export async function loginWithPhone(
  phone: string,
  password: string
): Promise<ApiResponse<AuthUser | null>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/login`;
  try {
    const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Login failed. Please check credentials.',
      };
    }
    const user = json.data?.user || json.data || json.user || null;
    const token = json.data?.token || json.token || null;
    if (token) {
      try {
        await setSecureItem(AUTH_TOKEN_KEY, token);
      } catch (e) {
        console.warn('[Auth] Failed to persist secure token:', e);
      }
    }
    return {
      data: user,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error during login',
    };
  }
}

/**
 * Register a new visitor account via POST /api/v1/auth/register
 */
export async function registerWithPhone(payload: {
  phone: string;
  password: string;
  confirmPassword?: string;
  name?: string;
  email?: string;
}): Promise<ApiResponse<AuthUser | null>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/register`;
  try {
    const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Registration failed.',
      };
    }
    const user = json.data?.user || json.data || json.user || null;
    const token = json.data?.token || json.token || null;
    if (token) {
      try {
        await setSecureItem(AUTH_TOKEN_KEY, token);
      } catch (e) {
        console.warn('[Auth] Failed to persist secure token:', e);
      }
    }
    return {
      data: user,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error during registration',
    };
  }
}

/**
 * Request an Email OTP code via POST /api/v1/auth/email/request
 */
export async function requestEmailOtp(email: string): Promise<ApiResponse<{ message?: string }>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/email/request`;
  try {
    const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null as any,
        isLive: true,
        error: json.error || json.message || 'Failed to send verification code',
      };
    }
    return {
      data: json.data || json,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null as any,
      isLive: false,
      error: err?.message || 'Network error sending verification code',
    };
  }
}

/**
 * Verify Email OTP code and authenticate session via POST /api/v1/auth/email/verify
 */
export async function verifyEmailOtp(
  email: string,
  code: string
): Promise<ApiResponse<AuthUser | null>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/email/verify`;
  try {
    const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Invalid or expired code',
      };
    }
    const user = json.data?.user || json.data || json.user || null;
    const token = json.data?.token || json.token || null;
    if (token) {
      try {
        await setSecureItem(AUTH_TOKEN_KEY, token);
      } catch (e) {
        console.warn('[Auth] Failed to persist secure token:', e);
      }
    }
    return {
      data: user,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error verifying code',
    };
  }
}

/**
 * Log out user session via POST /api/v1/auth/logout
 */
export async function logoutUser(): Promise<ApiResponse<boolean>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/logout`;
  try {
    const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS, {
      method: 'POST',
    });
    try {
      await removeSecureItem(AUTH_TOKEN_KEY);
    } catch {}
    return {
      data: res.ok,
      isLive: true,
    };
  } catch (err: any) {
    try {
      await removeSecureItem(AUTH_TOKEN_KEY);
    } catch {}
    return {
      data: false,
      isLive: false,
      error: err?.message || 'Failed to logout',
    };
  }
}

/**
 * Fetch user's priority ghat bookings from /api/v1/priority-bookings
 */
export async function getPriorityBookings(): Promise<ApiResponse<PriorityBookingItem[]>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/priority-bookings`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { data: [], isLive: true, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    const items = json.data?.items || json.items || [];
    cacheBookings(items);
    return {
      data: items,
      isLive: true,
    };
  } catch (err: any) {
    const cached = getCachedBookings();
    return {
      data: cached || [],
      isLive: false,
      error: err?.message || 'Unable to load priority bookings',
    };
  }
}

/**
 * Submit priority ghat booking application via POST /api/v1/priority-bookings
 */
export async function submitPriorityBooking(formData: FormData): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/priority-bookings`;
  try {
    const res = await fetchWithTimeout(url, 15000, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Booking submission failed.',
      };
    }
    return {
      data: json.data || json,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error submitting application',
    };
  }
}

/**
 * Cancel a priority ghat booking application via PATCH /api/v1/priority-bookings/[id]
 */
export async function cancelPriorityBooking(
  bookingId: string,
  cancellationReason?: string
): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/priority-bookings/${encodeURIComponent(bookingId)}`;
  try {
    const res = await fetchWithTimeout(url, 12000, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CANCEL',
        cancellationReason: cancellationReason || 'Cancelled by pilgrim via mobile app',
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Failed to cancel booking',
      };
    }
    return {
      data: json.data || json,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error cancelling booking',
    };
  }
}

/**
 * Fetch authenticated user's hotel room reservations via GET /api/v1/bookings/hotel
 */
export async function getHotelBookings(): Promise<ApiResponse<HotelBookingItem[]>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/hotel`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { data: [], isLive: true, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    const items: HotelBookingItem[] = json.data?.items || json.items || [];
    return { data: items, isLive: true };
  } catch (err: any) {
    return {
      data: [],
      isLive: false,
      error: err?.message || 'Unable to load hotel bookings',
    };
  }
}

/**
 * Create a new hotel room booking via POST /api/v1/bookings/hotel
 */
export async function createHotelBooking(data: {
  listingId: string;
  roomId?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms?: number;
  adults?: number;
  children?: number;
  specialRequest?: string;
}): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/hotel`;
  try {
    const res = await fetchWithTimeout(url, 15000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Hotel booking failed',
      };
    }
    return { data: json.data || json, isLive: true };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error submitting hotel booking',
    };
  }
}

/**
 * Cancel a hotel booking via PATCH /api/v1/bookings/hotel/[id]
 */
export async function cancelHotelBooking(id: string): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/hotel/${encodeURIComponent(id)}`;
  try {
    const res = await fetchWithTimeout(url, 12000, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Failed to cancel hotel booking',
      };
    }
    return { data: json.data || json, isLive: true };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error cancelling hotel booking',
    };
  }
}

/**
 * Fetch authenticated user's restaurant table reservations via GET /api/v1/bookings/restaurant
 */
export async function getRestaurantBookings(): Promise<ApiResponse<RestaurantBookingItem[]>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/restaurant`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { data: [], isLive: true, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    const items: RestaurantBookingItem[] = json.data?.items || json.items || [];
    return { data: items, isLive: true };
  } catch (err: any) {
    return {
      data: [],
      isLive: false,
      error: err?.message || 'Unable to load restaurant bookings',
    };
  }
}

/**
 * Create a restaurant table reservation via POST /api/v1/bookings/restaurant
 */
export async function createRestaurantBooking(data: {
  listingId: string;
  bookingDate: string;
  timeSlot: string;
  peopleCount: number;
  specialRequest?: string;
}): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/restaurant`;
  try {
    const res = await fetchWithTimeout(url, 15000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Restaurant reservation failed',
      };
    }
    return { data: json.data || json, isLive: true };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error reserving restaurant table',
    };
  }
}

/**
 * Cancel a restaurant reservation via PATCH /api/v1/bookings/restaurant/[id]
 */
export async function cancelRestaurantBooking(id: string): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/restaurant/${encodeURIComponent(id)}`;
  try {
    const res = await fetchWithTimeout(url, 12000, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Failed to cancel restaurant booking',
      };
    }
    return { data: json.data || json, isLive: true };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error cancelling restaurant booking',
    };
  }
}

/**
 * Fetch authenticated user's free pilgrim accommodation stays via GET /api/v1/bookings/accommodation
 */
export async function getAccommodationBookings(): Promise<ApiResponse<AccommodationBookingItem[]>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/accommodation`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { data: [], isLive: true, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    const items: AccommodationBookingItem[] = json.data?.items || json.items || [];
    return { data: items, isLive: true };
  } catch (err: any) {
    return {
      data: [],
      isLive: false,
      error: err?.message || 'Unable to load accommodation bookings',
    };
  }
}

/**
 * Register free pilgrim stay via POST /api/v1/bookings/accommodation
 */
export async function createAccommodationBooking(data: {
  listingId: string;
  checkInDate: string;
  checkOutDate: string;
  peopleCount: number;
  groupType: 'FAMILY' | 'MEN' | 'WOMEN' | 'MIXED';
  guestName: string;
  guestPhone: string;
  idProofType?: string;
  idProofNumber?: string;
  specialNotes?: string;
}): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/accommodation`;
  try {
    const res = await fetchWithTimeout(url, 15000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Free accommodation registration failed',
      };
    }
    return { data: json.data || json, isLive: true };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error registering accommodation',
    };
  }
}

/**
 * Cancel a free accommodation booking via PATCH /api/v1/bookings/accommodation
 */
export async function cancelAccommodationBooking(id: string): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/accommodation`;
  try {
    const res = await fetchWithTimeout(url, 12000, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id, status: 'CANCELLED' }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Failed to cancel accommodation registration',
      };
    }
    return { data: json.data || json, isLive: true };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error cancelling accommodation registration',
    };
  }
}

/**
 * Verify entry via QR scan token or application number (POST /api/v1/priority-bookings/verify-qr)
 */
export async function verifyPriorityPass(params: {
  token?: string;
  applicationNumber?: string;
  manualNotes?: string;
}): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/priority-bookings/verify-qr`;
  try {
    const res = await fetchWithTimeout(url, 15000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Verification failed.',
      };
    }
    return {
      data: json.data || json,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error verifying pass',
    };
  }
}

/**
 * Fetch notifications from /api/v1/notifications
 */
export async function getNotifications(unreadOnly = false): Promise<ApiResponse<{ items: any[]; unread: number }>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/notifications${unreadOnly ? '?unread=true' : ''}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { data: { items: [], unread: 0 }, isLive: true, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    const data = json.data || json || { items: [], unread: 0 };
    return {
      data: {
        items: data.items || [],
        unread: typeof data.unread === 'number' ? data.unread : 0,
      },
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: { items: [], unread: 0 },
      isLive: false,
      error: err?.message || 'Unable to load notifications',
    };
  }
}

/**
 * Mark notification(s) as read via PATCH /api/v1/notifications
 */
export async function markNotificationsRead(params: { id?: string; all?: boolean }): Promise<ApiResponse<boolean>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/notifications`;
  try {
    const res = await fetchWithTimeout(url, 10000, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    return {
      data: res.ok,
      isLive: true,
      error: res.ok ? undefined : json.error || 'Failed to update notifications',
    };
  } catch (err: any) {
    return {
      data: false,
      isLive: false,
      error: err?.message || 'Network error updating notifications',
    };
  }
}

/**
 * Update ghat crowd status via PATCH /api/v1/ghats/[id]/status (Supervisors / Admins)
 */
export async function updateGhatCrowdStatus(
  ghatId: string,
  crowdStatus: 'FREE' | 'MODERATE' | 'CROWDED' | 'CLOSED' | 'OVERCROWDED' | 'EMERGENCY',
  notes?: string
): Promise<ApiResponse<any>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/ghats/${encodeURIComponent(ghatId)}/status`;
  try {
    const res = await fetchWithTimeout(url, 15000, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crowdStatus, notes }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        isLive: true,
        error: json.error || json.message || 'Failed to update crowd status',
      };
    }
    return {
      data: json.data || json,
      isLive: true,
    };
  } catch (err: any) {
    return {
      data: null,
      isLive: false,
      error: err?.message || 'Network error updating ghat status',
    };
  }
}



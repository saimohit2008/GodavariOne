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

const DEV_HOST_IP = '192.168.31.251';
const DEFAULT_API_URL = `http://${DEV_HOST_IP}:3000/api/v1`;

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  let resolvedUrl = DEFAULT_API_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    resolvedUrl = envUrl.replace(/\/+$/, '');
  } else if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    // On web, use current origin to leverage same-origin Metro proxy and eliminate CORS
    return `${window.location.origin}/api/v1`;
  }

  // Guard against physical Android devices attempting to reach host via 'localhost' or '127.0.0.1'
  if (Platform.OS === 'android' && (resolvedUrl.includes('localhost') || resolvedUrl.includes('127.0.0.1'))) {
    resolvedUrl = resolvedUrl.replace(/localhost|127\.0\.0\.1/g, DEV_HOST_IP);
  }

  return resolvedUrl;
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

const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(
  url: string,
  timeout = REQUEST_TIMEOUT_MS,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const extraHeaders: Record<string, string> = {};
    if (Platform.OS !== 'web') {
      extraHeaders['X-Client-Platform'] = 'native';
      extraHeaders['X-Godavari-Client'] = 'godavari-mobile-native-v1';
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
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
        ...(options?.headers || {}),
      },
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
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
    const [homepageRes, carouselRes, listingsRes] = await Promise.all([
      fetchWithTimeout(homepageContentUrl),
      fetchWithTimeout(`${baseUrl}/carousel`),
      fetchWithTimeout(`${baseUrl}/listings?limit=24`),
    ]);

    if (!homepageRes.ok || !listingsRes.ok) {
      throw new Error('Non-200 response from backend API');
    }

    const homepageJson = await homepageRes.json();
    const carouselJson = carouselRes.ok ? await carouselRes.json() : { items: [] };
    const listingsJson = await listingsRes.json();

    const sections = Array.isArray(homepageJson.sections) ? homepageJson.sections : [];
    const items = Array.isArray(homepageJson.items) ? homepageJson.items : [];
    const allListings: ListingItem[] = Array.isArray(listingsJson.items) ? listingsJson.items : [];

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
    console.error('[API] getHomepageData ERROR:', err?.message || err);
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



// Godavari One Mobile — Production Safe Cross-Platform Storage Utility
// Safeguards:
// 1. Web uses localStorage with SSR protections.
// 2. Native uses @react-native-async-storage/async-storage for non-sensitive data.
// 3. Native uses expo-secure-store (Keychain/Keystore) for sensitive tokens.
// 4. In-memory cache ensures synchronous zero-latency reads without SSR hydration mismatch.
// 5. Race-condition protection: in-flight startup writes are tracked via dirtyKeys and never overwritten by disk hydration.
// 6. Explicit failure handling for storage quota, keychain lock, and async failures.
// 7. Component signatures preserved for 100% backward compatibility.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const RECENT_SEARCHES_KEY = 'godavari_one_recent_searches_v1';
export const FAVORITES_KEY = 'godavari_one_favorites_v1';
export const CACHE_LISTINGS_KEY = 'godavari_one_cache_listings_v1';
export const CACHE_BOOKINGS_KEY = 'godavari_one_cache_bookings_v1';
export const AUTH_TOKEN_KEY = 'godavari_one_auth_token_v1';
export const PREF_LANG_KEY = 'godavari_one_pref_lang_v1';
export const PREF_THEME_KEY = 'godavari_one_pref_theme_v1';

const ALL_PERSISTENT_KEYS = [
  RECENT_SEARCHES_KEY,
  FAVORITES_KEY,
  CACHE_LISTINGS_KEY,
  CACHE_BOOKINGS_KEY,
  PREF_LANG_KEY,
  PREF_THEME_KEY,
];

const MAX_RECENT_SEARCHES = 8;

// Synchronous in-memory mirrors
const memoryStore: Record<string, string> = {};
const secureMemoryStore: Record<string, string> = {};

// Startup synchronization and race-condition guards
const dirtyKeys = new Set<string>();
let isInitialized = false;
let initPromise: Promise<void> | null = null;

function isBrowser(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Returns whether persistent storage has completed its initial hydration
 */
export function isStorageReady(): boolean {
  return isInitialized;
}

/**
 * Awaitable storage initialization. Safe to call multiple times concurrently.
 */
export function waitForStorageInit(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (!initPromise) {
    initPromise = initNativeStorage();
  }
  return initPromise;
}

/**
 * Hydrates in-memory cache from persistent storage.
 * Guarded against race conditions: any key mutated during startup (dirtyKeys)
 * is preserved and never overwritten with stale disk data.
 */
export async function initNativeStorage(): Promise<void> {
  if (isInitialized) return;
  try {
    if (isBrowser()) {
      // Browser: hydrate memoryStore from localStorage safely
      for (const k of ALL_PERSISTENT_KEYS) {
        if (dirtyKeys.has(k)) continue;
        try {
          const val = window.localStorage.getItem(k);
          if (val !== null && !dirtyKeys.has(k)) {
            memoryStore[k] = val;
          }
        } catch (e) {
          console.warn(`[Storage] Failed to read web localStorage key ${k}:`, e);
        }
      }
    } else {
      // Native platforms: hydrate memoryStore from AsyncStorage
      const pairs = await AsyncStorage.multiGet(ALL_PERSISTENT_KEYS);
      for (const [k, v] of pairs) {
        // Race condition prevention: do not overwrite if mutated during startup
        if (v !== null && !dirtyKeys.has(k)) {
          memoryStore[k] = v;
        }
      }
    }
  } catch (err) {
    // Explicit storage failure handling: app continues with in-memory store
    console.warn('[Storage] Persistent storage hydration failed; continuing with in-memory fallback:', err);
  } finally {
    isInitialized = true;
  }
}

/**
 * Synchronous read from in-memory cache or web localStorage
 */
export function getItem(key: string): string | null {
  try {
    if (isBrowser()) {
      const webVal = window.localStorage.getItem(key);
      if (webVal !== null) {
        memoryStore[key] = webVal;
        return webVal;
      }
    }
    return memoryStore[key] || null;
  } catch {
    return memoryStore[key] || null;
  }
}

/**
 * Write value to in-memory cache and persistent disk storage
 */
export function setItem(key: string, value: string): void {
  try {
    dirtyKeys.add(key);
    memoryStore[key] = value;

    if (isBrowser()) {
      try {
        window.localStorage.setItem(key, value);
      } catch (webErr) {
        console.warn(`[Storage] Failed to write key "${key}" to web localStorage:`, webErr);
      }
    } else {
      AsyncStorage.setItem(key, value).catch((nativeErr) => {
        console.warn(`[Storage] Failed to write key "${key}" to AsyncStorage:`, nativeErr);
      });
    }
  } catch (err) {
    console.warn(`[Storage] setItem unexpected error for "${key}":`, err);
  }
}

/**
 * Remove value from in-memory cache and persistent storage
 */
export function removeItem(key: string): void {
  try {
    dirtyKeys.add(key);
    delete memoryStore[key];

    if (isBrowser()) {
      try {
        window.localStorage.removeItem(key);
      } catch (webErr) {
        console.warn(`[Storage] Failed to remove key "${key}" from web localStorage:`, webErr);
      }
    } else {
      AsyncStorage.removeItem(key).catch((nativeErr) => {
        console.warn(`[Storage] Failed to remove key "${key}" from AsyncStorage:`, nativeErr);
      });
    }
  } catch (err) {
    console.warn(`[Storage] removeItem unexpected error for "${key}":`, err);
  }
}

/**
 * Asynchronous read guaranteeing disk synchronization
 */
export async function getItemAsync(key: string): Promise<string | null> {
  await waitForStorageInit();
  if (isBrowser()) {
    return getItem(key);
  }
  try {
    const val = await AsyncStorage.getItem(key);
    if (val !== null && !dirtyKeys.has(key)) {
      memoryStore[key] = val;
    }
    return val !== null ? val : (memoryStore[key] || null);
  } catch (err) {
    console.warn(`[Storage] getItemAsync failed for key "${key}":`, err);
    return memoryStore[key] || null;
  }
}

/**
 * Asynchronous write guaranteeing disk completion
 */
export async function setItemAsync(key: string, value: string): Promise<void> {
  dirtyKeys.add(key);
  memoryStore[key] = value;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[Storage] setItemAsync web error for "${key}":`, e);
    }
  } else {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[Storage] setItemAsync native error for "${key}":`, e);
    }
  }
}

/**
 * Asynchronous delete guaranteeing disk completion
 */
export async function removeItemAsync(key: string): Promise<void> {
  dirtyKeys.add(key);
  delete memoryStore[key];
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[Storage] removeItemAsync web error for "${key}":`, e);
    }
  } else {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`[Storage] removeItemAsync native error for "${key}":`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Hardware-Backed Secure Storage (Sensitive Tokens & Credentials)
// Strictly isolated from ordinary AsyncStorage & plain localStorage!
// ---------------------------------------------------------------------------

/**
 * Retrieve sensitive token from hardware-backed secure storage
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    // Never expose secure tokens to browser localStorage
    return secureMemoryStore[key] || null;
  }
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val !== null) secureMemoryStore[key] = val;
    return val;
  } catch (err) {
    console.warn(`[SecureStore] Error reading key "${key}":`, err);
    return secureMemoryStore[key] || null;
  }
}

/**
 * Write sensitive token to hardware-backed secure storage (iOS Keychain / Android Keystore)
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  secureMemoryStore[key] = value;
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } catch (err) {
    console.warn(`[SecureStore] Error writing key "${key}":`, err);
  }
}

/**
 * Delete sensitive token from hardware-backed secure storage
 */
export async function removeSecureItem(key: string): Promise<void> {
  delete secureMemoryStore[key];
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn(`[SecureStore] Error deleting key "${key}":`, err);
  }
}

// ---------------------------------------------------------------------------
// High-Level Domain Helpers (Preserves existing synchronous signatures)
// ---------------------------------------------------------------------------

export function getRecentSearches(): string[] {
  try {
    const raw = getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): string[] {
  const clean = term.trim();
  if (!clean || clean.length < 2) return getRecentSearches();

  try {
    const current = getRecentSearches();
    const filtered = current.filter((item) => item.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [clean];
  }
}

export function clearRecentSearches(): void {
  removeItem(RECENT_SEARCHES_KEY);
}

export function getFavorites(): string[] {
  try {
    const raw = getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function isFavorite(listingId: string): boolean {
  if (!listingId) return false;
  const current = getFavorites();
  return current.includes(listingId);
}

export function toggleFavorite(listingId: string): boolean {
  if (!listingId) return false;
  try {
    const current = getFavorites();
    const index = current.indexOf(listingId);
    let updated: string[];
    let isNowFav: boolean;

    if (index >= 0) {
      updated = current.filter((id) => id !== listingId);
      isNowFav = false;
    } else {
      updated = [listingId, ...current];
      isNowFav = true;
    }

    setItem(FAVORITES_KEY, JSON.stringify(updated));
    return isNowFav;
  } catch {
    return false;
  }
}

export function cacheListings(listings: any[]): void {
  try {
    if (Array.isArray(listings) && listings.length > 0) {
      setItem(CACHE_LISTINGS_KEY, JSON.stringify({ timestamp: Date.now(), items: listings }));
    }
  } catch {
    // safe fallback
  }
}

export function getCachedListings(): any[] | null {
  try {
    const raw = getItem(CACHE_LISTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed.items : null;
  } catch {
    return null;
  }
}

export function cacheBookings(bookings: any[]): void {
  try {
    if (Array.isArray(bookings)) {
      setItem(CACHE_BOOKINGS_KEY, JSON.stringify({ timestamp: Date.now(), items: bookings }));
    }
  } catch {
    // safe fallback
  }
}

export function getCachedBookings(): any[] | null {
  try {
    const raw = getItem(CACHE_BOOKINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed.items : null;
  } catch {
    return null;
  }
}

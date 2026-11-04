import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme as useDeviceColorScheme } from '@/hooks/use-color-scheme';
import { Colors, ThemeColors } from '../constants/theme';
import { Lang, TranslationKey, t as translate } from '../lib/i18n';
import { AuthUser } from '../types';
import { getCurrentUser, logoutUser } from '../services/api';
import {
  waitForStorageInit,
  getItem,
  setItem,
  PREF_LANG_KEY,
  PREF_THEME_KEY,
} from '../lib/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

interface AppContextType {
  storageReady: boolean;
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colors: ThemeColors;
  t: (key: TranslationKey) => string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const deviceScheme = useDeviceColorScheme();
  const [storageReady, setStorageReady] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getCurrentUser();
      if (res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Hydrate persistent storage and restore preferences
  useEffect(() => {
    let active = true;
    waitForStorageInit()
      .then(() => {
        if (!active) return;
        const savedLang = getItem(PREF_LANG_KEY);
        if (savedLang === 'en' || savedLang === 'te') {
          setLang(savedLang);
        }
        const savedTheme = getItem(PREF_THEME_KEY);
        if (savedTheme === 'system' || savedTheme === 'light' || savedTheme === 'dark') {
          setThemeMode(savedTheme);
        }
        setStorageReady(true);
      })
      .catch((err) => {
        console.warn('[AppContext] Storage initialization failure handled:', err);
        if (active) setStorageReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // SSR-safe session verification: executes only in the client after hydration
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const handleSetLang = useCallback((newLang: Lang) => {
    setLang(newLang);
    setItem(PREF_LANG_KEY, newLang);
  }, []);

  const handleSetThemeMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    setItem(PREF_THEME_KEY, mode);
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'en' ? 'te' : 'en';
      setItem(PREF_LANG_KEY, next);
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
    }
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'light') return false;
    if (themeMode === 'dark') return true;
    return deviceScheme === 'dark';
  }, [themeMode, deviceScheme]);

  const colors = useMemo(() => {
    return isDark ? Colors.dark : Colors.light;
  }, [isDark]);

  const t = (key: TranslationKey) => {
    return translate(lang, key);
  };

  const value = useMemo(
    () => ({
      storageReady,
      lang,
      setLang: handleSetLang,
      toggleLang,
      themeMode,
      setThemeMode: handleSetThemeMode,
      isDark,
      colors,
      t,
      searchQuery,
      setSearchQuery,
      selectedCategory,
      setSelectedCategory,
      user,
      setUser,
      refreshUser,
      logout,
    }),
    [storageReady, lang, handleSetLang, toggleLang, themeMode, handleSetThemeMode, isDark, colors, searchQuery, selectedCategory, user, refreshUser, logout]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

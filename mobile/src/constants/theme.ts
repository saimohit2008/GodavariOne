/**
 * Godavari One — Mobile Theme System
 * Unified design tokens for Light and Dark modes.
 */

import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Brand Tokens (Light)
    background: '#F7FAFA',
    primary: '#168A8A',
    primaryLight: '#E6F4F4',
    primaryDark: '#0E5C5C',
    text: '#29383D',
    textSecondary: '#5C7178',
    textMuted: '#8A9CA1',
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',
    secondary: '#EAF2F2',
    border: '#DCE6E6',

    // Accent and Semantic Colors
    accent: '#D97706',
    accentLight: '#FEF3C7',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    success: '#059669',
    successLight: '#D1FAE5',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    info: '#0284C7',
    infoLight: '#E0F2FE',

    // Template compatibility aliases
    backgroundElement: '#EAF2F2',
    backgroundSelected: '#DCE6E6',
    tint: '#168A8A',
  },
  dark: {
    // Brand Tokens (Dark)
    background: '#172126',
    primary: '#55BDB5',
    primaryLight: '#183835',
    primaryDark: '#7FE0D9',
    text: '#EDF5F4',
    textSecondary: '#A0B2B7',
    textMuted: '#6C8086',
    card: '#202D33',
    cardElevated: '#27373E',
    secondary: '#303C42',
    border: '#39464B',

    // Accent and Semantic Colors
    accent: '#F59E0B',
    accentLight: '#3D2808',
    danger: '#EF4444',
    dangerLight: '#3B1818',
    success: '#10B981',
    successLight: '#12372A',
    warning: '#F59E0B',
    warningLight: '#3D2808',
    info: '#38BDF8',
    infoLight: '#0C374D',

    // Template compatibility aliases
    backgroundElement: '#303C42',
    backgroundSelected: '#39464B',
    tint: '#55BDB5',
  },
} as const;

export type ThemeColors = (typeof Colors)[keyof typeof Colors];
export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
  }),
  cardHover: Platform.select({
    ios: {
      shadowColor: '#168A8A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    default: {
      shadowColor: '#168A8A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
  }),
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

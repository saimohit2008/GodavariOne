import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "./i18n";

// Central client-side store: language + view routing + auth + theme

export type View =
  | { name: "home" }
  | { name: "directory"; category?: string; q?: string }
  | { name: "listing"; id: string }
  | { name: "listing-form"; id?: string; category?: string }
  | { name: "login" }
  | { name: "register" }
  | { name: "admin-login" }
  | { name: "bookings" }
  | { name: "favorites" }
  | { name: "notifications" }
  | { name: "visitor-dashboard" }
  | { name: "admin"; tab?: AdminTab }
  | { name: "owner-dashboard" }
  | { name: "ghat-reporter" }
  | { name: "ghat-supervisor" }
  | { name: "editor-dashboard" }
  | { name: "reviewer-dashboard" }
  | { name: "nri-access"; ref?: string }
  | { name: "nri-service-manager" }
  | { name: "purohit-dashboard" }
  | { name: "ceremonies"; category?: string; purohitId?: string }
  | { name: "carousel-detail"; id: string }
  | { name: "ai-assistant" };

export type AdminTab =
  | "overview"
  | "homepage-content"
  | "carousel"
  | "footer-contact"
  | "nri-service-manager"
  | "ceremony-management"
  | "listings"
  | "restaurants"
  | "hotels"
  | "ghats"
  | "hospitals"
  | "transport"
  | "tourist-spots"
  | "free-accommodation"
  | "annadanam"
  | "roles"
  | "ghat-monitoring"
  | "bookings"
  | "ownership"
  | "reviews"
  | "audit"
  | "users"
  | "restaurant-bookings"
  | "hotel-bookings"
  | "settings"
  | "priority-bookings"
  | "email-notifications"
  | "ai-assistant"
  | "nri-management"
  | "nri-requests";

export interface CurrentUser {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  phoneVerified: boolean;
  mfaEnabled: boolean;
}

export interface PendingBooking {
  type: "HOTEL" | "RESTAURANT" | "FREE_ACCOMMODATION" | "CEREMONY" | "PRIORITY_GHAT" | "NRI_PACKAGE";
  listingId?: string;
  title?: string;
  data?: Record<string, any>;
  returnView?: View;
}

export interface BookingAuthModalState {
  isOpen: boolean;
  context?: {
    type: string;
    title?: string;
    details?: string;
    data?: Record<string, any>;
  };
  onAuthenticated?: (user: CurrentUser) => void;
}

interface AppState {
  lang: Lang;
  theme: "light" | "dark";
  view: View;
  user: CurrentUser | null;
  authLoading: boolean;
  searchQuery: string;
  pendingBooking: PendingBooking | null;
  bookingAuthModal: BookingAuthModalState;
  // actions
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
  navigate: (v: View) => void;
  setUser: (u: CurrentUser | null) => void;
  setAuthLoading: (b: boolean) => void;
  setSearchQuery: (q: string) => void;
  setPendingBooking: (b: PendingBooking | null) => void;
  openBookingAuthModal: (opts: {
    context?: BookingAuthModalState["context"];
    onAuthenticated?: (user: CurrentUser) => void;
  }) => void;
  closeBookingAuthModal: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      lang: "en",
      theme: "light",
      view: { name: "home" },
      user: null,
      authLoading: true,
      searchQuery: "",
      pendingBooking: null,
      bookingAuthModal: { isOpen: false },
      setLang: (l) => set({ lang: l }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      navigate: (v) => {
        set({ view: v });
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          if (window.location.pathname !== "/") {
            if (v.name === "home") {
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/";
            } else {
              try {
                sessionStorage.setItem("godavari_pending_view", JSON.stringify(v));
              } catch {
                // ignore storage quota error
              }
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/";
            }
          }
        }
      },
      setUser: (u) => set({ user: u }),
      setAuthLoading: (b) => set({ authLoading: b }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setPendingBooking: (b) => {
        set({ pendingBooking: b });
        if (typeof window !== "undefined") {
          try {
            if (b) {
              sessionStorage.setItem("godavari_pending_booking", JSON.stringify(b));
            } else {
              sessionStorage.removeItem("godavari_pending_booking");
            }
          } catch {
            // ignore storage errors
          }
        }
      },
      openBookingAuthModal: ({ context, onAuthenticated }) => {
        set({
          bookingAuthModal: {
            isOpen: true,
            context,
            onAuthenticated,
          },
        });
      },
      closeBookingAuthModal: () => {
        set((s) => ({
          bookingAuthModal: { ...s.bookingAuthModal, isOpen: false },
        }));
      },
    }),
    {
      name: "godavari-one-store",
      partialize: (s) => ({ lang: s.lang, theme: s.theme }),
    }
  )
);

if (typeof window !== "undefined") {
  (window as any).__godavariStore = useApp;
}

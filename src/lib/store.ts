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
  | { name: "forgot-password"; email?: string }
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

export function viewToUrl(view: View): string {
  if (view.name === "home") {
    return "/";
  }
  const params = new URLSearchParams();
  params.set("view", view.name);
  if ("id" in view && view.id) {
    params.set("id", view.id);
  }
  if ("category" in view && view.category) {
    params.set("category", view.category);
  }
  if ("q" in view && view.q) {
    params.set("q", view.q);
  }
  if ("tab" in view && view.tab) {
    params.set("tab", view.tab);
  }
  if ("ref" in view && view.ref) {
    params.set("ref", view.ref);
  }
  if ("purohitId" in view && view.purohitId) {
    params.set("purohitId", view.purohitId);
  }
  if ("email" in view && view.email) {
    params.set("email", view.email);
  }
  return `/?${params.toString()}`;
}

export function urlToView(searchStr: string): View | null {
  if (!searchStr || searchStr === "?" || searchStr === "/") return null;
  const queryString = searchStr.includes("?") ? searchStr.slice(searchStr.indexOf("?") + 1) : searchStr;
  const params = new URLSearchParams(queryString);
  const viewName = params.get("view");
  if (!viewName) {
    const cat = params.get("category");
    const q = params.get("q");
    if (cat || q) {
      return { name: "directory", category: cat || undefined, q: q || undefined };
    }
    return null;
  }

  switch (viewName) {
    case "home":
      return { name: "home" };
    case "directory":
      return {
        name: "directory",
        category: params.get("category") || undefined,
        q: params.get("q") || undefined,
      };
    case "listing": {
      const id = params.get("id");
      return id ? { name: "listing", id } : { name: "directory" };
    }
    case "listing-form":
      return {
        name: "listing-form",
        id: params.get("id") || undefined,
        category: params.get("category") || undefined,
      };
    case "login":
      return { name: "login" };
    case "register":
      return { name: "register" };
    case "forgot-password":
      return { name: "forgot-password", email: params.get("email") || undefined };
    case "admin-login":
      return { name: "admin-login" };
    case "admin":
      return { name: "admin", tab: (params.get("tab") as AdminTab) || undefined };
    case "bookings":
      return { name: "bookings" };
    case "favorites":
      return { name: "favorites" };
    case "notifications":
      return { name: "notifications" };
    case "visitor-dashboard":
      return { name: "visitor-dashboard" };
    case "owner-dashboard":
      return { name: "owner-dashboard" };
    case "ghat-reporter":
      return { name: "ghat-reporter" };
    case "ghat-supervisor":
      return { name: "ghat-supervisor" };
    case "reviewer-dashboard":
      return { name: "reviewer-dashboard" };
    case "editor-dashboard":
      return { name: "editor-dashboard" };
    case "nri-service-manager":
      return { name: "nri-service-manager" };
    case "purohit-dashboard":
      return { name: "purohit-dashboard" };
    case "ceremonies":
      return {
        name: "ceremonies",
        category: params.get("category") || undefined,
        purohitId: params.get("purohitId") || undefined,
      };
    case "nri-access":
      return { name: "nri-access", ref: params.get("ref") || undefined };
    case "carousel-detail": {
      const id = params.get("id");
      return id ? { name: "carousel-detail", id } : { name: "home" };
    }
    case "ai-assistant":
      return { name: "ai-assistant" };
    default:
      return null;
  }
}

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
  navDepth: number;
  // actions
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
  navigate: (v: View, opts?: { replace?: boolean; skipHistory?: boolean }) => void;
  goBack: (fallback?: View) => void;
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
    (set, get) => ({
      lang: "en",
      theme: "light",
      view: { name: "home" },
      user: null,
      authLoading: true,
      searchQuery: "",
      pendingBooking: null,
      bookingAuthModal: { isOpen: false },
      navDepth: 0,
      setLang: (l) => set({ lang: l }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      goBack: (fallback) => {
        if (typeof window !== "undefined") {
          const currentDepth = get().navDepth;
          if (window.history.length > 1 && currentDepth > 0) {
            window.history.back();
            return;
          }
        }
        get().navigate(fallback || { name: "home" });
      },
      navigate: (v, opts) => {
        set({ view: v });
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          if (window.location.pathname !== "/") {
            if (v.name === "home") {
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/";
              return;
            } else {
              try {
                sessionStorage.setItem("godavari_pending_view", JSON.stringify(v));
              } catch {
                // ignore storage quota error
              }
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/";
              return;
            }
          }

          if (!opts?.skipHistory) {
            const targetUrl = viewToUrl(v);
            if (opts?.replace) {
              window.history.replaceState({ view: v, godavariDepth: get().navDepth }, "", targetUrl);
            } else {
              const nextDepth = get().navDepth + 1;
              window.history.pushState({ view: v, godavariDepth: nextDepth }, "", targetUrl);
              set({ navDepth: nextDepth });
              try {
                sessionStorage.setItem("godavari_nav_depth", String(nextDepth));
              } catch {
                // ignore storage errors
              }
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

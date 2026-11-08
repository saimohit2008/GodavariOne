import { create } from "zustand";

export type PwaPlatform = "android" | "ios" | "desktop" | "other";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  canInstall: boolean;
  isInstalled: boolean;
  isDismissed: boolean;
  isInstallDialogOpen: boolean;
  platform: PwaPlatform;

  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  setIsInstalled: (val: boolean) => void;
  setIsDismissed: (val: boolean) => void;
  setPlatform: (platform: PwaPlatform) => void;
  openInstallDialog: () => void;
  closeInstallDialog: () => void;
  dismissBanner: () => void;
  triggerInstall: () => Promise<void>;
}

export const usePwa = create<PwaState>((set, get) => ({
  deferredPrompt: null,
  canInstall: false,
  isInstalled: false,
  isDismissed: false,
  isInstallDialogOpen: false,
  platform: "other",

  setDeferredPrompt: (prompt) => {
    set({
      deferredPrompt: prompt,
      canInstall: !!prompt,
    });
  },

  setIsInstalled: (val) => {
    set({ isInstalled: val });
  },

  setIsDismissed: (val) => {
    set({ isDismissed: val });
  },

  setPlatform: (platform) => {
    set({ platform });
  },

  openInstallDialog: () => {
    set({ isInstallDialogOpen: true });
  },

  closeInstallDialog: () => {
    set({ isInstallDialogOpen: false });
  },

  dismissBanner: () => {
    set({ isDismissed: true });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("godavari_pwa_dismissed", Date.now().toString());
      } catch {
        // ignore localStorage errors
      }
    }
  },

  triggerInstall: async () => {
    const { deferredPrompt, isInstalled } = get();

    if (isInstalled) {
      set({ isInstallDialogOpen: true });
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          set({
            isInstalled: true,
            deferredPrompt: null,
            canInstall: false,
            isDismissed: true,
          });
        }
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
        set({ isInstallDialogOpen: true });
      }
    } else {
      // Automatic prompt not available: open manual instructions modal
      set({ isInstallDialogOpen: true });
    }
  },
}));


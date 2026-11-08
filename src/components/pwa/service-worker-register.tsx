"use client";

import { useEffect } from "react";
import { usePwa, type PwaPlatform } from "./pwa-store";

export function ServiceWorkerRegister() {
  const { setDeferredPrompt, setIsInstalled, setIsDismissed, setPlatform } = usePwa();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect platform
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
    let detectedPlatform: PwaPlatform = "desktop";
    if (/android/i.test(userAgent)) {
      detectedPlatform = "android";
    } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      detectedPlatform = "ios";
    }
    setPlatform(detectedPlatform);

    // 2. Detect if already installed / running standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
    }

    // 3. Check dismissal timestamp in localStorage (hide banner if dismissed in last 7 days)
    try {
      const dismissedAt = localStorage.getItem("godavari_pwa_dismissed");
      if (dismissedAt) {
        const timePassed = Date.now() - parseInt(dismissedAt, 10);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (timePassed < sevenDays) {
          setIsDismissed(true);
        }
      }
    } catch {
      // ignore storage access errors
    }

    // 4. Listen for Chrome Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as any);
    };

    // 5. Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // 6. Register Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((registration) => {
            // Check for updates on new deployments
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[PWA] New version available; will activate on next reload.");
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn("[PWA] ServiceWorker registration failed:", err);
          });
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [setDeferredPrompt, setIsInstalled, setIsDismissed, setPlatform]);

  return null;
}


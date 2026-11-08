"use client";

import { usePwa } from "./pwa-store";
import { Button } from "@/components/ui/button";
import { Download, X, Waves } from "lucide-react";

export function PwaPromptBanner() {
  const { isInstalled, isDismissed, dismissBanner, triggerInstall } = usePwa();

  // Do not show if already installed or dismissed
  if (isInstalled || isDismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Install Godavari One Web App"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-md z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-background/95 backdrop-blur-md border border-teal-200 dark:border-teal-900 rounded-2xl p-3 sm:p-3.5 shadow-xl flex items-center gap-3">
        {/* Brand Icon */}
        <div className="size-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white grid place-items-center shrink-0 shadow-sm">
          <Waves className="size-5" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs sm:text-sm text-foreground truncate">
              Install Godavari One
            </span>
            <span className="text-[10px] bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-semibold px-1.5 py-0.2 rounded">
              Free App
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1">
            Fast access &bull; Offline emergency info
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-3 shadow-xs"
            onClick={triggerInstall}
          >
            <Download className="size-3.5 mr-1" />
            Install
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-foreground rounded-full"
            aria-label="Dismiss installation prompt"
            onClick={dismissBanner}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}


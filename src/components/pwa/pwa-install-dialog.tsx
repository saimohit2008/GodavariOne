"use client";

import { usePwa } from "./pwa-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Smartphone,
  Share2,
  MoreVertical,
  CheckCircle2,
  Sparkles,
  Waves,
  WifiOff,
  Zap,
} from "lucide-react";

export function PwaInstallDialog() {
  const {
    isInstallDialogOpen,
    closeInstallDialog,
    isInstalled,
    platform,
    deferredPrompt,
    triggerInstall,
  } = usePwa();

  return (
    <Dialog open={isInstallDialogOpen} onOpenChange={(open) => !open && closeInstallDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white grid place-items-center shadow-md shrink-0">
              <Waves className="size-6" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                Godavari One
                <Badge variant="secondary" className="bg-teal-100 text-teal-800 border-teal-200 text-xs">
                  Free PWA
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pushkaralu 2027 &bull; Instant Installation &bull; Zero Store Fees
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isInstalled ? (
          <div className="py-4 text-center space-y-3">
            <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h3 className="font-semibold text-base">App Already Installed</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Godavari One is already installed and available on your home screen or app drawer.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 p-2.5 rounded-lg border">
                <Zap className="size-4 text-amber-600 mx-auto mb-1" />
                <span className="text-xs font-semibold block">Instant Load</span>
                <span className="text-[10px] text-muted-foreground">No app store download</span>
              </div>
              <div className="bg-muted/50 p-2.5 rounded-lg border">
                <WifiOff className="size-4 text-sky-600 mx-auto mb-1" />
                <span className="text-xs font-semibold block">Offline Ready</span>
                <span className="text-[10px] text-muted-foreground">Emergency info offline</span>
              </div>
              <div className="bg-muted/50 p-2.5 rounded-lg border">
                <Sparkles className="size-4 text-teal-600 mx-auto mb-1" />
                <span className="text-xs font-semibold block">100% Free</span>
                <span className="text-[10px] text-muted-foreground">Safe &amp; official</span>
              </div>
            </div>

            {/* Platform Instructions */}
            {deferredPrompt ? (
              <div className="bg-teal-50 dark:bg-teal-950/40 p-3.5 rounded-xl border border-teal-200 dark:border-teal-800 space-y-2">
                <p className="text-sm font-medium text-teal-950 dark:text-teal-100 flex items-center gap-1.5">
                  <Smartphone className="size-4 text-teal-600" />
                  Ready to install directly in Google Chrome
                </p>
                <p className="text-xs text-teal-800 dark:text-teal-300">
                  Click the button below to add Godavari One to your device home screen with full standalone app experience.
                </p>
              </div>
            ) : platform === "android" ? (
              <div className="bg-muted/60 p-3.5 rounded-xl border space-y-2 text-xs">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <MoreVertical className="size-4 text-primary" />
                  Chrome on Android: Manual Steps
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Tap the <strong>three dots (⋮)</strong> menu in top-right corner of Chrome.</li>
                  <li>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</li>
                  <li>Tap <strong>&quot;Install&quot;</strong> to confirm.</li>
                </ol>
              </div>
            ) : platform === "ios" ? (
              <div className="bg-muted/60 p-3.5 rounded-xl border space-y-2 text-xs">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <Share2 className="size-4 text-primary" />
                  Safari on iPhone / iPad
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Tap the <strong>Share</strong> button (square with arrow) at the bottom.</li>
                  <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</li>
                  <li>Tap <strong>&quot;Add&quot;</strong> in the top-right corner.</li>
                </ol>
              </div>
            ) : (
              <div className="bg-muted/60 p-3.5 rounded-xl border space-y-2 text-xs">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <Download className="size-4 text-primary" />
                  Desktop Chrome / Edge
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Look for the <strong>Install icon</strong> (computer with down arrow) in the address bar.</li>
                  <li>Or open the browser menu (⋮) and click <strong>&quot;Install Godavari One&quot;</strong>.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          {deferredPrompt && !isInstalled && (
            <Button
              className="w-full sm:w-auto bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 text-white font-medium"
              onClick={triggerInstall}
            >
              <Download className="size-4 mr-1.5" /> Install App Now
            </Button>
          )}
          <Button variant="outline" className="w-full sm:w-auto" onClick={closeInstallDialog}>
            {isInstalled ? "Close" : "Got It"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


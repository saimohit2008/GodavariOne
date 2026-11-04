"use client";

import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeleteListingDialogProps {
  listing: { id: string; name: string; publicationStatus?: string };
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteListingDialog({
  listing,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteListingDialogProps) {
  const { lang } = useApp();
  const isArchived = listing.publicationStatus === "ARCHIVED";

  return (
    <Dialog open onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(lang, "deleteListing")}</DialogTitle>
          <DialogDescription>
            {t(lang, "deleteListingConfirm")}{" "}
            <span className="font-semibold text-foreground">&ldquo;{listing.name}&rdquo;</span>?{" "}
            {isArchived
              ? "This will permanently delete the listing and remove associated records."
              : "This will archive the listing and remove it from public directory views."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            {t(lang, "cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? t(lang, "loading") : t(lang, "delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "../use-api";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accessibility,
  Heart,
  QrCode,
  Calendar,
  Clock,
  Waves,
  MapPin,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  Printer,
  Download,
  Eye,
  RefreshCw,
  Info,
} from "lucide-react";
import { generateQrSvg, formatQrPassPayload } from "@/lib/qr";

const STATUS_BADGE_STYLES: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  ADDITIONAL_PROOF_REQUIRED: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  SLOT_ASSIGNED: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
  CHECKED_IN: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
  CANCELLED: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-400",
};

export function UserPriorityBookingsTab() {
  const { lang, user, navigate } = useApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, refetch } = useApi<{ items: any[]; total: number }>(
    user ? "/priority-bookings" : null,
    [refreshKey]
  );

  const [selectedPass, setSelectedPass] = useState<any | null>(null);
  const [reuploadBooking, setReuploadBooking] = useState<any | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this priority booking application?")) return;
    setCancellingId(id);
    try {
      await api.patch(`/priority-bookings/${id}`, {
        action: "CANCEL",
        cancellationReason: "Cancelled by applicant",
      });
      toast({ title: t(lang, "cancelled"), description: "Priority booking application has been cancelled." });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: t(lang, "error"),
        description: err instanceof ApiError ? err.message : "Failed to cancel application",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
    }
  }

  async function handleReplacementSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reuploadBooking || !replacementFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", replacementFile);

      const res = await fetch(`/api/v1/priority-bookings/${reuploadBooking.id}/document`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload replacement document");

      toast({
        title: t(lang, "imageUploaded"),
        description: "Replacement proof submitted successfully. Application is now SUBMITTED for review.",
      });

      setReuploadBooking(null);
      setReplacementFile(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: t(lang, "error"),
        description: err.message || "Failed to upload replacement proof",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">{t(lang, "loginTitle")}</p>
        <Button onClick={() => navigate({ name: "login" })} className="mt-4">
          {t(lang, "login")}
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl w-full" />
        ))}
      </div>
    );
  }

  const bookings = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Accessibility className="size-5 text-sky-600" />
            {t(lang, "myPriorityBookings")}
          </h2>
          <p className="text-xs text-muted-foreground">
            Track applications, view supervisor verification status, and access verified QR entry passes
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="size-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {bookings.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Accessibility className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-base">No Priority Ghat Bookings Found</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            Senior citizens aged 65+ and persons with disabilities can apply for priority bathing ghat access, dedicated assistance, and human-verified passes.
          </p>
          <Button
            size="sm"
            onClick={() => navigate({ name: "directory", category: "GHAT" })}
            className="mt-4 bg-sky-600 hover:bg-sky-700 text-white"
          >
            Browse Ghats to Apply
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const hasQr = (b.status === "SLOT_ASSIGNED" || b.status === "CHECKED_IN") && b.qrPassToken;
            return (
              <Card key={b.id} className="p-0 overflow-hidden shadow-sm hover:border-primary/40 transition-colors">
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm bg-muted px-2.5 py-0.5 rounded">
                        {b.applicationNumber}
                      </span>
                      <Badge variant="outline" className={STATUS_BADGE_STYLES[b.status] || ""}>
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {b.category === "SENIOR_CITIZEN" ? (
                          <span className="flex items-center gap-1">
                            <Heart className="size-3 text-rose-500" /> {t(lang, "seniorCitizen")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Accessibility className="size-3 text-sky-500" /> {t(lang, "personWithDisability")}
                          </span>
                        )}
                      </Badge>
                    </div>

                    <span className="text-xs text-muted-foreground">
                      Applied: {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground font-medium">Beneficiary:</p>
                      <p className="font-semibold text-sm text-foreground">{b.beneficiaryName}</p>
                      {b.isCaregiverApplication && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Caregiver: {b.applicantName} ({b.applicantRelationship})
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-muted-foreground font-medium">Pushkar Ghat:</p>
                      <p className="font-semibold text-sm text-foreground flex items-center gap-1">
                        <Waves className="size-3.5 text-sky-600" />
                        {b.ghat?.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {[b.ghat?.town, b.ghat?.district].filter(Boolean).join(", ")}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground font-medium">Scheduled Visit & Slot:</p>
                      <p className="font-semibold text-sm text-foreground flex items-center gap-1">
                        <Calendar className="size-3.5 text-primary" />
                        {b.visitDate}
                      </p>
                      {b.timeSlot ? (
                        <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 mt-0.5">
                          <Clock className="size-3" />
                          {b.timeSlot.startTime} - {b.timeSlot.endTime}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          {b.status === "APPROVED" ? "Awaiting supervisor slot assignment" : "Not yet assigned"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Special alerts / Reviewer messages */}
                  {b.status === "ADDITIONAL_PROOF_REQUIRED" && (
                    <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/70 dark:bg-orange-950/20 text-xs text-orange-900 dark:text-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Additional Proof Required</p>
                          <p className="text-muted-foreground mt-0.5">{b.additionalProofNotes}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 text-xs"
                        onClick={() => setReuploadBooking(b)}
                      >
                        <Upload className="size-3.5 mr-1" /> {t(lang, "uploadReplacementDoc")}
                      </Button>
                    </div>
                  )}

                  {b.status === "REJECTED" && (
                    <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/70 dark:bg-rose-950/20 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
                      <XCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{t(lang, "rejected")}</p>
                        <p className="text-muted-foreground mt-0.5">{b.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {b.status === "CHECKED_IN" && (
                    <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/70 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-indigo-600 shrink-0" />
                      <span>
                        Verified and checked in on {new Date(b.checkedInAt).toLocaleString()} ({b.checkedInMethod})
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
                    <div className="text-xs text-muted-foreground">
                      {b.accessibilityNeeds && (
                        <span>Assistance: <strong>{b.accessibilityNeeds}</strong> · </span>
                      )}
                      <span>Accompanying: <strong>{b.accompanyingCount}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasQr && (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                          onClick={() => setSelectedPass(b)}
                        >
                          <QrCode className="size-3.5 mr-1.5" /> {t(lang, "viewPass")}
                        </Button>
                      )}

                      {["SUBMITTED", "UNDER_REVIEW", "ADDITIONAL_PROOF_REQUIRED", "APPROVED"].includes(b.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => handleCancel(b.id)}
                          disabled={cancellingId === b.id}
                        >
                          {t(lang, "cancel")}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* QR Entry Pass Dialog */}
      {selectedPass && (
        <Dialog open onOpenChange={(o) => !o && setSelectedPass(null)}>
          <DialogContent className="max-w-md text-center p-6 space-y-4">
            <DialogHeader className="text-center">
              <span className="size-12 rounded-full bg-teal-100 text-teal-700 mx-auto grid place-items-center mb-1 dark:bg-teal-950 dark:text-teal-300">
                <QrCode className="size-6" />
              </span>
              <DialogTitle className="text-lg font-bold">
                Pushkaralu 2027 Priority Entry Pass
              </DialogTitle>
              <DialogDescription className="text-xs">
                Present this official digital or printed pass at the designated priority queue entrance
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-xl border bg-white text-slate-900 shadow-sm max-w-[240px] mx-auto aspect-square flex items-center justify-center">
              <div
                className="w-full h-full text-slate-900"
                dangerouslySetInnerHTML={{
                  __html: generateQrSvg(
                    formatQrPassPayload(selectedPass.applicationNumber, selectedPass.qrPassToken || ""),
                    2
                  ),
                }}
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/60 text-xs text-left space-y-1.5 border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pass Reference:</span>
                <span className="font-mono font-bold text-foreground">{selectedPass.applicationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Beneficiary:</span>
                <span className="font-semibold text-foreground">{selectedPass.beneficiaryName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-semibold text-foreground">
                  {selectedPass.category === "SENIOR_CITIZEN" ? "Senior Citizen (65+)" : "Person with Disability"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pushkar Ghat:</span>
                <span className="font-semibold text-foreground">{selectedPass.ghat?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visit Date & Slot:</span>
                <span className="font-semibold text-teal-700 dark:text-teal-300">
                  {selectedPass.visitDate} ({selectedPass.timeSlot ? `${selectedPass.timeSlot.startTime}-${selectedPass.timeSlot.endTime}` : "Confirmed"})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accompanying:</span>
                <span className="font-semibold text-foreground">+{selectedPass.accompanyingCount} person(s)</span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Please carry government photo ID matching the beneficiary name for physical verification at entry.
            </div>

            <DialogFooter className="flex gap-2 justify-center sm:justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="size-3.5" /> Print Pass
              </Button>
              <Button
                size="sm"
                onClick={() => setSelectedPass(null)}
              >
                {t(lang, "close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Replacement Document Upload Modal */}
      {reuploadBooking && (
        <Dialog open onOpenChange={(o) => !o && setReuploadBooking(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {t(lang, "uploadReplacementDoc")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Application: {reuploadBooking.applicationNumber} ({reuploadBooking.beneficiaryName})
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleReplacementSubmit} className="space-y-4 pt-2">
              <div className="p-3 rounded-lg border bg-amber-50/50 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="font-semibold">Reviewer Request:</p>
                <p className="mt-1">{reuploadBooking.additionalProofNotes}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="replacement-file" className="text-xs font-semibold">
                  Select Clear Replacement Document (PDF, JPEG, PNG, WebP)
                </Label>
                <Input
                  id="replacement-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setReplacementFile(e.target.files[0]);
                    }
                  }}
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReuploadBooking(null)}
                  disabled={uploading}
                >
                  {t(lang, "cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={uploading || !replacementFile}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {uploading ? "Uploading..." : "Submit Replacement Proof"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, ApiError } from "@/lib/api-client";
import { useBookingAuth } from "./booking-auth-modal";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Home, Soup, Users, Clock, ShieldCheck, CheckCircle2, AlertCircle, AlertTriangle,
  Calendar, RefreshCw, FileText, Info, Sparkles, Check, X,
} from "lucide-react";
import { calculateAnnadanamServingStatus, formatTime12h } from "@/lib/timing";

function formatTimeAgo(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ============================================================================
// 1. FREE ACCOMMODATION DETAIL CARD
// ============================================================================
export function FreeAccommodationDetailCard({
  listing,
  canManage,
  onUpdateCapacity,
  onBookStay,
}: {
  listing: any;
  canManage?: boolean;
  onUpdateCapacity: () => void;
  onBookStay: () => void;
}) {
  const { lang, user } = useApp();
  const acc = listing.freeAccommodation;

  const totalCap = acc?.totalCapacity != null ? Number(acc.totalCapacity) : null;
  const availCap = acc?.availableCapacity != null ? Number(acc.availableCapacity) : null;
  const isTempClosed = !!acc?.isTemporarilyUnavailable;
  const hasLiveCapacity = totalCap != null && totalCap > 0 && availCap != null;
  const occupancyPercent = hasLiveCapacity && totalCap ? Math.min(100, Math.max(0, Math.round(((totalCap - availCap) / totalCap) * 100))) : null;

  const status = acc?.availabilityStatus || (availCap === 0 ? "FULL" : (hasLiveCapacity ? "AVAILABLE" : "NOT_CONFIRMED"));

  return (
    <div className="space-y-6">
      {/* Live Capacity & Availability Banner */}
      <Card className="p-0 border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 to-background dark:from-indigo-950/20 shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b bg-indigo-50/30 dark:bg-indigo-950/30 flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-lg bg-indigo-600 text-white grid place-items-center shadow-sm">
              <Home className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Free Accommodation & Capacity Status
              </CardTitle>
              <CardDescription className="text-xs">
                Official pilgrim lodging facility · No room or bed charge
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isTempClosed ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium">
                <AlertTriangle className="size-3 mr-1" /> Temporarily Unavailable
              </Badge>
            ) : status === "FULL" || availCap === 0 ? (
              <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-medium">
                Completely Full
              </Badge>
            ) : hasLiveCapacity ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">
                <CheckCircle2 className="size-3 mr-1" /> Places Available
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border text-muted-foreground font-medium">
                Availability Not Confirmed
              </Badge>
            )}

            {canManage && (
              <Button size="sm" variant="outline" onClick={onUpdateCapacity} className="h-7 px-2.5 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300">
                <RefreshCw className="size-3 mr-1" /> Update Capacity
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* Capacity Progress Bar */}
          {hasLiveCapacity ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">{availCap}</span>
                  <span className="text-sm font-medium text-muted-foreground"> / {totalCap} places available</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  {100 - (occupancyPercent || 0)}% free
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    availCap <= 10 ? "bg-rose-500" : availCap <= Math.floor(totalCap * 0.25) ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, (availCap / totalCap) * 100))}%` }}
                />
              </div>
              {acc?.lastAvailabilityUpdate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="size-3" /> Availability updated {formatTimeAgo(acc.lastAvailabilityUpdate)}
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-lg border bg-muted/30 text-xs text-muted-foreground flex items-start gap-2.5">
              <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Current availability not confirmed</p>
                <p className="mt-0.5">
                  Live occupancy counts are not actively tracked for this centre. Accommodation is provided subject to hall or room readiness upon arrival. Please check the contact instructions below.
                </p>
              </div>
            </div>
          )}

          {/* Gender & Family Capacity Breakdown */}
          {(acc?.capacityMen != null || acc?.capacityWomen != null || acc?.capacityFamily != null) && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              {acc.capacityMen != null && (
                <div className="p-3 rounded-xl border bg-card text-center">
                  <p className="text-xs text-muted-foreground">Men's Dormitory</p>
                  <p className="text-base font-bold mt-0.5">
                    {acc.availableMen != null ? `${acc.availableMen} / ${acc.capacityMen}` : `${acc.capacityMen} capacity`}
                  </p>
                </div>
              )}
              {acc.capacityWomen != null && (
                <div className="p-3 rounded-xl border bg-card text-center">
                  <p className="text-xs text-muted-foreground">Women's Dormitory</p>
                  <p className="text-base font-bold mt-0.5">
                    {acc.availableWomen != null ? `${acc.availableWomen} / ${acc.capacityWomen}` : `${acc.capacityWomen} capacity`}
                  </p>
                </div>
              )}
              {acc.capacityFamily != null && (
                <div className="p-3 rounded-xl border bg-card text-center">
                  <p className="text-xs text-muted-foreground">Family Rooms</p>
                  <p className="text-base font-bold mt-0.5">
                    {acc.availableFamily != null ? `${acc.availableFamily} / ${acc.capacityFamily}` : `${acc.capacityFamily} capacity`}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Facilities & Stay Rules */}
      <Card className="p-0 shadow-sm">
        <CardHeader className="p-5 border-b pb-3">
          <CardTitle className="text-base font-semibold">Accommodation Facilities & Rules</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-sm">
            <div className="p-3 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground font-medium block">Accommodation Type</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {acc?.availableTypes || acc?.accommodationType?.replace(/_/g, " ") || "Dormitory / Halls"}
              </span>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground font-medium block">Reception & Check-in / Check-out</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {acc?.checkInTime || "06:00"} — {acc?.checkOutTime || "21:00"}
              </span>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground font-medium block">Maximum Permitted Stay</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                Up to {acc?.maxStayDays || 3} days per pilgrim
              </span>
            </div>
          </div>

          {acc?.eligibilityCriteria && (
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 dark:bg-indigo-950/20 text-sm space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-900 dark:text-indigo-200">
                <FileText className="size-4 text-indigo-600" />
                <span>Eligibility & Required Documents</span>
              </div>
              <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                {acc.eligibilityCriteria}
              </p>
            </div>
          )}

          {acc?.rules && (
            <div className="p-4 rounded-xl border bg-muted/30 text-sm space-y-1">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider block">Rules & Restrictions</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {acc.rules}
              </p>
            </div>
          )}

          {acc?.amenities && (
            <div className="space-y-2 pt-1">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider block">Amenities Provided</span>
              <div className="flex flex-wrap gap-2">
                {(typeof acc.amenities === "string" ? acc.amenities.split(/[,;\n]+/) : acc.amenities).map((a: string, i: number) => {
                  const label = a.trim();
                  if (!label) return null;
                  return (
                    <Badge key={i} variant="secondary" className="px-2.5 py-1 text-xs font-medium">
                      <Check className="size-3 mr-1 text-emerald-600" /> {label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration / Booking Action Box */}
      <Card className="p-0 border-indigo-200 dark:border-indigo-900/60 shadow-sm overflow-hidden">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-base text-foreground">
              {acc?.requiresRegistration ? "Advance Registration Required" : "Walk-in Accommodation Instructions"}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {acc?.requiresRegistration
                ? "This centre requires pilgrims to register their stay in advance to avoid overbooking."
                : "No advance registration needed. Accommodation is allotted directly at the reception on arrival."}
            </p>
            {acc?.registrationContact && (
              <p className="text-xs font-medium text-primary mt-1">
                Helpdesk: {acc.registrationContact}
              </p>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {acc?.requiresRegistration ? (
              <Button onClick={onBookStay} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Home className="size-4 mr-1.5" /> Request Free Stay / Register
              </Button>
            ) : listing.phone ? (
              <Button asChild variant="outline">
                <a href={`tel:${listing.phone}`}>Call Reception ({listing.phone})</a>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 2. FREE ANNADANAM & PRASADAM DETAIL CARD
// ============================================================================
export function AnnadanamDetailCard({
  listing,
  canManage,
  onUpdateStatus,
}: {
  listing: any;
  canManage?: boolean;
  onUpdateStatus: () => void;
}) {
  const { lang, user } = useApp();
  const ann = listing.annadanam;

  const statusResult = calculateAnnadanamServingStatus(ann);

  // Parse sessions
  let sessionsList: Array<{ name: string; startTime: string; endTime: string; description?: string }> = [];
  if (ann?.sessions) {
    if (Array.isArray(ann.sessions)) sessionsList = ann.sessions;
    else if (typeof ann.sessions === "string") {
      try { sessionsList = JSON.parse(ann.sessions); } catch { sessionsList = []; }
    }
  }

  return (
    <div className="space-y-6">
      {/* Real-time Serving Status Banner */}
      <Card className="p-0 border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50/50 to-background dark:from-orange-950/20 shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b bg-orange-50/30 dark:bg-orange-950/30 flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-lg bg-orange-600 text-white grid place-items-center shadow-sm">
              <Soup className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Free Annadanam & Prasadam Service Status
              </CardTitle>
              <CardDescription className="text-xs">
                {ann?.organizationName || "Charitable trust meal distribution"} · Free for all pilgrims
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                statusResult.badgeVariant === "open"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold flex items-center gap-1.5"
                  : statusResult.badgeVariant === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium"
                  : statusResult.badgeVariant === "closed"
                  ? "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-medium"
                  : "border-border text-muted-foreground font-medium"
              }
            >
              {statusResult.isServing && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
              {statusResult.label}
            </Badge>

            {canManage && (
              <Button size="sm" variant="outline" onClick={onUpdateStatus} className="h-7 px-2.5 text-xs border-orange-300 text-orange-700 hover:bg-orange-50 dark:text-orange-300">
                <RefreshCw className="size-3 mr-1" /> Update Status
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card">
            <div>
              <p className="text-sm font-semibold text-foreground">{statusResult.detail}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Food and prasadam are prepared purely for pilgrim welfare. Servings are provided subject to daily preparation.
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {ann?.queueWaitMinutes != null && ann.queueWaitMinutes > 0 && (
                <div className="text-center px-3 py-1.5 rounded-lg border bg-muted/30">
                  <span className="text-xs text-muted-foreground block">Estimated Queue</span>
                  <span className="text-sm font-bold text-foreground">~{ann.queueWaitMinutes} mins</span>
                </div>
              )}
              {ann?.remainingServings != null && (
                <div className="text-center px-3 py-1.5 rounded-lg border bg-muted/30">
                  <span className="text-xs text-muted-foreground block">Remaining Servings</span>
                  <span className="text-sm font-bold text-foreground">~{ann.remainingServings}</span>
                </div>
              )}
            </div>
          </div>

          {ann?.lastStatusUpdate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" /> Operational status last updated by staff: {formatTimeAgo(ann.lastStatusUpdate)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Distribution Sessions Schedule */}
      <Card className="p-0 shadow-sm">
        <CardHeader className="p-5 border-b pb-3">
          <CardTitle className="text-base font-semibold">Distribution Sessions Schedule</CardTitle>
          <CardDescription className="text-xs">Multiple meal & prasadam serving windows throughout the day</CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {sessionsList.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {sessionsList.map((sess, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{sess.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatTime12h(sess.startTime)} - {formatTime12h(sess.endTime)}
                    </Badge>
                  </div>
                  {sess.description && (
                    <p className="text-xs text-muted-foreground">{sess.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-lg border bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
              <Info className="size-4 shrink-0" />
              <span>Detailed session times are not configured for this distribution centre. Standard serving hours apply.</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 pt-2 text-sm">
            <div className="p-3 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground font-medium block">Dietary Standard</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {ann?.dietaryInfo === "SATVIK" ? "Satvik (No Onion/Garlic)" : ann?.dietaryInfo === "PRASADAM_ONLY" ? "Temple Pushkara Prasadam" : "100% Pure Vegetarian"}
              </span>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground font-medium block">Dining Hall Capacity</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {ann?.seatingCapacity ? `Seating for ${ann.seatingCapacity} devotees` : "Standing & Seated Hall"}
              </span>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <span className="text-xs text-muted-foreground font-medium block">Eligibility / Entry Fee</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                Free for all pilgrims
              </span>
            </div>
          </div>

          {ann?.eligibilityRules && (
            <div className="p-3.5 rounded-xl border bg-muted/30 text-xs text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground uppercase tracking-wider block">Entry & Queue Guidelines</span>
              <p>{ann.eligibilityRules}</p>
            </div>
          )}

          {ann?.specialDates && (
            <div className="p-3.5 rounded-xl border border-orange-100 bg-orange-50/40 dark:bg-orange-950/20 text-xs space-y-1">
              <span className="font-semibold text-orange-900 dark:text-orange-200 block">Festival & Special Service Days</span>
              <p className="text-orange-800 dark:text-orange-300">{ann.specialDates}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 3. FREE ACCOMMODATION BOOKING / REGISTRATION DIALOG
// ============================================================================
export function FreeAccommodationBookingDialog({
  listing,
  onClose,
  onDone,
}: {
  listing: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const { lang, user } = useApp();
  const { requireAuth } = useBookingAuth();
  const acc = listing.freeAccommodation;

  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [checkInDate, setCheckInDate] = useState(todayStr);
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);
  const [peopleCount, setPeopleCount] = useState(2);
  const [groupType, setGroupType] = useState<"FAMILY" | "MEN" | "WOMEN" | "MIXED">("FAMILY");
  const [guestName, setGuestName] = useState(user?.name || "");
  const [guestPhone, setGuestPhone] = useState(user?.phone || "");
  const [idProofType, setIdProofType] = useState("AADHAAR");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const maxStay = acc?.maxStayDays || 7;

  async function submit() {
    if (!guestName.trim() || !guestPhone.trim()) {
      toast({ title: "Error", description: "Name and phone number are required", variant: "destructive" });
      return;
    }
    const cin = new Date(checkInDate);
    const cout = new Date(checkOutDate);
    if (cout <= cin) {
      toast({ title: "Error", description: "Check-out date must be strictly after check-in date", variant: "destructive" });
      return;
    }
    const days = Math.ceil((cout.getTime() - cin.getTime()) / (1000 * 60 * 60 * 24));
    if (days > maxStay) {
      toast({ title: "Error", description: `Maximum stay duration is ${maxStay} days. You selected ${days} days.`, variant: "destructive" });
      return;
    }

    if (!requireAuth({
      type: "FREE_ACCOMMODATION",
      listingId: listing.id,
      title: `Free Accommodation · ${listing.name}`,
      details: `${peopleCount} pilgrims · ${checkInDate} to ${checkOutDate}`,
      data: {
        checkInDate,
        checkOutDate,
        peopleCount,
        groupType,
        guestName,
        guestPhone,
        idProofType,
        idProofNumber,
        specialNotes,
      },
      returnView: { name: "listing", id: listing.id },
    }, (authUser) => {
      setGuestName(authUser.name || guestName);
      setGuestPhone(authUser.phone || guestPhone);
      submit();
    })) {
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/bookings/accommodation", {
        listingId: listing.id,
        checkInDate,
        checkOutDate,
        peopleCount,
        groupType,
        guestName,
        guestPhone,
        idProofType,
        idProofNumber,
        specialNotes,
      });
      toast({ title: "Registration Successful", description: `Your stay at ${listing.name} has been registered!` });
      onDone();
    } catch (e) {
      toast({ title: "Registration Failed", description: e instanceof ApiError ? e.message : "Failed to register stay", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="size-5 text-indigo-600" />
            Register for Free Stay
          </DialogTitle>
          <DialogDescription>
            {listing.name} · Free pilgrim accommodation (Max {maxStay} days)
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 py-2 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Check-in Date</Label>
              <Input type="date" value={checkInDate} min={todayStr} onChange={(e) => setCheckInDate(e.target.value)} />
            </div>
            <div>
              <Label>Check-out Date</Label>
              <Input type="date" value={checkOutDate} min={checkInDate} onChange={(e) => setCheckOutDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Number of Pilgrims</Label>
              <Input type="number" min={1} max={50} value={peopleCount} onChange={(e) => setPeopleCount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Group Type</Label>
              <Select value={groupType} onValueChange={(v: any) => setGroupType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FAMILY">Family</SelectItem>
                  <SelectItem value="MEN">Men Group</SelectItem>
                  <SelectItem value="WOMEN">Women Group</SelectItem>
                  <SelectItem value="MIXED">Mixed / Senior Citizens</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full Name</Label>
              <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Primary guest name" />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="10-digit mobile number" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ID Proof Type</Label>
              <Select value={idProofType} onValueChange={setIdProofType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AADHAAR">Aadhaar Card</SelectItem>
                  <SelectItem value="VOTER_ID">Voter ID</SelectItem>
                  <SelectItem value="PASSPORT">Passport</SelectItem>
                  <SelectItem value="OTHER">Government Issued ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ID Number (Optional)</Label>
              <Input value={idProofNumber} onChange={(e) => setIdProofNumber(e.target.value)} placeholder="Last 4 digits / ID no." />
            </div>
          </div>

          <div>
            <Label>Special Requirements / Accessibility Needs</Label>
            <Textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} placeholder="e.g. Elderly pilgrim requiring ground-floor bedding" rows={2} />
          </div>

          <p className="text-xs text-muted-foreground">
            Note: Free accommodation is allotted strictly for genuine pilgrims. Please carry valid government ID proofs for verification at check-in.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {submitting ? "Registering..." : "Confirm Free Stay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// 4. UPDATE FREE ACCOMMODATION AVAILABILITY DIALOG (STAFF / ADMIN)
// ============================================================================
export function UpdateFreeAccommodationAvailabilityDialog({
  listing,
  onClose,
  onDone,
}: {
  listing: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const acc = listing.freeAccommodation;

  const [totalCapacity, setTotalCapacity] = useState(acc?.totalCapacity != null ? String(acc.totalCapacity) : "500");
  const [availableCapacity, setAvailableCapacity] = useState(acc?.availableCapacity != null ? String(acc.availableCapacity) : "150");
  const [capacityMen, setCapacityMen] = useState(acc?.capacityMen != null ? String(acc.capacityMen) : "");
  const [availableMen, setAvailableMen] = useState(acc?.availableMen != null ? String(acc.availableMen) : "");
  const [capacityWomen, setCapacityWomen] = useState(acc?.capacityWomen != null ? String(acc.capacityWomen) : "");
  const [availableWomen, setAvailableWomen] = useState(acc?.availableWomen != null ? String(acc.availableWomen) : "");
  const [availabilityStatus, setAvailabilityStatus] = useState(acc?.availabilityStatus || "AVAILABLE");
  const [isTemporarilyUnavailable, setIsTemporarilyUnavailable] = useState(!!acc?.isTemporarilyUnavailable);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const tot = totalCapacity ? Number(totalCapacity) : null;
    const avail = availableCapacity ? Number(availableCapacity) : null;

    if (tot != null && avail != null && avail > tot) {
      toast({ title: "Validation Error", description: `Available places (${avail}) cannot exceed total recorded capacity (${tot})`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/listings/${listing.id}/availability`, {
        totalCapacity: tot,
        availableCapacity: avail,
        capacityMen: capacityMen ? Number(capacityMen) : null,
        availableMen: availableMen ? Number(availableMen) : null,
        capacityWomen: capacityWomen ? Number(capacityWomen) : null,
        availableWomen: availableWomen ? Number(availableWomen) : null,
        availabilityStatus,
        isTemporarilyUnavailable,
      });
      toast({ title: "Success", description: "Accommodation availability updated successfully." });
      onDone();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to update availability", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-5 text-indigo-600" />
            Update Live Accommodation Availability
          </DialogTitle>
          <DialogDescription>
            {listing.name} · Authorized Staff & Admin Controls
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total Capacity</Label>
              <Input type="number" min="0" value={totalCapacity} onChange={(e) => setTotalCapacity(e.target.value)} />
            </div>
            <div>
              <Label>Currently Available</Label>
              <Input type="number" min="0" value={availableCapacity} onChange={(e) => setAvailableCapacity(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Men's Avail / Total</Label>
              <div className="flex gap-1.5">
                <Input type="number" min="0" placeholder="Avail" value={availableMen} onChange={(e) => setAvailableMen(e.target.value)} />
                <Input type="number" min="0" placeholder="Tot" value={capacityMen} onChange={(e) => setCapacityMen(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Women's Avail / Total</Label>
              <div className="flex gap-1.5">
                <Input type="number" min="0" placeholder="Avail" value={availableWomen} onChange={(e) => setAvailableWomen(e.target.value)} />
                <Input type="number" min="0" placeholder="Tot" value={capacityWomen} onChange={(e) => setCapacityWomen(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <Label>Availability Status</Label>
            <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="FEW_LEFT">Few Places Left</SelectItem>
                <SelectItem value="FULL">Completely Full</SelectItem>
                <SelectItem value="NOT_CONFIRMED">Not Confirmed</SelectItem>
                <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="tempUnavailModal" checked={isTemporarilyUnavailable} onChange={(e) => setIsTemporarilyUnavailable(e.target.checked)} />
            <Label htmlFor="tempUnavailModal">Mark centre as temporarily unavailable</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? "Saving..." : "Save Availability"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// 5. UPDATE ANNADANAM SERVING STATUS DIALOG (STAFF / ADMIN)
// ============================================================================
export function UpdateAnnadanamStatusDialog({
  listing,
  onClose,
  onDone,
}: {
  listing: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const ann = listing.annadanam;

  const [servingStatus, setServingStatus] = useState<"ACTIVE" | "PAUSED" | "ENDED" | "TEMPORARILY_UNAVAILABLE">(
    ann?.servingStatus || "ACTIVE"
  );
  const [queueWaitMinutes, setQueueWaitMinutes] = useState(ann?.queueWaitMinutes != null ? String(ann.queueWaitMinutes) : "");
  const [remainingServings, setRemainingServings] = useState(ann?.remainingServings != null ? String(ann.remainingServings) : "");
  const [seatingCapacity, setSeatingCapacity] = useState(ann?.seatingCapacity != null ? String(ann.seatingCapacity) : "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api.patch(`/listings/${listing.id}/availability`, {
        servingStatus,
        queueWaitMinutes: queueWaitMinutes ? Number(queueWaitMinutes) : null,
        remainingServings: remainingServings ? Number(remainingServings) : null,
        seatingCapacity: seatingCapacity ? Number(seatingCapacity) : null,
      });
      toast({ title: "Success", description: "Serving status and queue information updated." });
      onDone();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to update status", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Soup className="size-5 text-orange-600" />
            Update Annadanam Serving Status
          </DialogTitle>
          <DialogDescription>
            {listing.name} · Report live distribution status & waiting times
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 text-sm">
          <div>
            <Label>Current Distribution Status</Label>
            <Select value={servingStatus} onValueChange={(v: any) => setServingStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active / Currently Serving</SelectItem>
                <SelectItem value="PAUSED">Paused Temporarily by Staff</SelectItem>
                <SelectItem value="ENDED">Distribution Ended for Today</SelectItem>
                <SelectItem value="TEMPORARILY_UNAVAILABLE">Temporarily Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Queue Wait Time (Mins)</Label>
              <Input type="number" min="0" placeholder="e.g. 15" value={queueWaitMinutes} onChange={(e) => setQueueWaitMinutes(e.target.value)} />
            </div>
            <div>
              <Label>Remaining Servings (Est.)</Label>
              <Input type="number" min="0" placeholder="e.g. 250" value={remainingServings} onChange={(e) => setRemainingServings(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Seating Capacity</Label>
            <Input type="number" min="0" placeholder="e.g. 200" value={seatingCapacity} onChange={(e) => setSeatingCapacity(e.target.value)} />
          </div>

          <p className="text-xs text-muted-foreground">
            Only enter remaining servings or queue times when verified by on-ground volunteers.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
            {saving ? "Updating..." : "Update Live Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

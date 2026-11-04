"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "../use-api";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2, Waves, CheckCircle2, XCircle, Plus, ClipboardList, Megaphone, User as UserIcon,
  Store, PenLine, CheckCheck, Trash2, RefreshCw, Clock, BedDouble, Flame,
} from "lucide-react";
import { DeleteListingDialog } from "../delete-listing-dialog";
import { CrowdBadge } from "./home-view";
import { TimingManagerDialog } from "../timing-manager-dialog";
import { HotelRoomManager } from "../hotel-room-manager";
import { ReviewsModerationPanel } from "../reviews-moderation-panel";
import { SupervisorPriorityBookingSection } from "../priority-booking/supervisor-priority-booking-section";
import { NriOwnerSection } from "../nri/nri-owner-section";
import { NriVisitorSection } from "../nri/nri-visitor-section";
import { CeremonyBookingsSection } from "../ceremonies/ceremony-bookings-section";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-sky-100 text-sky-700 border-sky-200",
  SUBMITTED: "bg-amber-100 text-amber-700 border-amber-200",
  ACKNOWLEDGED: "bg-sky-100 text-sky-700 border-sky-200",
  ESCALATED: "bg-red-100 text-red-700 border-red-200",
  RESOLVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export function OwnerDashboard() {
  const { lang, navigate, user } = useApp();
  const allowed = user?.role === "BUSINESS_OWNER";
  const { data: listings, refetch } = useApi<{ items: any[] }>(allowed ? "/listings?status=PUBLISHED&limit=100" : "/listings?limit=1");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [timingTarget, setTimingTarget] = useState<any>(null);
  const [roomHotelTarget, setRoomHotelTarget] = useState<any>(null);

  if (!allowed) return <Deny />;
  const myRestaurants = listings?.items?.filter((l) => l.ownerId === user.id && l.category === "RESTAURANT") || [];
  const myHotels = listings?.items?.filter((l) => l.ownerId === user.id && l.category === "HOTEL") || [];

  async function handleDelete(listing: any) {
    setDeleting(true);
    try {
      const isArchived = listing.publicationStatus === "ARCHIVED";
      await api.del(`/listings/${listing.id}${isArchived ? "?permanent=true" : ""}`);
      toast({ title: "Success", description: t(lang, "listingDeleted") });
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof ApiError ? e.message : "Failed to delete listing",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex-1 container mx-auto max-w-5xl px-4 py-8">
      <Header icon={Store} title="Business Owner Dashboard" subtitle="Manage your listings, operating hours, room capacity, and bookings" />
      <div className="flex justify-end mb-4">
        <Button onClick={() => navigate({ name: "listing-form" })}><Plus className="size-4" /> {t(lang, "createListing")}</Button>
      </div>
      <BookingQueue kind="restaurant" />
      <BookingQueue kind="hotel" />

      <section className="mt-8 pt-6 border-t">
        <NriOwnerSection />
      </section>

      <section className="mt-8 pt-6 border-t">
        <h2 className="font-semibold mb-3">My Listings ({myRestaurants.length + myHotels.length})</h2>
        <div className="space-y-2">
          {[...myRestaurants, ...myHotels].map((l) => (
            <Card key={l.id} className="p-0"><CardContent className="p-3 flex items-center gap-3 flex-wrap">
              <span className="size-10 rounded-lg bg-muted grid place-items-center overflow-hidden shrink-0">
                {l.primaryImage ? <img src={l.primaryImage} alt="" className="w-full h-full object-cover" /> : <Building2 className="size-4 text-muted-foreground" />}
              </span>
              <div className="flex-1 min-w-[140px]">
                <p className="font-medium truncate">{l.name}</p>
                <p className="text-xs text-muted-foreground">{l.category.replace(/_/g, " ")}</p>
              </div>
              <Badge variant="outline">{l.publicationStatus}</Badge>
              {l.category === "HOTEL" && (
                <Button size="sm" variant="outline" onClick={() => setRoomHotelTarget(l)}>
                  <BedDouble className="size-3.5 mr-1" /> Rooms
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setTimingTarget(l)}>
                <Clock className="size-3.5 mr-1" /> Hours
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate({ name: "listing-form", id: l.id })}>{t(lang, "edit")}</Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteTarget(l)}
              >
                <Trash2 className="size-3.5 mr-1" />
                {t(lang, "delete")}
              </Button>
            </CardContent></Card>
          ))}
          {myRestaurants.length + myHotels.length === 0 && <Empty text="No listings yet. Create your first one." />}
        </div>
      </section>

      <section className="mt-8 pt-6 border-t">
        <ReviewsModerationPanel
          title="Customer Reviews & Feedback"
          subtitle="View and moderate reviews for your authorized listings in compliance with platform policy"
        />
      </section>
      {deleteTarget && (
        <DeleteListingDialog
          listing={deleteTarget}
          isDeleting={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
      {timingTarget && (
        <TimingManagerDialog
          listingId={timingTarget.id}
          listingName={timingTarget.name}
          category={timingTarget.category}
          currentSchedule={timingTarget.schedule}
          onClose={() => setTimingTarget(null)}
          onSaved={() => { setTimingTarget(null); refetch(); }}
        />
      )}
      {roomHotelTarget && (
        <Dialog open onOpenChange={(o) => !o && setRoomHotelTarget(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <HotelRoomManager
              hotelId={roomHotelTarget.id}
              hotelName={roomHotelTarget.name}
              onClose={() => { setRoomHotelTarget(null); refetch(); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BookingQueue({ kind }: { kind: "restaurant" | "hotel" }) {
  const { navigate } = useApp();
  const [r, setR] = useState(0);
  const { data, loading } = useApi<{ items: any[] }>(`/bookings/${kind}`, [r]);
  async function decide(id: string, status: string) {
    try { await api.patch(`/bookings/${kind}/${id}`, { status }); toast({ title: `Booking ${status.toLowerCase()}` }); setR((x) => x + 1); }
    catch (e) { toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" }); }
  }
  return (
    <section className="mb-6">
      <h2 className="font-semibold mb-3 capitalize">{kind} Bookings</h2>
      <Card className="p-0"><CardContent className="p-0">
        {loading ? <Skeleton className="h-24" /> : (
          <div className="divide-y max-h-72 overflow-y-auto nice-scroll">
            {data?.items?.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <p className="font-medium text-sm truncate">{b.listing?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {kind === "restaurant" ? `${b.bookingDate} · ${b.timeSlot} · ${b.peopleCount} ppl` : `${b.checkIn} → ${b.checkOut} · ${b.rooms}r/${b.guests}g`}
                  </p>
                  <p className="text-xs text-muted-foreground">{b.user?.name} · {b.user?.phone}</p>
                </div>
                <Badge variant="outline" className={STATUS_COLORS[b.status]}>{b.status}</Badge>
                {b.status === "PENDING" && (
                  <>
                    <Button size="sm" onClick={() => decide(b.id, "APPROVED")}><CheckCircle2 className="size-3.5" /></Button>
                    <Button size="sm" variant="outline" onClick={() => decide(b.id, "REJECTED")}><XCircle className="size-3.5" /></Button>
                  </>
                )}
                {b.listingId && <Button size="sm" variant="ghost" onClick={() => navigate({ name: "listing", id: b.listingId })}>View</Button>}
              </div>
            ))}
            {data?.items?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No {kind} bookings.</p>}
          </div>
        )}
      </CardContent></Card>
    </section>
  );
}

export function GhatReporterView() {
  const { lang, navigate, user } = useApp();
  const allowed = user?.role === "GHAT_SUPERVISOR" || user?.role === "SUPER_ADMIN";
  const [r, setR] = useState(0);
  const { data: myAssignments } = useApi<{ items: any[] }>(user?.id ? `/admin/users/${user.id}/assign` : null);
  const { data: ghats } = useApi<{ items: any[] }>("/listings?category=GHAT&limit=100");
  const { data: reports } = useApi<{ items: any[] }>(allowed ? "/ghats/reports" : null, [r]);
  const [selGhat, setSelGhat] = useState("");
  const [status, setStatus] = useState("MODERATE");
  const [notes, setNotes] = useState("");
  const [incident, setIncident] = useState("NONE");
  const [submitting, setSubmitting] = useState(false);

  if (!allowed) return <Deny />;

  const ghatAssignments = myAssignments?.items?.filter((a: any) => a.type === "GHAT_SUPERVISOR") || [];
  const assignedGhatIds = ghatAssignments.map((a: any) => a.listingId).filter(Boolean);
  const myGhats = ghats?.items?.filter((g) => assignedGhatIds.includes(g.id)) || [];
  const myReports = reports?.items?.filter((rp: any) => rp.reporterId === user.id) || [];

  async function submit() {
    if (!selGhat) { toast({ title: "Error", description: "Select a ghat", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      await api.post("/ghats/reports", { listingId: selGhat, crowdStatus: status, notes, incidentType: incident });
      toast({ title: "Success", description: t(lang, "reportSubmitted") });
      setNotes(""); setR((x) => x + 1);
    } catch (e) { toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" }); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="flex-1 container mx-auto max-w-4xl px-4 py-8">
      <Header icon={Megaphone} title="Ghat Reporter" subtitle="Submit crowd observations for your assigned ghats" />
      {myGhats.length === 0 && (
        <Card className="p-0 mb-6 border-amber-200 bg-amber-50"><CardContent className="p-4 text-sm text-amber-800">
          You have no ghat assignments yet. A Super Admin must assign ghats to you before you can report.
        </CardContent></Card>
      )}
      <Card className="p-0 mb-6">
        <CardHeader><CardTitle>{t(lang, "submitReport")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Ghat</Label>
            <Select value={selGhat} onValueChange={setSelGhat}>
              <SelectTrigger><SelectValue placeholder="Select assigned ghat" /></SelectTrigger>
              <SelectContent>
                {myGhats.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t(lang, "crowdStatus")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="MODERATE">Moderate</SelectItem>
                  <SelectItem value="CROWDED">Crowded</SelectItem>
                  <SelectItem value="OVERCROWDED">Overcrowded</SelectItem>
                  <SelectItem value="EMERGENCY">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Incident Type</Label>
              <Select value={incident} onValueChange={setIncident}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="BLOCKED_ACCESS">Blocked Access</SelectItem>
                  <SelectItem value="MEDICAL_ASSISTANCE">Medical Assistance</SelectItem>
                  <SelectItem value="FACILITY_ISSUE">Facility Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          <Button onClick={submit} disabled={submitting}>{submitting ? t(lang, "loading") : t(lang, "submitReport")}</Button>
        </CardContent>
      </Card>
      <Card className="p-0"><CardHeader><CardTitle>{t(lang, "reportHistory")}</CardTitle></CardHeader><CardContent className="p-0">
        <div className="divide-y max-h-80 overflow-y-auto nice-scroll">
          {myReports.map((rp: any) => (
            <div key={rp.id} className="flex items-center gap-3 p-3">
              <Waves className="size-4 text-sky-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{rp.listing?.name} · <Badge variant="outline" className={STATUS_COLORS[rp.crowdStatus]}>{rp.crowdStatus}</Badge></p>
                {rp.notes && <p className="text-xs text-muted-foreground">{rp.notes}</p>}
                <p className="text-xs text-muted-foreground">{new Date(rp.createdAt).toLocaleString()}</p>
              </div>
              <Badge variant="outline" className={STATUS_COLORS[rp.reviewStatus]}>{rp.reviewStatus}</Badge>
            </div>
          ))}
          {myReports.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No reports submitted yet.</p>}
        </div>
      </CardContent></Card>
    </div>
  );
}

export function GhatSupervisorView() {
  const { lang, user, navigate } = useApp();
  const allowed = user?.role === "GHAT_SUPERVISOR" || user?.role === "SUPER_ADMIN";
  const [r, setR] = useState(0);
  const { data: myAssignments } = useApi<{ items: any[] }>(user?.id ? `/admin/users/${user.id}/assign` : null);
  const { data: ghats, refetch: refetchGhats } = useApi<{ items: any[] }>("/listings?category=GHAT&limit=100", [r]);
  const { data, loading, refetch: refetchReports } = useApi<{ items: any[] }>(allowed ? "/ghats/reports?limit=100" : null, [r]);
  const [statusTarget, setStatusTarget] = useState<any>(null);
  const [timingTarget, setTimingTarget] = useState<any>(null);

  if (!allowed) return <Deny />;

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const supervisorAssignments = myAssignments?.items?.filter((a: any) => a.type === "GHAT_SUPERVISOR") || [];
  const assignedGhatIds = supervisorAssignments.map((a: any) => a.listingId).filter(Boolean);
  const myGhats = isSuperAdmin
    ? (ghats?.items || [])
    : (ghats?.items?.filter((g) => assignedGhatIds.includes(g.id) || g.ghat?.supervisorId === user.id) || []);

  async function review(id: string, status: string) {
    try {
      await api.patch(`/ghats/reports/${id}`, { reviewStatus: status });
      toast({ title: status === "ACKNOWLEDGED" ? "Acknowledged" : status === "ESCALATED" ? "Escalated" : "Resolved" });
      setR((x) => x + 1);
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" });
    }
  }

  return (
    <div className="flex-1 container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <Header icon={ClipboardList} title="Ghat Supervisor Dashboard" subtitle="Manage real-time crowd status and act on incoming ground reports for your assigned ghats" />

      {/* Assigned Ghats Management Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Waves className="size-5 text-sky-600" />
              {isSuperAdmin ? "All Ghats Crowd Status (Super Admin)" : `My Assigned Ghats (${myGhats.length})`}
            </h2>
            <p className="text-xs text-muted-foreground">Update and report live crowd congestion levels</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { refetchGhats(); refetchReports(); }}>
            <RefreshCw className="size-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {myGhats.length === 0 ? (
          <Card className="p-0 border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-800">
              You have no ghat assignments yet. A Super Admin must assign ghats to you before you can manage their crowd status.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {myGhats.map((g: any) => {
              const crowd = g.ghat?.currentCrowdStatus;
              return (
                <Card key={g.id} className="p-0 overflow-hidden shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-base">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{[g.locality, g.town, g.district].filter(Boolean).join(", ") || "Godavari Riverbank"}</p>
                      </div>
                      <CrowdBadge status={crowd} />
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t">
                      <span>Last Updated:</span>
                      <span className="font-medium text-foreground">
                        {g.ghat?.statusUpdatedAt
                          ? new Date(g.ghat.statusUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : "Not reported yet"}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 pt-1 flex-wrap">
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => navigate({ name: "listing", id: g.id })}>
                        View
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setTimingTarget(g)}>
                        <Clock className="size-3.5 mr-1" /> Hours & Closures
                      </Button>
                      <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setStatusTarget(g)}>
                        <Waves className="size-3.5 mr-1" /> Crowd Status
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Priority Ghat Booking Management (Senior Citizens & PwD) */}
      <section className="pt-2">
        <SupervisorPriorityBookingSection
          assignedGhats={myGhats}
          isSuperAdmin={isSuperAdmin}
        />
      </section>

      {/* Ground Reports Stream */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Incoming Ground Reports</h2>
        <Card className="p-0">
          <CardContent className="p-0">
            {loading ? <Skeleton className="h-40" /> : (
              <div className="divide-y max-h-[50vh] overflow-y-auto nice-scroll">
                {data?.items?.map((rp: any) => (
                  <div key={rp.id} className="flex items-start gap-3 p-4 flex-wrap">
                    <Waves className="size-5 text-sky-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-medium">{rp.listing?.name} <Badge variant="outline" className={STATUS_COLORS[rp.crowdStatus]}>{rp.crowdStatus}</Badge></p>
                      {rp.incidentType !== "NONE" && <p className="text-xs text-amber-600">Incident: {rp.incidentType.replace(/_/g, " ")}</p>}
                      {rp.notes && <p className="text-sm text-muted-foreground mt-1">{rp.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">By {rp.reporter?.name} · {new Date(rp.createdAt).toLocaleString()}</p>
                    </div>
                    <Badge variant="outline" className={STATUS_COLORS[rp.reviewStatus]}>{rp.reviewStatus}</Badge>
                    {rp.reviewStatus === "SUBMITTED" && <Button size="sm" onClick={() => review(rp.id, "ACKNOWLEDGED")}><CheckCheck className="size-3.5" /> {t(lang, "acknowledged")}</Button>}
                    {(rp.reviewStatus === "SUBMITTED" || rp.reviewStatus === "ACKNOWLEDGED") && <Button size="sm" variant="outline" onClick={() => review(rp.id, "ESCALATED")}>{t(lang, "escalate")}</Button>}
                    {rp.reviewStatus !== "RESOLVED" && <Button size="sm" variant="ghost" onClick={() => review(rp.id, "RESOLVED")}>{t(lang, "resolve")}</Button>}
                  </div>
                ))}
                {data?.items?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No reports yet.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 pt-6 border-t">
        <ReviewsModerationPanel
          title="Assigned Ghat Reviews & Feedback"
          subtitle="Monitor cleanliness, overcrowding, facilities, and visitor reports for your assigned ghats"
        />
      </section>

      {statusTarget && (
        <SupervisorStatusDialog
          ghat={statusTarget}
          onClose={() => setStatusTarget(null)}
          onDone={() => {
            setStatusTarget(null);
            setR((x) => x + 1);
          }}
        />
      )}

      {timingTarget && (
        <TimingManagerDialog
          listingId={timingTarget.id}
          listingName={timingTarget.name}
          category="GHAT"
          currentSchedule={timingTarget.schedule}
          onClose={() => setTimingTarget(null)}
          onSaved={() => {
            setTimingTarget(null);
            refetchGhats();
          }}
        />
      )}
    </div>
  );
}

function SupervisorStatusDialog({
  ghat,
  onClose,
  onDone,
}: {
  ghat: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<string>(ghat.ghat?.currentCrowdStatus || "FREE");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await api.patch<{ ok: boolean; message: string }>(`/ghats/${ghat.id}/status`, {
        crowdStatus: status,
        notes: notes || undefined,
      });
      toast({
        title: "Crowd Status Updated",
        description: res.message || `${ghat.name} crowd status updated to ${status}.`,
      });
      onDone();
    } catch (e) {
      toast({
        title: "Update Failed",
        description: e instanceof ApiError ? e.message : "Failed to update ghat status.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-sky-600 mb-1">
            <Waves className="size-5" />
            <DialogTitle>Update Crowd Status</DialogTitle>
          </div>
          <DialogDescription>
            Update live crowd level for <strong>{ghat.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Crowd Status Level</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select crowd status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">FREE — Low crowd level</SelectItem>
                <SelectItem value="MODERATE">MODERATE — Medium crowd level</SelectItem>
                <SelectItem value="CROWDED">CROWDED — High crowd level</SelectItem>
                <SelectItem value="CLOSED">CLOSED — Temporarily closed</SelectItem>
                <SelectItem value="OVERCROWDED">OVERCROWDED — Very high crowd level</SelectItem>
                <SelectItem value="EMERGENCY">EMERGENCY — Emergency alert status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observation Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Queue moving smoothly, north entry open..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white">
            {submitting ? "Saving..." : "Save Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewerDashboard() {
  const { user } = useApp();
  const allowed = user?.role === "BOOKING_REVIEWER" || user?.role === "SUPER_ADMIN";
  if (!allowed) return <Deny />;
  return (
    <div className="flex-1 container mx-auto max-w-5xl px-4 py-8">
      <Header icon={CheckCheck} title="Booking Reviewer" subtitle="Process incoming booking requests" />
      <BookingQueue kind="restaurant" />
      <BookingQueue kind="hotel" />
    </div>
  );
}

export function EditorDashboard() {
  const { lang, navigate, user } = useApp();
  const allowed = user?.role === "SUPER_ADMIN";
  const { data, loading, refetch } = useApi<{ items: any[] }>(allowed ? "/listings?limit=100" : null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  if (!allowed) return <Deny />;

  async function handleDelete(listing: any) {
    setDeleting(true);
    try {
      const isArchived = listing.publicationStatus === "ARCHIVED";
      await api.del(`/listings/${listing.id}${isArchived ? "?permanent=true" : ""}`);
      toast({ title: "Success", description: t(lang, "listingDeleted") });
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof ApiError ? e.message : "Failed to delete listing",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex-1 container mx-auto max-w-5xl px-4 py-8">
      <Header icon={PenLine} title="Directory Editor" subtitle="Create and manage listings" />
      <div className="flex justify-end mb-4"><Button onClick={() => navigate({ name: "listing-form" })}><Plus className="size-4" /> {t(lang, "createListing")}</Button></div>
      <Card className="p-0"><CardContent className="p-0">
        {loading ? <Skeleton className="h-40" /> : (
          <div className="divide-y max-h-[60vh] overflow-y-auto nice-scroll">
            {data?.items?.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <Building2 className="size-5 text-violet-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.category.replace(/_/g, " ")} · {[l.town, l.district].filter(Boolean).join(", ")}</p>
                </div>
                <Badge variant="outline">{l.publicationStatus}</Badge>
                <Button size="sm" variant="ghost" onClick={() => navigate({ name: "listing-form", id: l.id })}>{t(lang, "edit")}</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate({ name: "listing", id: l.id })}>View</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(l)}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  {t(lang, "delete")}
                </Button>
              </div>
            ))}
            {data?.items?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No listings yet.</p>}
          </div>
        )}
      </CardContent></Card>
      {deleteTarget && (
        <DeleteListingDialog
          listing={deleteTarget}
          isDeleting={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}

export function VisitorDashboard() {
  const { lang, navigate, user } = useApp();
  if (!user) return <Deny />;
  return (
    <div className="flex-1 container mx-auto max-w-3xl px-4 py-8">
      <Header icon={UserIcon} title={`Welcome, ${user.name || "Visitor"}`} subtitle="Your Godavari One account" />
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        <DashCard icon={ClipboardList} title={t(lang, "bookings")} desc="Restaurant & hotel stays" onClick={() => navigate({ name: "bookings" })} />
        <DashCard icon={Flame} title="Ceremonies & Rites" desc="Ancestral rituals with purohits" onClick={() => navigate({ name: "ceremonies" })} />
        <DashCard icon={Building2} title={t(lang, "favorites")} desc="Saved listings" onClick={() => navigate({ name: "favorites" })} />
        <DashCard icon={Megaphone} title={t(lang, "notifications")} desc="Recent updates" onClick={() => navigate({ name: "notifications" })} />
        <DashCard icon={Building2} title={t(lang, "directory")} desc="Browse all listings" onClick={() => navigate({ name: "directory" })} />
      </div>

      <div className="mt-8 pt-6 border-t space-y-6">
        <section className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
          <CeremonyBookingsSection />
        </section>
        <section className="p-4 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900">
          <NriVisitorSection />
        </section>
      </div>
    </div>
  );
}

function DashCard({ icon: Icon, title, desc, onClick }: { icon: any; title: string; desc: string; onClick: () => void }) {
  return (
    <Card className="p-0 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer" onClick={onClick}>
      <CardContent className="p-5 flex items-center gap-3">
        <span className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon className="size-5" /></span>
        <div><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
      </CardContent>
    </Card>
  );
}

function Header({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="size-11 rounded-xl bg-primary text-primary-foreground grid place-items-center"><Icon className="size-5" /></span>
      <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
    </div>
  );
}

function Deny() {
  return <div className="flex-1 container mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">You don&apos;t have permission to view this page.</div>;
}

function Empty({ text }: { text: string }) {
  return <Card className="p-0"><CardContent className="p-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>;
}

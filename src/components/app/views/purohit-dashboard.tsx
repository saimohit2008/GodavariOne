"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Clock, MapPin, Phone, Mail, Plus, Search, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, Flame, Flower2, Award, Check, User, Trash2, Ban,
  CalendarDays,
} from "lucide-react";

const ALL_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export function PurohitDashboard() {
  const { user } = useApp();
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"bookings" | "schedule" | "profile">("bookings");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Reschedule dialog
  const [rescheduleBooking, setRescheduleBooking] = useState<any>(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  // Decline dialog
  const [declineBooking, setDeclineBooking] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  // Block slot dialog
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState("");
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockReason, setBlockReason] = useState("");
  const [blocking, setBlocking] = useState(false);

  // Schedule settings
  const [workingStart, setWorkingStart] = useState("06:00");
  const [workingEnd, setWorkingEnd] = useState("18:00");
  const [breakStart, setBreakStart] = useState("12:30");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [slotDuration, setSlotDuration] = useState(60);
  const [workingDays, setWorkingDays] = useState<string[]>(ALL_DAYS);
  const [savingSchedule, setSavingSchedule] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Fetch Purohits list to find profile matching current user
      const purohitsRes = await api.get<{ items: any[] }>("/ceremonies/purohits");
      const myProfile = purohitsRes.items.find(
        p => p.userId === user?.id || p.phone === user?.phone
      ) || purohitsRes.items[0]; // fallback if super admin testing

      if (myProfile) {
        // Fetch detailed profile with blocked slots
        const detailRes = await api.get<{ purohit: any }>(`/ceremonies/purohits/${myProfile.id}`);
        setProfile(detailRes.purohit);
        setWorkingStart(detailRes.purohit.workingHoursStart || "06:00");
        setWorkingEnd(detailRes.purohit.workingHoursEnd || "18:00");
        setBreakStart(detailRes.purohit.breakStart || "12:30");
        setBreakEnd(detailRes.purohit.breakEnd || "14:00");
        setSlotDuration(detailRes.purohit.slotDurationMinutes || 60);
        setWorkingDays(Array.isArray(detailRes.purohit.workingDays) ? detailRes.purohit.workingDays : ALL_DAYS);
      }

      // 2. Fetch bookings for this purohit (server-side scoped!)
      const bookingsRes = await api.get<{ items: any[] }>("/ceremonies/bookings");
      setBookings(bookingsRes.items || []);
    } catch (e: any) {
      toast({ title: "Failed to load purohit workspace", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "PUROHIT" || user?.role === "SUPER_ADMIN") {
      loadData();
    }
  }, [user?.role]);

  if (user?.role !== "PUROHIT" && user?.role !== "SUPER_ADMIN") {
    return (
      <div className="flex-1 container mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        Access restricted. This sacred workspace is reserved for registered Vedic Purohits.
      </div>
    );
  }

  async function handleConfirmBooking(bookingId: string) {
    try {
      await api.patch(`/ceremonies/bookings/${bookingId}`, { action: "CONFIRM" });
      toast({ title: "Booking Confirmed", description: "You accepted the ceremony booking." });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleCompleteBooking(bookingId: string) {
    try {
      await api.patch(`/ceremonies/bookings/${bookingId}`, { action: "COMPLETE" });
      toast({ title: "Ceremony Completed", description: "Marked sacred rites as successfully performed." });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleDeclineSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!declineBooking) return;
    setDeclining(true);
    try {
      await api.patch(`/ceremonies/bookings/${declineBooking.id}`, {
        action: "DECLINE",
        reason: declineReason.trim() || "Purohit is unable to perform this ceremony on requested slot",
      });
      toast({ title: "Booking Declined", description: "The slot has been released." });
      setDeclineBooking(null);
      setDeclineReason("");
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeclining(false);
    }
  }

  async function handleRescheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleBooking) return;
    setRescheduling(true);
    try {
      await api.patch(`/ceremonies/bookings/${rescheduleBooking.id}`, {
        action: "RESCHEDULE_REQUEST",
        rescheduleProposedDate: proposedDate,
        rescheduleProposedTime: proposedTime,
        rescheduleReason: rescheduleReason.trim() || "Purohit proposed alternative sacred slot",
      });
      toast({ title: "Reschedule Proposed", description: "Visitor has been notified of the requested timing change." });
      setRescheduleBooking(null);
      setProposedDate("");
      setProposedTime("");
      setRescheduleReason("");
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRescheduling(false);
    }
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingSchedule(true);
    try {
      await api.patch(`/ceremonies/purohits/${profile.id}`, {
        workingHoursStart: workingStart,
        workingHoursEnd: workingEnd,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        slotDurationMinutes: Number(slotDuration),
        workingDays,
      });
      toast({ title: "Schedule Updated", description: "Your availability and working hours are saved." });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleBlockSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBlocking(true);
    try {
      await api.post(`/ceremonies/purohits/${profile.id}/availability`, {
        startDate: blockStartDate,
        endDate: blockEndDate || blockStartDate,
        startTime: blockAllDay ? null : blockStartTime,
        endTime: blockAllDay ? null : blockEndTime,
        isAllDay: blockAllDay,
        reason: blockReason.trim() || "Purohit unavailable",
      });
      toast({ title: "Time Blocked", description: "Selected period will not accept ceremony bookings." });
      setBlockModalOpen(false);
      setBlockStartDate("");
      setBlockEndDate("");
      setBlockStartTime("");
      setBlockEndTime("");
      setBlockReason("");
      loadData();
    } catch (e: any) {
      toast({ title: "Failed to block slot", description: e.message, variant: "destructive" });
    } finally {
      setBlocking(false);
    }
  }

  async function handleUnblockSlot(slotId: string) {
    if (!profile) return;
    try {
      await api.del(`/ceremonies/purohits/${profile.id}/blocked-slots/${slotId}`);
      toast({ title: "Unblocked", description: "Slot released back to availability." });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  function toggleDay(day: string) {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    return true;
  });

  const upcomingCount = bookings.filter(b => b.status === "CONFIRMED").length;
  const pendingCount = bookings.filter(b => b.status === "PENDING").length;
  const completedCount = bookings.filter(b => b.status === "COMPLETED").length;

  return (
    <div className="flex-1 container mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Sacred Purohit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-700 via-amber-800 to-amber-950 text-white shadow-md">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="size-9 rounded-xl bg-amber-400/20 grid place-items-center border border-amber-300/30">
              <Flame className="size-5 text-amber-200" />
            </span>
            <Badge className="bg-amber-400/20 text-amber-100 border-amber-300/30 text-xs font-semibold">
              Vedic Purohit Workspace
            </Badge>
            {profile?.verificationStatus === "VERIFIED" && (
              <Badge className="bg-emerald-500 text-white text-xs">Verified Priest</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {profile?.fullName || user?.name || "Vedic Purohit"}
          </h1>
          <p className="text-xs text-amber-100/80">
            {profile?.serviceArea || "Pushkar Ghat, Rajahmundry"} · Sacred Pushkaralu Ancestral Rites Management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="border-amber-300/30 text-white hover:bg-amber-800">
            <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setBlockModalOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
            <Ban className="size-4 mr-1.5" /> Block Dates/Slots
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Confirmed Ceremonies</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700">{upcomingCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Scheduled rites</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Pending Approval</p>
          <p className="text-2xl font-bold mt-1 text-amber-700">{pendingCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting acceptance</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Completed Ceremonies</p>
          <p className="text-2xl font-bold mt-1 text-sky-700">{completedCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Conducted successfully</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Daily Available Hours</p>
          <p className="text-lg font-bold mt-1 text-foreground">{workingStart} - {workingEnd}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Break: {breakStart} - {breakEnd}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={activeTab === "bookings" ? "default" : "ghost"}
          onClick={() => setActiveTab("bookings")}
          className="gap-2"
        >
          <Calendar className="size-4" /> My Ceremonies ({bookings.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "schedule" ? "default" : "ghost"}
          onClick={() => setActiveTab("schedule")}
          className="gap-2"
        >
          <Clock className="size-4" /> Availability & Working Hours
        </Button>
        <Button
          size="sm"
          variant={activeTab === "profile" ? "default" : "ghost"}
          onClick={() => setActiveTab("profile")}
          className="gap-2"
        >
          <User className="size-4" /> Profile Details
        </Button>
      </div>

      {/* TAB 1: Bookings Management */}
      {activeTab === "bookings" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">My Sacred Ceremony Bookings</CardTitle>
                <CardDescription>
                  Review visiting pilgrim bookings, contact details, customary notes, and mark ceremonies as completed.
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="CONFIRMED">CONFIRMED</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="RESCHEDULE_REQUESTED">RESCHEDULE_REQUESTED</SelectItem>
                  <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                  <SelectItem value="DECLINED">DECLINED</SelectItem>
                  <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Flower2 className="size-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="font-semibold text-sm">No Ceremony Bookings Found</p>
                <p className="text-xs mt-1">Bookings made by pilgrims will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((b) => (
                  <div key={b.id} className="p-4 rounded-xl border bg-card hover:border-amber-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {b.bookingReference}
                        </span>
                        <Badge
                          variant={b.status === "CONFIRMED" ? "default" : b.status === "COMPLETED" ? "secondary" : "outline"}
                          className={b.status === "CONFIRMED" ? "bg-emerald-600 text-white" : b.status === "COMPLETED" ? "bg-sky-600 text-white" : ""}
                        >
                          {b.status}
                        </Badge>
                        <span className="text-xs font-semibold text-emerald-700">₹{b.serviceFee} (Dakshina & Samagri)</span>
                      </div>

                      <div>
                        <p className="font-bold text-base text-foreground">{b.ceremonyType}</p>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <span className="flex items-center gap-1 font-semibold text-foreground"><Calendar className="size-3" /> {b.bookingDate}</span>
                          <span className="flex items-center gap-1 font-semibold text-foreground"><Clock className="size-3" /> {b.startTime} - {b.endTime} ({b.durationMinutes} min)</span>
                          <span className="flex items-center gap-1"><MapPin className="size-3" /> {b.locationAddress}</span>
                          <span>Participants: <strong>{b.participantsCount}</strong></span>
                        </p>
                      </div>

                      {/* Visitor details authorized for performing ceremony */}
                      <div className="text-xs bg-muted/40 p-2.5 rounded-lg border space-y-1">
                        <p className="font-medium text-foreground">
                          Pilgrim: <span className="font-bold">{b.visitorName}</span> · Phone: <a href={`tel:${b.visitorPhone}`} className="text-primary font-bold underline">{b.visitorPhone}</a> {b.visitorEmail && `· Email: ${b.visitorEmail}`}
                        </p>
                        {b.customaryRequirements && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Customary Notes / Gotra:</span> {b.customaryRequirements}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {b.status === "PENDING" && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmBooking(b.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="size-3.5 mr-1" /> Accept
                        </Button>
                      )}
                      {b.status === "CONFIRMED" && (
                        <Button
                          size="sm"
                          onClick={() => handleCompleteBooking(b.id)}
                          className="bg-sky-600 hover:bg-sky-700 text-white"
                        >
                          <CheckCircle2 className="size-3.5 mr-1" /> Mark Done
                        </Button>
                      )}
                      {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRescheduleBooking(b);
                              setProposedDate(b.bookingDate);
                              setProposedTime(b.startTime);
                              setRescheduleReason("");
                            }}
                          >
                            Reschedule
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setDeclineBooking(b);
                              setDeclineReason("");
                            }}
                          >
                            Decline
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Availability & Working Hours */}
      {activeTab === "schedule" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recurring Availability & Working Hours</CardTitle>
              <CardDescription>
                Configure the days of the week, working hours, and customary break times when you perform ceremonies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSchedule} className="space-y-5 text-sm">
                <div>
                  <Label className="font-semibold">Available Days of the Week</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ALL_DAYS.map(day => {
                      const active = workingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            active
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/40 rounded-xl border">
                  <div>
                    <Label className="text-xs">Daily Working Start</Label>
                    <Input type="time" value={workingStart} onChange={(e) => setWorkingStart(e.target.value)} required />
                  </div>
                  <div>
                    <Label className="text-xs">Daily Working End</Label>
                    <Input type="time" value={workingEnd} onChange={(e) => setWorkingEnd(e.target.value)} required />
                  </div>
                  <div>
                    <Label className="text-xs">Daily Break Start</Label>
                    <Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Daily Break End</Label>
                    <Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Standard Slot Duration (Minutes)</Label>
                    <Select value={String(slotDuration)} onValueChange={(v) => setSlotDuration(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 Minutes</SelectItem>
                        <SelectItem value="45">45 Minutes</SelectItem>
                        <SelectItem value="60">60 Minutes (Standard)</SelectItem>
                        <SelectItem value="90">90 Minutes</SelectItem>
                        <SelectItem value="120">120 Minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t">
                  <Button type="submit" disabled={savingSchedule} className="bg-amber-600 hover:bg-amber-700 text-white">
                    {savingSchedule ? "Saving..." : "Save Availability Settings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Blocked Slots & Dates Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Blocked Dates & Time Windows</CardTitle>
                <CardDescription>Dates or times when you are unavailable for ceremonies</CardDescription>
              </div>
              <Button size="sm" onClick={() => setBlockModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="size-4 mr-1.5" /> Block Specific Time
              </Button>
            </CardHeader>
            <CardContent>
              {!profile?.blockedPeriods || profile.blockedPeriods.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <CalendarDays className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p>No dates or slots currently blocked.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {profile.blockedPeriods.map((slot: any) => (
                    <div key={slot.id} className="p-3 bg-card border rounded-xl flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold">{slot.reason || "Purohit Unavailable"}</p>
                        <p className="text-xs text-muted-foreground">
                          {slot.startDate} {slot.endDate !== slot.startDate ? `to ${slot.endDate}` : ""} ·{" "}
                          {slot.isAllDay ? "All Day" : `${slot.startTime} - ${slot.endTime}`}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleUnblockSlot(slot.id)} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-4 mr-1" /> Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: Profile Details */}
      {activeTab === "profile" && profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Purohit Public Profile</CardTitle>
            <CardDescription>Displayed to visiting pilgrims seeking ancestral ceremony bookings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl">
              <div><span className="text-muted-foreground">Full Name:</span> <p className="font-bold">{profile.fullName}</p></div>
              <div><span className="text-muted-foreground">Phone Number:</span> <p className="font-bold">{profile.phone}</p></div>
              <div><span className="text-muted-foreground">Service Area / Ghats:</span> <p className="font-bold">{profile.serviceArea}</p></div>
              <div><span className="text-muted-foreground">Experience:</span> <p className="font-bold">{profile.experienceYears} Years</p></div>
              <div><span className="text-muted-foreground">Base Dakshina / Fee:</span> <p className="font-bold text-emerald-700">₹{profile.baseFee}</p></div>
              <div><span className="text-muted-foreground">Languages:</span> <p className="font-bold">{(profile.languages || []).join(", ")}</p></div>
            </div>

            {profile.qualifications && (
              <div className="p-3 bg-card border rounded-xl">
                <span className="font-semibold text-xs text-muted-foreground uppercase">Vedic Qualifications & Lineage</span>
                <p className="mt-1">{profile.qualifications}</p>
              </div>
            )}

            {profile.customaryPractices && (
              <div className="p-3 bg-card border rounded-xl">
                <span className="font-semibold text-xs text-muted-foreground uppercase">Customary Practices & Ritual Inclusions</span>
                <p className="mt-1">{profile.customaryPractices}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog: Block Slot */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Block Date or Specific Time Slot</DialogTitle>
            <DialogDescription>
              Mark periods when you cannot conduct ceremonies. Overlapping bookings will be automatically prevented.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBlockSlot} className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={blockStartDate} onChange={(e) => setBlockStartDate(e.target.value)} required />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={blockEndDate} onChange={(e) => setBlockEndDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="blockAllDay"
                checked={blockAllDay}
                onChange={(e) => setBlockAllDay(e.target.checked)}
                className="size-4 rounded border-gray-300"
              />
              <Label htmlFor="blockAllDay" className="cursor-pointer">Block Full Day(s)</Label>
            </div>

            {!blockAllDay && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label>Start Time</Label>
                  <Input type="time" value={blockStartTime} onChange={(e) => setBlockStartTime(e.target.value)} required={!blockAllDay} />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input type="time" value={blockEndTime} onChange={(e) => setBlockEndTime(e.target.value)} required={!blockAllDay} />
                </div>
              </div>
            )}

            <div>
              <Label>Reason (Optional)</Label>
              <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="e.g. Temple Sankalpam Duty / Personal Travel" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBlockModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={blocking} className="bg-amber-600 hover:bg-amber-700 text-white">
                {blocking ? "Saving..." : "Block Slot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reschedule Booking */}
      <Dialog open={Boolean(rescheduleBooking)} onOpenChange={() => setRescheduleBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
            <DialogDescription>
              Propose an alternative date or time slot for {rescheduleBooking?.ceremonyType} ({rescheduleBooking?.visitorName}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Proposed Date</Label>
                <Input type="date" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} required />
              </div>
              <div>
                <Label>Proposed Start Time</Label>
                <Input type="time" value={proposedTime} onChange={(e) => setProposedTime(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Reason for Rescheduling</Label>
              <Textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="e.g. Auspicious muhurtam timing adjustment for ancestor gotra sankalpam..."
                rows={3}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRescheduleBooking(null)}>Cancel</Button>
              <Button type="submit" disabled={rescheduling} className="bg-amber-600 hover:bg-amber-700 text-white">
                {rescheduling ? "Proposing..." : "Send Reschedule Proposal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Decline Booking */}
      <Dialog open={Boolean(declineBooking)} onOpenChange={() => setDeclineBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Ceremony Booking</DialogTitle>
            <DialogDescription>
              State a reason for declining booking <strong>{declineBooking?.bookingReference}</strong>. The time slot will be released.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeclineSubmit} className="space-y-3 text-sm">
            <div>
              <Label>Reason for Declining</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Schedule conflict with prior ritual commitments."
                rows={3}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeclineBooking(null)}>Cancel</Button>
              <Button type="submit" disabled={declining} variant="destructive">
                {declining ? "Declining..." : "Decline and Release Slot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

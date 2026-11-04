"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "../use-api";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accessibility,
  Heart,
  QrCode,
  Calendar,
  Clock,
  Waves,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Eye,
  RefreshCw,
  Plus,
  ShieldCheck,
  UserCheck,
  Users,
  Camera,
  History,
  Lock,
  Pause,
  Play,
} from "lucide-react";

interface SupervisorPriorityBookingSectionProps {
  assignedGhats?: any[];
  isSuperAdmin?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  ADDITIONAL_PROOF_REQUIRED: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  SLOT_ASSIGNED: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
  CHECKED_IN: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
  CANCELLED: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-400",
};

export function SupervisorPriorityBookingSection({
  assignedGhats = [],
  isSuperAdmin = false,
}: SupervisorPriorityBookingSectionProps) {
  const { lang, user } = useApp();
  const [activeTab, setActiveTab] = useState<"applications" | "verify" | "slots">("applications");
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [selectedGhatId, setSelectedGhatId] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Query construction
  const queryParams = new URLSearchParams();
  if (selectedGhatId !== "ALL") queryParams.set("ghatId", selectedGhatId);
  if (selectedCategory !== "ALL") queryParams.set("category", selectedCategory);
  if (selectedStatus !== "ALL") queryParams.set("status", selectedStatus);
  if (searchQuery.trim()) queryParams.set("search", searchQuery.trim());
  queryParams.set("limit", "100");

  const { data: bookingsData, loading: loadingBookings, refetch: refetchBookings } = useApi<{
    items: any[];
    total: number;
  }>(`/priority-bookings?${queryParams.toString()}`, [refreshKey, selectedGhatId, selectedCategory, selectedStatus]);

  const { data: statsData, refetch: refetchStats } = useApi<any>(
    `/priority-bookings/stats${selectedGhatId !== "ALL" ? `?ghatId=${selectedGhatId}` : ""}`,
    [refreshKey, selectedGhatId]
  );

  // Action Dialogs State
  const [reviewBooking, setReviewBooking] = useState<any | null>(null);
  const [docModalBooking, setDocModalBooking] = useState<any | null>(null);
  const [slotModalBooking, setSlotModalBooking] = useState<any | null>(null);
  const [rejectModalBooking, setRejectModalBooking] = useState<any | null>(null);
  const [proofModalBooking, setProofModalBooking] = useState<any | null>(null);
  const [overrideModalBooking, setOverrideModalBooking] = useState<any | null>(null);

  // Form states for modals
  const [rejectionReason, setRejectionReason] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("APPROVED");
  const [actionLoading, setActionLoading] = useState(false);

  // Slot modal state
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Create Slot Modal State
  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [newSlotGhatId, setNewSlotGhatId] = useState(assignedGhats[0]?.id || "");
  const [newSlotDate, setNewSlotDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [newSlotStart, setNewSlotStart] = useState("06:00");
  const [newSlotEnd, setNewSlotEnd] = useState("08:00");
  const [newSlotCapacity, setNewSlotCapacity] = useState("50");
  const [newSlotNotes, setNewSlotNotes] = useState("");
  const [creatingSlot, setCreatingSlot] = useState(false);

  // QR Verification State
  const [scanInput, setScanInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Fetch slots when slot modal opens
  useEffect(() => {
    if (slotModalBooking) {
      setLoadingSlots(true);
      api
        .get<{ items: any[] }>(`/ghats/${slotModalBooking.ghatId}/slots?status=ACTIVE`)
        .then((res) => {
          setAvailableSlots(res.items || []);
          if (res.items && res.items.length > 0) {
            setSelectedSlotId(res.items[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingSlots(false));
    }
  }, [slotModalBooking]);

  // Handle Review action
  async function handleReviewAction(id: string, action: string, extraData: any = {}) {
    setActionLoading(true);
    try {
      await api.patch(`/priority-bookings/${id}`, {
        action,
        ...extraData,
      });

      toast({
        title: "Status Updated",
        description: `Application updated: ${action.replace(/_/g, " ")}.`,
      });

      setReviewBooking(null);
      setRejectModalBooking(null);
      setProofModalBooking(null);
      setOverrideModalBooking(null);
      setRejectionReason("");
      setProofNotes("");
      setReviewerNotes("");
      setOverrideReason("");
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: t(lang, "error"),
        description: err instanceof ApiError ? err.message : "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Slot Allocation
  async function handleAssignSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!slotModalBooking || !selectedSlotId) return;

    setActionLoading(true);
    try {
      await api.post(`/priority-bookings/${slotModalBooking.id}/slot`, {
        timeSlotId: selectedSlotId,
      });

      toast({
        title: "Slot Confirmed",
        description: `Time slot successfully allocated and QR pass generated for ${slotModalBooking.applicationNumber}.`,
      });

      setSlotModalBooking(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: t(lang, "error"),
        description: err instanceof ApiError ? err.message : "Failed to allocate slot",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Create Time Slot
  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!newSlotGhatId) return;

    setCreatingSlot(true);
    try {
      await api.post(`/ghats/${newSlotGhatId}/slots`, {
        slotDate: newSlotDate,
        startTime: newSlotStart,
        endTime: newSlotEnd,
        maxCapacity: parseInt(newSlotCapacity, 10) || 50,
        accessibilityNotes: newSlotNotes,
      });

      toast({
        title: "Time Slot Created",
        description: `New slot configured for ${newSlotDate} (${newSlotStart}-${newSlotEnd}).`,
      });

      setCreateSlotOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: t(lang, "error"),
        description: err instanceof ApiError ? err.message : "Failed to create slot",
        variant: "destructive",
      });
    } finally {
      setCreatingSlot(false);
    }
  }

  // Handle QR Check-In Verification
  async function handleVerifyCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!scanInput.trim()) return;

    setVerifying(true);
    setVerificationResult(null);
    setVerificationError(null);

    try {
      const res = await api.post<{ success: boolean; message: string; booking: any }>(
        "/priority-bookings/verify-qr",
        {
          token: scanInput.trim(),
          applicationNumber: scanInput.trim(),
        }
      );

      setVerificationResult(res.booking);
      toast({
        title: "Entry Verified",
        description: `Verified check-in for ${res.booking.beneficiaryName} at ${res.booking.ghatName}.`,
      });
      setScanInput("");
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setVerificationError(err instanceof ApiError ? err.message : "Verification failed");
      toast({
        title: "Entry Verification Failed",
        description: err instanceof ApiError ? err.message : "Invalid or duplicate pass",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  }

  const items = bookingsData?.items || [];
  const wf = statsData?.workflow || {};

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Accessibility className="size-6 text-sky-600" />
            {t(lang, "supervisorReviewManagement")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin
              ? "System-wide oversight of senior citizen & disability priority bookings across all ghats"
              : `Review, verify supporting documents, and allocate time slots for your assigned ghats (${assignedGhats.length})`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateSlotOpen(true)}
            className="text-xs gap-1.5"
          >
            <Plus className="size-3.5" /> Configure Time Slot
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchBookings();
              refetchStats();
            }}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
        <Card className="p-3 shadow-sm bg-blue-50/50 border-blue-200 dark:bg-blue-950/20">
          <p className="text-[11px] text-muted-foreground font-medium">New Submitted</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{wf.submitted ?? 0}</p>
        </Card>
        <Card className="p-3 shadow-sm bg-amber-50/50 border-amber-200 dark:bg-amber-950/20">
          <p className="text-[11px] text-muted-foreground font-medium">Under Review</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{wf.underReview ?? 0}</p>
        </Card>
        <Card className="p-3 shadow-sm bg-orange-50/50 border-orange-200 dark:bg-orange-950/20">
          <p className="text-[11px] text-muted-foreground font-medium">Need Proof</p>
          <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{wf.additionalProofRequired ?? 0}</p>
        </Card>
        <Card className="p-3 shadow-sm bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20">
          <p className="text-[11px] text-muted-foreground font-medium">Approved (Awaiting Slot)</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{wf.approvedPendingSlot ?? 0}</p>
        </Card>
        <Card className="p-3 shadow-sm bg-teal-50/50 border-teal-200 dark:bg-teal-950/20">
          <p className="text-[11px] text-muted-foreground font-medium">Slot Confirmed</p>
          <p className="text-lg font-bold text-teal-700 dark:text-teal-300">{wf.slotAssignedConfirmed ?? 0}</p>
        </Card>
        <Card className="p-3 shadow-sm bg-indigo-50/50 border-indigo-200 dark:bg-indigo-950/20">
          <p className="text-[11px] text-muted-foreground font-medium">Checked In</p>
          <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{wf.checkedIn ?? 0}</p>
        </Card>
        <Card className="p-3 shadow-sm bg-rose-50/50 border-rose-200 dark:bg-rose-950/20">
          <p className="text-[11px] text-muted-foreground font-medium">Rejected</p>
          <p className="text-lg font-bold text-rose-700 dark:text-rose-300">{wf.rejected ?? 0}</p>
        </Card>
        <Card className="p-3 shadow-sm bg-slate-50/50 border-slate-200 dark:bg-slate-900/50">
          <p className="text-[11px] text-muted-foreground font-medium">Cancelled</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{wf.cancelled ?? 0}</p>
        </Card>
      </div>

      {/* Tab Navigation: Applications / Verify Entry / Time Slots */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="h-10">
          <TabsTrigger value="applications" className="text-xs gap-1.5 font-medium">
            <Users className="size-3.5" /> Applications Queue ({bookingsData?.total || 0})
          </TabsTrigger>
          <TabsTrigger value="verify" className="text-xs gap-1.5 font-medium">
            <QrCode className="size-3.5 text-teal-600" /> QR Entry Check-In
          </TabsTrigger>
        </TabsList>

        {/* 1. APPLICATIONS QUEUE */}
        <TabsContent value="applications" className="space-y-4 pt-2">
          {/* Filter Bar */}
          <Card className="p-3 border shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <Label className="text-[11px] text-muted-foreground">Filter by Ghat</Label>
                <Select value={selectedGhatId} onValueChange={setSelectedGhatId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Ghats" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Authorized Ghats</SelectItem>
                    {assignedGhats.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Filter by Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    <SelectItem value="SENIOR_CITIZEN">Senior Citizens (65+)</SelectItem>
                    <SelectItem value="PERSON_WITH_DISABILITY">Persons with Disabilities</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Filter by Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="ADDITIONAL_PROOF_REQUIRED">Additional Proof</SelectItem>
                    <SelectItem value="APPROVED">Approved (Need Slot)</SelectItem>
                    <SelectItem value="SLOT_ASSIGNED">Slot Assigned</SelectItem>
                    <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Search Beneficiary / Ref</Label>
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, Phone, or PGB-..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Applications Stream */}
          {loadingBookings ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Accessibility className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-semibold text-sm">No applications match the selected filters.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                New priority booking submissions for your assigned ghats will appear here.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((b) => (
                <Card key={b.id} className="p-0 overflow-hidden shadow-sm hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded">
                          {b.applicationNumber}
                        </span>
                        <Badge variant="outline" className={STATUS_COLORS[b.status] || ""}>
                          {b.status.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {b.category === "SENIOR_CITIZEN" ? (
                            <span className="flex items-center gap-1">
                              <Heart className="size-3 text-rose-500" /> Senior Citizen {b.beneficiaryAge ? `(${b.beneficiaryAge}y)` : ""}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Accessibility className="size-3 text-sky-500" /> Person with Disability
                            </span>
                          )}
                        </Badge>
                        {b.isCaregiverApplication && (
                          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                            Caregiver Filed
                          </Badge>
                        )}
                      </div>

                      <span className="text-[11px] text-muted-foreground">
                        Submitted: {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground font-medium">Beneficiary:</p>
                        <p className="font-semibold text-sm text-foreground">{b.beneficiaryName}</p>
                        <p className="text-muted-foreground">{b.beneficiaryPhone}</p>
                        {b.isCaregiverApplication && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Applicant: {b.applicantName} ({b.applicantRelationship}) · {b.applicantPhone}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-muted-foreground font-medium">Pushkar Ghat:</p>
                        <p className="font-semibold text-foreground flex items-center gap-1">
                          <Waves className="size-3.5 text-sky-600" />
                          {b.ghat?.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Target Visit: <strong>{b.visitDate}</strong>
                        </p>
                        {b.timeSlot && (
                          <p className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock className="size-3" />
                            {b.timeSlot.startTime} - {b.timeSlot.endTime}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-muted-foreground font-medium">Special Assistance & Proof:</p>
                        <p className="text-foreground">
                          {b.accessibilityNeeds || "Standard assistance"} · +{b.accompanyingCount} attendant(s)
                        </p>
                        <div className="pt-1.5 flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setDocModalBooking(b)}
                          >
                            <FileCheck className="size-3.5 text-sky-600" /> View Proof Doc
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Operational Review Actions Bar */}
                    <div className="flex items-center justify-between pt-2.5 border-t flex-wrap gap-2">
                      <div className="text-[11px] text-muted-foreground">
                        {b.reviewer && <span>Reviewer: {b.reviewer.name} · </span>}
                        {b.rejectionReason && <span className="text-rose-600 font-medium">Reason: {b.rejectionReason}</span>}
                        {b.additionalProofNotes && <span className="text-orange-600 font-medium">Note: {b.additionalProofNotes}</span>}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {b.status === "SUBMITTED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                            onClick={() => handleReviewAction(b.id, "START_REVIEW")}
                            disabled={actionLoading}
                          >
                            {t(lang, "startReview")}
                          </Button>
                        )}

                        {["SUBMITTED", "UNDER_REVIEW"].includes(b.status) && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleReviewAction(b.id, "APPROVE")}
                              disabled={actionLoading}
                            >
                              <CheckCircle2 className="size-3.5 mr-1" /> {t(lang, "approveEligibility")}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-orange-700 hover:bg-orange-50 border-orange-300"
                              onClick={() => {
                                setProofModalBooking(b);
                                setProofNotes("");
                              }}
                              disabled={actionLoading}
                            >
                              <AlertTriangle className="size-3.5 mr-1" /> {t(lang, "requestProof")}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setRejectModalBooking(b);
                                setRejectionReason("");
                              }}
                              disabled={actionLoading}
                            >
                              <XCircle className="size-3.5 mr-1" /> {t(lang, "rejectApplication")}
                            </Button>
                          </>
                        )}

                        {b.status === "APPROVED" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                            onClick={() => setSlotModalBooking(b)}
                          >
                            <Calendar className="size-3.5 mr-1" /> {t(lang, "assignSlot")}
                          </Button>
                        )}

                        {b.status === "SLOT_ASSIGNED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50"
                            onClick={() => setSlotModalBooking(b)}
                          >
                            <Clock className="size-3.5 mr-1" /> {t(lang, "reassignSlot")}
                          </Button>
                        )}

                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-indigo-600 hover:bg-indigo-50"
                            onClick={() => {
                              setOverrideModalBooking(b);
                              setOverrideReason("");
                              setOverrideStatus(b.status);
                            }}
                          >
                            <ShieldCheck className="size-3.5 mr-1" /> Override
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 2. QR ENTRY CHECK-IN */}
        <TabsContent value="verify" className="pt-2">
          <Card className="max-w-2xl mx-auto border shadow-sm">
            <CardHeader className="text-center pb-4">
              <span className="size-12 rounded-full bg-teal-100 text-teal-700 mx-auto grid place-items-center mb-1 dark:bg-teal-950 dark:text-teal-300">
                <QrCode className="size-6" />
              </span>
              <CardTitle className="text-lg font-bold">Pushkar Ghat Entry Verification</CardTitle>
              <CardDescription className="text-xs">
                Scan beneficiary QR pass or enter application number for verified entry at assigned ghats
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={handleVerifyCheckIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scan-code" className="text-xs font-semibold">
                    Scan Code / Enter Pass Token or Application Number
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="scan-code"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="e.g. PGB-2027-ABC123 or scan payload"
                      className="h-10 text-sm font-mono"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      disabled={verifying || !scanInput.trim()}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-semibold h-10 px-5"
                    >
                      {verifying ? "Checking..." : "Verify & Check In"}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Verification Success Feedback */}
              {verificationResult && (
                <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    <span className="font-bold text-sm">Ghat Entry Verified Successfully!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-200">
                    <div>
                      <p className="text-muted-foreground">Beneficiary:</p>
                      <p className="font-semibold text-foreground">{verificationResult.beneficiaryName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Category:</p>
                      <p className="font-semibold text-foreground">
                        {verificationResult.category === "SENIOR_CITIZEN" ? "Senior Citizen" : "Person with Disability"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Assigned Ghat:</p>
                      <p className="font-semibold text-foreground">{verificationResult.ghatName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Confirmed Slot:</p>
                      <p className="font-semibold text-foreground">{verificationResult.timeSlot || "Scheduled"}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Check-in recorded at {new Date(verificationResult.checkedInAt).toLocaleTimeString()} ({verificationResult.checkedInMethod}) by {verificationResult.checkedInBy}.
                  </p>
                </div>
              )}

              {/* Verification Error Feedback */}
              {verificationError && (
                <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 space-y-1">
                  <div className="flex items-center gap-2">
                    <XCircle className="size-5 text-rose-600" />
                    <span className="font-bold text-sm">Verification Failed</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{verificationError}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Secure Private Document Viewer */}
      {docModalBooking && (
        <Dialog open onOpenChange={(o) => !o && setDocModalBooking(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileCheck className="size-5 text-sky-600" />
                Supporting Proof Verification · {docModalBooking.applicationNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Beneficiary: <strong>{docModalBooking.beneficiaryName}</strong> ({docModalBooking.category.replace(/_/g, " ")}) · DOB: {docModalBooking.beneficiaryDob || "N/A"}
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 rounded-lg border bg-muted/40 text-xs flex justify-between items-center">
              <div>
                <p className="font-semibold">{docModalBooking.documentOriginalName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(docModalBooking.documentSizeBytes / 1024).toFixed(1)} KB · {docModalBooking.documentMimeType}
                </p>
              </div>
              <a
                href={`/api/v1/priority-bookings/${docModalBooking.id}/document`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Eye className="size-3.5" /> Open in New Tab
              </a>
            </div>

            <div className="rounded-lg border overflow-hidden min-h-[350px] max-h-[500px] flex items-center justify-center bg-muted/20">
              {docModalBooking.documentMimeType === "application/pdf" ? (
                <iframe
                  src={`/api/v1/priority-bookings/${docModalBooking.id}/document`}
                  className="w-full h-[450px]"
                  title="Document Preview"
                />
              ) : (
                <img
                  src={`/api/v1/priority-bookings/${docModalBooking.id}/document`}
                  alt="Supporting Proof"
                  className="max-h-[450px] max-w-full object-contain mx-auto"
                />
              )}
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setDocModalBooking(null)}>
                {t(lang, "close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 2: Assign Time Slot Modal */}
      {slotModalBooking && (
        <Dialog open onOpenChange={(o) => !o && setSlotModalBooking(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="size-5 text-teal-600" />
                Allocate Time Slot · {slotModalBooking.applicationNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ghat: <strong>{slotModalBooking.ghat?.name}</strong> · Beneficiary: {slotModalBooking.beneficiaryName} (+{slotModalBooking.accompanyingCount} attendant)
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAssignSlot} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="select-slot" className="text-xs font-semibold">
                  Select Active Schedule Slot ({slotModalBooking.visitDate})
                </Label>
                {loadingSlots ? (
                  <Skeleton className="h-10 w-full" />
                ) : availableSlots.length === 0 ? (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    No active time slots configured for this ghat yet. Please click &quot;Configure Time Slot&quot; to add one.
                  </div>
                ) : (
                  <Select value={selectedSlotId} onValueChange={setSelectedSlotId}>
                    <SelectTrigger id="select-slot" className="h-10 text-xs">
                      <SelectValue placeholder="Select a slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots.map((s) => {
                        const remaining = Math.max(0, s.maxCapacity - s.allocatedCount);
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            {s.slotDate} · {s.startTime} - {s.endTime} ({remaining} remaining / cap: {s.maxCapacity})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSlotModalBooking(null)}
                  disabled={actionLoading}
                >
                  {t(lang, "cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading || availableSlots.length === 0 || !selectedSlotId}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {actionLoading ? "Allocating..." : "Confirm Slot & Issue Pass"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 3: Reject Application Modal */}
      {rejectModalBooking && (
        <Dialog open onOpenChange={(o) => !o && setRejectModalBooking(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                <XCircle className="size-5" />
                Reject Application · {rejectModalBooking.applicationNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                A mandatory documented reason is required to reject an application.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleReviewAction(rejectModalBooking.id, "REJECT", { rejectionReason });
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="reject-reason" className="text-xs font-semibold">
                  Mandatory Rejection Reason *
                </Label>
                <Textarea
                  id="reject-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State clear reasons why proof was deemed ineligible or invalid"
                  required
                  rows={3}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectModalBooking(null)}
                  disabled={actionLoading}
                >
                  {t(lang, "cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading || rejectionReason.trim().length < 5}
                  variant="destructive"
                >
                  {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 4: Request Additional Proof Modal */}
      {proofModalBooking && (
        <Dialog open onOpenChange={(o) => !o && setProofModalBooking(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-orange-600 flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Request Additional Proof · {proofModalBooking.applicationNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Applicant will be notified to upload a replacement supporting certificate.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleReviewAction(proofModalBooking.id, "REQUEST_ADDITIONAL_PROOF", {
                  additionalProofNotes: proofNotes,
                });
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="proof-notes" className="text-xs font-semibold">
                  Specify Document Deficiencies & Required Proof *
                </Label>
                <Textarea
                  id="proof-notes"
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  placeholder="e.g. Document image is blurry. Please upload a clear photo of your Aadhaar card or UDID certificate."
                  required
                  rows={3}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProofModalBooking(null)}
                  disabled={actionLoading}
                >
                  {t(lang, "cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading || proofNotes.trim().length < 5}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {actionLoading ? "Requesting..." : "Send Proof Request"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 5: Super Admin Override Modal */}
      {overrideModalBooking && (
        <Dialog open onOpenChange={(o) => !o && setOverrideModalBooking(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-indigo-700 flex items-center gap-2">
                <ShieldCheck className="size-5" />
                Super Admin Override · {overrideModalBooking.applicationNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Administrative override capability. Must include a mandatory recorded reason for audit logging.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleReviewAction(overrideModalBooking.id, "SUPER_ADMIN_OVERRIDE", {
                  targetStatus: overrideStatus,
                  overrideReason,
                });
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="override-target-status" className="text-xs font-semibold">
                  Target Status
                </Label>
                <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                  <SelectTrigger id="override-target-status" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">APPROVED</SelectItem>
                    <SelectItem value="UNDER_REVIEW">UNDER_REVIEW</SelectItem>
                    <SelectItem value="ADDITIONAL_PROOF_REQUIRED">ADDITIONAL_PROOF_REQUIRED</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="override-reason" className="text-xs font-semibold">
                  Mandatory Override Reason *
                </Label>
                <Textarea
                  id="override-reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Record formal administrative justification for this override"
                  required
                  rows={3}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOverrideModalBooking(null)}
                  disabled={actionLoading}
                >
                  {t(lang, "cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading || overrideReason.trim().length < 5}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {actionLoading ? "Overriding..." : "Apply Admin Override"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 6: Configure Time Slot Modal */}
      {createSlotOpen && (
        <Dialog open onOpenChange={setCreateSlotOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="size-5 text-primary" />
                Configure New Pushkar Ghat Time Slot
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set up an active time window and capacity limit for priority passes
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateSlot} className="space-y-3.5 pt-2">
              <div className="space-y-1">
                <Label htmlFor="new-slot-ghat" className="text-xs font-semibold">
                  Destination Ghat *
                </Label>
                <Select value={newSlotGhatId} onValueChange={setNewSlotGhatId}>
                  <SelectTrigger id="new-slot-ghat" className="h-9 text-xs">
                    <SelectValue placeholder="Select ghat" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedGhats.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-slot-date" className="text-xs font-semibold">
                  Slot Date (YYYY-MM-DD) *
                </Label>
                <Input
                  id="new-slot-date"
                  type="date"
                  value={newSlotDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setNewSlotDate(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-slot-start" className="text-xs font-semibold">
                    Start Time *
                  </Label>
                  <Input
                    id="new-slot-start"
                    type="time"
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-slot-end" className="text-xs font-semibold">
                    End Time *
                  </Label>
                  <Input
                    id="new-slot-end"
                    type="time"
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-slot-cap" className="text-xs font-semibold">
                  Max Booking Capacity (Passes) *
                </Label>
                <Input
                  id="new-slot-cap"
                  type="number"
                  min="1"
                  max="500"
                  value={newSlotCapacity}
                  onChange={(e) => setNewSlotCapacity(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-slot-notes" className="text-xs font-semibold">
                  Accessibility Instructions / Facilities (Optional)
                </Label>
                <Input
                  id="new-slot-notes"
                  value={newSlotNotes}
                  onChange={(e) => setNewSlotNotes(e.target.value)}
                  placeholder="e.g. Wheelchair battery vehicle available at North gate"
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateSlotOpen(false)}
                  disabled={creatingSlot}
                >
                  {t(lang, "cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={creatingSlot}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {creatingSlot ? "Creating..." : "Save Time Slot"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

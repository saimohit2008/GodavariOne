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
  Sparkles, Plus, Search, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, Calendar, MapPin, Eye, Phone, Mail, Clock, FileText, Check,
  UserCheck, UserX, Flame, Flower2, Award, ShieldAlert,
} from "lucide-react";
import { CEREMONY_TYPES, CEREMONY_LOCATIONS, CEREMONY_LANGUAGES } from "@/lib/ceremonies";

export function CeremonyManagementAdminSection() {
  const { user } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<"purohits" | "bookings">("purohits");
  const [purohits, setPurohits] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [purohitFilter, setPurohitFilter] = useState("ALL");

  // Register / Edit Purohit Dialog
  const [purohitModalOpen, setPurohitModalOpen] = useState(false);
  const [editingPurohit, setEditingPurohit] = useState<any>(null);
  const [savingPurohit, setSavingPurohit] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [serviceArea, setServiceArea] = useState("Pushkar Ghat, Rajahmundry");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["Telugu", "Sanskrit"]);
  const [selectedCeremonies, setSelectedCeremonies] = useState<string[]>([
    "Pinda Pradanam (Ancestral Food Offering)",
    "Pitru Tarpana & Pushkara Snanam",
  ]);
  const [experienceYears, setExperienceYears] = useState(8);
  const [qualifications, setQualifications] = useState("Vedic Smartha Pathashala Certified Scholar, Godavari Lineage");
  const [customaryPractices, setCustomaryPractices] = useState("Traditional Vedic Mantras, all puja samagri provided, sacred Pushkaralu snanam sankalpam included");
  const [baseFee, setBaseFee] = useState(2100);
  const [feeIncludes, setFeeIncludes] = useState("Complete puja samagri, sankalpam, dakshina, ghat seating pass");
  const [workingHoursStart, setWorkingHoursStart] = useState("06:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("18:00");
  const [breakStart, setBreakStart] = useState("12:30");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(60);
  const [bio, setBio] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("VERIFIED");
  const [isPublished, setIsPublished] = useState(true);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");

  // Inspect booking dialog
  const [inspectBooking, setInspectBooking] = useState<any>(null);

  // Intervention on booking
  const [interventionBooking, setInterventionBooking] = useState<any>(null);
  const [interventionAction, setInterventionAction] = useState("CONFIRM");
  const [interventionReason, setInterventionReason] = useState("");
  const [intervening, setIntervening] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [purohitRes, bookingRes] = await Promise.all([
        api.get<{ items: any[] }>("/ceremonies/purohits"),
        api.get<{ items: any[] }>("/ceremonies/bookings"),
      ]);
      setPurohits(purohitRes.items || []);
      setBookings(bookingRes.items || []);
    } catch (e: any) {
      toast({ title: "Failed to load ceremony data", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingPurohit(null);
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("Rajahmundry, East Godavari, Andhra Pradesh");
    setServiceArea("Pushkar Ghat, Kotilingala Ghat, Rajahmundry");
    setSelectedLanguages(["Telugu", "Sanskrit", "Hindi"]);
    setSelectedCeremonies(["Pinda Pradanam (Ancestral Food Offering)", "Pitru Tarpana & Pushkara Snanam", "Asthi Visarjan & Sacred Immersion"]);
    setExperienceYears(10);
    setQualifications("Vedic Smartha Scholar, Rigveda Samhita Specialist");
    setCustomaryPractices("Traditional Satvik procedures, ancestral Gotra-Pravara chanting, all sacred samagri provided");
    setBaseFee(2500);
    setFeeIncludes("Complete puja samagri, priest dakshina, ghat coordination");
    setWorkingHoursStart("06:00");
    setWorkingHoursEnd("18:00");
    setBreakStart("12:30");
    setBreakEnd("14:00");
    setSlotDurationMinutes(60);
    setBio("Experienced Vedic Purohit conducting sacred ancestral rites on the banks of holy Godavari for over 10 years.");
    setVerificationStatus("VERIFIED");
    setIsPublished(true);
    setProfilePhotoUrl("");
    setPurohitModalOpen(true);
  }

  function openEditModal(p: any) {
    setEditingPurohit(p);
    setFullName(p.fullName);
    setPhone(p.phone || "");
    setEmail(p.email || "");
    setAddress(p.address || "");
    setServiceArea(p.serviceArea);
    setSelectedLanguages(Array.isArray(p.languages) ? p.languages : ["Telugu", "Sanskrit"]);
    setSelectedCeremonies(Array.isArray(p.ceremonies) ? p.ceremonies : [CEREMONY_TYPES[0].label]);
    setExperienceYears(p.experienceYears || 5);
    setQualifications(p.qualifications || "");
    setCustomaryPractices(p.customaryPractices || "");
    setBaseFee(p.baseFee || 1500);
    setFeeIncludes(p.feeIncludes || "");
    setWorkingHoursStart(p.workingHoursStart || "06:00");
    setWorkingHoursEnd(p.workingHoursEnd || "18:00");
    setBreakStart(p.breakStart || "12:30");
    setBreakEnd(p.breakEnd || "14:00");
    setSlotDurationMinutes(p.slotDurationMinutes || 60);
    setBio(p.bio || "");
    setVerificationStatus(p.verificationStatus || "VERIFIED");
    setIsPublished(p.isPublished !== false);
    setProfilePhotoUrl(p.profilePhotoUrl || "");
    setPurohitModalOpen(true);
  }

  async function handleSavePurohit(e: React.FormEvent) {
    e.preventDefault();
    setSavingPurohit(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim(),
        serviceArea: serviceArea.trim(),
        languages: selectedLanguages,
        ceremonies: selectedCeremonies,
        experienceYears,
        qualifications: qualifications.trim() || undefined,
        customaryPractices: customaryPractices.trim() || undefined,
        baseFee: Number(baseFee),
        feeIncludes: feeIncludes.trim() || undefined,
        workingHoursStart,
        workingHoursEnd,
        breakStart: breakStart || undefined,
        breakEnd: breakEnd || undefined,
        slotDurationMinutes: Number(slotDurationMinutes),
        bio: bio.trim() || undefined,
        verificationStatus,
        isActive: editingPurohit ? editingPurohit.isActive : true,
        isPublished,
        profilePhotoUrl: profilePhotoUrl.trim() || undefined,
      };

      if (editingPurohit) {
        await api.patch(`/ceremonies/purohits/${editingPurohit.id}`, payload);
        toast({ title: "Updated", description: "Purohit profile updated successfully" });
      } else {
        await api.post("/ceremonies/purohits", payload);
        toast({ title: "Registered", description: "New Purohit registered and published" });
      }

      setPurohitModalOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingPurohit(false);
    }
  }

  async function handleVerifyPurohit(purohitId: string, status: "VERIFIED" | "REJECTED") {
    try {
      await api.patch(`/ceremonies/purohits/${purohitId}`, { verificationStatus: status });
      toast({ title: "Verification Status Changed", description: `Purohit is now ${status}` });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleToggleActive(purohitId: string, current: boolean) {
    try {
      await api.patch(`/ceremonies/purohits/${purohitId}`, { isActive: !current });
      toast({ title: "Status Updated", description: !current ? "Purohit activated" : "Purohit deactivated" });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleTogglePublish(purohitId: string, current: boolean) {
    try {
      await api.patch(`/ceremonies/purohits/${purohitId}`, { isPublished: !current });
      toast({
        title: "Publication Status Updated",
        description: !current ? "Purohit published to public directory" : "Purohit unpublished (hidden from directory)",
      });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleBookingIntervention(e: React.FormEvent) {
    e.preventDefault();
    if (!interventionBooking) return;
    setIntervening(true);
    try {
      await api.patch(`/ceremonies/bookings/${interventionBooking.id}`, {
        action: interventionAction,
        reason: interventionReason.trim() || undefined,
      });
      toast({ title: "Intervention Executed", description: `Booking updated to ${interventionAction}` });
      setInterventionBooking(null);
      setInterventionReason("");
      loadData();
    } catch (e: any) {
      toast({ title: "Intervention Failed", description: e.message, variant: "destructive" });
    } finally {
      setIntervening(false);
    }
  }

  // Filter purohits
  const filteredPurohits = purohits.filter((p) => {
    if (statusFilter !== "ALL" && p.verificationStatus !== statusFilter) return false;
    if (q) {
      const qLower = q.toLowerCase();
      const match =
        p.fullName?.toLowerCase().includes(qLower) ||
        p.serviceArea?.toLowerCase().includes(qLower) ||
        p.phone?.toLowerCase().includes(qLower) ||
        p.qualifications?.toLowerCase().includes(qLower);
      if (!match) return false;
    }
    return true;
  });

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    if (purohitFilter !== "ALL" && b.purohitId !== purohitFilter) return false;
    if (q) {
      const qLower = q.toLowerCase();
      const match =
        b.bookingReference?.toLowerCase().includes(qLower) ||
        b.visitorName?.toLowerCase().includes(qLower) ||
        b.visitorPhone?.toLowerCase().includes(qLower) ||
        b.ceremonyType?.toLowerCase().includes(qLower);
      if (!match) return false;
    }
    return true;
  });

  const verifiedPurohits = purohits.filter(p => p.verificationStatus === "VERIFIED").length;
  const pendingPurohits = purohits.filter(p => p.verificationStatus === "PENDING").length;
  const confirmedBookings = bookings.filter(b => b.status === "CONFIRMED").length;
  const completedBookings = bookings.filter(b => b.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-amber-950 dark:text-amber-100">
            <Flame className="size-5 text-amber-600" />
            Ceremony & Purohit Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage qualified Vedic purohits, ancestral ceremony bookings (Pinda Pradanam, Pitru Tarpana), and schedule oversight.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={openCreateModal} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="size-4 mr-1.5" /> Register Purohit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Registered Purohits</p>
          <p className="text-2xl font-bold mt-1 text-amber-700">{purohits.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{verifiedPurohits} Verified · {pendingPurohits} Pending</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Ceremony Bookings</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{bookings.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Across all ghats</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Confirmed Rites</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700">{confirmedBookings}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Upcoming sacred ceremonies</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Completed Ceremonies</p>
          <p className="text-2xl font-bold mt-1 text-sky-700">{completedBookings}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ancestral rites conducted</p>
        </Card>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={activeSubTab === "purohits" ? "default" : "ghost"}
          onClick={() => setActiveSubTab("purohits")}
          className="gap-2"
        >
          <Award className="size-4" /> Purohit Profiles ({purohits.length})
        </Button>
        <Button
          size="sm"
          variant={activeSubTab === "bookings" ? "default" : "ghost"}
          onClick={() => setActiveSubTab("bookings")}
          className="gap-2"
        >
          <Calendar className="size-4" /> Ceremony Bookings ({bookings.length})
        </Button>
      </div>

      {/* TAB 1: Purohits Directory & Profiles */}
      {activeSubTab === "purohits" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Registered Vedic Purohits</CardTitle>
                <CardDescription>
                  Qualified and verified priests authorized to perform sacred Pushkaralu ancestral ceremonies and snanam rituals.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name / area..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Verification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Verification</SelectItem>
                    <SelectItem value="VERIFIED">Verified Only</SelectItem>
                    <SelectItem value="PENDING">Pending Review</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : filteredPurohits.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Flower2 className="size-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium">No Purohit Profiles Found</p>
                <p className="text-xs mt-1">Register verified priests to enable ancestral ceremony bookings.</p>
                <Button size="sm" onClick={openCreateModal} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white">
                  <Plus className="size-4 mr-1.5" /> Register Purohit
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPurohits.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl border bg-card hover:border-amber-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="size-11 rounded-full bg-amber-100 text-amber-800 grid place-items-center font-bold text-sm shrink-0 border border-amber-300">
                        {p.fullName?.[0]?.toUpperCase() || "P"}
                      </span>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-sm">{p.fullName}</p>
                          <Badge
                            variant={p.verificationStatus === "VERIFIED" ? "default" : p.verificationStatus === "PENDING" ? "secondary" : "destructive"}
                            className={p.verificationStatus === "VERIFIED" ? "bg-emerald-600 text-white" : ""}
                          >
                            {p.verificationStatus}
                          </Badge>
                          <Badge variant={p.isActive ? "outline" : "secondary"}>
                            {p.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge
                            variant={p.isPublished ? "default" : "secondary"}
                            className={p.isPublished ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground"}
                          >
                            {p.isPublished ? "Published (Public)" : "Unpublished (Hidden)"}
                          </Badge>
                          <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Base Fee: ₹{p.baseFee}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="flex items-center gap-1"><MapPin className="size-3 text-muted-foreground" /> {p.serviceArea}</span>
                          <span className="flex items-center gap-1"><Award className="size-3 text-muted-foreground" /> {p.experienceYears} Years Experience</span>
                          <span>Languages: <strong>{(p.languages || []).join(", ")}</strong></span>
                          <span>Phone: <strong>{p.phone}</strong></span>
                        </p>
                        {p.qualifications && (
                          <p className="text-xs text-muted-foreground">
                            Scholarship: <span className="text-foreground">{p.qualifications}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEditModal(p)}>
                        Edit
                      </Button>
                      {p.verificationStatus !== "VERIFIED" && (
                        <Button
                          size="sm"
                          onClick={() => handleVerifyPurohit(p.id, "VERIFIED")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="size-3.5 mr-1" /> Verify
                        </Button>
                      )}
                      {p.verificationStatus === "VERIFIED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerifyPurohit(p.id, "REJECTED")}
                          className="text-amber-700 hover:text-amber-800"
                        >
                          Revoke
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={p.isActive ? "outline" : "default"}
                        onClick={() => handleToggleActive(p.id, p.isActive)}
                      >
                        {p.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant={p.isPublished ? "outline" : "default"}
                        onClick={() => handleTogglePublish(p.id, p.isPublished)}
                        className={!p.isPublished ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                      >
                        {p.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: Bookings Oversight */}
      {activeSubTab === "bookings" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Ceremony Bookings Oversight</CardTitle>
                <CardDescription>
                  Monitor and manage sacred ancestral ceremonies booked by visiting pilgrims across all purohits and ghats.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search ref / visitor..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
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
                <Select value={purohitFilter} onValueChange={setPurohitFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Filter Purohit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Purohits</SelectItem>
                    {purohits.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Calendar className="size-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium">No Ceremony Bookings Found</p>
                <p className="text-xs mt-1">Adjust your filters to see ceremony bookings.</p>
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
                        <span className="text-xs text-muted-foreground">
                          Purohit: <strong className="text-foreground">{b.purohit?.fullName}</strong>
                        </span>
                        <span className="text-xs font-semibold text-emerald-700">₹{b.serviceFee}</span>
                      </div>

                      <div>
                        <p className="font-semibold text-sm">
                          {b.ceremonyType} · {b.visitorName} ({b.visitorPhone})
                        </p>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <span className="flex items-center gap-1"><Calendar className="size-3" /> {b.bookingDate}</span>
                          <span className="flex items-center gap-1"><Clock className="size-3" /> {b.startTime} - {b.endTime} ({b.durationMinutes} min)</span>
                          <span className="flex items-center gap-1"><MapPin className="size-3" /> {b.locationAddress}</span>
                          <span>Participants: <strong>{b.participantsCount}</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setInspectBooking(b)}>
                        <Eye className="size-3.5 mr-1" /> Inspect
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setInterventionBooking(b);
                          setInterventionAction(b.status === "CONFIRMED" ? "COMPLETE" : "CONFIRM");
                          setInterventionReason("");
                        }}
                      >
                        Intervene
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog: Register / Edit Purohit Profile */}
      <Dialog open={purohitModalOpen} onOpenChange={setPurohitModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPurohit ? "Edit Purohit Profile" : "Register Vedic Purohit"}</DialogTitle>
            <DialogDescription>
              Register certified Vedic purohits for the sacred Pushkaralu directory and ancestral rites booking.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePurohit} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Brahmasri Venkata Shastri" required />
              </div>
              <div>
                <Label>Mobile Number (used for bookings) *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9848011223" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Email Address (Optional)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="shastri@vedic.org" />
              </div>
              <div>
                <Label>Service Area / Ghats *</Label>
                <Input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="Pushkar Ghat, Kotilingala Ghat" required />
              </div>
            </div>

            <div>
              <Label>Physical Residential / Vedic Matha Address *</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Main Temple Road, Rajahmundry" required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Experience (Years) *</Label>
                <Input type="number" min={1} max={60} value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value))} required />
              </div>
              <div>
                <Label>Standard Base Service Fee (₹) *</Label>
                <Input type="number" min={0} step={100} value={baseFee} onChange={(e) => setBaseFee(Number(e.target.value))} required />
              </div>
            </div>

            <div>
              <Label>Vedic Qualifications & Lineage</Label>
              <Input value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="Vedic Smartha certified, Acharya lineage" />
            </div>

            <div>
              <Label>Customary Practices & Ritual Samagri Provided</Label>
              <Textarea value={customaryPractices} onChange={(e) => setCustomaryPractices(e.target.value)} rows={2} placeholder="Samagri, holy holy Pushkaralu snanam sankalpam..." />
            </div>

            <div>
              <Label>Service Fee Inclusions (shown to visitor)</Label>
              <Input value={feeIncludes} onChange={(e) => setFeeIncludes(e.target.value)} placeholder="Complete samagri, priest dakshina, ghat coordination" />
            </div>

            {/* Working Hours & Break Times */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg">
              <div>
                <Label className="text-xs">Working Starts</Label>
                <Input type="time" value={workingHoursStart} onChange={(e) => setWorkingHoursStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Working Ends</Label>
                <Input type="time" value={workingHoursEnd} onChange={(e) => setWorkingHoursEnd(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Break Starts</Label>
                <Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Break Ends</Label>
                <Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Slot Duration</Label>
                <Select value={String(slotDurationMinutes)} onValueChange={(v) => setSlotDurationMinutes(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Minutes</SelectItem>
                    <SelectItem value="45">45 Minutes</SelectItem>
                    <SelectItem value="60">60 Minutes</SelectItem>
                    <SelectItem value="90">90 Minutes</SelectItem>
                    <SelectItem value="120">120 Minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Verification Status</Label>
                <Select value={verificationStatus} onValueChange={setVerificationStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VERIFIED">VERIFIED (Eligible)</SelectItem>
                    <SelectItem value="PENDING">PENDING REVIEW</SelectItem>
                    <SelectItem value="REJECTED">REJECTED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Directory Publication</Label>
                <Select value={isPublished ? "true" : "false"} onValueChange={(v) => setIsPublished(v === "true")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">PUBLISHED (Public)</SelectItem>
                    <SelectItem value="false">UNPUBLISHED (Hidden)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPurohitModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPurohit} className="bg-amber-600 hover:bg-amber-700 text-white">
                {savingPurohit ? "Saving..." : editingPurohit ? "Update Profile" : "Register Purohit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Inspect Ceremony Booking */}
      <Dialog open={Boolean(inspectBooking)} onOpenChange={() => setInspectBooking(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flower2 className="size-5 text-amber-600" />
              Ceremony Booking {inspectBooking?.bookingReference}
            </DialogTitle>
            <DialogDescription>
              Sacred Ancestral Rites Booking Details
            </DialogDescription>
          </DialogHeader>

          {inspectBooking && (
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ceremony:</span>
                  <strong>{inspectBooking.ceremonyType}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <strong>{inspectBooking.bookingDate}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Slot:</span>
                  <strong>{inspectBooking.startTime} - {inspectBooking.endTime} ({inspectBooking.durationMinutes} min)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location:</span>
                  <strong>{inspectBooking.locationAddress}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{inspectBooking.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Fee:</span>
                  <strong className="text-emerald-700">₹{inspectBooking.serviceFee}</strong>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-xs font-semibold uppercase text-amber-900">Assigned Purohit</p>
                <p className="font-bold">{inspectBooking.purohit?.fullName}</p>
                <p className="text-xs text-muted-foreground">{inspectBooking.purohit?.phone} · {inspectBooking.purohit?.serviceArea}</p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Visitor & Customary Notes</p>
                <p><strong>{inspectBooking.visitorName}</strong> ({inspectBooking.visitorPhone})</p>
                {inspectBooking.customaryRequirements && (
                  <p className="text-xs text-muted-foreground mt-1 bg-background p-2 rounded border">
                    Customary Details: {inspectBooking.customaryRequirements}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectBooking(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Intervene on Ceremony Booking */}
      <Dialog open={Boolean(interventionBooking)} onOpenChange={() => setInterventionBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Ceremony Intervention</DialogTitle>
            <DialogDescription>
              Override status for ceremony <strong>{interventionBooking?.bookingReference}</strong> ({interventionBooking?.ceremonyType}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBookingIntervention} className="space-y-4">
            <div>
              <Label>Action</Label>
              <Select value={interventionAction} onValueChange={setInterventionAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFIRM">CONFIRM Booking</SelectItem>
                  <SelectItem value="COMPLETE">Mark COMPLETED</SelectItem>
                  <SelectItem value="CANCEL">CANCEL Booking (Release Slot)</SelectItem>
                  <SelectItem value="DECLINE">DECLINE Booking (Release Slot)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason / Administrative Note</Label>
              <Textarea
                value={interventionReason}
                onChange={(e) => setInterventionReason(e.target.value)}
                placeholder="Reason for administrative action..."
                rows={3}
                required={interventionAction === "CANCEL" || interventionAction === "DECLINE"}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInterventionBooking(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={intervening} className="bg-amber-600 hover:bg-amber-700 text-white">
                {intervening ? "Processing..." : "Confirm Action"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

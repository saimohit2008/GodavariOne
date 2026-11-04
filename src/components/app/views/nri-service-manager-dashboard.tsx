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
  Briefcase, Calendar, MapPin, Phone, Mail, Clock, Plus, Search, RefreshCw,
  CheckCircle2, AlertTriangle, FileText, Check, ChevronRight, Eye, ShieldCheck,
  Send, UserCheck, CheckSquare, ListChecks, ArrowRight,
} from "lucide-react";
import { NRI_STATUS_META, type NriRequestStatus } from "@/lib/nri-constants";

export function NriServiceManagerDashboard() {
  const { user } = useApp();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "quotation" | "itinerary" | "tasks">("overview");

  // Quotation form state
  const [qTitle, setQTitle] = useState("Curated Godavari Pushkaralu Sacred Pilgrimage Package");
  const [qDesc, setQDesc] = useState("Complete VIP pilgrimage with luxury riverside accommodation, private transport, and Vedic guides.");
  const [durationDays, setDurationDays] = useState(5);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [accommodationCost, setAccommodationCost] = useState(45000);
  const [transportCost, setTransportCost] = useState(25000);
  const [foodCost, setFoodCost] = useState(15000);
  const [guideCost, setGuideCost] = useState(10000);
  const [ceremonyCost, setCeremonyCost] = useState(5000);
  const [otherCharges, setOtherCharges] = useState(2000);
  const [taxAmount, setTaxAmount] = useState(5100);
  const [discountAmount, setDiscountAmount] = useState(2000);
  const [additionalFeesExplanation, setAdditionalFeesExplanation] = useState("Pushkaralu VIP ghat entry pass and parking permit fees");
  const [validUntil, setValidUntil] = useState("2027-05-31");
  const [hotelName, setHotelName] = useState("River Heritage Luxury Resort, Rajahmundry");
  const [roomType, setRoomType] = useState("Executive AC Suites");
  const [vehicleType, setVehicleType] = useState("Toyota Innova Crysta (AC)");
  const [inclusions, setInclusions] = useState("AC private vehicle with chauffeur, luxury stay with breakfast & dinner, VIP pushkara snanam assistance, Vedic guide");
  const [exclusions, setExclusions] = useState("Airfare to India, personal pooja dakshina, discretionary tips, room laundry");
  const [terms, setTerms] = useState("50% advance upon formal confirmation. Free date changes permitted up to 30 days before Pushkaralu opening.");
  const [cancellationPolicy, setCancellationPolicy] = useState("100% refund if cancelled >30 days before arrival. 50% refund if 15-30 days before.");
  const [managerNotes, setManagerNotes] = useState("We have structured sacred timings for the holy snanam to avoid peak crowd periods.");
  const [internalNotes, setInternalNotes] = useState("Priority driver allocated; riverside rooms pre-blocked.");
  const [submittingQuotation, setSubmittingQuotation] = useState(false);

  // Itinerary modal
  const [itineraryModalOpen, setItineraryModalOpen] = useState(false);
  const [itinDayNum, setItinDayNum] = useState(1);
  const [itinDate, setItinDate] = useState("");
  const [itinTimeSlot, setItinTimeSlot] = useState("06:30 - 08:30");
  const [itinTitle, setItinTitle] = useState("Sacred Godavari Pushkara Snanam & Sankalpam");
  const [itinLocation, setItinLocation] = useState("Pushkar Ghat, Rajahmundry");
  const [itinTransport, setItinTransport] = useState("Private AC Crysta Pickup from Resort");
  const [itinAccommodation, setItinAccommodation] = useState("River Heritage Luxury Resort");
  const [itinProvider, setItinProvider] = useState("Pushkaralu Seva Trust & Vedic Guides");
  const [itinConfirmationCode, setItinConfirmationCode] = useState("VIP-GHAT-2027-01");
  const [itinInstructions, setItinInstructions] = useState("Wear traditional Satvik dhoti/sari; priest will receive family at VIP gate.");
  const [itinVisitorNotes, setItinVisitorNotes] = useState("VIP passes will be handed over by coordinator at the vehicle.");
  const [itinInternalNotes, setItinInternalNotes] = useState("Coordinator Murthy on ground duty at VIP Gate 2.");
  const [savingItinerary, setSavingItinerary] = useState(false);

  // Task modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState<any>("ACCOMMODATION");
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskRef, setTaskRef] = useState("");
  const [taskInternalNotes, setTaskInternalNotes] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await api.get<{ items: any[] }>("/nri/requests?limit=100");
      setRequests(res.items || []);
      if (res.items?.length > 0 && !selectedRequest) {
        loadRequestDetail(res.items[0].id);
      }
    } catch (e: any) {
      toast({ title: "Failed to load assigned requests", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadRequestDetail(id: string) {
    try {
      const res = await api.get<{ request: any }>(`/nri/requests/${id}`);
      setSelectedRequest(res.request);
      setCheckIn(res.request.arrivalDate || "");
      setCheckOut(res.request.departureDate || "");
      setDurationDays(res.request.daysCount || 5);
      setItinDate(res.request.arrivalDate || "");
    } catch (e: any) {
      toast({ title: "Failed to load details", description: e.message, variant: "destructive" });
    }
  }

  useEffect(() => {
    if (user?.role === "NRI_SERVICE_MANAGER" || user?.role === "SUPER_ADMIN") {
      loadRequests();
    }
  }, [user?.role]);

  if (user?.role !== "NRI_SERVICE_MANAGER" && user?.role !== "SUPER_ADMIN") {
    return (
      <div className="flex-1 container mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        Access restricted. This workspace is reserved for dedicated NRI Service Managers.
      </div>
    );
  }

  const totalCalculated =
    accommodationCost + transportCost + foodCost + guideCost + ceremonyCost + otherCharges + taxAmount - discountAmount;

  async function handleSendQuotation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest) return;
    setSubmittingQuotation(true);
    try {
      await api.post(`/nri/requests/${selectedRequest.id}/quotations`, {
        title: qTitle.trim(),
        description: qDesc.trim(),
        durationDays: Number(durationDays),
        checkInDate: checkIn,
        checkOutDate: checkOut,
        hotelName: hotelName.trim(),
        roomType: roomType.trim(),
        numberOfRooms: selectedRequest.numRooms || 1,
        vehicleType: vehicleType.trim(),
        accommodationCost: Number(accommodationCost),
        transportCost: Number(transportCost),
        foodCost: Number(foodCost),
        guideCost: Number(guideCost),
        ceremonyCost: Number(ceremonyCost),
        otherCharges: Number(otherCharges),
        taxAmount: Number(taxAmount),
        discountAmount: Number(discountAmount),
        additionalFeesExplanation: additionalFeesExplanation.trim() || undefined,
        validUntil: validUntil || undefined,
        inclusions: inclusions.split(",").map(s => s.trim()).filter(Boolean),
        exclusions: exclusions.split(",").map(s => s.trim()).filter(Boolean),
        termsAndConditions: terms.trim(),
        cancellationPolicy: cancellationPolicy.trim(),
        managerNotes: managerNotes.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        itinerary: [
          { day: 1, title: "Airport Reception & Riverside Welcome", description: "Meet & greet at Rajahmundry Airport (RJA) with flower garlands, check-in to resort, evening river walk" },
          { day: 2, title: "Sacred Pushkara Snanam & Vedic Sankalpam", description: "Priority VIP holy dip at Pushkar Ghat with dedicated scholar priest, Pitru Tarpana rituals" },
          { day: 3, title: "Heritage Temples Excursion", description: "Private AC tour to Draksharamam Bhimeswara Swamy and Annavaram Satyanarayana Swamy shrines" },
          { day: 4, title: "Godavari Backwaters & Maha Harathi", description: "Scenic Dindi river cruise followed by evening VIP seating for Maha Godavari Harathi" },
          { day: 5, title: "Final Blessings & Departure Logistics", description: "Morning temple visit, souvenir shopping, private drop-off at Rajahmundry Airport" },
        ],
        status: "SENT",
      });

      toast({ title: "Quotation Sent", description: "The itemized quotation was transmitted to the client." });
      loadRequestDetail(selectedRequest.id);
      loadRequests();
    } catch (e: any) {
      toast({ title: "Failed to send quotation", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingQuotation(false);
    }
  }

  async function handleAddItinerary(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest) return;
    setSavingItinerary(true);
    try {
      await api.post(`/nri/requests/${selectedRequest.id}/coordination`, {
        dayNumber: Number(itinDayNum),
        date: itinDate,
        timeSlot: itinTimeSlot.trim(),
        activityTitle: itinTitle.trim(),
        location: itinLocation.trim(),
        transportDetails: itinTransport.trim(),
        accommodationDetails: itinAccommodation.trim(),
        assignedProvider: itinProvider.trim(),
        bookingConfirmationCode: itinConfirmationCode.trim(),
        instructions: itinInstructions.trim(),
        visitorNotes: itinVisitorNotes.trim(),
        internalNotes: itinInternalNotes.trim(),
        status: "SCHEDULED",
      });
      toast({ title: "Itinerary Item Scheduled", description: `Day ${itinDayNum} item added.` });
      setItineraryModalOpen(false);
      loadRequestDetail(selectedRequest.id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingItinerary(false);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest) return;
    setSavingTask(true);
    try {
      await api.post(`/nri/requests/${selectedRequest.id}/tasks`, {
        title: taskTitle.trim(),
        category: taskCategory,
        assignedTo: taskAssignedTo.trim() || undefined,
        dueDate: taskDueDate || undefined,
        confirmationRef: taskRef.trim() || undefined,
        internalNotes: taskInternalNotes.trim() || undefined,
        status: "PENDING",
      });
      toast({ title: "Task Created", description: "Coordination task logged." });
      setTaskModalOpen(false);
      setTaskTitle("");
      setTaskAssignedTo("");
      setTaskDueDate("");
      setTaskRef("");
      setTaskInternalNotes("");
      loadRequestDetail(selectedRequest.id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingTask(false);
    }
  }

  async function handleUpdateTaskStatus(taskId: string, newStatus: string) {
    if (!selectedRequest) return;
    try {
      await api.patch(`/nri/requests/${selectedRequest.id}/tasks/${taskId}`, { status: newStatus });
      toast({ title: "Task Status Updated", description: `Task is now ${newStatus}` });
      loadRequestDetail(selectedRequest.id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleConfirmTrip() {
    if (!selectedRequest) return;
    try {
      await api.patch(`/nri/requests/${selectedRequest.id}`, { status: "CONFIRMED", reason: "Manager confirmed trip details" });
      toast({ title: "Trip Confirmed", description: "Trip moved to Confirmed Coordination stage" });
      loadRequestDetail(selectedRequest.id);
      loadRequests();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleRejectRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest) return;
    setRejecting(true);
    try {
      await api.patch(`/nri/requests/${selectedRequest.id}`, {
        status: "DECLINED",
        rejectionReason: rejectionReason.trim() || "Unable to fulfill custom requirements for requested dates",
      });
      toast({ title: "Request Rejected", description: "Visitor notified with explanation" });
      setRejectOpen(false);
      setRejectionReason("");
      loadRequestDetail(selectedRequest.id);
      loadRequests();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className="flex-1 container mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-9 rounded-xl bg-teal-500/20 grid place-items-center border border-teal-400/30">
              <Briefcase className="size-5 text-teal-300" />
            </span>
            <Badge className="bg-teal-500/30 text-teal-200 border-teal-400/40 text-xs">NRI Service Coordinator</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Welcome, {user?.name || "Service Manager"}</h1>
          <p className="text-sm text-teal-100/80">
            Assigned NRI client requests, itemized quotation preparation, and day-by-day trip coordination.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadRequests} disabled={loading} className="border-teal-400/30 text-white hover:bg-teal-800">
            <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Column Requests List, Right Column Active Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Assigned Requests (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base flex items-center gap-1.5">
              <FileText className="size-4 text-teal-600" />
              Assigned Requests ({requests.length})
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : requests.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <Briefcase className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-sm">No Requests Assigned</p>
              <p className="text-xs mt-1">Super Admin has not yet assigned any active NRI requests to your account.</p>
            </Card>
          ) : (
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {requests.map((r) => {
                const isSelected = selectedRequest?.id === r.id;
                const meta = NRI_STATUS_META[r.status as NriRequestStatus] || { label: r.status, color: "bg-muted text-muted-foreground" };
                return (
                  <div
                    key={r.id}
                    onClick={() => loadRequestDetail(r.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-teal-600 bg-teal-50/50 shadow-sm ring-1 ring-teal-500/20"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-teal-700">{r.referenceNumber}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="font-bold text-sm mt-1">{r.visitorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.countryOfResidence} · {r.groupSize} Travelers ({r.daysCount || 5} Days)
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                      <span className="flex items-center gap-1"><Calendar className="size-3" /> {r.arrivalDate}</span>
                      <span>Mode: <strong>{r.preferredCommunication || "WhatsApp"}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Client Workspace (8 cols) */}
        <div className="lg:col-span-8">
          {!selectedRequest ? (
            <Card className="p-12 text-center text-muted-foreground">
              <FileText className="size-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-bold text-base">Select an NRI Request</p>
              <p className="text-xs mt-1">Choose a client pilgrimage request from the list to prepare quotations or coordinate itineraries.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Client Brief Header */}
              <Card className="border-teal-600/30">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                          {selectedRequest.referenceNumber}
                        </span>
                        <Badge variant="outline">{selectedRequest.status}</Badge>
                      </div>
                      <CardTitle className="text-xl mt-1.5">{selectedRequest.visitorName} ({selectedRequest.countryOfResidence})</CardTitle>
                      <CardDescription>
                        {selectedRequest.groupSize} Travelers ({selectedRequest.numAdults} Adults, {selectedRequest.numChildren} Children) · Arriving: {selectedRequest.arrivalDate}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectOpen(true)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        Reject Request
                      </Button>
                      {selectedRequest.status === "QUOTATION_ACCEPTED" && (
                        <Button
                          size="sm"
                          onClick={handleConfirmTrip}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Confirm Trip
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-muted/40 p-3 rounded-xl border">
                    <div><span className="text-muted-foreground">Contact Phone:</span> <p className="font-semibold">{selectedRequest.visitorPhone}</p></div>
                    <div><span className="text-muted-foreground">Preferred Mode:</span> <p className="font-semibold">{selectedRequest.preferredCommunication || "WhatsApp"}</p></div>
                    <div><span className="text-muted-foreground">Stay Type:</span> <p className="font-semibold">{selectedRequest.accommodationPreference} ({selectedRequest.numRooms} Rms)</p></div>
                    <div><span className="text-muted-foreground">Budget:</span> <p className="font-semibold">{selectedRequest.budgetRange || "Flexible"}</p></div>
                  </div>
                </CardContent>
              </Card>

              {/* Workspace Navigation Tabs */}
              <div className="flex gap-2 border-b pb-2">
                <Button
                  size="sm"
                  variant={activeTab === "overview" ? "default" : "ghost"}
                  onClick={() => setActiveTab("overview")}
                  className="gap-1.5"
                >
                  <Eye className="size-4" /> Requirements
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "quotation" ? "default" : "ghost"}
                  onClick={() => setActiveTab("quotation")}
                  className="gap-1.5"
                >
                  <Send className="size-4" /> Quotation Builder
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "itinerary" ? "default" : "ghost"}
                  onClick={() => setActiveTab("itinerary")}
                  className="gap-1.5"
                >
                  <Calendar className="size-4" /> Day-by-Day Itinerary ({selectedRequest.tripItineraryItems?.length || 0})
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "tasks" ? "default" : "ghost"}
                  onClick={() => setActiveTab("tasks")}
                  className="gap-1.5"
                >
                  <ListChecks className="size-4" /> Trip Tasks ({selectedRequest.tripTasks?.length || 0})
                </Button>
              </div>

              {/* TAB 1: Requirements Overview */}
              {activeTab === "overview" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Client Trip Planning Requirements</CardTitle>
                    <CardDescription>Submitted by foreign visitor through NRI Access portal</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-xl">
                      <div>
                        <p className="text-xs text-muted-foreground">Places to Visit / Ghats Requested</p>
                        <p className="font-semibold mt-0.5">{selectedRequest.placesToVisit || "Pushkar Ghat, Kotilingala, Draksharamam"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Preferred Ghats & Temples</p>
                        <p className="font-semibold mt-0.5">{selectedRequest.preferredGhats || "Pushkar Ghat, Kotilingala Ghat"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Dietary Preferences</p>
                        <p className="font-semibold mt-0.5">{selectedRequest.dietaryPreference}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Transport & Guide</p>
                        <p className="font-semibold mt-0.5">
                          {selectedRequest.transportRequirements || "AC Chauffeur Driven"} · {selectedRequest.localGuideRequired ? "Vedic Scholar Guide Needed" : "No Guide"}
                        </p>
                      </div>
                    </div>

                    {selectedRequest.ceremonyRequirements && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900">
                        <p className="font-bold text-xs uppercase">Special Ceremonies Requested</p>
                        <p className="mt-1">{selectedRequest.ceremonyRequirements}</p>
                      </div>
                    )}

                    {selectedRequest.additionalInstructions && (
                      <div className="p-3 bg-muted/40 rounded-xl">
                        <p className="font-bold text-xs uppercase text-muted-foreground">Additional Visitor Instructions</p>
                        <p className="mt-1">{selectedRequest.additionalInstructions}</p>
                      </div>
                    )}

                    {/* Quotation history if already sent */}
                    {selectedRequest.quotations && selectedRequest.quotations.length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <h4 className="font-bold text-xs uppercase text-muted-foreground">Quotation History ({selectedRequest.quotations.length})</h4>
                        {selectedRequest.quotations.map((q: any) => (
                          <div key={q.id} className="p-3 bg-card border rounded-xl flex items-center justify-between">
                            <div>
                              <p className="font-bold">{q.title}</p>
                              <p className="text-xs text-muted-foreground">₹{q.totalPrice?.toLocaleString()} ({q.status}) · v{q.version}</p>
                            </div>
                            <Badge variant="outline">{q.quotationNumber}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* TAB 2: Quotation Builder */}
              {activeTab === "quotation" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Prepare Itemized Quotation</CardTitle>
                    <CardDescription>
                      Review client requirements and prepare transparent itemized pricing for accommodation, transport, Vedic guides, and sacred rites.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSendQuotation} className="space-y-4 text-sm">
                      <div>
                        <Label>Package Title</Label>
                        <Input value={qTitle} onChange={(e) => setQTitle(e.target.value)} required />
                      </div>
                      <div>
                        <Label>Package Summary</Label>
                        <Textarea value={qDesc} onChange={(e) => setQDesc(e.target.value)} rows={2} />
                      </div>

                      {/* Itemized Cost Breakdown */}
                      <div className="p-4 bg-muted/40 rounded-xl border space-y-3">
                        <h4 className="font-bold text-xs uppercase text-muted-foreground">Itemized Cost Breakdown (INR)</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Accommodation (₹)</Label>
                            <Input type="number" min={0} value={accommodationCost} onChange={(e) => setAccommodationCost(Number(e.target.value))} required />
                          </div>
                          <div>
                            <Label className="text-xs">Transport (₹)</Label>
                            <Input type="number" min={0} value={transportCost} onChange={(e) => setTransportCost(Number(e.target.value))} required />
                          </div>
                          <div>
                            <Label className="text-xs">Food & Meals (₹)</Label>
                            <Input type="number" min={0} value={foodCost} onChange={(e) => setFoodCost(Number(e.target.value))} required />
                          </div>
                          <div>
                            <Label className="text-xs">Vedic Guide (₹)</Label>
                            <Input type="number" min={0} value={guideCost} onChange={(e) => setGuideCost(Number(e.target.value))} required />
                          </div>
                          <div>
                            <Label className="text-xs">Ceremonies & Rites (₹)</Label>
                            <Input type="number" min={0} value={ceremonyCost} onChange={(e) => setCeremonyCost(Number(e.target.value))} required />
                          </div>
                          <div>
                            <Label className="text-xs">Additional Fees (₹)</Label>
                            <Input type="number" min={0} value={otherCharges} onChange={(e) => setOtherCharges(Number(e.target.value))} />
                          </div>
                          <div>
                            <Label className="text-xs">Taxes & Charges (₹)</Label>
                            <Input type="number" min={0} value={taxAmount} onChange={(e) => setTaxAmount(Number(e.target.value))} />
                          </div>
                          <div>
                            <Label className="text-xs">Special Discount (₹)</Label>
                            <Input type="number" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} />
                          </div>
                          <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg flex flex-col justify-center">
                            <span className="text-[11px] text-teal-800 font-semibold">Total Estimated Price</span>
                            <span className="text-lg font-bold text-teal-950">₹{totalCalculated.toLocaleString()}</span>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Additional Fees Explanation</Label>
                          <Input value={additionalFeesExplanation} onChange={(e) => setAdditionalFeesExplanation(e.target.value)} placeholder="e.g. Special VIP ghat bath pass and parking permits" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Hotel / Resort Name</Label>
                          <Input value={hotelName} onChange={(e) => setHotelName(e.target.value)} />
                        </div>
                        <div>
                          <Label>Vehicle Specification</Label>
                          <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
                        </div>
                      </div>

                      <div>
                        <Label>Inclusions (comma separated)</Label>
                        <Textarea value={inclusions} onChange={(e) => setInclusions(e.target.value)} rows={2} />
                      </div>

                      <div>
                        <Label>Exclusions (comma separated)</Label>
                        <Textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={2} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Quotation Validity Date</Label>
                          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                        </div>
                        <div>
                          <Label>Notes for Visitor</Label>
                          <Input value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} />
                        </div>
                      </div>

                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <Label className="text-xs font-bold text-amber-900 dark:text-amber-200">Internal Coordinator Staff Notes (Restricted from visitor)</Label>
                        <Input value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="mt-1" />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button type="submit" disabled={submittingQuotation} className="bg-teal-700 hover:bg-teal-800 text-white gap-2">
                          <Send className="size-4" /> {submittingQuotation ? "Transmitting..." : "Send Itemized Quotation to Visitor"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* TAB 3: Day-by-Day Itinerary */}
              {activeTab === "itinerary" && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base">Coordinated Itinerary</CardTitle>
                      <CardDescription>Day-by-day sacred schedule, visit times, ghat locations, and assigned providers</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setItineraryModalOpen(true)} className="bg-teal-700 hover:bg-teal-800 text-white">
                      <Plus className="size-4 mr-1.5" /> Add Day Schedule
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!selectedRequest.tripItineraryItems || selectedRequest.tripItineraryItems.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Calendar className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="font-semibold text-sm">No Itinerary Items Scheduled Yet</p>
                        <p className="text-xs mt-1">Schedule day-by-day sacred bath, temple visits, and meals for this pilgrim.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedRequest.tripItineraryItems.map((item: any) => (
                          <div key={item.id} className="p-3.5 bg-card border rounded-xl hover:border-teal-500/30 transition-all space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-teal-700 text-white font-bold text-xs">Day {item.dayNumber}</Badge>
                                <span className="font-semibold text-sm">{item.activityTitle}</span>
                              </div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                                <Clock className="size-3" /> {item.date} · {item.timeSlot}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
                              <div><span className="font-medium text-foreground">Location:</span> {item.location}</div>
                              <div><span className="font-medium text-foreground">Transport:</span> {item.transportDetails}</div>
                              <div><span className="font-medium text-foreground">Provider:</span> {item.assignedProvider}</div>
                            </div>

                            {item.instructions && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Visitor Guidance:</span> {item.instructions}
                              </p>
                            )}
                            {item.internalNotes && (
                              <p className="text-xs text-amber-800 bg-amber-50 p-1.5 rounded">
                                <span className="font-bold">Staff Internal Note:</span> {item.internalNotes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* TAB 4: Trip Tasks */}
              {activeTab === "tasks" && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base">Trip Coordination Tasks</CardTitle>
                      <CardDescription>Track room blocks, VIP pass issuance, purohit booking, and vehicle coordination</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => setTaskModalOpen(true)} className="bg-teal-700 hover:bg-teal-800 text-white">
                      <Plus className="size-4 mr-1.5" /> Log Coordination Task
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!selectedRequest.tripTasks || selectedRequest.tripTasks.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <CheckSquare className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="font-semibold text-sm">No Active Tasks Logged</p>
                        <p className="text-xs mt-1">Log external supplier reservations, priest coordination, and pass tracking.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedRequest.tripTasks.map((t: any) => (
                          <div key={t.id} className="p-3 bg-card border rounded-xl flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-start gap-2.5">
                              <button
                                onClick={() => handleUpdateTaskStatus(t.id, t.status === "COMPLETED" ? "PENDING" : "COMPLETED")}
                                className={`size-5 rounded border mt-0.5 grid place-items-center ${t.status === "COMPLETED" ? "bg-emerald-600 text-white border-emerald-600" : "border-muted-foreground"}`}
                              >
                                {t.status === "COMPLETED" && <Check className="size-3" />}
                              </button>
                              <div>
                                <p className={`font-semibold ${t.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  Category: {t.category} · Due: {t.dueDate || "Before arrival"} {t.assignedTo && `· Assigned to: ${t.assignedTo}`}
                                </p>
                                {t.internalNotes && <p className="text-xs text-amber-700 mt-0.5">{t.internalNotes}</p>}
                              </div>
                            </div>
                            <Badge variant={t.status === "COMPLETED" ? "default" : "outline"} className={t.status === "COMPLETED" ? "bg-emerald-600 text-white" : ""}>
                              {t.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialog: Add Itinerary Day */}
      <Dialog open={itineraryModalOpen} onOpenChange={setItineraryModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Day-by-Day Itinerary Item</DialogTitle>
            <DialogDescription>
              Add sacred pilgrimage events, timings, locations, and provider confirmations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItinerary} className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Day Number</Label>
                <Input type="number" min={1} value={itinDayNum} onChange={(e) => setItinDayNum(Number(e.target.value))} required />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={itinDate} onChange={(e) => setItinDate(e.target.value)} required />
              </div>
              <div>
                <Label>Time Slot</Label>
                <Input value={itinTimeSlot} onChange={(e) => setItinTimeSlot(e.target.value)} placeholder="06:30 - 08:30" />
              </div>
            </div>

            <div>
              <Label>Activity / Ceremony Title</Label>
              <Input value={itinTitle} onChange={(e) => setItinTitle(e.target.value)} placeholder="e.g. VIP Pushkara Snanam & Maha Harathi" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Location / Ghat</Label>
                <Input value={itinLocation} onChange={(e) => setItinLocation(e.target.value)} />
              </div>
              <div>
                <Label>Assigned Provider</Label>
                <Input value={itinProvider} onChange={(e) => setItinProvider(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Transport Details</Label>
                <Input value={itinTransport} onChange={(e) => setItinTransport(e.target.value)} />
              </div>
              <div>
                <Label>Booking Confirmation Code</Label>
                <Input value={itinConfirmationCode} onChange={(e) => setItinConfirmationCode(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Visitor Guidance & Instructions</Label>
              <Textarea value={itinInstructions} onChange={(e) => setItinInstructions(e.target.value)} rows={2} />
            </div>

            <div>
              <Label className="text-amber-800">Internal Coordinator Staff Notes (Hidden from visitor)</Label>
              <Input value={itinInternalNotes} onChange={(e) => setItinInternalNotes(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItineraryModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingItinerary} className="bg-teal-700 hover:bg-teal-800 text-white">
                {savingItinerary ? "Saving..." : "Save to Itinerary"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Task */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Trip Coordination Task</DialogTitle>
            <DialogDescription>Track bookings and supplier confirmations.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-3 text-sm">
            <div>
              <Label>Task Title</Label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Block 2 Executive Suites at River Heritage" required />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={taskCategory} onValueChange={setTaskCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCOMMODATION">Accommodation Block</SelectItem>
                  <SelectItem value="TRANSPORT">Vehicle & Chauffeur</SelectItem>
                  <SelectItem value="VIP_PASS">VIP Ghat Pass</SelectItem>
                  <SelectItem value="PUROHIT">Vedic Purohit</SelectItem>
                  <SelectItem value="GUIDE">Tour Guide</SelectItem>
                  <SelectItem value="MEALS">Satvik Meals</SelectItem>
                  <SelectItem value="GENERAL">General Logistics</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Assigned Provider</Label>
                <Input value={taskAssignedTo} onChange={(e) => setTaskAssignedTo(e.target.value)} placeholder="Hotel Front Desk" />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>External Confirmation Ref</Label>
              <Input value={taskRef} onChange={(e) => setTaskRef(e.target.value)} placeholder="e.g. RES-2027-HOTEL-88" />
            </div>
            <div>
              <Label>Internal Staff Notes</Label>
              <Input value={taskInternalNotes} onChange={(e) => setTaskInternalNotes(e.target.value)} placeholder="Private staff notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTaskModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingTask} className="bg-teal-700 hover:bg-teal-800 text-white">
                {savingTask ? "Saving..." : "Log Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reject Request with reason */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject NRI Trip Request</DialogTitle>
            <DialogDescription>
              State a clear reason why request <strong>{selectedRequest?.referenceNumber}</strong> cannot be accommodated.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRejectRequest} className="space-y-4">
            <div>
              <Label>Rejection Reason (Transmitted to visitor)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. All verified riverside heritage rooms are fully booked for requested dates; alternative dates suggested."
                rows={4}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={rejecting} variant="destructive">
                {rejecting ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

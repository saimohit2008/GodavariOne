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
  Users, Briefcase, Plus, Search, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  UserCheck, RefreshCw, Calendar, MapPin, Eye, Phone, Mail, Clock, MessageSquare,
  FileText, Check, ArrowRight, UserX, ShieldAlert,
} from "lucide-react";
import { NRI_STATUS_META, type NriRequestStatus } from "@/lib/nri-constants";

export function NriServiceManagerAdminSection() {
  const { user } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<"managers" | "requests">("managers");
  const [managers, setManagers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedManagerFilter, setSelectedManagerFilter] = useState("ALL");

  // Create manager dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Assign manager dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [targetManagerId, setTargetManagerId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assigning, setAssigning] = useState(false);

  // View request details state
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeRequestDetail, setActiveRequestDetail] = useState<any>(null);

  // Status update / intervention dialog
  const [statusDialogReq, setStatusDialogReq] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [mgrRes, reqRes] = await Promise.all([
        api.get<{ items: any[] }>("/nri/service-managers"),
        api.get<{ items: any[] }>("/nri/requests?limit=100"),
      ]);
      setManagers(mgrRes.items || []);
      setRequests(reqRes.items || []);
    } catch (e: any) {
      toast({ title: "Failed to load NRI Manager data", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateManager(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/nri/service-managers", {
        name: createName.trim(),
        phone: createPhone.trim(),
        email: createEmail.trim() || undefined,
        password: createPassword,
      });
      toast({ title: "Success", description: "NRI Service Manager account created" });
      setCreateOpen(false);
      setCreateName("");
      setCreatePhone("");
      setCreateEmail("");
      setCreatePassword("");
      loadData();
    } catch (e: any) {
      toast({ title: "Failed to create manager", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(managerId: string, currentStatus: string) {
    const nextStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await api.patch(`/nri/service-managers/${managerId}`, { status: nextStatus });
      toast({ title: "Status Updated", description: `Manager account is now ${nextStatus}` });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleRevokeRole(managerId: string) {
    if (!confirm("Are you sure you want to revoke the NRI Service Manager role for this user?")) return;
    try {
      await api.patch(`/nri/service-managers/${managerId}`, { revokeRole: true });
      toast({ title: "Role Revoked", description: "User reverted to standard account" });
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleAssignManager(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest || !targetManagerId) return;
    setAssigning(true);
    try {
      await api.post(`/nri/requests/${selectedRequest.id}/assign-manager`, {
        managerId: targetManagerId,
        notes: assignNotes.trim() || undefined,
      });
      toast({ title: "Manager Assigned", description: "Request successfully routed to manager" });
      setAssignOpen(false);
      setSelectedRequest(null);
      setTargetManagerId("");
      setAssignNotes("");
      loadData();
    } catch (e: any) {
      toast({ title: "Assignment Failed", description: e.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  }

  async function handleStatusUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!statusDialogReq || !newStatus) return;
    setUpdatingStatus(true);
    try {
      await api.patch(`/nri/requests/${statusDialogReq.id}`, {
        status: newStatus,
        reason: statusReason.trim() || undefined,
        rejectionReason: newStatus === "DECLINED" ? (statusReason.trim() || "Rejected by Super Admin") : undefined,
      });
      toast({ title: "Status Updated", description: `Request status is now ${newStatus}` });
      setStatusDialogReq(null);
      setNewStatus("");
      setStatusReason("");
      loadData();
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (selectedManagerFilter !== "ALL") {
      if (selectedManagerFilter === "UNASSIGNED" && r.assignedManagerId) return false;
      if (selectedManagerFilter !== "UNASSIGNED" && r.assignedManagerId !== selectedManagerFilter) return false;
    }
    if (q) {
      const qLower = q.toLowerCase();
      const match =
        r.referenceNumber?.toLowerCase().includes(qLower) ||
        r.visitorName?.toLowerCase().includes(qLower) ||
        r.visitorEmail?.toLowerCase().includes(qLower) ||
        r.countryOfResidence?.toLowerCase().includes(qLower);
      if (!match) return false;
    }
    return true;
  });

  const totalAssigned = requests.filter(r => r.assignedManagerId).length;
  const totalUnassigned = requests.filter(r => !r.assignedManagerId).length;
  const totalConfirmed = requests.filter(r => r.status === "CONFIRMED").length;

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Briefcase className="size-5 text-teal-600" />
            NRI Service Manager Administration
          </h2>
          <p className="text-sm text-muted-foreground">
            Oversee dedicated NRI coordinators, trip request routing, quotation approvals, and client journey progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-teal-700 hover:bg-teal-800 text-white">
            <Plus className="size-4 mr-1.5" /> Add Service Manager
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">NRI Service Managers</p>
          <p className="text-2xl font-bold mt-1 text-teal-700">{managers.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{managers.filter(m => m.status === "ACTIVE").length} Active</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Total Trip Requests</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{requests.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{totalUnassigned} Awaiting Manager</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Assigned & In Progress</p>
          <p className="text-2xl font-bold mt-1 text-sky-700">{totalAssigned}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Being coordinated</p>
        </Card>
        <Card className="p-4 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground uppercase font-medium">Confirmed Pilgrimages</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700">{totalConfirmed}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Full packages locked</p>
        </Card>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={activeSubTab === "managers" ? "default" : "ghost"}
          onClick={() => setActiveSubTab("managers")}
          className="gap-2"
        >
          <UserCheck className="size-4" /> Manager Accounts ({managers.length})
        </Button>
        <Button
          size="sm"
          variant={activeSubTab === "requests" ? "default" : "ghost"}
          onClick={() => setActiveSubTab("requests")}
          className="gap-2"
        >
          <FileText className="size-4" /> Trip Requests & Assignments ({requests.length})
        </Button>
      </div>

      {/* Tab 1: Service Managers List */}
      {activeSubTab === "managers" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">NRI Service Manager Staff</CardTitle>
            <CardDescription>
              Dedicated staff authorized to review foreign pilgrim requests, prepare itemized quotations, and coordinate itineraries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : managers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="size-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium">No NRI Service Managers Created Yet</p>
                <p className="text-xs mt-1">Create dedicated coordinator accounts to manage NRI requests.</p>
                <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-4">
                  <Plus className="size-4 mr-1.5" /> Create First Manager
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {managers.map((mgr) => (
                  <div key={mgr.id} className="p-4 rounded-xl border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="size-10 rounded-full bg-teal-100 text-teal-800 grid place-items-center font-bold text-sm shrink-0">
                        {mgr.name?.[0]?.toUpperCase() || "M"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{mgr.name}</p>
                          <Badge variant={mgr.status === "ACTIVE" ? "default" : "secondary"} className={mgr.status === "ACTIVE" ? "bg-emerald-600 text-white" : ""}>
                            {mgr.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Phone className="size-3" /> {mgr.phone}</span>
                          {mgr.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {mgr.email}</span>}
                          <span>Assigned: <strong>{mgr.assignedCount}</strong> requests</span>
                          <span>Active: <strong>{mgr.activeRequestsCount}</strong></span>
                          <span>Confirmed: <strong>{mgr.completedRequestsCount}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedManagerFilter(mgr.id);
                          setActiveSubTab("requests");
                        }}
                      >
                        <Eye className="size-3.5 mr-1" /> View Assigned ({mgr.assignedCount})
                      </Button>
                      <Button
                        size="sm"
                        variant={mgr.status === "ACTIVE" ? "outline" : "default"}
                        onClick={() => handleToggleStatus(mgr.id, mgr.status)}
                      >
                        {mgr.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRevokeRole(mgr.id)}
                        title="Revoke manager role"
                      >
                        <UserX className="size-3.5 mr-1" /> Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Requests & Assignments */}
      {activeSubTab === "requests" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">NRI Trip Requests & Quotation Oversight</CardTitle>
                <CardDescription>
                  Assign requests to managers, review itemized quotations, inspect itineraries, and intervene when necessary.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search visitor / ref..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="QUOTATION_SENT">Quotation Sent</SelectItem>
                    <SelectItem value="QUOTATION_ACCEPTED">Quotation Accepted</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="DECLINED">Declined</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedManagerFilter} onValueChange={setSelectedManagerFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Filter Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Managers</SelectItem>
                    <SelectItem value="UNASSIGNED">Unassigned Only</SelectItem>
                    {managers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
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
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="size-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium">No matching NRI Trip Requests found</p>
                <p className="text-xs mt-1">Adjust your search or status filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((req) => {
                  const meta = NRI_STATUS_META[req.status as NriRequestStatus] || { label: req.status, color: "bg-muted text-muted-foreground" };
                  return (
                    <div key={req.id} className="p-4 rounded-xl border bg-card hover:border-primary/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {req.referenceNumber}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                            {meta.label}
                          </span>
                          {req.assignedManager ? (
                            <Badge variant="outline" className="text-xs bg-muted/40">
                              Manager: <strong className="ml-1 text-foreground">{req.assignedManager.name}</strong>
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              Unassigned
                            </Badge>
                          )}
                        </div>

                        <div>
                          <p className="font-medium text-sm">
                            {req.visitorName} ({req.countryOfResidence}) · {req.groupSize} Travelers ({req.numAdults} Adults, {req.numChildren} Children)
                          </p>
                          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            <span className="flex items-center gap-1"><Calendar className="size-3" /> {req.arrivalDate} to {req.departureDate} ({req.daysCount || 5} Days)</span>
                            <span className="flex items-center gap-1"><MapPin className="size-3" /> {req.placesToVisit || "Ghats & Temples"}</span>
                            <span>Communication: <strong>{req.preferredCommunication || "WhatsApp"}</strong></span>
                            <span>Phone: <strong>{req.visitorPhone}</strong></span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveRequestDetail(req);
                            setDetailOpen(true);
                          }}
                        >
                          <Eye className="size-3.5 mr-1" /> Inspect
                        </Button>
                        <Button
                          size="sm"
                          variant={req.assignedManager ? "outline" : "default"}
                          onClick={() => {
                            setSelectedRequest(req);
                            setTargetManagerId(req.assignedManagerId || "");
                            setAssignOpen(true);
                          }}
                          className={!req.assignedManager ? "bg-teal-700 hover:bg-teal-800 text-white" : ""}
                        >
                          <UserCheck className="size-3.5 mr-1" /> {req.assignedManager ? "Reassign" : "Assign"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setStatusDialogReq(req);
                            setNewStatus(req.status);
                            setStatusReason("");
                          }}
                        >
                          Intervene
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog: Create Manager */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add NRI Service Manager</DialogTitle>
            <DialogDescription>
              Create a dedicated staff account. The user will be assigned the NRI_SERVICE_MANAGER role.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateManager} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Anand Murthy"
                required
              />
            </div>
            <div>
              <Label>Mobile Number (used for login)</Label>
              <Input
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="e.g. 9848012345"
                required
              />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="anand@godavari.one"
              />
            </div>
            <div>
              <Label>Account Password</Label>
              <Input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="bg-teal-700 hover:bg-teal-800 text-white">
                {creating ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Assign Manager */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign NRI Service Manager</DialogTitle>
            <DialogDescription>
              Select a dedicated coordinator for request <strong>{selectedRequest?.referenceNumber}</strong> ({selectedRequest?.visitorName}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignManager} className="space-y-4">
            <div>
              <Label>Select Service Manager</Label>
              <Select value={targetManagerId} onValueChange={setTargetManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a manager..." />
                </SelectTrigger>
                <SelectContent>
                  {managers.filter(m => m.status === "ACTIVE").map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.phone}) · {m.assignedCount} Active Requests
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assignment Instructions / Notes (Optional)</Label>
              <Textarea
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Special notes for the manager regarding VIP ghat bath, dietary preferences, or flight schedules..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={assigning || !targetManagerId} className="bg-teal-700 hover:bg-teal-800 text-white">
                {assigning ? "Assigning..." : "Confirm Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Request Detail Inspector */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-teal-600" />
              NRI Request {activeRequestDetail?.referenceNumber}
            </DialogTitle>
            <DialogDescription>
              Submitted on {activeRequestDetail?.createdAt ? new Date(activeRequestDetail.createdAt).toLocaleDateString() : ""}
            </DialogDescription>
          </DialogHeader>

          {activeRequestDetail && (
            <div className="space-y-4 text-sm">
              {/* Visitor Details */}
              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase">Visitor Details</h4>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div><span className="text-muted-foreground">Name:</span> <strong>{activeRequestDetail.visitorName}</strong></div>
                  <div><span className="text-muted-foreground">Country:</span> <strong>{activeRequestDetail.countryOfResidence}</strong></div>
                  <div><span className="text-muted-foreground">Phone:</span> <strong>{activeRequestDetail.visitorPhone}</strong></div>
                  <div><span className="text-muted-foreground">Email:</span> <strong>{activeRequestDetail.visitorEmail}</strong></div>
                  <div><span className="text-muted-foreground">Preferred Mode:</span> <strong>{activeRequestDetail.preferredCommunication || "WhatsApp"}</strong></div>
                  <div><span className="text-muted-foreground">Travelers:</span> <strong>{activeRequestDetail.groupSize} ({activeRequestDetail.numAdults} Adults, {activeRequestDetail.numChildren} Children)</strong></div>
                </div>
                {activeRequestDetail.accessibilityRequirements && (
                  <p className="text-xs text-amber-700 bg-amber-50 p-1.5 rounded mt-1">
                    Special Assistance: {activeRequestDetail.accessibilityRequirements}
                  </p>
                )}
              </div>

              {/* Trip Requirements */}
              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase">Trip Requirements</h4>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div><span className="text-muted-foreground">Dates:</span> <strong>{activeRequestDetail.arrivalDate} to {activeRequestDetail.departureDate}</strong></div>
                  <div><span className="text-muted-foreground">Duration:</span> <strong>{activeRequestDetail.daysCount || 5} Days / {activeRequestDetail.nightsCount || 4} Nights</strong></div>
                  <div><span className="text-muted-foreground">Stay Preference:</span> <strong>{activeRequestDetail.accommodationPreference} ({activeRequestDetail.numRooms} Rooms)</strong></div>
                  <div><span className="text-muted-foreground">Dietary:</span> <strong>{activeRequestDetail.dietaryPreference}</strong></div>
                  <div><span className="text-muted-foreground">Guide Needed:</span> <strong>{activeRequestDetail.localGuideRequired ? "Yes (Vedic Guide)" : "No"}</strong></div>
                  <div><span className="text-muted-foreground">Package Budget:</span> <strong>{activeRequestDetail.budgetRange || "Flexible"}</strong></div>
                </div>
                {activeRequestDetail.placesToVisit && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Destinations / Ghats:</span> {activeRequestDetail.placesToVisit}
                  </p>
                )}
                {activeRequestDetail.ceremonyRequirements && (
                  <p className="text-xs text-purple-700 bg-purple-50 p-1.5 rounded mt-1">
                    <span className="font-medium">Ceremonies Requested:</span> {activeRequestDetail.ceremonyRequirements}
                  </p>
                )}
                {activeRequestDetail.additionalInstructions && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Additional Instructions:</span> {activeRequestDetail.additionalInstructions}
                  </p>
                )}
              </div>

              {/* Assigned Coordinator */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-teal-800 uppercase">Assigned Service Manager</h4>
                  <p className="text-sm font-bold text-teal-950 mt-0.5">
                    {activeRequestDetail.assignedManager?.name || "Unassigned"}
                  </p>
                  {activeRequestDetail.assignedManager && (
                    <p className="text-xs text-teal-700">{activeRequestDetail.assignedManager.phone} · {activeRequestDetail.assignedManager.email}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedRequest(activeRequestDetail);
                    setTargetManagerId(activeRequestDetail.assignedManagerId || "");
                    setDetailOpen(false);
                    setAssignOpen(true);
                  }}
                >
                  {activeRequestDetail.assignedManager ? "Change Manager" : "Assign Now"}
                </Button>
              </div>

              {/* Quotations Summary */}
              {activeRequestDetail.quotations && activeRequestDetail.quotations.length > 0 && (
                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Quotations ({activeRequestDetail.quotations.length})</h4>
                  <div className="space-y-2">
                    {activeRequestDetail.quotations.map((q: any) => (
                      <div key={q.id} className="p-2.5 rounded bg-muted/40 border text-xs flex items-center justify-between">
                        <div>
                          <p className="font-bold">{q.title}</p>
                          <p className="text-muted-foreground">Total: ₹{q.totalPrice?.toLocaleString()} ({q.status})</p>
                        </div>
                        <Badge variant="outline">{q.quotationNumber}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Intervene / Status Update */}
      <Dialog open={Boolean(statusDialogReq)} onOpenChange={() => setStatusDialogReq(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Administrative Intervention</DialogTitle>
            <DialogDescription>
              Directly override status for request <strong>{statusDialogReq?.referenceNumber}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStatusUpdate} className="space-y-4">
            <div>
              <Label>Set Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUBMITTED">SUBMITTED</SelectItem>
                  <SelectItem value="ASSIGNED">ASSIGNED</SelectItem>
                  <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                  <SelectItem value="QUOTATION_SENT">QUOTATION_SENT</SelectItem>
                  <SelectItem value="QUOTATION_ACCEPTED">QUOTATION_ACCEPTED</SelectItem>
                  <SelectItem value="CONFIRMED">CONFIRMED</SelectItem>
                  <SelectItem value="DECLINED">DECLINED (Reject)</SelectItem>
                  <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Intervention Reason / Notes</Label>
              <Textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Reason for administrative intervention..."
                rows={3}
                required={newStatus === "DECLINED"}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStatusDialogReq(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatingStatus} variant="destructive">
                {updatingStatus ? "Updating..." : "Apply Intervention"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

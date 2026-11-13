"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield,
  Users,
  Building,
  RefreshCw,
  UserCheck,
  ArrowRight,
  Eye,
  History,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Archive,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { NRI_STATUS_META, formatNriCurrency, type NriRequestStatus } from "@/lib/nri-constants";

export function NriAdminSection() {
  const [requests, setRequests] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewTab, setViewTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

  // Modals state
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Archive modal
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);

  // Restore modal
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoring, setRestoring] = useState(false);

  // Permanent Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmRefInput, setConfirmRefInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const isArchived = viewTab === "ARCHIVED";
      const [reqRes, provRes] = await Promise.all([
        api.get<{ items: any[] }>(`/nri/requests?limit=100&archived=${isArchived ? "true" : "false"}`),
        api.get<{ providers: any[] }>("/nri/providers"),
      ]);
      setRequests(reqRes.items || []);
      setProviders(provRes.providers || []);
    } catch (err: any) {
      toast({
        title: "Load failed",
        description: err instanceof ApiError ? err.message : "Error fetching admin NRI data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [viewTab]);

  const filtered = requests.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.referenceNumber?.toLowerCase().includes(q) ||
      r.visitorName?.toLowerCase().includes(q) ||
      r.countryOfResidence?.toLowerCase().includes(q) ||
      r.visitorEmail?.toLowerCase().includes(q)
    );
  });

  async function handleAssign() {
    if (!activeRequest || selectedProviders.length === 0) return;
    setAssigning(true);
    try {
      await api.post(`/nri/requests/${activeRequest.id}/assign`, {
        providerIds: selectedProviders,
        replaceExisting: false,
        reason: "Assigned by Super Administrator",
      });
      toast({
        title: "Providers Assigned",
        description: `Request assigned to ${selectedProviders.length} business owner(s).`,
      });
      setAssignOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: "Assignment failed",
        description: err instanceof ApiError ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  }

  async function handleArchive() {
    if (!activeRequest) return;
    if (archiveReason.trim().length < 3) {
      toast({
        title: "Reason required",
        description: "Please provide a valid archive reason (minimum 3 characters).",
        variant: "destructive",
      });
      return;
    }
    setArchiving(true);
    try {
      await api.post(`/nri/requests/${activeRequest.id}/archive`, {
        reason: archiveReason.trim(),
      });
      toast({
        title: "Request Archived",
        description: `Request ${activeRequest.referenceNumber} has been safely archived.`,
      });
      setArchiveOpen(false);
      setArchiveReason("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Archive failed",
        description: err instanceof ApiError ? err.message : "Failed to archive request",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore() {
    if (!activeRequest) return;
    setRestoring(true);
    try {
      const res = await api.post<{ ok: boolean; restoredStatus: string }>(
        `/nri/requests/${activeRequest.id}/restore`,
        {
          reason: restoreReason.trim() || "Restored by Super Admin",
        }
      );
      toast({
        title: "Request Restored",
        description: `Request ${activeRequest.referenceNumber} restored to ${res.restoredStatus || "active"} status.`,
      });
      setRestoreOpen(false);
      setRestoreReason("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Restore failed",
        description: err instanceof ApiError ? err.message : "Failed to restore request",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  }

  async function handleDelete() {
    if (!activeRequest) return;
    if (confirmRefInput.trim() !== activeRequest.referenceNumber && confirmRefInput.trim() !== "PERMANENTLY DELETE") {
      toast({
        title: "Confirmation mismatch",
        description: `You must enter "${activeRequest.referenceNumber}" exactly to authorize permanent deletion.`,
        variant: "destructive",
      });
      return;
    }
    if (deleteReason.trim().length < 10) {
      toast({
        title: "Detailed reason required",
        description: "A mandatory explanation (minimum 10 characters) is required for audit and data protection compliance.",
        variant: "destructive",
      });
      return;
    }
    setDeleting(true);
    try {
      await api.del(`/nri/requests/${activeRequest.id}`, {
        reason: deleteReason.trim(),
        confirmReference: confirmRefInput.trim(),
      });
      toast({
        title: "Request Permanently Deleted",
        description: `Request ${activeRequest.referenceNumber} and associated records were permanently purged in compliance with retention policies.`,
      });
      setDeleteOpen(false);
      setDeleteReason("");
      setConfirmRefInput("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Deletion failed",
        description: err instanceof ApiError ? err.message : "Failed to delete request",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="size-5 text-teal-600" /> Super Admin — NRI Requests & Quotation Oversight
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit request allocations, manage active client workflows, archive completed pilgrimages, or permanently purge records under legal retention controls.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="text-xs">
          <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border w-fit">
          <button
            type="button"
            onClick={() => setViewTab("ACTIVE")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewTab === "ACTIVE"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5 text-teal-600" />
            Active Requests
          </button>
          <button
            type="button"
            onClick={() => setViewTab("ARCHIVED")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewTab === "ARCHIVED"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="size-3.5 text-slate-500" />
            Archived Requests
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Input
            placeholder="Search reference #, visitor, or country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 h-8 text-xs bg-card"
          />
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            Count: {filtered.length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading administrative oversight data...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-xs">
          {viewTab === "ACTIVE" ? (
            <div>
              <FileText className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-sm">No Active NRI Requests</p>
              <p className="text-xs text-muted-foreground mt-1">There are currently no active non-archived NRI custom package requests.</p>
            </div>
          ) : (
            <div>
              <Archive className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold text-sm">No Archived Requests</p>
              <p className="text-xs text-muted-foreground mt-1">Archived requests will appear here with restoration and data purge controls.</p>
            </div>
          )}
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Visitor & Country</th>
                  <th className="p-3">Travelers & Dates</th>
                  {viewTab === "ACTIVE" ? (
                    <>
                      <th className="p-3">Status</th>
                      <th className="p-3">Assigned Providers</th>
                      <th className="p-3">Quotations</th>
                    </>
                  ) : (
                    <>
                      <th className="p-3">Archived By</th>
                      <th className="p-3">Archived Date</th>
                      <th className="p-3">Archive Reason</th>
                    </>
                  )}
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const statusInfo = NRI_STATUS_META[r.status as NriRequestStatus] || {
                    label: r.status,
                    color: "bg-muted text-muted-foreground",
                  };
                  const assignedCount = r.assignments?.length || 0;
                  const quotesCount = r.quotations?.length || 0;
                  const isConfirmed = r.status === "CONFIRMED" || Boolean(r.confirmedQuotationId);

                  // Extract archive metadata from status history
                  const archiveHistoryItem = r.statusHistory?.find((h: any) => h.toStatus === "ARCHIVED");
                  const archivedBy = archiveHistoryItem?.changedByName || "Staff";
                  const archivedAt = archiveHistoryItem?.createdAt
                    ? new Date(archiveHistoryItem.createdAt).toLocaleDateString()
                    : new Date(r.updatedAt).toLocaleDateString();
                  const archiveReasonText = archiveHistoryItem?.reason || "Archived by Administrator";

                  return (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-bold text-teal-800 dark:text-teal-300">
                        {r.referenceNumber}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold block">{r.visitorName}</span>
                        <span className="text-muted-foreground text-[11px]">{r.countryOfResidence}</span>
                      </td>
                      <td className="p-3">
                        <span>{r.groupSize} Guests ({r.numAdults}A, {r.numChildren}C)</span>
                        <span className="text-muted-foreground block text-[11px]">
                          {r.arrivalDate} → {r.departureDate}
                        </span>
                      </td>

                      {viewTab === "ACTIVE" ? (
                        <>
                          <td className="p-3">
                            <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <span className="font-medium">{assignedCount} Provider(s)</span>
                            {r.assignments?.map((a: any) => (
                              <span key={a.id} className="block text-[10px] text-muted-foreground">
                                • {a.provider?.name || a.provider?.phone} ({a.status})
                              </span>
                            ))}
                          </td>
                          <td className="p-3 font-mono">
                            {quotesCount > 0 ? (
                              <span className="font-semibold text-teal-700 dark:text-teal-400">
                                {quotesCount} {quotesCount === 1 ? "Offer" : "Offers"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">None</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 font-medium text-foreground">
                            {archivedBy}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {archivedAt}
                          </td>
                          <td className="p-3 max-w-xs truncate italic text-muted-foreground text-[11px]" title={archiveReasonText}>
                            “{archiveReasonText}”
                          </td>
                        </>
                      )}

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {viewTab === "ACTIVE" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2"
                                onClick={() => {
                                  setActiveRequest(r);
                                  setSelectedProviders(r.assignments?.map((a: any) => a.providerId) || []);
                                  setAssignOpen(true);
                                }}
                              >
                                <UserCheck className="size-3 mr-1" /> Reassign
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-[11px] h-7 px-2"
                                onClick={() => {
                                  setActiveRequest(r);
                                  setHistoryOpen(true);
                                }}
                              >
                                <History className="size-3 mr-1" /> Audit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2 text-slate-700 hover:text-slate-900 border-slate-300"
                                disabled={isConfirmed}
                                title={isConfirmed ? "Confirmed packages cannot be archived directly" : "Archive this request"}
                                onClick={() => {
                                  setActiveRequest(r);
                                  setArchiveReason("");
                                  setArchiveOpen(true);
                                }}
                              >
                                <Archive className="size-3 mr-1" /> Archive
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-[11px] h-7 px-2"
                                onClick={() => {
                                  setActiveRequest(r);
                                  setHistoryOpen(true);
                                }}
                              >
                                <History className="size-3 mr-1" /> Audit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                onClick={() => {
                                  setActiveRequest(r);
                                  setRestoreReason("");
                                  setRestoreOpen(true);
                                }}
                              >
                                <RotateCcw className="size-3 mr-1" /> Restore
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-[11px] h-7 px-2 font-semibold"
                                onClick={() => {
                                  setActiveRequest(r);
                                  setDeleteReason("");
                                  setConfirmRefInput("");
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="size-3 mr-1" /> Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign / Reassign Modal */}
      {activeRequest && (
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-teal-800 dark:text-teal-300">
                Assign Providers — {activeRequest.referenceNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select authorized Business Owners offering relevant transport and hotel services for {activeRequest.visitorName}'s group.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-3 max-h-64 overflow-y-auto text-xs">
              {providers.map((p) => {
                const isSelected = selectedProviders.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedProviders(selectedProviders.filter((id) => id !== p.id));
                      } else {
                        setSelectedProviders([...selectedProviders, p.id]);
                      }
                    }}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected ? "bg-teal-50 dark:bg-teal-950 border-teal-600 font-semibold" : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div>
                      <p className="text-xs text-foreground">{p.name} ({p.phone})</p>
                      <p className="text-[10px] text-muted-foreground">{p.categories?.join(", ") || "Hospitality"}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="size-4 text-teal-600" />}
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold"
                disabled={assigning || selectedProviders.length === 0}
                onClick={handleAssign}
              >
                {assigning ? "Assigning..." : "Confirm Assignment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* History & Audit Modal */}
      {activeRequest && (
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <History className="size-4 text-teal-600" />
                Audit Trail — {activeRequest.referenceNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Indelible historical records of status transitions, assignment updates, and administrative actions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2 max-h-72 overflow-y-auto text-xs">
              {activeRequest.statusHistory?.length ? (
                activeRequest.statusHistory.map((h: any) => (
                  <div key={h.id} className="p-2.5 rounded-lg border bg-muted/20 space-y-0.5">
                    <div className="flex justify-between font-semibold">
                      <span>{h.fromStatus} → {h.toStatus}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">By: {h.changedByName || "System"}</p>
                    {h.reason && <p className="text-[11px] italic text-foreground/80">“{h.reason}”</p>}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4 text-xs">No status history entries recorded.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHistoryOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Archive Request Confirmation Dialog */}
      {activeRequest && (
        <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Archive className="size-4 text-slate-600" />
                Archive NRI Request — {activeRequest.referenceNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Archiving moves this request into cold storage. Visitor details, quotations, and assignments are safely preserved and can be restored at any time.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Soft Archival:</strong> Ordinary database records are NOT erased. Providers will no longer see active prompts for this request.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="archive-reason" className="text-xs font-semibold">
                  Archive Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="archive-reason"
                  placeholder="e.g. Pilgrimage dates expired / Client requested postponement / Dormant request"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="text-xs min-h-[70px]"
                />
                <p className="text-[10px] text-muted-foreground">Mandatory minimum 3 characters required for audit trail.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={archiving}>
                Cancel
              </Button>
              <Button
                className="bg-slate-800 hover:bg-slate-900 text-white font-semibold"
                disabled={archiving || archiveReason.trim().length < 3}
                onClick={handleArchive}
              >
                {archiving ? "Archiving..." : "Confirm Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Restore Request Confirmation Dialog */}
      {activeRequest && (
        <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <RotateCcw className="size-4 text-emerald-600" />
                Restore Archived Request — {activeRequest.referenceNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Restoring this request re-activates client oversight and returns the request to its previous workflow status.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs">
                The request will be returned to active operational lists with full quotation history preserved.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="restore-reason" className="text-xs font-semibold">
                  Restore Notes (Optional)
                </Label>
                <Input
                  id="restore-reason"
                  placeholder="e.g. Client confirmed return travel / Reactivated by Super Admin"
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreOpen(false)} disabled={restoring}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                disabled={restoring}
                onClick={handleRestore}
              >
                {restoring ? "Restoring..." : "Confirm Restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Strongly Protected Permanent Deletion Dialog */}
      {activeRequest && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md border-red-500">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600">
                <AlertTriangle className="size-5 text-red-600" />
                Permanent Deletion — Legal Retention Gate
              </DialogTitle>
              <DialogDescription className="text-xs text-red-700 dark:text-red-400 font-medium">
                WARNING: This is an irreversible operation. All associated quotations, versions, messages, and task records will be permanently removed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Lock className="size-3.5" /> Retention & Business Compliance:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Requests with confirmed packages or accepted payments can NEVER be deleted.</li>
                  <li>A permanent deletion audit entry will be recorded in the system audit log.</li>
                  <li>This action is restricted strictly to Super Administrators.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="del-ref-confirm" className="text-xs font-semibold">
                  Type <span className="font-mono font-bold text-red-600">{activeRequest.referenceNumber}</span> to confirm:
                </Label>
                <Input
                  id="del-ref-confirm"
                  placeholder={activeRequest.referenceNumber}
                  value={confirmRefInput}
                  onChange={(e) => setConfirmRefInput(e.target.value)}
                  className="font-mono text-xs border-red-300 focus-visible:ring-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="del-reason" className="text-xs font-semibold">
                  Mandatory Legal Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="del-reason"
                  placeholder="e.g. Formal GDPR erasure request from visitor / Legal data protection purge authorization"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="text-xs min-h-[70px] border-red-300 focus-visible:ring-red-500"
                />
                <p className="text-[10px] text-muted-foreground">Minimum 10 characters required for regulatory audit log.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  deleting ||
                  (confirmRefInput.trim() !== activeRequest.referenceNumber && confirmRefInput.trim() !== "PERMANENTLY DELETE") ||
                  deleteReason.trim().length < 10
                }
                onClick={handleDelete}
                className="font-bold"
              >
                {deleting ? "Deleting..." : "Permanently Delete Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

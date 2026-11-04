"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Shield, Users, Building, RefreshCw, UserCheck, ArrowRight,
  Eye, History, FileText, CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { NRI_STATUS_META, formatNriCurrency, type NriRequestStatus } from "@/lib/nri-constants";

export function NriAdminSection() {
  const [requests, setRequests] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [reqRes, provRes] = await Promise.all([
        api.get<{ items: any[] }>("/nri/requests?limit=100"),
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
  }, []);

  const filtered = requests.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.referenceNumber?.toLowerCase().includes(q) ||
      r.visitorName?.toLowerCase().includes(q) ||
      r.countryOfResidence?.toLowerCase().includes(q)
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
      toast({ title: "Providers Assigned", description: `Request assigned to ${selectedProviders.length} business owner(s).` });
      setAssignOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setAssigning(false);
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
            Audit request allocations, assign or reassign business owners, and inspect quotation version history.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="text-xs">
          <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex justify-between items-center gap-3">
        <Input
          placeholder="Search by reference #, visitor, or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm h-8 text-xs bg-card"
        />
        <span className="text-xs text-muted-foreground font-mono">
          Total Requests: {requests.length}
        </span>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading administrative oversight data...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-xs">No NRI requests found.</Card>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Visitor & Country</th>
                  <th className="p-3">Travelers & Dates</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned Providers</th>
                  <th className="p-3">Quotations</th>
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
                        <span className="text-muted-foreground block text-[11px]">{r.arrivalDate} → {r.departureDate}</span>
                      </td>
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
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
              <DialogTitle className="text-base font-bold">
                Audit Trail — {activeRequest.referenceNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2 max-h-72 overflow-y-auto text-xs">
              {activeRequest.statusHistory?.map((h: any) => (
                <div key={h.id} className="p-2.5 rounded-lg border bg-muted/20 space-y-0.5">
                  <div className="flex justify-between font-semibold">
                    <span>{h.fromStatus} → {h.toStatus}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{new Date(h.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">By: {h.changedByName || "System"}</p>
                  {h.reason && <p className="text-[11px] italic">“{h.reason}”</p>}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHistoryOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

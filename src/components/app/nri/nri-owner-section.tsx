"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  FileText, Clock, Users, Calendar, MapPin, Building, Utensils,
  CheckCircle2, XCircle, AlertCircle, MessageSquare, Plus, ArrowRight,
  Eye, ShieldCheck, Filter, Car, RefreshCw
} from "lucide-react";
import { NriQuotationBuilder } from "./nri-quotation-builder";
import { NRI_STATUS_META, formatNriCurrency, type NriRequestStatus } from "@/lib/nri-constants";

export function NriOwnerSection() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Active targets
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<any>(null);

  // Decline Dialog
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  // Final Confirmation Verification Modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hotelDetails, setHotelDetails] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [confirmationNotes, setConfirmationNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Messages dialog
  const [messageOpen, setMessageOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await api.get<{ items: any[] }>("/nri/requests");
      setRequests(res.items || []);
    } catch (err: any) {
      toast({
        title: "Failed to load requests",
        description: err instanceof ApiError ? err.message : "Error fetching NRI requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  // Filter requests
  const filtered = requests.filter((r) => {
    if (statusFilter !== "ALL") {
      if (statusFilter === "NEW" && r.status !== "SUBMITTED" && r.status !== "ASSIGNED") return false;
      if (statusFilter === "IN_PROGRESS" && r.status !== "IN_PROGRESS") return false;
      if (statusFilter === "QUOTATION_SENT" && r.status !== "QUOTATION_SENT") return false;
      if (statusFilter === "ACCEPTED" && r.status !== "QUOTATION_ACCEPTED" && r.status !== "AWAITING_FINAL_CONFIRMATION") return false;
      if (statusFilter === "CONFIRMED" && r.status !== "CONFIRMED") return false;
      if (statusFilter === "DECLINED" && r.status !== "DECLINED") return false;
      if (statusFilter === "CLOSED" && r.status !== "CLOSED" && r.status !== "CANCELLED") return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.referenceNumber?.toLowerCase().includes(q) ||
        r.visitorName?.toLowerCase().includes(q) ||
        r.countryOfResidence?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate remaining response SLA
  function getRemainingTime(deadlineStr?: string) {
    if (!deadlineStr) return null;
    const diff = new Date(deadlineStr).getTime() - Date.now();
    if (diff <= 0) return "SLA Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  }

  async function handleDecline() {
    if (!activeRequest) return;
    setDeclining(true);
    try {
      await api.patch(`/nri/requests/${activeRequest.id}`, {
        status: "DECLINED",
        declineReason: declineReason.trim() || "Provider unavailable for requested dates",
      });
      toast({ title: "Request Declined", description: "You have declined this request with recorded rationale." });
      setDeclineOpen(false);
      setDetailsModalOpen(false);
      loadRequests();
    } catch (err: any) {
      toast({ title: "Action failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setDeclining(false);
    }
  }

  async function handleFinalConfirmation() {
    if (!activeRequest || !activeRequest.quotations?.[0]) return;
    const quote = activeRequest.quotations[0];
    if (!hotelDetails.trim() || !vehicleDetails.trim()) {
      toast({ title: "Details required", description: "Please enter hotel room verification and vehicle driver details.", variant: "destructive" });
      return;
    }

    setConfirming(true);
    try {
      await api.post(`/nri/quotations/${quote.id}/confirm`, {
        hotelConfirmationDetails: hotelDetails.trim(),
        vehicleDetails: vehicleDetails.trim(),
        confirmationNotes: confirmationNotes.trim() || null,
      });
      toast({ title: "Package Confirmed!", description: "All arrangements locked in and verified with the visitor." });
      setConfirmOpen(false);
      setDetailsModalOpen(false);
      loadRequests();
    } catch (err: any) {
      toast({ title: "Confirmation failed", description: err instanceof ApiError ? err.message : "Error confirming package", variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  }

  async function openMessages(reqItem: any) {
    setActiveRequest(reqItem);
    setMessageOpen(true);
    try {
      const res = await api.get<{ messages: any[] }>(`/nri/requests/${reqItem.id}/messages`);
      setMessages(res.messages || []);
    } catch {
      setMessages([]);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !activeRequest) return;
    setSendingMsg(true);
    try {
      const res = await api.post<{ ok: boolean; message: any }>(`/nri/requests/${activeRequest.id}/messages`, {
        message: newMessage.trim(),
      });
      setMessages([...messages, res.message]);
      setNewMessage("");
      toast({ title: "Message Sent" });
    } catch (err: any) {
      toast({ title: "Message failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setSendingMsg(false);
    }
  }

  if (builderOpen && activeRequest) {
    return (
      <NriQuotationBuilder
        request={activeRequest}
        existingQuotation={editingQuotation}
        onSuccess={() => {
          setBuilderOpen(false);
          setEditingQuotation(null);
          loadRequests();
        }}
        onCancel={() => {
          setBuilderOpen(false);
          setEditingQuotation(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building className="size-5 text-teal-600" /> NRI Custom Package Requests
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review incoming global pilgrim package requests, submit itemized quotations, and confirm verified services.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadRequests} disabled={loading} className="text-xs">
            <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "ALL", label: "All Requests" },
            { id: "NEW", label: "New / Assigned" },
            { id: "IN_PROGRESS", label: "In Progress" },
            { id: "QUOTATION_SENT", label: "Quotation Sent" },
            { id: "ACCEPTED", label: "Accepted" },
            { id: "CONFIRMED", label: "Confirmed" },
            { id: "DECLINED", label: "Declined" },
          ].map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant={statusFilter === tab.id ? "default" : "outline"}
              className={`h-8 text-xs ${
                statusFilter === tab.id ? "bg-teal-700 hover:bg-teal-800 text-white" : ""
              }`}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <Input
          placeholder="Filter by ref # or visitor name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs h-8 text-xs bg-card"
        />
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading package requests...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FileText className="size-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-foreground">No package requests found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {statusFilter !== "ALL" ? `No requests matching status "${statusFilter}".` : "Incoming NRI requests will appear here once allocated."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((item) => {
            const statusInfo = NRI_STATUS_META[item.status as NriRequestStatus] || {
              label: item.status,
              color: "bg-muted text-muted-foreground",
            };
            const remaining = getRemainingTime(item.responseDeadline);
            const myQuote = item.quotations?.[0];

            return (
              <Card key={item.id} className="overflow-hidden border hover:border-teal-500/40 transition-all shadow-xs">
                <CardContent className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-teal-800 dark:text-teal-300">
                        {item.referenceNumber}
                      </span>
                      <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                        {statusInfo.label}
                      </Badge>
                      {remaining && (item.status === "ASSIGNED" || item.status === "IN_PROGRESS") && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <Clock className="size-3" /> {remaining}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Visitor & Origin</span>
                        <span className="font-semibold text-foreground">{item.visitorName}</span>
                        <span className="text-muted-foreground block text-[11px]">{item.countryOfResidence}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Group Size & Dates</span>
                        <span className="font-semibold text-foreground">{item.groupSize} Travelers ({item.numAdults}A, {item.numChildren}C)</span>
                        <span className="text-muted-foreground block text-[11px]">{item.arrivalDate} → {item.departureDate}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Accommodation & Hub</span>
                        <span className="font-semibold text-foreground">{item.accommodationPreference}</span>
                        <span className="text-muted-foreground block text-[11px] truncate">{item.arrivalLocation}</span>
                      </div>
                    </div>

                    {item.specialRequests && (
                      <p className="text-xs text-muted-foreground/90 line-clamp-1 italic bg-muted/30 px-2.5 py-1 rounded-md">
                        “{item.specialRequests}”
                      </p>
                    )}

                    {myQuote && (
                      <div className="flex items-center gap-3 pt-1 text-xs">
                        <span className="text-teal-700 dark:text-teal-400 font-bold">
                          My Quotation: {formatNriCurrency(myQuote.totalPrice)} (v{myQuote.version} - {myQuote.status})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => openMessages(item)}
                    >
                      <MessageSquare className="size-3.5 mr-1" /> Messages
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => {
                        setActiveRequest(item);
                        setDetailsModalOpen(true);
                      }}
                    >
                      <Eye className="size-3.5 mr-1" /> Review Request
                    </Button>

                    {/* Action button based on status */}
                    {item.status === "AWAITING_FINAL_CONFIRMATION" || item.status === "QUOTATION_ACCEPTED" ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                        onClick={() => {
                          setActiveRequest(item);
                          setConfirmOpen(true);
                        }}
                      >
                        <ShieldCheck className="size-3.5 mr-1" /> Verify & Confirm Services
                      </Button>
                    ) : item.status !== "CONFIRMED" && item.status !== "DECLINED" && item.status !== "CLOSED" ? (
                      <Button
                        size="sm"
                        className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs h-8"
                        onClick={() => {
                          setActiveRequest(item);
                          setEditingQuotation(myQuote || null);
                          setBuilderOpen(true);
                        }}
                      >
                        {myQuote ? "Revise Quotation" : "Prepare Quotation"} <ArrowRight className="size-3.5 ml-1" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Request Details Modal */}
      {activeRequest && (
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-bold text-teal-800 dark:text-teal-300">
                  Request Details — {activeRequest.referenceNumber}
                </DialogTitle>
                <Badge variant="outline">{activeRequest.status}</Badge>
              </div>
              <DialogDescription className="text-xs">
                Submitted on {new Date(activeRequest.createdAt).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Primary Contact</span>
                  <span className="font-bold text-sm text-foreground">{activeRequest.visitorName}</span>
                  <span className="text-muted-foreground block">{activeRequest.visitorEmail}</span>
                  <span className="text-muted-foreground block font-mono">{activeRequest.visitorPhone}</span>
                  <span className="text-teal-700 dark:text-teal-400 font-semibold block mt-0.5">Origin: {activeRequest.countryOfResidence}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Travel Group Details</span>
                  <span className="font-bold text-sm text-foreground">{activeRequest.groupSize} Travelers</span>
                  <span className="text-muted-foreground block">{activeRequest.numAdults} Adults · {activeRequest.numChildren} Children</span>
                  <span className="text-muted-foreground block">Dates: {activeRequest.arrivalDate} → {activeRequest.departureDate}</span>
                  <span className="text-muted-foreground block">Rooms: {activeRequest.numRooms} Rooms Desired</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border">
                  <span className="font-semibold block mb-1">Pickup / Arrival Hub</span>
                  <p className="text-muted-foreground">{activeRequest.arrivalLocation}</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <span className="font-semibold block mb-1">Drop-off / Departure Hub</span>
                  <p className="text-muted-foreground">{activeRequest.departureLocation}</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <span className="font-semibold block mb-1">Accommodation Preference</span>
                  <p className="text-muted-foreground">{activeRequest.accommodationPreference}</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <span className="font-semibold block mb-1">Dietary Requirements</span>
                  <p className="text-muted-foreground">{activeRequest.dietaryPreference}</p>
                </div>
              </div>

              {activeRequest.specialRequests && (
                <div className="p-3 rounded-lg border bg-amber-50/40 dark:bg-amber-950/20 border-amber-200">
                  <span className="font-semibold text-amber-900 dark:text-amber-300 block mb-1">Special Requests & Assistance</span>
                  <p className="text-muted-foreground">{activeRequest.specialRequests}</p>
                </div>
              )}

              {activeRequest.preferredItinerary && (
                <div className="p-3 rounded-lg border">
                  <span className="font-semibold block mb-1">Preferred Itinerary</span>
                  <p className="text-muted-foreground">{activeRequest.preferredItinerary}</p>
                </div>
              )}

              {activeRequest.budgetRange && (
                <div className="p-3 rounded-lg border">
                  <span className="font-semibold block mb-1">Visitor's Estimated Budget</span>
                  <p className="text-muted-foreground font-mono">{activeRequest.budgetRange}</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeclineOpen(true)}
              >
                <XCircle className="size-4 mr-1.5" /> Decline Request
              </Button>
              <Button
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold"
                onClick={() => {
                  setDetailsModalOpen(false);
                  setEditingQuotation(activeRequest.quotations?.[0] || null);
                  setBuilderOpen(true);
                }}
              >
                Prepare All-Inclusive Quotation <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Decline Reason Modal */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-destructive">Decline Package Request</DialogTitle>
            <DialogDescription className="text-xs">
              State a clear reason for declining this request. The visitor and administrators will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs font-semibold mb-1 block">Decline Reason *</Label>
            <Textarea
              placeholder="e.g. Hotel fully booked for requested dates, vehicle fleet committed to prior VIP Pushkaralu allocation..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={declining}
              onClick={handleDecline}
            >
              {declining ? "Declining..." : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Service Verification & Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" /> Verify & Lock In Package Services
            </DialogTitle>
            <DialogDescription className="text-xs">
              Visitor has accepted your quotation. Please verify actual hotel room allocation, chauffeur assignment, and holy bath arrangements to confirm the booking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Hotel Room Verification Details *</Label>
              <Input
                placeholder="e.g. River Bay Resort — Booking Voucher #RB-2027-891, 2 Deluxe River Rooms"
                value={hotelDetails}
                onChange={(e) => setHotelDetails(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Vehicle & Chauffeur Details *</Label>
              <Input
                placeholder="e.g. Toyota Innova Crysta (AP 05 XY 1234), Driver: Ramesh (+91 98480 12345)"
                value={vehicleDetails}
                onChange={(e) => setVehicleDetails(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Confirmation Notes / Priest Details (Optional)</Label>
              <Textarea
                placeholder="e.g. VIP Pushkara Snanam pass registered with Devasthanam. Purohit Sri Sharma (+91 94401 23456) assigned for morning sankalpam."
                value={confirmationNotes}
                onChange={(e) => setConfirmationNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={confirming}
              onClick={handleFinalConfirmation}
            >
              {confirming ? "Confirming Package..." : "Finalize & Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Messages / Conversation Modal */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="size-4 text-teal-600" /> Conversation — {activeRequest?.referenceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Direct private coordination with {activeRequest?.visitorName} ({activeRequest?.countryOfResidence}).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-muted/20 rounded-xl my-2 max-h-80 text-xs">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 italic">No messages yet. Ask questions or reply to visitor inquiries.</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl max-w-[85%] ${
                    m.senderRole === "BUSINESS_OWNER"
                      ? "ml-auto bg-teal-700 text-white rounded-br-xs"
                      : "mr-auto bg-card border rounded-bl-xs text-foreground"
                  }`}
                >
                  <span className="text-[10px] opacity-75 font-semibold block mb-0.5">
                    {m.senderName} ({m.senderRole.replace(/_/g, " ")}) · {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <p className="text-xs leading-relaxed">{m.message}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Type your message or clarification..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
              disabled={sendingMsg || !newMessage.trim()}
              onClick={handleSendMessage}
            >
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

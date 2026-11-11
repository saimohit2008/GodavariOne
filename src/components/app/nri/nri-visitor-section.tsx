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
  FileText, Calendar, Building, Car, Utensils, Users,
  CheckCircle2, XCircle, AlertCircle, MessageSquare, ArrowRight,
  Eye, ShieldCheck, Printer, RefreshCw, Send, Check, DollarSign, Layers, Clock
} from "lucide-react";
import { NRI_STATUS_META, formatNriCurrency, type NriRequestStatus } from "@/lib/nri-constants";

export function NriVisitorSection() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active quotation & modal states
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Messaging modal state
  const [messageOpen, setMessageOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  async function loadMyRequests() {
    setLoading(true);
    try {
      const res = await api.get<{ items: any[] }>("/nri/requests");
      setRequests(res.items || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyRequests();
  }, []);

  async function handleAcceptQuotation(quotationId: string) {
    if (!selectedRequest) return;
    setAccepting(true);
    try {
      await api.post(`/nri/quotations/${quotationId}/accept`, {
        referenceNumber: selectedRequest.referenceNumber,
        visitorEmail: selectedRequest.visitorEmail,
      });
      toast({
        title: "Quotation Accepted!",
        description: "Your selection has been submitted. The provider will verify room and transit arrangements to lock in your final confirmation.",
      });
      setQuotationModalOpen(false);
      setCompareModalOpen(false);
      loadMyRequests();
    } catch (err: any) {
      toast({
        title: "Acceptance failed",
        description: err instanceof ApiError ? err.message : "Error accepting quotation",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  }

  async function openMessages(reqItem: any) {
    setSelectedRequest(reqItem);
    setMessageOpen(true);
    try {
      const res = await api.get<{ messages: any[] }>(`/nri/requests/${reqItem.id}/messages`);
      setMessages(res.messages || []);
    } catch {
      setMessages([]);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedRequest) return;
    setSendingMsg(true);
    try {
      const res = await api.post<{ ok: boolean; message: any }>(`/nri/requests/${selectedRequest.id}/messages`, {
        message: newMessage.trim(),
        requestRevision: true,
      });
      setMessages([...messages, res.message]);
      setNewMessage("");
      toast({ title: "Message Sent", description: "The provider has been notified of your inquiry/revision request." });
    } catch (err: any) {
      toast({ title: "Message failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    } finally {
      setSendingMsg(false);
    }
  }

  function handlePrintQuotation() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="size-5 text-teal-600" /> NRI Custom Package Proposals
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review, compare, and accept customized all-inclusive Pushkaralu 2027 package proposals from verified regional operators.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadMyRequests} disabled={loading} className="text-xs">
          <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading your custom requests...</div>
      ) : requests.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FileText className="size-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-foreground">No NRI package requests yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Plan your custom pilgrimage with private airport transit, 4/5-star accommodation, and sacred Pushkara snanam.
          </p>
          <Button asChild size="sm" className="bg-teal-700 hover:bg-teal-800 text-white">
            <a href="/nri-access">Create NRI Package Request</a>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((item) => {
            const statusInfo = NRI_STATUS_META[item.status as NriRequestStatus] || {
              label: item.status,
              color: "bg-muted text-muted-foreground",
            };
            const quotations = item.quotations || [];

            let confirmationParsed: any = null;
            if (item.confirmationNotes) {
              try {
                confirmationParsed = JSON.parse(item.confirmationNotes);
              } catch {}
            }

            return (
              <Card key={item.id} className="border shadow-xs overflow-hidden">
                <CardHeader className="p-4 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-teal-800 dark:text-teal-300">
                        {item.referenceNumber}
                      </span>
                      <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.groupSize} Travelers ({item.numAdults}A, {item.numChildren}C) · {item.arrivalDate} to {item.departureDate} · Hub: {item.arrivalLocation}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => openMessages(item)}
                    >
                      <MessageSquare className="size-3.5 mr-1" /> Ask Question / Messages
                    </Button>
                    {quotations.length > 1 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs h-8 font-semibold bg-teal-100 dark:bg-teal-950 text-teal-900 dark:text-teal-200"
                        onClick={() => {
                          setSelectedRequest(item);
                          setCompareModalOpen(true);
                        }}
                      >
                        <Layers className="size-3.5 mr-1" /> Compare Quotes ({quotations.length})
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Confirmed banner */}
                  {item.status === "CONFIRMED" && confirmationParsed && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <CheckCircle2 className="size-4 text-emerald-600" /> Package Verified & Confirmed!
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Hotel Voucher: <span className="font-semibold text-foreground">{confirmationParsed.hotel}</span> · Vehicle: <span className="font-semibold text-foreground">{confirmationParsed.vehicle}</span>
                      </p>
                      {confirmationParsed.notes && (
                        <p className="text-[11px] italic text-muted-foreground">Note: {confirmationParsed.notes}</p>
                      )}
                    </div>
                  )}

                  {/* Awaiting confirmation banner */}
                  {item.status === "AWAITING_FINAL_CONFIRMATION" && (
                    <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 text-xs text-cyan-900 dark:text-cyan-200 flex items-center gap-2">
                      <Clock className="size-4 text-cyan-600 shrink-0" />
                      <span>You have accepted an offer! The provider is currently verifying room inventory and chauffeur permits. Status will update to Confirmed shortly.</span>
                    </div>
                  )}

                  {/* Quotations List */}
                  <div>
                    <span className="text-xs font-semibold block mb-2 text-foreground">
                      Received Proposals ({quotations.length})
                    </span>

                    {quotations.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-3">
                        Regional hospitality partners have been assigned and are currently preparing day-by-day itineraries and vehicle arrangements.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {quotations.map((q: any) => (
                          <div
                            key={q.id}
                            className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                              q.status === "ACCEPTED" || q.status === "CONFIRMED"
                                ? "bg-teal-50/50 dark:bg-teal-950/30 border-teal-500 ring-1 ring-teal-500/30"
                                : "bg-card hover:border-teal-400"
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-sm text-foreground">{q.title}</h4>
                                  <p className="text-[11px] text-muted-foreground">
                                    By {q.provider?.name || "Verified Partner"} · {q.durationDays} Days / {q.durationDays - 1} Nights
                                  </p>
                                </div>
                                <Badge variant={q.status === "ACCEPTED" || q.status === "CONFIRMED" ? "default" : "secondary"} className="text-[10px]">
                                  {q.status}
                                </Badge>
                              </div>

                              <div className="mt-3 flex items-baseline justify-between bg-muted/40 p-2.5 rounded-lg">
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">Complete Package Total</span>
                                  <span className="font-bold font-mono text-base text-teal-800 dark:text-teal-300">
                                    {formatNriCurrency(q.totalPrice)}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-muted-foreground block">Price Per Person</span>
                                  <span className="font-semibold font-mono text-xs text-teal-700 dark:text-teal-400">
                                    ₹{q.pricePerPerson.toLocaleString("en-IN")}/person
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs h-8"
                                onClick={() => {
                                  setSelectedRequest(item);
                                  setSelectedQuotation(q);
                                  setQuotationModalOpen(true);
                                }}
                              >
                                <Eye className="size-3.5 mr-1" /> View Full Quotation
                              </Button>

                              {item.status !== "AWAITING_FINAL_CONFIRMATION" && item.status !== "CONFIRMED" && item.status !== "CANCELLED" && (
                                <Button
                                  size="sm"
                                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs h-8"
                                  onClick={() => {
                                    setSelectedRequest(item);
                                    handleAcceptQuotation(q.id);
                                  }}
                                >
                                  Accept Offer
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Single Quotation Inspection Modal */}
      {selectedQuotation && (
        <Dialog open={quotationModalOpen} onOpenChange={setQuotationModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-teal-800 dark:text-teal-300">
                    {selectedQuotation.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Proposal #{selectedQuotation.quotationNumber} · by {selectedQuotation.provider?.name || "Verified Partner"}
                  </DialogDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={handlePrintQuotation} className="text-xs">
                  <Printer className="size-3.5 mr-1" /> Print / Save
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-5 py-3 text-xs">
              {/* Header Pricing Pill */}
              <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex justify-between items-center">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Group Pricing ({selectedRequest?.groupSize} Guests)</span>
                  <span className="text-2xl font-bold font-mono text-teal-800 dark:text-teal-200">
                    {formatNriCurrency(selectedQuotation.totalPrice)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block text-[11px]">Price Per Traveler</span>
                  <span className="text-base font-bold font-mono text-teal-700 dark:text-teal-300">
                    ₹{selectedQuotation.pricePerPerson.toLocaleString("en-IN")} / person
                  </span>
                </div>
              </div>

              {/* Day-by-day Itinerary */}
              <div>
                <h4 className="font-bold text-sm mb-2 text-foreground">Day-by-Day Sacred Schedule</h4>
                <div className="space-y-2">
                  {(() => {
                    let days: any[] = [];
                    try {
                      days = typeof selectedQuotation.itinerary === "string" ? JSON.parse(selectedQuotation.itinerary) : selectedQuotation.itinerary;
                    } catch {}
                    return days.map((d: any) => (
                      <div key={d.day} className="p-3 rounded-lg border bg-card space-y-1">
                        <span className="font-bold text-teal-700 dark:text-teal-400">Day {d.day}: {d.title}</span>
                        <p className="text-muted-foreground">{d.description}</p>
                        {d.ghatVisits && <p className="text-[11px] text-teal-600 dark:text-teal-300">Ghats & Temples: {d.ghatVisits}</p>}
                        {d.mealsIncluded && <p className="text-[11px] text-amber-700 dark:text-amber-400">Meals: {d.mealsIncluded}</p>}
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Accommodation & Vehicle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border space-y-1">
                  <span className="font-bold block flex items-center gap-1.5"><Building className="size-3.5 text-teal-600" /> Accommodation</span>
                  <p className="font-semibold text-foreground">{selectedQuotation.hotelName} ({selectedQuotation.numberOfRooms} Rooms)</p>
                  <p className="text-muted-foreground">{selectedQuotation.roomType}</p>
                  {selectedQuotation.accommodationDetails && <p className="text-muted-foreground text-[11px]">{selectedQuotation.accommodationDetails}</p>}
                </div>

                <div className="p-3 rounded-lg border space-y-1">
                  <span className="font-bold block flex items-center gap-1.5"><Car className="size-3.5 text-teal-600" /> Dedicated Vehicle</span>
                  <p className="font-semibold text-foreground">{selectedQuotation.vehicleType} (Capacity: {selectedQuotation.vehicleCapacity || "7-12"} Pax)</p>
                  <p className="text-muted-foreground">{selectedQuotation.pickupDropDetails}</p>
                </div>
              </div>

              {/* Itemized Pricing */}
              <div className="p-3 rounded-lg border space-y-2">
                <span className="font-bold block text-foreground">Verified Pricing Breakdown (₹ INR)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div><span className="text-muted-foreground block">Stay & Rooms:</span> <span className="font-mono font-medium">₹{selectedQuotation.accommodationCost.toLocaleString("en-IN")}</span></div>
                  <div><span className="text-muted-foreground block">Transport:</span> <span className="font-mono font-medium">₹{selectedQuotation.transportCost.toLocaleString("en-IN")}</span></div>
                  <div><span className="text-muted-foreground block">Meals:</span> <span className="font-mono font-medium">₹{selectedQuotation.foodCost.toLocaleString("en-IN")}</span></div>
                  <div><span className="text-muted-foreground block">Guide & Sightseeing:</span> <span className="font-mono font-medium">₹{selectedQuotation.guideCost.toLocaleString("en-IN")}</span></div>
                  <div><span className="text-muted-foreground block">Taxes & Fees:</span> <span className="font-mono font-medium">₹{selectedQuotation.taxAmount.toLocaleString("en-IN")}</span></div>
                  {selectedQuotation.discountAmount > 0 && (
                    <div><span className="text-muted-foreground block">Discount:</span> <span className="font-mono font-medium text-emerald-600">-₹{selectedQuotation.discountAmount.toLocaleString("en-IN")}</span></div>
                  )}
                </div>
              </div>

              {/* Inclusions & Exclusions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-teal-50/20">
                  <span className="font-bold text-teal-800 dark:text-teal-300 block mb-1">Inclusions</span>
                  <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
                    {(() => {
                      let inc: string[] = [];
                      try {
                        inc = typeof selectedQuotation.inclusions === "string" ? JSON.parse(selectedQuotation.inclusions) : selectedQuotation.inclusions;
                      } catch {}
                      return inc.map((x, i) => <li key={i}>{x}</li>);
                    })()}
                  </ul>
                </div>

                <div className="p-3 rounded-lg border bg-amber-50/20">
                  <span className="font-bold text-amber-800 dark:text-amber-300 block mb-1">Exclusions</span>
                  <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
                    {(() => {
                      let exc: string[] = [];
                      try {
                        exc = typeof selectedQuotation.exclusions === "string" ? JSON.parse(selectedQuotation.exclusions) : selectedQuotation.exclusions;
                      } catch {}
                      return exc.map((x, i) => <li key={i}>{x}</li>);
                    })()}
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setQuotationModalOpen(false)}>Close</Button>
              {selectedRequest?.status !== "AWAITING_FINAL_CONFIRMATION" && selectedRequest?.status !== "CONFIRMED" && (
                <Button
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold"
                  disabled={accepting}
                  onClick={() => handleAcceptQuotation(selectedQuotation.id)}
                >
                  {accepting ? "Processing..." : "Accept This Quotation"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Side-by-Side Quotation Comparison Modal */}
      {selectedRequest && (
        <Dialog open={compareModalOpen} onOpenChange={setCompareModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-teal-800 dark:text-teal-300">
                Compare Quotation Proposals ({selectedRequest.quotations?.length})
              </DialogTitle>
              <DialogDescription className="text-xs">
                Side-by-side comparison for group of {selectedRequest.groupSize} traveling from {selectedRequest.arrivalDate} to {selectedRequest.departureDate}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3 text-xs">
              {selectedRequest.quotations?.map((q: any) => (
                <div key={q.id} className="p-4 rounded-xl border bg-card flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-sm text-foreground">{q.title}</h4>
                      <Badge variant="outline">{q.status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Provider: {q.provider?.name || "Verified Partner"}</p>

                    <div className="my-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200">
                      <span className="text-[10px] text-muted-foreground block">Verified Group Total</span>
                      <span className="text-xl font-bold font-mono text-teal-800 dark:text-teal-200">{formatNriCurrency(q.totalPrice)}</span>
                      <span className="text-[11px] text-muted-foreground block">₹{q.pricePerPerson.toLocaleString("en-IN")}/person</span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div><span className="font-semibold">Hotel:</span> {q.hotelName} ({q.roomType})</div>
                      <div><span className="font-semibold">Vehicle:</span> {q.vehicleType}</div>
                      <div><span className="font-semibold">Meals:</span> {q.mealPlan}</div>
                      <div><span className="font-semibold">Guide:</span> {q.guideServices}</div>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs"
                    disabled={accepting || selectedRequest.status === "AWAITING_FINAL_CONFIRMATION" || selectedRequest.status === "CONFIRMED"}
                    onClick={() => handleAcceptQuotation(q.id)}
                  >
                    Accept This Offer
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCompareModalOpen(false)}>Close Comparison</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Messages Dialog */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="size-4 text-teal-600" /> Package Conversation — {selectedRequest?.referenceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ask questions or request revisions directly from the service operators.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-muted/20 rounded-xl my-2 max-h-80 text-xs">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 italic">No messages yet. Send a question about transport, dietary options, or arrival times.</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl max-w-[85%] ${
                    m.senderRole === "VISITOR"
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
              placeholder="Ask a question or request changes..."
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

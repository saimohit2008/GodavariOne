"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Clock, MapPin, User, Phone, Mail, X, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { CEREMONY_TYPES } from "@/lib/ceremonies";

const CEREMONY_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  DECLINED: "bg-red-100 text-red-800 border-red-300",
  RESCHEDULE_REQUESTED: "bg-purple-100 text-purple-800 border-purple-300",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  COMPLETED: "bg-sky-100 text-sky-800 border-sky-300",
};

export function CeremonyBookingsSection({ onUpdated }: { onUpdated?: () => void }) {
  const { navigate } = useApp();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cancellation modal
  const [cancellingBooking, setCancellingBooking] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    setLoading(true);
    try {
      const res = await api.get<{ bookings: any[] }>("/ceremonies/bookings");
      setBookings(res.bookings || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!cancellingBooking) return;
    setCancelling(true);
    try {
      await api.patch(`/ceremonies/bookings/${cancellingBooking.id}`, {
        status: "CANCELLED",
        cancellationReason: cancelReason.trim() || "Cancelled by visitor",
      });
      toast({ title: "Ceremony Cancelled", description: "The time slot has been released." });
      setCancellingBooking(null);
      setCancelReason("");
      loadBookings();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast({
        title: "Cancellation Failed",
        description: err instanceof ApiError ? err.message : "Error cancelling booking",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Flame className="size-5 text-amber-600" /> Vedic Ceremony & Ritual Bookings
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate({ name: "ceremonies" })}
          className="text-xs h-8 text-amber-800 border-amber-300 hover:bg-amber-50"
        >
          <Plus className="size-3.5 mr-1" /> Book New Ceremony
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-32" />
      ) : bookings.length === 0 ? (
        <Card className="p-0 border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground space-y-3">
            <Flame className="size-8 mx-auto text-amber-500/50" />
            <p className="text-sm font-medium">No ceremony bookings scheduled yet.</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Schedule ancestral rites, Pinda Pradanam, Pitru Tarpana, or Pushkara Snanam with certified purohits on Godavari ghats.
            </p>
            <Button
              size="sm"
              onClick={() => navigate({ name: "ceremonies" })}
              className="bg-amber-700 hover:bg-amber-800 text-white font-medium text-xs mt-2"
            >
              Browse Purohit Directory
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const ceremonyMeta = CEREMONY_TYPES.find(c => c.id === b.ceremonyType);
            const statusClass = CEREMONY_STATUS_COLORS[b.status] || "bg-muted text-muted-foreground";

            return (
              <Card key={b.id} className="p-0 border-amber-200/60 shadow-xs">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">
                        {ceremonyMeta ? ceremonyMeta.label : b.ceremonyType}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        #{b.bookingReference}
                      </span>
                      <Badge variant="outline" className={`text-xs ${statusClass}`}>
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3.5 text-primary shrink-0" />
                        <span>Purohit: <strong className="text-foreground">{b.purohit?.fullName}</strong></span>
                        {b.purohit?.phone && (
                          <a href={`tel:${b.purohit.phone}`} className="text-primary hover:underline ml-1">
                            ({b.purohit.phone})
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary shrink-0" />
                        <span>{b.bookingDate} at {b.startTime} ({b.durationMinutes}m)</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-primary shrink-0" />
                        <span className="truncate">{b.ceremonyLocation}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Flame className="size-3.5 text-amber-600 shrink-0" />
                        <span>Dakshina: <strong className="text-amber-900 font-mono">₹{b.serviceFee}</strong></span>
                      </div>
                    </div>

                    {b.gotra && (
                      <p className="text-[11px] text-muted-foreground">
                        Gotra: <span className="font-medium text-foreground">{b.gotra}</span>
                        {b.deceasedRelationship && ` · For: ${b.deceasedRelationship}`}
                      </p>
                    )}

                    {b.rejectionReason && (
                      <p className="text-xs text-red-600 font-medium bg-red-50 p-1.5 rounded">
                        Declined Reason: {b.rejectionReason}
                      </p>
                    )}

                    {b.cancellationReason && (
                      <p className="text-xs text-muted-foreground italic">
                        Cancellation note: {b.cancellationReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCancellingBooking(b)}
                        className="text-xs h-8 text-destructive hover:bg-destructive/10"
                      >
                        <X className="size-3.5 mr-1" /> Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Modal */}
      {cancellingBooking && (
        <Dialog open={true} onOpenChange={(open) => !open && setCancellingBooking(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" /> Cancel Ceremony Booking
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to cancel booking #{cancellingBooking.bookingReference} with {cancellingBooking.purohit?.fullName}?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <Label className="text-xs">Reason for cancellation (optional):</Label>
              <Input
                placeholder="e.g. Travel plan changed, rescheduled dates..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setCancellingBooking(null)}>
                Keep Booking
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

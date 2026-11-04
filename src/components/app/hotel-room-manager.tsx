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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BedDouble, Plus, Edit2, Trash2, Users, IndianRupee, CheckCircle2, XCircle,
  Calendar, Clock, ShieldCheck, AlertCircle, RefreshCw, EyeOff, Eye, LogIn, LogOut,
} from "lucide-react";

interface HotelRoomItem {
  id: string;
  listingId: string;
  name: string;
  roomIdentifier?: string | null;
  description?: string | null;
  totalRooms: number;
  availableRooms?: number;
  bookedRooms?: number;
  maxAdults: number;
  maxChildren: number;
  maxGuests: number;
  basePrice: number;
  extraPersonPrice: number;
  amenities: string[];
  bedType?: string | null;
  bedCount: number;
  images: string[];
  isActive: boolean;
}

export function HotelRoomManager({
  hotelId,
  hotelName,
  onClose,
}: {
  hotelId: string;
  hotelName: string;
  onClose?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"rooms" | "inventory" | "bookings">("rooms");
  const [rooms, setRooms] = useState<HotelRoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [editRoom, setEditRoom] = useState<HotelRoomItem | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [refreshKey, setRefreshKey] = useState(0);

  // Load room types
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<{ items: HotelRoomItem[] }>(`/hotels/${hotelId}/rooms`);
        setRooms(res.items || []);
      } catch (err: any) {
        toast({
          title: "Error loading rooms",
          description: err instanceof ApiError ? err.message : "Failed to load rooms",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [hotelId, refreshKey]);

  // Load inventory overview
  useEffect(() => {
    if (activeTab === "inventory" || activeTab === "bookings") {
      (async () => {
        try {
          const inv = await api.get<any>(`/hotels/${hotelId}/inventory?date=${filterDate}`);
          setInventoryData(inv);
        } catch {
          // ignore
        }
      })();
    }
  }, [hotelId, activeTab, filterDate, refreshKey]);

  async function toggleActive(room: HotelRoomItem) {
    try {
      await api.patch(`/hotels/${hotelId}/rooms/${room.id}`, { isActive: !room.isActive });
      toast({
        title: !room.isActive ? "Room Activated" : "Room Disabled",
        description: `${room.name} is now ${!room.isActive ? "open for bookings" : "temporarily disabled from new bookings"}.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err instanceof ApiError ? err.message : "Could not toggle room status",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteRoom(roomId: string, roomName: string) {
    if (!confirm(`Are you sure you want to delete or disable "${roomName}"?`)) return;
    try {
      const res = await api.del<{ ok: boolean; action: string; message: string }>(`/hotels/${hotelId}/rooms/${roomId}`);
      toast({
        title: res.action === "DEACTIVATED" ? "Room Disabled" : "Room Deleted",
        description: res.message,
      });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err instanceof ApiError ? err.message : "Could not delete room",
        variant: "destructive",
      });
    }
  }

  async function updateBookingStatus(bookingId: string, status: string, extra?: any) {
    try {
      await api.patch(`/bookings/hotel/${bookingId}`, { status, ...extra });
      toast({ title: `Booking ${status.toLowerCase()}` });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({
        title: "Status update failed",
        description: err instanceof ApiError ? err.message : "Could not update booking",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BedDouble className="size-6 text-teal-600" />
            <h2 className="text-xl font-bold tracking-tight">{hotelName} — Room & Capacity Control</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage room types, real inventory, capacities, pricing, and bookings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="size-3.5 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="size-4 mr-1" /> Add Room Type
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab("rooms")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "rooms" ? "bg-teal-600 text-white" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Room Types ({rooms.length})
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "inventory" ? "bg-teal-600 text-white" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Live Inventory & Capacity
        </button>
        <button
          onClick={() => setActiveTab("bookings")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "bookings" ? "bg-teal-600 text-white" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Hotel Bookings
        </button>
      </div>

      {/* Tab 1: Room Types List */}
      {activeTab === "rooms" && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : rooms.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <BedDouble className="size-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-base">No Room Types Configured</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                Add standard, deluxe, family rooms, or dormitory types with pricing and guest limits.
              </p>
              <Button size="sm" onClick={() => setAddDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Plus className="size-4 mr-1" /> Add First Room Type
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rooms.map((room) => (
                <Card key={room.id} className={`p-0 overflow-hidden border ${!room.isActive ? "opacity-75 bg-muted/40" : ""}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-base">{room.name}</p>
                          {room.roomIdentifier && (
                            <Badge variant="outline" className="text-[10px] font-mono py-0 h-4">
                              {room.roomIdentifier}
                            </Badge>
                          )}
                        </div>
                        {room.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{room.description}</p>
                        )}
                      </div>
                      <Badge variant={room.isActive ? "default" : "secondary"} className={room.isActive ? "bg-emerald-600 text-white" : ""}>
                        {room.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg">
                      <div>
                        <span className="block text-[10px] font-medium uppercase text-muted-foreground/80">Inventory</span>
                        <span className="font-semibold text-foreground text-sm">{room.totalRooms} rooms</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-medium uppercase text-muted-foreground/80">Base Rate</span>
                        <span className="font-semibold text-foreground text-sm flex items-center">
                          <IndianRupee className="size-3" />{room.basePrice}/night
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-medium uppercase text-muted-foreground/80">Max Capacity</span>
                        <span className="font-medium text-foreground">
                          {room.maxGuests} guests ({room.maxAdults} adults, {room.maxChildren} kids)
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-medium uppercase text-muted-foreground/80">Extra Person</span>
                        <span className="font-medium text-foreground">
                          +₹{room.extraPersonPrice}/night
                        </span>
                      </div>
                    </div>

                    {room.amenities && room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {room.amenities.map((am) => (
                          <Badge key={am} variant="secondary" className="text-[10px] py-0 h-5">
                            {am}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`active-${room.id}`} className="text-xs cursor-pointer">
                          {room.isActive ? "Disable" : "Enable"}
                        </Label>
                        <Switch
                          id={`active-${room.id}`}
                          checked={room.isActive}
                          onCheckedChange={() => toggleActive(room)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditRoom(room)}>
                          <Edit2 className="size-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteRoom(room.id, room.name)}
                        >
                          <Trash2 className="size-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Inventory & Capacity Dashboard */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Label className="text-sm whitespace-nowrap">View Inventory for Date:</Label>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-44 h-9 text-xs"
            />
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4">
              <span className="text-xs text-muted-foreground block font-medium">Total Capacity</span>
              <span className="text-2xl font-bold text-foreground">
                {inventoryData?.summary?.totalCapacityRooms ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground block">Active rooms</span>
            </Card>
            <Card className="p-4 border-emerald-200 bg-emerald-50/40">
              <span className="text-xs text-emerald-800 block font-medium">Available</span>
              <span className="text-2xl font-bold text-emerald-700">
                {inventoryData?.summary?.availableRooms ?? 0}
              </span>
              <span className="text-[10px] text-emerald-600 block">Rooms open for booking</span>
            </Card>
            <Card className="p-4 border-amber-200 bg-amber-50/40">
              <span className="text-xs text-amber-800 block font-medium">Pending Requests</span>
              <span className="text-2xl font-bold text-amber-700">
                {inventoryData?.summary?.reservedRooms ?? 0}
              </span>
              <span className="text-[10px] text-amber-600 block">Pending approval hold</span>
            </Card>
            <Card className="p-4 border-sky-200 bg-sky-50/40">
              <span className="text-xs text-sky-800 block font-medium">Confirmed Occupied</span>
              <span className="text-2xl font-bold text-sky-700">
                {inventoryData?.summary?.occupiedRooms ?? 0}
              </span>
              <span className="text-[10px] text-sky-600 block">
                {inventoryData?.summary?.occupancyRate ?? 0}% Occupancy
              </span>
            </Card>
          </div>

          {/* Per-room type breakdown */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm">Room Type Inventory Breakdown ({filterDate})</h3>
            <div className="border rounded-xl overflow-hidden divide-y text-xs">
              <div className="bg-muted font-medium p-2.5 grid grid-cols-12 gap-2 text-muted-foreground">
                <span className="col-span-4">Room Type</span>
                <span className="col-span-2 text-center">Total</span>
                <span className="col-span-2 text-center">Reserved</span>
                <span className="col-span-2 text-center">Occupied</span>
                <span className="col-span-2 text-right">Available</span>
              </div>
              {inventoryData?.roomBreakdowns?.map((rb: any) => (
                <div key={rb.roomId} className="p-2.5 grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-4 font-semibold text-foreground truncate">
                    {rb.name} {rb.roomIdentifier && `(${rb.roomIdentifier})`}
                  </span>
                  <span className="col-span-2 text-center font-medium">{rb.totalRooms}</span>
                  <span className="col-span-2 text-center text-amber-600 font-semibold">{rb.reservedRooms}</span>
                  <span className="col-span-2 text-center text-sky-600 font-semibold">{rb.occupiedRooms}</span>
                  <span className="col-span-2 text-right">
                    <Badge variant="outline" className={rb.availableRooms > 0 ? "text-emerald-700 border-emerald-300" : "text-destructive border-destructive"}>
                      {rb.availableRooms} available
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Upcoming Check-ins & Check-outs */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-0">
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5 text-emerald-700">
                  <LogIn className="size-4" /> Upcoming Check-Ins
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-2 text-xs">
                {inventoryData?.upcomingCheckIns?.map((b: any) => (
                  <div key={b.id} className="p-2 border rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{b.user?.name} · {b.rooms} room(s)</p>
                      <p className="text-muted-foreground">{b.room?.name || "Standard Room"} · {b.checkIn}</p>
                    </div>
                    <Badge variant="outline">{b.status}</Badge>
                  </div>
                ))}
                {(!inventoryData?.upcomingCheckIns || inventoryData.upcomingCheckIns.length === 0) && (
                  <p className="text-muted-foreground p-4 text-center">No upcoming check-ins scheduled.</p>
                )}
              </CardContent>
            </Card>

            <Card className="p-0">
              <CardHeader className="p-3.5 pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5 text-sky-700">
                  <LogOut className="size-4" /> Upcoming Check-Outs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 space-y-2 text-xs">
                {inventoryData?.upcomingCheckOuts?.map((b: any) => (
                  <div key={b.id} className="p-2 border rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{b.user?.name} · {b.rooms} room(s)</p>
                      <p className="text-muted-foreground">{b.room?.name || "Standard Room"} · {b.checkOut}</p>
                    </div>
                    <Badge variant="outline">{b.status}</Badge>
                  </div>
                ))}
                {(!inventoryData?.upcomingCheckOuts || inventoryData.upcomingCheckOuts.length === 0) && (
                  <p className="text-muted-foreground p-4 text-center">No upcoming check-outs scheduled.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 3: Hotel Bookings Queue with Check-in / Check-out controls */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          <div className="border rounded-xl overflow-hidden divide-y text-xs">
            {inventoryData?.recentBookings?.map((b: any) => (
              <div key={b.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{b.user?.name || "Guest"}</p>
                    <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                    {b.room && <Badge variant="secondary" className="text-[10px]">{b.room.name}</Badge>}
                  </div>
                  <p className="text-muted-foreground">
                    Dates: <strong>{b.checkIn}</strong> → <strong>{b.checkOut}</strong> · {b.rooms} Room(s) · {b.guests} Guest(s)
                  </p>
                  <p className="text-muted-foreground">Phone: {b.user?.phone || "N/A"}</p>
                  {b.totalPrice && <p className="font-medium text-foreground">Total: ₹{b.totalPrice}</p>}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {b.status === "PENDING" && (
                    <>
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateBookingStatus(b.id, "APPROVED")}>
                        <CheckCircle2 className="size-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => updateBookingStatus(b.id, "REJECTED")}>
                        <XCircle className="size-3 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {b.status === "APPROVED" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-teal-700 border-teal-300" onClick={() => updateBookingStatus(b.id, "APPROVED", { markCheckedIn: true })}>
                        <LogIn className="size-3 mr-1" /> Check In
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateBookingStatus(b.id, "COMPLETED", { markCheckedOut: true })}>
                        <LogOut className="size-3 mr-1" /> Check Out
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => updateBookingStatus(b.id, "NO_SHOW")}>
                        No Show
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {(!inventoryData?.recentBookings || inventoryData.recentBookings.length === 0) && (
              <p className="p-8 text-center text-muted-foreground">No bookings found for this hotel.</p>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Room Type Dialog */}
      {(addDialogOpen || !!editRoom) && (
        <RoomFormDialog
          hotelId={hotelId}
          initialData={editRoom}
          onClose={() => {
            setAddDialogOpen(false);
            setEditRoom(null);
          }}
          onSaved={() => {
            setAddDialogOpen(false);
            setEditRoom(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function RoomFormDialog({
  hotelId,
  initialData,
  onClose,
  onSaved,
}: {
  hotelId: string;
  initialData: HotelRoomItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name || "");
  const [roomIdentifier, setRoomIdentifier] = useState(initialData?.roomIdentifier || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [totalRooms, setTotalRooms] = useState(initialData?.totalRooms || 5);
  const [maxAdults, setMaxAdults] = useState(initialData?.maxAdults || 2);
  const [maxChildren, setMaxChildren] = useState(initialData?.maxChildren || 1);
  const [maxGuests, setMaxGuests] = useState(initialData?.maxGuests || 3);
  const [basePrice, setBasePrice] = useState(initialData?.basePrice || 2000);
  const [extraPersonPrice, setExtraPersonPrice] = useState(initialData?.extraPersonPrice || 500);
  const [bedType, setBedType] = useState(initialData?.bedType || "1 King Bed");
  const [bedCount, setBedCount] = useState(initialData?.bedCount || 1);
  const [amenitiesInput, setAmenitiesInput] = useState(initialData?.amenities?.join(", ") || "AC, WiFi, Geyser, TV");
  const [isActive, setIsActive] = useState(initialData?.isActive !== false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Keep maxGuests in sync with adult limit
  function handleAdultsChange(val: number) {
    setMaxAdults(val);
    if (maxGuests < val) setMaxGuests(val + maxChildren);
  }

  function handleChildrenChange(val: number) {
    setMaxChildren(val);
    if (maxGuests > maxAdults + val) setMaxGuests(maxAdults + val);
  }

  async function handleSave() {
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Room type name is required");
      return;
    }
    if (totalRooms < 1) {
      setErrorMsg("Total rooms must be at least 1");
      return;
    }
    if (basePrice < 0) {
      setErrorMsg("Base price cannot be negative");
      return;
    }
    if (maxGuests < maxAdults) {
      setErrorMsg("Total guest capacity cannot be less than adult limit");
      return;
    }
    if (maxGuests > maxAdults + maxChildren) {
      setErrorMsg("Total guest capacity cannot exceed adult limit + child limit");
      return;
    }

    setSubmitting(true);
    try {
      const amenities = amenitiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: name.trim(),
        roomIdentifier: roomIdentifier.trim() || undefined,
        description: description.trim() || undefined,
        totalRooms: Number(totalRooms),
        maxAdults: Number(maxAdults),
        maxChildren: Number(maxChildren),
        maxGuests: Number(maxGuests),
        basePrice: Number(basePrice),
        extraPersonPrice: Number(extraPersonPrice),
        bedType: bedType.trim() || undefined,
        bedCount: Number(bedCount),
        amenities,
        isActive,
      };

      if (isEdit) {
        await api.patch(`/hotels/${hotelId}/rooms/${initialData!.id}`, payload);
        toast({ title: "Room type updated successfully" });
      } else {
        await api.post(`/hotels/${hotelId}/rooms`, payload);
        toast({ title: "Room type created successfully" });
      }
      onSaved();
    } catch (err: any) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save room type");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Room Type" : "Add New Room Type"}</DialogTitle>
          <DialogDescription>
            Configure inventory, occupancy rules, and pricing for this room type.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Room Type Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Deluxe River View, Standard AC"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Optional Identifier / Room Number</Label>
              <Input
                value={roomIdentifier}
                onChange={(e) => setRoomIdentifier(e.target.value)}
                placeholder="e.g. Block A, 101-110"
                className="mt-1 h-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Features, balcony view, bathroom amenities..."
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Total Rooms in Inventory *</Label>
              <Input
                type="number"
                min={1}
                value={totalRooms}
                onChange={(e) => setTotalRooms(Number(e.target.value))}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Base Price per Night (₹) *</Label>
              <Input
                type="number"
                min={0}
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                className="mt-1 h-9"
              />
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg space-y-3">
            <p className="font-semibold text-xs text-foreground">Capacity Rules per Room</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px]">Max Adults *</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxAdults}
                  onChange={(e) => handleAdultsChange(Number(e.target.value))}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Max Children</Label>
                <Input
                  type="number"
                  min={0}
                  value={maxChildren}
                  onChange={(e) => handleChildrenChange(Number(e.target.value))}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Total Max Guests *</Label>
                <Input
                  type="number"
                  min={maxAdults}
                  max={maxAdults + maxChildren}
                  value={maxGuests}
                  onChange={(e) => setMaxGuests(Number(e.target.value))}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px]">Extra Person Charge per Night (₹)</Label>
              <Input
                type="number"
                min={0}
                value={extraPersonPrice}
                onChange={(e) => setExtraPersonPrice(Number(e.target.value))}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bed Type</Label>
              <Input
                value={bedType}
                onChange={(e) => setBedType(e.target.value)}
                placeholder="e.g. 1 King Bed, 2 Single Beds"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Number of Beds</Label>
              <Input
                type="number"
                min={1}
                value={bedCount}
                onChange={(e) => setBedCount(Number(e.target.value))}
                className="mt-1 h-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Amenities (comma-separated)</Label>
            <Input
              value={amenitiesInput}
              onChange={(e) => setAmenitiesInput(e.target.value)}
              placeholder="AC, WiFi, TV, Geyser, Electric Kettle, Balcony"
              className="mt-1 h-9"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="font-medium">Active for New Bookings</p>
              <p className="text-[11px] text-muted-foreground">If disabled, guests cannot make new bookings for this room.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting} className="bg-teal-600 hover:bg-teal-700 text-white">
            {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Room Type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

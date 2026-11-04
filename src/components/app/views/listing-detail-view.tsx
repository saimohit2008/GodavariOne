"use client";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "../use-api";
import { api, ApiError, type HotelBookingRequest } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Phone, Mail, Navigation, Clock, Users, Heart, ArrowLeft,
  CheckCircle2, AlertCircle, BedDouble, UtensilsCrossed, Waves, Stethoscope, Bus, Landmark, Accessibility, ShieldAlert,
  RefreshCw, Calendar, DoorOpen, IndianRupee, AlertTriangle, Sparkles, Building2, Home, Soup,
} from "lucide-react";
import { CategoryIcon } from "../category-icon";
import { CATEGORY_META } from "@/lib/constants";
import { useState, useEffect } from "react";
import { useBookingAuth } from "../booking-auth-modal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CrowdBadge } from "./home-view";
import { TimingManagerDialog } from "../timing-manager-dialog";
import { HotelRoomManager } from "../hotel-room-manager";
import { formatTime12h } from "@/lib/timing";
import { ReviewsSection } from "../reviews-section";
import {
  FreeAccommodationDetailCard,
  AnnadanamDetailCard,
  FreeAccommodationBookingDialog,
  UpdateFreeAccommodationAvailabilityDialog,
  UpdateAnnadanamStatusDialog,
} from "../free-categories-components";
import { PriorityBookingFormDialog } from "../priority-booking/priority-booking-form-dialog";

function formatTimeAgo(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ListingDetailView({ id }: { id: string }) {
  const { lang, navigate, user, pendingBooking } = useApp();
  const { requireAuth } = useBookingAuth();
  const { data: listing, loading, refetch } = useApi<any>(`/listings/${id}`);
  const [fav, setFav] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [timingDialogOpen, setTimingDialogOpen] = useState(false);
  const [roomManagerOpen, setRoomManagerOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [accBookingOpen, setAccBookingOpen] = useState(false);
  const [accAvailabilityOpen, setAccAvailabilityOpen] = useState(false);
  const [annadanamStatusOpen, setAnnadanamStatusOpen] = useState(false);
  const [priorityBookingOpen, setPriorityBookingOpen] = useState(false);

  // Restore pending booking workflow on authentication
  useEffect(() => {
    if (user && pendingBooking && pendingBooking.listingId === id) {
      if (pendingBooking.type === "HOTEL") {
        if (pendingBooking.data?.roomId) setSelectedRoomId(pendingBooking.data.roomId);
        setBookingOpen(true);
      } else if (pendingBooking.type === "RESTAURANT") {
        setBookingOpen(true);
      } else if (pendingBooking.type === "FREE_ACCOMMODATION") {
        setAccBookingOpen(true);
      } else if (pendingBooking.type === "PRIORITY_GHAT") {
        setPriorityBookingOpen(true);
      }
    }
  }, [user, pendingBooking, id]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="aspect-[21/9] w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  if (!listing) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-muted-foreground">{t(lang, "error")}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ name: "directory" })}>{t(lang, "back")}</Button>
      </div>
    );
  }

  const meta = CATEGORY_META[listing.category as keyof typeof CATEGORY_META];

  async function toggleFav() {
    if (!user) { navigate({ name: "login" }); return; }
    try {
      if (fav) {
        await api.del(`/favorites?listingId=${id}`);
        setFav(false);
      } else {
        await api.post("/favorites", { listingId: id });
        setFav(true);
      }
    } catch (e) { toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" }); }
  }

  const canManageTimings = Boolean(
    user && (
      user.role === "SUPER_ADMIN" ||
      (listing.category === "GHAT" && (user.role === "GHAT_SUPERVISOR" || (user as any).assignedGhatId === listing.id)) ||
      listing.ownerId === user.id ||
      (user as any).assignedListingId === listing.id ||
      user.role === "LISTING_OWNER"
    )
  );

  const canManageRooms = Boolean(
    listing.category === "HOTEL" &&
    user && (
      user.role === "SUPER_ADMIN" ||
      listing.ownerId === user.id ||
      (user as any).assignedListingId === listing.id ||
      user.role === "HOTEL_STAFF"
    )
  );

  const canManageAvailability = Boolean(
    user && (
      user.role === "SUPER_ADMIN" ||
      listing.ownerId === user.id ||
      (user as any).assignedListingId === listing.id ||
      user.role === "LISTING_OWNER"
    )
  );

  return (
    <div className="flex-1">
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate({ name: "directory" })}>
          <ArrowLeft className="size-4" /> {t(lang, "back")}
        </Button>

        {/* Gallery */}
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <div className="md:col-span-2 aspect-[16/9] rounded-xl overflow-hidden bg-muted">
            {listing.primaryImage ? (
              <img src={listing.primaryImage} alt={listing.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center bg-gradient-to-br from-accent to-secondary">
                <CategoryIcon category={listing.category} className="size-20 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-1 gap-3">
            {listing.images?.slice(1, 4).map((img: any) => (
              <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={img.url} alt={listing.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary">
                <CategoryIcon category={listing.category} className="size-3" />
                {lang === "te" ? meta.teLabel : meta.label}
              </Badge>
              {listing.timingStatus && (
                <Badge
                  variant="outline"
                  className={
                    listing.timingStatus.code === "TEMPORARILY_CLOSED" || listing.timingStatus.isTemporarilyClosed
                      ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : listing.timingStatus.code === "OPEN_24_HOURS"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : listing.timingStatus.isOpen
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : listing.timingStatus.code === "HOURS_NOT_AVAILABLE"
                      ? "border-border text-muted-foreground"
                      : "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                  }
                >
                  <Clock className="size-3 mr-1" />
                  {listing.timingStatus.label || listing.timingStatus.badgeText || (listing.timingStatus.isOpen ? "Open now" : "Closed")}
                </Badge>
              )}
              {listing.locationVerified && (
                <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                  <CheckCircle2 className="size-3" /> Verified Location
                </Badge>
              )}
              {listing.rating != null && listing.reviewCount != null && listing.reviewCount > 0 && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-semibold flex items-center gap-1">
                  <span>★</span> {Number(listing.rating).toFixed(1)} ({listing.reviewCount} {listing.reviewCount === 1 ? "review" : "reviews"})
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">{listing.name}</h1>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-4" />
              {[listing.locality, listing.town, listing.district].filter(Boolean).join(", ") || listing.address}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={toggleFav}>
              <Heart className={`size-4 ${fav ? "fill-destructive text-destructive" : ""}`} /> {t(lang, "favorites")}
            </Button>
            {canManageTimings && (
              <Button variant="outline" size="sm" onClick={() => setTimingDialogOpen(true)}>
                <Clock className="size-4 mr-1.5" /> Manage Hours
              </Button>
            )}
            {canManageRooms && (
              <Button variant="outline" size="sm" onClick={() => setRoomManagerOpen(true)}>
                <BedDouble className="size-4 mr-1.5" /> Manage Rooms
              </Button>
            )}
            {listing.category === "GHAT" && (
              <Button
                size="sm"
                className="bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-sm"
                onClick={() => {
                  if (requireAuth({
                    type: "PRIORITY_GHAT",
                    listingId: listing.id,
                    title: `Priority Ghat Pass · ${listing.name}`,
                    returnView: { name: "listing", id: listing.id }
                  }, () => setPriorityBookingOpen(true))) {
                    setPriorityBookingOpen(true);
                  }
                }}
              >
                <Accessibility className="size-4 mr-1.5" /> {t(lang, "priorityBooking")} (65+ & PwD)
              </Button>
            )}
            {listing.category === "GHAT" && (user?.role === "SUPER_ADMIN" || user?.role === "GHAT_SUPERVISOR") && (
              <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setStatusDialogOpen(true)}>
                <RefreshCw className="size-4 mr-1.5" /> Update Crowd Status
              </Button>
            )}
            {listing.category === "RESTAURANT" && listing.restaurant?.reservationAvailable && (
              <Button
                size="sm"
                onClick={() => {
                  if (requireAuth({
                    type: "RESTAURANT",
                    listingId: listing.id,
                    title: `Table Reservation · ${listing.name}`,
                    returnView: { name: "listing", id: listing.id }
                  }, () => setBookingOpen(true))) {
                    setBookingOpen(true);
                  }
                }}
              >
                <UtensilsCrossed className="size-4 mr-1.5" /> {t(lang, "bookTable")}
              </Button>
            )}
            {listing.category === "HOTEL" && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedRoomId(undefined);
                  if (requireAuth({
                    type: "HOTEL",
                    listingId: listing.id,
                    title: `Hotel Stay · ${listing.name}`,
                    returnView: { name: "listing", id: listing.id }
                  }, () => setBookingOpen(true))) {
                    setBookingOpen(true);
                  }
                }}
              >
                <BedDouble className="size-4 mr-1.5" /> {t(lang, "bookStay")}
              </Button>
            )}
            {listing.category === "FREE_ACCOMMODATION" && canManageAvailability && (
              <Button size="sm" variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300" onClick={() => setAccAvailabilityOpen(true)}>
                <Home className="size-4 mr-1.5" /> Update Live Capacity
              </Button>
            )}
            {listing.category === "FREE_ACCOMMODATION" && (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  if (requireAuth({
                    type: "FREE_ACCOMMODATION",
                    listingId: listing.id,
                    title: `Free Accommodation · ${listing.name}`,
                    returnView: { name: "listing", id: listing.id }
                  }, () => setAccBookingOpen(true))) {
                    setAccBookingOpen(true);
                  }
                }}
              >
                <Home className="size-4 mr-1.5" /> {t(lang, "registerStay")}
              </Button>
            )}
            {listing.category === "ANNADANAM" && canManageAvailability && (
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setAnnadanamStatusOpen(true)}>
                <Soup className="size-4 mr-1.5" /> Update Serving Status
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Live Ghat Crowd Status Section */}
            {listing.category === "GHAT" && (
              <Card className="p-0 border-sky-200 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Waves className="size-5 text-sky-600 shrink-0" />
                        <h2 className="font-bold text-base text-foreground">Current Ghat Crowd Status</h2>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <CrowdBadge status={listing.ghat?.currentCrowdStatus} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {listing.ghat?.statusUpdatedAt
                          ? `Last updated on ${new Date(listing.ghat.statusUpdatedAt).toLocaleString()} (${formatTimeAgo(listing.ghat.statusUpdatedAt)})`
                          : "Status not yet reported for this ghat. Supervisors report crowd levels periodically."}
                      </p>
                    </div>
                    {(user?.role === "SUPER_ADMIN" || user?.role === "GHAT_SUPERVISOR") && (
                      <Button
                        size="sm"
                        onClick={() => setStatusDialogOpen(true)}
                        className="w-fit shrink-0 bg-sky-600 hover:bg-sky-700 text-white"
                      >
                        <RefreshCw className="size-3.5 mr-1.5" /> Update Status
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Priority Ghat Booking Banner for Senior Citizens & PwD */}
            {listing.category === "GHAT" && (
              <Card className="p-0 border-sky-300 bg-gradient-to-r from-sky-50 via-indigo-50/40 to-sky-50 dark:from-sky-950/30 dark:via-indigo-950/20 dark:to-sky-950/30 shadow-sm overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-md bg-sky-600 text-white">
                          <Accessibility className="size-4" />
                        </span>
                        <h3 className="font-bold text-base text-foreground">
                          {t(lang, "priorityBookingTitle")}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                        {t(lang, "priorityBookingSubtitle")}
                      </p>
                      <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] text-muted-foreground font-medium">
                        <span className="flex items-center gap-1 text-sky-700 dark:text-sky-300">
                          <CheckCircle2 className="size-3.5" /> Wheelchair & Ramp Access
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-sky-700 dark:text-sky-300">
                          <CheckCircle2 className="size-3.5" /> Human Verification
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-sky-700 dark:text-sky-300">
                          <CheckCircle2 className="size-3.5" /> QR Pass Allocation
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (requireAuth({
                          type: "PRIORITY_GHAT",
                          listingId: listing.id,
                          title: `Priority Ghat Pass · ${listing.name}`,
                          returnView: { name: "listing", id: listing.id }
                        }, () => setPriorityBookingOpen(true))) {
                          setPriorityBookingOpen(true);
                        }
                      }}
                      className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow"
                    >
                      Apply for Priority Pass
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Operating Hours Card */}
            <OperatingHoursCard
              schedule={listing.schedule}
              timingStatus={listing.timingStatus}
              category={listing.category}
              canEdit={canManageTimings}
              onEdit={() => setTimingDialogOpen(true)}
            />

            <Card className="p-0">
              <CardContent className="p-6">
                <h2 className="font-semibold mb-3">{t(lang, "description")}</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{listing.description}</p>
              </CardContent>
            </Card>

            {/* Hotel Room Inventory Section */}
            {listing.category === "HOTEL" && listing.hotelRooms && listing.hotelRooms.length > 0 && (
              <HotelRoomsSection
                rooms={listing.hotelRooms}
                canManage={canManageRooms}
                onManage={() => setRoomManagerOpen(true)}
                onBookRoom={(roomId) => {
                  setSelectedRoomId(roomId);
                  if (requireAuth({
                    type: "HOTEL",
                    listingId: listing.id,
                    title: `Hotel Stay · ${listing.name}`,
                    data: { roomId },
                    returnView: { name: "listing", id: listing.id }
                  }, () => setBookingOpen(true))) {
                    setBookingOpen(true);
                  }
                }}
              />
            )}

            {/* Category-specific details */}
            {listing.category === "RESTAURANT" && listing.restaurant && (
              <DetailsCard title="Restaurant Details" items={[
                listing.restaurant.cuisine && { label: "Cuisine", value: listing.restaurant.cuisine },
                listing.restaurant.foodType && { label: "Food Type", value: listing.restaurant.foodType },
                listing.restaurant.priceRange && { label: "Price Range", value: listing.restaurant.priceRange },
                listing.restaurant.openingHours && { label: "Hours", value: listing.restaurant.openingHours },
                listing.restaurant.tableCapacity != null && { label: "Table Capacity", value: String(listing.restaurant.tableCapacity) },
              ]} />
            )}
            {listing.category === "HOTEL" && listing.hotel && (
              <DetailsCard title="Hotel Details" items={[
                listing.hotel.accommodationType && { label: "Type", value: listing.hotel.accommodationType },
                listing.hotel.roomTypes && { label: "Room Types", value: listing.hotel.roomTypes },
                listing.hotel.numRooms != null && { label: "Rooms", value: String(listing.hotel.numRooms) },
                listing.hotel.checkInTime && { label: "Check-in", value: listing.hotel.checkInTime },
                listing.hotel.checkOutTime && { label: "Check-out", value: listing.hotel.checkOutTime },
                listing.hotel.amenities && { label: "Amenities", value: listing.hotel.amenities },
                listing.hotel.priceRange && { label: "Price Range", value: listing.hotel.priceRange },
              ]} />
            )}
            {listing.category === "GHAT" && (
              <DetailsCard title="Ghat Information" items={[
                listing.ghat?.accessRoutes && { label: "Access Routes", value: typeof listing.ghat.accessRoutes === "string" ? listing.ghat.accessRoutes : listing.ghat.accessRoutes?.join?.(", ") },
                listing.ghat?.facilities && { label: "Facilities", value: typeof listing.ghat.facilities === "string" ? listing.ghat.facilities : "Available" },
                listing.ghat?.medicalAssistance && { label: "Medical Assistance", value: listing.ghat.medicalAssistance },
                { label: "Current Crowd Status", value: listing.ghat?.currentCrowdStatus || "Status not yet reported" },
                listing.ghat?.statusUpdatedAt && { label: "Status Last Updated", value: new Date(listing.ghat.statusUpdatedAt).toLocaleString() },
              ]} />
            )}
            {listing.category === "HOSPITAL" && listing.hospital && (
              <DetailsCard title="Hospital Details" items={[
                listing.hospital.facilityType && { label: "Type", value: listing.hospital.facilityType },
                listing.hospital.emergencyAvailable != null && { label: "Emergency", value: listing.hospital.emergencyAvailable ? "Available 24x7" : "Limited" },
                listing.hospital.operatingHours && { label: "Hours", value: listing.hospital.operatingHours },
              ]} />
            )}
            {listing.category === "TRANSPORT" && listing.transport && (
              <DetailsCard title="Transport Details" items={[
                listing.transport.transportType && { label: "Type", value: listing.transport.transportType },
                listing.transport.vehicleDetails && { label: "Vehicle", value: listing.transport.vehicleDetails },
                listing.transport.pricing && { label: "Pricing", value: listing.transport.pricing },
                listing.transport.driverOption != null && { label: "Driver Option", value: listing.transport.driverOption ? "Available" : "Not available" },
              ]} />
            )}
            {listing.category === "TOURIST_SPOT" && listing.tourist && (
              <DetailsCard title="Visitor Information" items={[
                listing.tourist.openingHours && { label: "Hours", value: listing.tourist.openingHours },
                listing.tourist.entryFee && { label: "Entry Fee", value: listing.tourist.entryFee },
                listing.tourist.directions && { label: "Directions", value: listing.tourist.directions },
              ]} />
            )}
            {listing.category === "FREE_ACCOMMODATION" && (
              <FreeAccommodationDetailCard
                listing={listing}
                canManage={canManageAvailability}
                onUpdateCapacity={() => setAccAvailabilityOpen(true)}
                onBookStay={() => {
                  if (requireAuth({
                    type: "FREE_ACCOMMODATION",
                    listingId: listing.id,
                    title: `Free Accommodation · ${listing.name}`,
                    returnView: { name: "listing", id: listing.id }
                  }, () => setAccBookingOpen(true))) {
                    setAccBookingOpen(true);
                  }
                }}
              />
            )}
            {listing.category === "ANNADANAM" && (
              <AnnadanamDetailCard
                listing={listing}
                canManage={canManageAvailability}
                onUpdateStatus={() => setAnnadanamStatusOpen(true)}
              />
            )}

            {/* Accessibility */}
            {listing.accessibility && Object.values(listing.accessibility).some(Boolean) && (
              <Card className="p-0 border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Accessibility className="size-5 text-primary" />
                    <h2 className="font-semibold">{t(lang, "accessibility")}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(listing.accessibility).filter(([, v]) => v).map(([k]) => (
                      <Badge key={k} variant="secondary" className="capitalize">{k.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User Reviews & Feedback */}
            <ReviewsSection
              listingId={listing.id}
              listingName={listing.name}
              category={listing.category}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="p-0">
              <CardContent className="p-5 space-y-3">
                <h2 className="font-semibold">{t(lang, "contactUs")}</h2>
                {listing.phone && (
                  <a href={`tel:${listing.phone}`} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent transition-colors">
                    <span className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center"><Phone className="size-4" /></span>
                    <div>
                      <p className="text-xs text-muted-foreground">{t(lang, "callNow")}</p>
                      <p className="text-sm font-medium">{listing.phone}</p>
                    </div>
                  </a>
                )}
                {listing.email && (
                  <a href={`mailto:${listing.email}`} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent transition-colors">
                    <span className="size-9 rounded-full bg-primary/10 text-primary grid place-items-center"><Mail className="size-4" /></span>
                    <div>
                      <p className="text-xs text-muted-foreground">{t(lang, "email")}</p>
                      <p className="text-sm font-medium truncate">{listing.email}</p>
                    </div>
                  </a>
                )}
                {!listing.phone && !listing.email && (
                  <p className="text-sm text-muted-foreground">Contact details not provided.</p>
                )}
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="p-0">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Navigation className="size-5 text-primary" />
                  <h2 className="font-semibold">Location</h2>
                </div>
                {listing.locationVerified ? (
                  <>
                    <p className="text-sm text-muted-foreground">{listing.address}</p>
                    {listing.latitude && listing.longitude && (
                      <p className="text-xs font-mono text-muted-foreground">{listing.latitude.toFixed(5)}, {listing.longitude.toFixed(5)}</p>
                    )}
                    {listing.directionsUrl && (
                      <Button asChild className="w-full" size="sm">
                        <a href={listing.directionsUrl} target="_blank" rel="noopener noreferrer">
                          <Navigation className="size-4" /> {t(lang, "directions")}
                        </a>
                      </Button>
                    )}
                    {listing.mapsUrl && listing.directionsUrl !== listing.mapsUrl && (
                      <Button asChild variant="outline" className="w-full" size="sm">
                        <a href={listing.mapsUrl} target="_blank" rel="noopener noreferrer">{t(lang, "openMaps")}</a>
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <p>{t(lang, "locationNotVerified")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {bookingOpen && listing.category === "RESTAURANT" && (
        <RestaurantBookingDialog listing={listing} onClose={() => setBookingOpen(false)} onDone={() => { setBookingOpen(false); refetch(); }} />
      )}
      {bookingOpen && listing.category === "HOTEL" && (
        <HotelBookingDialog
          listing={listing}
          initialRoomId={selectedRoomId}
          onClose={() => setBookingOpen(false)}
          onDone={() => { setBookingOpen(false); refetch(); }}
        />
      )}
      {statusDialogOpen && (
        <UpdateGhatStatusDialog listing={listing} onClose={() => setStatusDialogOpen(false)} onDone={() => { setStatusDialogOpen(false); refetch(); }} />
      )}
      {timingDialogOpen && (
        <TimingManagerDialog
          listingId={listing.id}
          listingName={listing.name}
          category={listing.category}
          currentSchedule={listing.schedule}
          onClose={() => setTimingDialogOpen(false)}
          onSaved={() => { setTimingDialogOpen(false); refetch(); }}
        />
      )}
      {roomManagerOpen && listing.category === "HOTEL" && (
        <Dialog open onOpenChange={(o) => !o && setRoomManagerOpen(false)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <HotelRoomManager
              hotelId={listing.id}
              hotelName={listing.name}
              onClose={() => { setRoomManagerOpen(false); refetch(); }}
            />
          </DialogContent>
        </Dialog>
      )}
      {accBookingOpen && listing.category === "FREE_ACCOMMODATION" && (
        <FreeAccommodationBookingDialog
          listing={listing}
          onClose={() => setAccBookingOpen(false)}
          onDone={() => { setAccBookingOpen(false); refetch(); }}
        />
      )}
      {accAvailabilityOpen && listing.category === "FREE_ACCOMMODATION" && (
        <UpdateFreeAccommodationAvailabilityDialog
          listing={listing}
          onClose={() => setAccAvailabilityOpen(false)}
          onDone={() => { setAccAvailabilityOpen(false); refetch(); }}
        />
      )}
      {annadanamStatusOpen && listing.category === "ANNADANAM" && (
        <UpdateAnnadanamStatusDialog
          listing={listing}
          onClose={() => setAnnadanamStatusOpen(false)}
          onDone={() => { setAnnadanamStatusOpen(false); refetch(); }}
        />
      )}
      {priorityBookingOpen && listing.category === "GHAT" && (
        <PriorityBookingFormDialog
          open={priorityBookingOpen}
          onOpenChange={setPriorityBookingOpen}
          preselectedGhatId={listing.id}
        />
      )}
    </div>
  );
}

function DetailsCard({ title, items }: { title: string; items: ({ label: string; value: string } | null | false | undefined)[] }) {
  const filtered = items.filter(Boolean) as { label: string; value: string }[];
  if (filtered.length === 0) return null;
  return (
    <Card className="p-0">
      <CardContent className="p-6">
        <h2 className="font-semibold mb-3">{title}</h2>
        <dl className="grid sm:grid-cols-2 gap-3">
          {filtered.map((it) => (
            <div key={it.label}>
              <dt className="text-xs text-muted-foreground">{it.label}</dt>
              <dd className="text-sm font-medium">{it.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function RestaurantBookingDialog({ listing, onClose, onDone }: { listing: any; onClose: () => void; onDone: () => void }) {
  const { lang, user } = useApp();
  const { requireAuth } = useBookingAuth();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:30");
  const [people, setPeople] = useState(2);
  const [request, setRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!date) { toast({ title: "Error", description: "Please choose a date", variant: "destructive" }); return; }
    if (!requireAuth({
      type: "RESTAURANT",
      listingId: listing.id,
      title: `Table Reservation · ${listing.name}`,
      details: `${people} guests · ${date} at ${time}`,
      data: { date, time, people, request },
      returnView: { name: "listing", id: listing.id }
    }, () => submit())) {
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/bookings/restaurant", { listingId: listing.id, bookingDate: date, timeSlot: time, peopleCount: people, specialRequest: request });
      toast({ title: "Success", description: t(lang, "bookingCreated") });
      onDone();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(lang, "bookTable")} · {listing.name}</DialogTitle>
          <DialogDescription>{t(lang, "requestBooking")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t(lang, "date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <Label>{t(lang, "time")}</Label>
              <select value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                {["12:00","12:30","13:00","13:30","19:00","19:30","20:00","20:30"].map((tm) => <option key={tm} value={tm}>{tm}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>{t(lang, "people")}</Label>
            <Input type="number" min={1} max={20} value={people} onChange={(e) => setPeople(Number(e.target.value))} />
          </div>
          <div>
            <Label>{t(lang, "specialRequest")}</Label>
            <Textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t(lang, "cancel")}</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? t(lang, "loading") : t(lang, "submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OperatingHoursCard({
  schedule,
  timingStatus,
  category,
  canEdit,
  onEdit,
}: {
  schedule: any;
  timingStatus: any;
  category: string;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const isTempClosed = schedule?.isTemporarilyClosed || timingStatus?.code === "TEMPORARILY_CLOSED" || timingStatus?.isTemporarilyClosed;
  const isOpen24 = schedule?.open24Hours || timingStatus?.code === "OPEN_24_HOURS";
  const hasHours = schedule && (schedule.open24Hours || (schedule.openingTime && schedule.closingTime));

  return (
    <Card className="p-0 border-border shadow-sm overflow-hidden">
      <CardHeader className="p-4 bg-muted/40 border-b flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <CardTitle className="text-base font-semibold">
            {category === "GHAT" ? "Ghat Operating Hours & Visiting Schedule" : "Operating Hours & Timings"}
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {timingStatus && (
            <Badge
              variant="outline"
              className={
                timingStatus.code === "TEMPORARILY_CLOSED" || timingStatus.isTemporarilyClosed
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  : isOpen24
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : timingStatus.isOpen
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : timingStatus.code === "HOURS_NOT_AVAILABLE"
                  ? "border-border text-muted-foreground"
                  : "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              }
            >
              {timingStatus.label || timingStatus.badgeText || (timingStatus.isOpen ? "Open now" : "Closed")}
            </Badge>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-xs">
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Temporary Closure Announcement */}
        {isTempClosed && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">
                {category === "GHAT" ? "Official Ghat Closure Notice" : "Temporarily Closed"}
              </p>
              <p>{schedule?.temporaryClosureReason || "Temporarily closed for maintenance or special safety guidelines."}</p>
              {schedule?.temporaryClosureUntil && (
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  Expected to reopen: {new Date(schedule.temporaryClosureUntil).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Regular Schedule Breakdown */}
        {isOpen24 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 font-medium p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-md">
            <Sparkles className="size-4 shrink-0" />
            <span>Open 24 Hours / 7 Days a week</span>
          </div>
        ) : hasHours ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Operating Days</p>
              <p className="font-medium mt-0.5">
                {schedule.operatingDays && schedule.operatingDays.length === 7
                  ? "All days (Monday – Sunday)"
                  : schedule.operatingDays?.join(", ") || "Daily"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Daily Hours</p>
              <p className="font-medium mt-0.5">
                {formatTime12h(schedule.openingTime)} – {formatTime12h(schedule.closingTime)}
              </p>
            </div>
            {schedule.breakStart && schedule.breakEnd && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Afternoon Break / Closure</p>
                <p className="text-sm font-medium mt-0.5 text-amber-700 dark:text-amber-400">
                  {formatTime12h(schedule.breakStart)} – {formatTime12h(schedule.breakEnd)}
                </p>
              </div>
            )}
            {schedule.closedDays && schedule.closedDays.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Weekly Closed Days</p>
                <p className="text-sm font-medium mt-0.5 text-rose-600 dark:text-rose-400">
                  {schedule.closedDays.join(", ")}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Hours not available for this listing. Authorized staff can provide official schedules.
          </p>
        )}

        {/* Special Holiday / Event Timings */}
        {schedule?.specialHours && (
          <div className="pt-2 border-t text-xs">
            <span className="font-semibold text-foreground">Special Event / Festival Hours: </span>
            <span className="text-muted-foreground">{schedule.specialHours}</span>
          </div>
        )}

        {/* Timezone and Last Updated Timestamp */}
        <div className="pt-2 border-t flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
          <span>All times in India Standard Time (IST, UTC+5:30)</span>
          {schedule?.updatedAt && (
            <span>Last updated: {new Date(schedule.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HotelRoomsSection({
  rooms,
  canManage,
  onManage,
  onBookRoom,
}: {
  rooms: any[];
  canManage?: boolean;
  onManage?: () => void;
  onBookRoom: (roomId: string) => void;
}) {
  const activeRooms = rooms.filter((r) => r.isActive !== false);
  if (activeRooms.length === 0) return null;

  return (
    <Card className="p-0 border-border shadow-sm overflow-hidden">
      <CardHeader className="p-5 border-b bg-muted/30 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <BedDouble className="size-5 text-primary" /> Available Room Types & Inventory
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time room availability, occupancy limits, and pricing
          </p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onManage}>
            <Building2 className="size-3.5 mr-1.5" /> Manage Inventory
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {activeRooms.map((room) => {
            const amenitiesList: string[] = Array.isArray(room.amenities)
              ? room.amenities
              : typeof room.amenities === "string"
              ? room.amenities.split(",").map((s: string) => s.trim()).filter(Boolean)
              : [];

            return (
              <div
                key={room.id}
                className="border rounded-xl p-4 flex flex-col justify-between bg-card hover:border-primary/50 transition-colors shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h3 className="font-bold text-base text-foreground">{room.name}</h3>
                      {room.roomIdentifier && (
                        <span className="text-[11px] font-mono text-muted-foreground">Unit: {room.roomIdentifier}</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-base text-primary">₹{room.basePrice.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground">per night</p>
                    </div>
                  </div>

                  {room.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{room.description}</p>
                  )}

                  <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5">
                      <BedDouble className="size-3.5 text-foreground/70" />
                      <span>{room.bedCount || 1} {room.bedType || "Standard"} Bed(s)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-foreground/70" />
                      <span>
                        Up to {room.maxGuests} guests ({room.maxAdults} adults, {room.maxChildren} children)
                      </span>
                    </div>
                    {room.extraPersonPrice > 0 && (
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <IndianRupee className="size-3" />
                        <span>Extra guest: ₹{room.extraPersonPrice}/night</span>
                      </div>
                    )}
                  </div>

                  {amenitiesList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {amenitiesList.slice(0, 4).map((am) => (
                        <Badge key={am} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                          {am}
                        </Badge>
                      ))}
                      {amenitiesList.length > 4 && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground">
                          +{amenitiesList.length - 4} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => onBookRoom(room.id)}
                >
                  <Calendar className="size-3.5 mr-1.5" /> Book This Room
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function HotelBookingDialog({
  listing,
  initialRoomId,
  onClose,
  onDone,
}: {
  listing: any;
  initialRoomId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { lang, user } = useApp();
  const { requireAuth } = useBookingAuth();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [roomId, setRoomId] = useState<string>(initialRoomId || listing.hotelRooms?.[0]?.id || "");
  const [roomsCount, setRoomsCount] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [request, setRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Live room availability from server
  const { data: serverRoomsData, loading: checkingRooms } = useApi<{
    items?: Array<{
      id: string;
      name: string;
      totalRooms: number;
      availableRooms: number;
      basePrice: number;
      extraPersonPrice: number;
      maxAdults: number;
      maxChildren: number;
      maxGuests: number;
    }>;
    rooms?: Array<{
      id: string;
      name: string;
      totalRooms: number;
      availableRooms: number;
      basePrice: number;
      extraPersonPrice: number;
      maxAdults: number;
      maxChildren: number;
      maxGuests: number;
    }>;
  }>(
    checkIn && checkOut && checkOut > checkIn
      ? `/hotels/${listing.id}/rooms?checkIn=${checkIn}&checkOut=${checkOut}`
      : null
  );

  const availableRoomsList = serverRoomsData?.items || serverRoomsData?.rooms || listing.hotelRooms || [];
  const selectedRoom = availableRoomsList.find((r: any) => r.id === roomId) || availableRoomsList[0];

  // Calculate nights
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculate pricing preview
  const baseRoomPrice = selectedRoom ? selectedRoom.basePrice * nights * roomsCount : 0;
  const maxIncludedGuests = (selectedRoom?.maxAdults || 2) * roomsCount;
  const extraGuests = Math.max(0, adults + children - maxIncludedGuests);
  const extraCharges = selectedRoom ? extraGuests * (selectedRoom.extraPersonPrice || 0) * nights : 0;
  const estimatedTotal = baseRoomPrice + extraCharges;

  // Real-time capacity and inventory limits
  const isAvailable = selectedRoom ? (selectedRoom.availableRooms == null || selectedRoom.availableRooms >= roomsCount) : true;
  const maxAllowedAdults = selectedRoom ? selectedRoom.maxAdults * roomsCount : 10;
  const maxAllowedChildren = selectedRoom ? selectedRoom.maxChildren * roomsCount : 10;
  const maxAllowedTotal = selectedRoom ? selectedRoom.maxGuests * roomsCount : 10;
  const capacityExceeded = adults > maxAllowedAdults || (adults + children) > maxAllowedTotal;

  async function submit() {
    if (!checkIn || !checkOut) {
      toast({ title: "Error", description: "Select check-in and check-out dates", variant: "destructive" });
      return;
    }
    if (checkOut <= checkIn) {
      toast({ title: "Error", description: "Check-out date must be after check-in date", variant: "destructive" });
      return;
    }
    if (!selectedRoom && availableRoomsList.length > 0) {
      toast({ title: "Error", description: "Please select a room type", variant: "destructive" });
      return;
    }
    if (capacityExceeded) {
      toast({
        title: "Capacity Exceeded",
        description: `Selected rooms cannot accommodate ${adults} adults and ${children} children. Please book additional rooms or select a larger room type.`,
        variant: "destructive",
      });
      return;
    }
    if (selectedRoom && selectedRoom.availableRooms != null && selectedRoom.availableRooms < roomsCount) {
      toast({
        title: "No Availability",
        description: `Only ${selectedRoom.availableRooms} room(s) available for the selected dates.`,
        variant: "destructive",
      });
      return;
    }

    const numAdults = Number(adults);
    const numChildren = Number(children);
    const numRooms = Number(roomsCount);
    const totalGuests = numAdults + numChildren;

    if (numAdults < 1) {
      toast({ title: "Error", description: "At least 1 adult is required", variant: "destructive" });
      return;
    }
    if (numRooms < 1) {
      toast({ title: "Error", description: "At least 1 room is required", variant: "destructive" });
      return;
    }
    if (!requireAuth({
      type: "HOTEL",
      listingId: listing.id,
      title: `Hotel Stay · ${listing.name}`,
      details: `${numRooms} room(s) · ${checkIn} to ${checkOut} · ${totalGuests} guests`,
      data: {
        checkIn,
        checkOut,
        roomId: selectedRoom?.id,
        roomsCount: numRooms,
        adults: numAdults,
        children: numChildren,
        request,
      },
      returnView: { name: "listing", id: listing.id },
    }, () => submit())) {
      return;
    }

    setSubmitting(true);
    try {
      const payload: HotelBookingRequest = {
        listingId: listing.id,
        roomId: selectedRoom?.id || undefined,
        checkIn,
        checkOut,
        rooms: numRooms,
        adults: numAdults,
        children: numChildren,
        guests: totalGuests,
        specialRequest: request || "",
      };
      await api.post("/bookings/hotel", payload);
      toast({
        title: "Booking Requested",
        description: "Your reservation request has been submitted successfully.",
      });
      onDone();
    } catch (e) {
      toast({
        title: "Booking Failed",
        description: e instanceof ApiError ? e.message : "Failed to create hotel booking.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="size-5 text-primary" /> {t(lang, "bookStay")} · {listing.name}
          </DialogTitle>
          <DialogDescription>
            Live date availability check & instant reservation request
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">{t(lang, "checkIn")}</Label>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={today}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">{t(lang, "checkOut")}</Label>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || today}
                className="mt-1"
              />
            </div>
          </div>

          {/* Room Type Selector */}
          {availableRoomsList.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Room Type</Label>
                {checkingRooms && <span className="text-[11px] text-muted-foreground animate-pulse">Checking availability...</span>}
              </div>
              <Select value={roomId || selectedRoom?.id} onValueChange={setRoomId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoomsList.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} — ₹{r.basePrice}/night {r.availableRooms != null ? `(${r.availableRooms} available)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Availability Alert */}
          {selectedRoom && selectedRoom.availableRooms != null && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center justify-between ${
                selectedRoom.availableRooms >= roomsCount
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200"
                  : selectedRoom.availableRooms > 0
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200"
                  : "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200"
              }`}
            >
              <span className="font-medium">
                {selectedRoom.availableRooms >= roomsCount
                  ? `✓ ${selectedRoom.availableRooms} rooms available for ${nights} night(s)`
                  : selectedRoom.availableRooms > 0
                  ? `Only ${selectedRoom.availableRooms} rooms available for selected dates`
                  : "No rooms available for the selected dates"}
              </span>
              <span className="text-[11px]">Max {selectedRoom.maxGuests} guests/room</span>
            </div>
          )}

          {/* Number of Rooms and Guest breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Rooms</Label>
              <Input
                type="number"
                min={1}
                max={selectedRoom?.availableRooms || 5}
                value={roomsCount}
                onChange={(e) => setRoomsCount(Math.max(1, Number(e.target.value)))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Adults</Label>
              <Input
                type="number"
                min={1}
                max={maxAllowedAdults || 10}
                value={adults}
                onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Children</Label>
              <Input
                type="number"
                min={0}
                max={maxAllowedChildren || 5}
                value={children}
                onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
                className="mt-1"
              />
            </div>
          </div>

          {capacityExceeded && (
            <p className="text-xs text-rose-600 font-medium">
              Guest count ({adults} adults, {children} children) exceeds the limit for {roomsCount} room(s) (max {maxAllowedTotal} total guests).
            </p>
          )}

          {/* Special Requests */}
          <div>
            <Label className="text-xs font-semibold">{t(lang, "specialRequest")}</Label>
            <Textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="e.g. Early check-in requested, ground floor preferred..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Pricing Preview */}
          {selectedRoom && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-xs border">
              <div className="flex justify-between text-muted-foreground">
                <span>Room rate ({nights} night(s) × {roomsCount} room(s)):</span>
                <span>₹{baseRoomPrice.toLocaleString()}</span>
              </div>
              {extraCharges > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Extra person fee ({extraGuests} guest(s)):</span>
                  <span>+₹{extraCharges.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t">
                <span>Estimated Total:</span>
                <span className="text-primary font-extrabold">₹{estimatedTotal.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                *Prices calculated securely on server. Payment instructions provided upon confirmation.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t(lang, "cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || checkingRooms || !isAvailable || capacityExceeded}
          >
            {submitting ? t(lang, "loading") : "Request Reservation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateGhatStatusDialog({
  listing,
  onClose,
  onDone,
}: {
  listing: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<string>(listing.ghat?.currentCrowdStatus || "FREE");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await api.patch<{ ok: boolean; message: string }>(`/ghats/${listing.id}/status`, {
        crowdStatus: status,
        notes: notes || undefined,
      });
      toast({ title: "Status Updated", description: res.message || `Ghat crowd status updated to ${status}.` });
      onDone();
    } catch (e) {
      toast({
        title: "Update Failed",
        description: e instanceof ApiError ? e.message : "Failed to update ghat status.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-sky-600 mb-1">
            <Waves className="size-5" />
            <DialogTitle>Update Crowd Status</DialogTitle>
          </div>
          <DialogDescription>
            Update real-time crowd status for <strong>{listing.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Crowd Status Level</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select crowd status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">FREE — Low crowd level</SelectItem>
                <SelectItem value="MODERATE">MODERATE — Medium crowd level</SelectItem>
                <SelectItem value="CROWDED">CROWDED — High crowd level</SelectItem>
                <SelectItem value="CLOSED">CLOSED — Temporarily closed</SelectItem>
                <SelectItem value="OVERCROWDED">OVERCROWDED — Very high crowd</SelectItem>
                <SelectItem value="EMERGENCY">EMERGENCY — Emergency alert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observation Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Queue moving smoothly, north gate open..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white">
            {submitting ? "Saving..." : "Save Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client";
import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon } from "../category-icon";
import {
  ArrowLeft, Save, UploadCloud, X, MapPin, ExternalLink, Star, ImagePlus, Loader2, CheckCircle2, Trash2,
} from "lucide-react";
import { DeleteListingDialog } from "../delete-listing-dialog";
import { CATEGORY_META, type ListingCategory } from "@/lib/constants";

const CATEGORIES = Object.keys(CATEGORY_META) as ListingCategory[];

interface ImageItem {
  id?: string;
  url: string;
  isPrimary?: boolean;
  isNew?: boolean;
}

export function ListingFormView({ id, initialCategory }: { id?: string; initialCategory?: string }) {
  const { lang, navigate, goBack, user } = useApp();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [category, setCategory] = useState<ListingCategory>((initialCategory as ListingCategory) || "RESTAURANT");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [town, setTown] = useState("");
  const [locality, setLocality] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [publicationStatus, setPublicationStatus] = useState("DRAFT");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [accessibility, setAccessibility] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // category-specific detail state
  const [rest, setRest] = useState({ cuisine: "", foodType: "", priceRange: "", openingHours: "", tableCapacity: "", reservationAvailable: true, seatingAccessibility: "" });
  const [hotel, setHotel] = useState({ accommodationType: "", roomTypes: "", numRooms: "", roomCapacity: "", checkInTime: "12:00", checkOutTime: "11:00", amenities: "", priceRange: "", bookingContact: "" });
  const [ghat, setGhat] = useState({ accessRoutes: "", facilities: "", accessibility: "", medicalAssistance: "" });
  const [hospital, setHospital] = useState({ facilityType: "", emergencyAvailable: false, services: "", operatingHours: "" });
  const [transport, setTransport] = useState({ transportType: "TAXI", serviceAreas: "", vehicleDetails: "", pricing: "", driverOption: false });
  const [tourist, setTourist] = useState({ openingHours: "", entryFee: "", facilities: "", accessibility: "", directions: "" });
  const [freeAcc, setFreeAcc] = useState({
    accommodationType: "DORMITORY",
    availableTypes: "Dormitories, Shared Halls",
    totalCapacity: "",
    availableCapacity: "",
    capacityMen: "",
    availableMen: "",
    capacityWomen: "",
    availableWomen: "",
    capacityFamily: "",
    availableFamily: "",
    checkInTime: "06:00",
    checkOutTime: "21:00",
    maxStayDays: "3",
    rules: "",
    eligibilityCriteria: "",
    amenities: "Drinking Water, Mats/Bedding, Clean Bathrooms",
    requiresRegistration: false,
    registrationUrl: "",
    registrationContact: "",
    isTemporarilyUnavailable: false,
    availabilityStatus: "AVAILABLE",
  });
  const [annadanam, setAnnadanam] = useState({
    organizationName: "",
    distributionType: "ALL",
    dietaryInfo: "PURE_VEG",
    servingStatus: "ACTIVE",
    sessions: JSON.stringify([
      { name: "Breakfast", startTime: "07:30", endTime: "09:30" },
      { name: "Lunch (Mahaprasadam)", startTime: "12:00", endTime: "15:00" },
      { name: "Dinner", startTime: "19:30", endTime: "21:30" }
    ], null, 2),
    seatingCapacity: "",
    queueWaitMinutes: "",
    remainingServings: "",
    eligibilityRules: "Open for all devotees and pilgrims",
    specialDates: "",
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const l = await api.get<any>(`/listings/${id}`);
        setCategory(l.category);
        setName(l.name);
        setDescription(l.description);
        setAddress(l.address);
        setDistrict(l.district || "");
        setTown(l.town || "");
        setLocality(l.locality || "");
        setPhone(l.phone || "");
        setEmail(l.email || "");
        setLatitude(l.latitude != null ? String(l.latitude) : "");
        setLongitude(l.longitude != null ? String(l.longitude) : "");
        setMapsUrl(l.mapsUrl || "");
        setPublicationStatus(l.publicationStatus);
        setImages((l.images || []).map((im: any) => ({ id: im.id, url: im.url, isPrimary: im.isPrimary })));
        setAccessibility(l.accessibility || {});
        if (l.restaurant) setRest({ cuisine: l.restaurant.cuisine||"", foodType: l.restaurant.foodType||"", priceRange: l.restaurant.priceRange||"", openingHours: l.restaurant.openingHours||"", tableCapacity: l.restaurant.tableCapacity!=null?String(l.restaurant.tableCapacity):"", reservationAvailable: l.restaurant.reservationAvailable, seatingAccessibility: l.restaurant.seatingAccessibility||"" });
        if (l.hotel) setHotel({ accommodationType: l.hotel.accommodationType||"", roomTypes: l.hotel.roomTypes||"", numRooms: l.hotel.numRooms!=null?String(l.hotel.numRooms):"", roomCapacity: l.hotel.roomCapacity!=null?String(l.hotel.roomCapacity):"", checkInTime: l.hotel.checkInTime||"12:00", checkOutTime: l.hotel.checkOutTime||"11:00", amenities: l.hotel.amenities||"", priceRange: l.hotel.priceRange||"", bookingContact: l.hotel.bookingContact||"" });
        if (l.ghat) setGhat({ accessRoutes: typeof l.ghat.accessRoutes === "string" ? l.ghat.accessRoutes : (Array.isArray(l.ghat.accessRoutes) ? l.ghat.accessRoutes.join(", ") : ""), facilities: typeof l.ghat.facilities === "string" ? l.ghat.facilities : "", accessibility: typeof l.ghat.accessibility === "string" ? l.ghat.accessibility : "", medicalAssistance: l.ghat.medicalAssistance||"" });
        if (l.hospital) setHospital({ facilityType: l.hospital.facilityType||"", emergencyAvailable: l.hospital.emergencyAvailable, services: l.hospital.services||"", operatingHours: l.hospital.operatingHours||"" });
        if (l.transport) setTransport({ transportType: l.transport.transportType||"TAXI", serviceAreas: typeof l.transport.serviceAreas === "string" ? l.transport.serviceAreas : "", vehicleDetails: l.transport.vehicleDetails||"", pricing: l.transport.pricing||"", driverOption: l.transport.driverOption });
        if (l.tourist) setTourist({ openingHours: l.tourist.openingHours||"", entryFee: l.tourist.entryFee||"", facilities: typeof l.tourist.facilities === "string" ? l.tourist.facilities : "", accessibility: typeof l.tourist.accessibility === "string" ? l.tourist.accessibility : "", directions: l.tourist.directions||"" });
        if (l.freeAccommodation) {
          setFreeAcc({
            accommodationType: l.freeAccommodation.accommodationType || "DORMITORY",
            availableTypes: typeof l.freeAccommodation.availableTypes === "string" ? l.freeAccommodation.availableTypes : (Array.isArray(l.freeAccommodation.availableTypes) ? l.freeAccommodation.availableTypes.join(", ") : ""),
            totalCapacity: l.freeAccommodation.totalCapacity != null ? String(l.freeAccommodation.totalCapacity) : "",
            availableCapacity: l.freeAccommodation.availableCapacity != null ? String(l.freeAccommodation.availableCapacity) : "",
            capacityMen: l.freeAccommodation.capacityMen != null ? String(l.freeAccommodation.capacityMen) : "",
            availableMen: l.freeAccommodation.availableMen != null ? String(l.freeAccommodation.availableMen) : "",
            capacityWomen: l.freeAccommodation.capacityWomen != null ? String(l.freeAccommodation.capacityWomen) : "",
            availableWomen: l.freeAccommodation.availableWomen != null ? String(l.freeAccommodation.availableWomen) : "",
            capacityFamily: l.freeAccommodation.capacityFamily != null ? String(l.freeAccommodation.capacityFamily) : "",
            availableFamily: l.freeAccommodation.availableFamily != null ? String(l.freeAccommodation.availableFamily) : "",
            checkInTime: l.freeAccommodation.checkInTime || "06:00",
            checkOutTime: l.freeAccommodation.checkOutTime || "21:00",
            maxStayDays: l.freeAccommodation.maxStayDays != null ? String(l.freeAccommodation.maxStayDays) : "3",
            rules: l.freeAccommodation.rules || "",
            eligibilityCriteria: l.freeAccommodation.eligibilityCriteria || "",
            amenities: typeof l.freeAccommodation.amenities === "string" ? l.freeAccommodation.amenities : (Array.isArray(l.freeAccommodation.amenities) ? l.freeAccommodation.amenities.join(", ") : ""),
            requiresRegistration: !!l.freeAccommodation.requiresRegistration,
            registrationUrl: l.freeAccommodation.registrationUrl || "",
            registrationContact: l.freeAccommodation.registrationContact || "",
            isTemporarilyUnavailable: !!l.freeAccommodation.isTemporarilyUnavailable,
            availabilityStatus: l.freeAccommodation.availabilityStatus || "AVAILABLE",
          });
        }
        if (l.annadanam) {
          setAnnadanam({
            organizationName: l.annadanam.organizationName || "",
            distributionType: l.annadanam.distributionType || "ALL",
            dietaryInfo: l.annadanam.dietaryInfo || "PURE_VEG",
            servingStatus: l.annadanam.servingStatus || "ACTIVE",
            sessions: typeof l.annadanam.sessions === "string" ? l.annadanam.sessions : JSON.stringify(l.annadanam.sessions || [], null, 2),
            seatingCapacity: l.annadanam.seatingCapacity != null ? String(l.annadanam.seatingCapacity) : "",
            queueWaitMinutes: l.annadanam.queueWaitMinutes != null ? String(l.annadanam.queueWaitMinutes) : "",
            remainingServings: l.annadanam.remainingServings != null ? String(l.annadanam.remainingServings) : "",
            eligibilityRules: l.annadanam.eligibilityRules || "",
            specialDates: l.annadanam.specialDates || "",
          });
        }
      } catch (e) { toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to load", variant: "destructive" }); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const canPublish = user?.role === "SUPER_ADMIN";
  const latNum = latitude ? Number(latitude) : undefined;
  const lngNum = longitude ? Number(longitude) : undefined;
  const coordsValid = latNum != null && lngNum != null && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
  const mapsValid = !!mapsUrl && /^https?:\/\//i.test(mapsUrl);
  const locationVerified = coordsValid || mapsValid;
  const directionsUrl = coordsValid ? `https://www.google.com/maps/dir/?api=1&destination=${latNum},${lngNum}` : (mapsValid ? mapsUrl : null);

  async function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!id) { toast({ title: "Save first", description: "Save the listing before uploading images.", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await api.post<{ images: any[] }>(`/images?listingId=${id}&primary=${images.length === 0}`, fd);
      setImages((prev) => [...prev, ...res.images.map((im) => ({ id: im.id, url: im.url, isPrimary: im.isPrimary }))]);
      toast({ title: "Success", description: t(lang, "imageUploaded") });
    } catch (e) { toast({ title: "Upload failed", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function removeImage(img: ImageItem, idx: number) {
    if (img.id) {
      try { await api.del(`/images/${img.id}`); } catch (e) { toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" }); return; }
    }
    setImages((prev) => prev.filter((_, i) => i !== idx));
    toast({ title: "Removed", description: t(lang, "imageRemoved") });
  }

  async function setPrimary(idx: number) {
    const target = images[idx];
    if (!target.id) return;
    setImages((prev) => prev.map((im, i) => ({ ...im, isPrimary: i === idx })));
    // The backend sets primary via re-upload semantics; we just optimistically update.
    toast({ title: "Primary set" });
  }

  async function save(status?: string) {
    if (!name || !description || !address) { toast({ title: "Error", description: t(lang, "requiredField"), variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      name, category, description, address,
      district: district || null, town: town || null, locality: locality || null,
      phone: phone || null, email: email || null,
      latitude: latNum ?? null, longitude: lngNum ?? null,
      mapsUrl: mapsUrl || null,
      accessibility: Object.keys(accessibility).length ? accessibility : null,
      publicationStatus: status || publicationStatus,
    };
    if (category === "RESTAURANT") payload.restaurant = { ...rest, tableCapacity: rest.tableCapacity ? Number(rest.tableCapacity) : null };
    if (category === "HOTEL") payload.hotel = { ...hotel, numRooms: hotel.numRooms ? Number(hotel.numRooms) : null, roomCapacity: hotel.roomCapacity ? Number(hotel.roomCapacity) : null };
    if (category === "GHAT") payload.ghat = ghat;
    if (category === "HOSPITAL") payload.hospital = hospital;
    if (category === "TRANSPORT") payload.transport = transport;
    if (category === "TOURIST_SPOT") payload.tourist = tourist;
    if (category === "FREE_ACCOMMODATION") {
      payload.freeAccommodation = {
        ...freeAcc,
        totalCapacity: freeAcc.totalCapacity ? Number(freeAcc.totalCapacity) : null,
        availableCapacity: freeAcc.availableCapacity ? Number(freeAcc.availableCapacity) : null,
        capacityMen: freeAcc.capacityMen ? Number(freeAcc.capacityMen) : null,
        availableMen: freeAcc.availableMen ? Number(freeAcc.availableMen) : null,
        capacityWomen: freeAcc.capacityWomen ? Number(freeAcc.capacityWomen) : null,
        availableWomen: freeAcc.availableWomen ? Number(freeAcc.availableWomen) : null,
        capacityFamily: freeAcc.capacityFamily ? Number(freeAcc.capacityFamily) : null,
        availableFamily: freeAcc.availableFamily ? Number(freeAcc.availableFamily) : null,
        maxStayDays: freeAcc.maxStayDays ? Number(freeAcc.maxStayDays) : 3,
      };
    }
    if (category === "ANNADANAM") {
      let parsedSessions: any = null;
      try {
        parsedSessions = JSON.parse(annadanam.sessions);
      } catch {
        parsedSessions = null;
      }
      payload.annadanam = {
        ...annadanam,
        sessions: parsedSessions,
        seatingCapacity: annadanam.seatingCapacity ? Number(annadanam.seatingCapacity) : null,
        queueWaitMinutes: annadanam.queueWaitMinutes ? Number(annadanam.queueWaitMinutes) : null,
        remainingServings: annadanam.remainingServings ? Number(annadanam.remainingServings) : null,
      };
    }

    try {
      if (id) {
        await api.put(`/listings/${id}`, payload);
        toast({ title: "Success", description: t(lang, "saved") });
      } else {
        const created = await api.post<any>("/listings", payload);
        toast({ title: "Success", description: t(lang, "listingCreated") });
        navigate({ name: "listing-form", id: created.id });
        return;
      }
      if (status === "PUBLISHED" && canPublish) {
        try { await api.post(`/listings/${id}/publish`); toast({ title: "Success", description: t(lang, "listingPublished") }); }
        catch (e) { toast({ title: "Publish failed", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" }); }
      }
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" });
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="container mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">{t(lang, "loading")}</div>;
  }

  return (
    <div className="flex-1 container mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => goBack({ name: user?.role === "SUPER_ADMIN" ? "admin" : "directory" })}>
        <ArrowLeft className="size-4" /> {t(lang, "back")}
      </Button>
      <h1 className="text-3xl font-bold mb-1">{isEdit ? t(lang, "editListing") : t(lang, "createListing")}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {locationVerified ? <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Location verified</span> : <span className="text-amber-600">{t(lang, "locationNotVerified")} — add coordinates or a Maps URL to publish.</span>}
      </p>

      {/* Basic info */}
      <Card className="p-0 mb-6">
        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>{t(lang, "name")} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ListingCategory)} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2"><CategoryIcon category={c} className="size-4" /> {CATEGORY_META[c].label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Publication Status</Label>
            <Select value={publicationStatus} onValueChange={setPublicationStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING">Submit for Review</SelectItem>
                {canPublish && <SelectItem value="PUBLISHED">Publish</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>{t(lang, "description")} *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
        </CardContent>
      </Card>

      {/* Location & contact */}
      <Card className="p-0 mb-6">
        <CardHeader><CardTitle>Location & Contact</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>{t(lang, "address")} *</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>
          <div><Label>{t(lang, "district")}</Label><Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="East Godavari" /></div>
          <div><Label>{t(lang, "town")}</Label><Input value={town} onChange={(e) => setTown(e.target.value)} placeholder="Rajahmundry" /></div>
          <div><Label>{t(lang, "locality")}</Label><Input value={locality} onChange={(e) => setLocality(e.target.value)} /></div>
          <div><Label>{t(lang, "phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>{t(lang, "email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div>
            <Label>{t(lang, "latitude")}</Label>
            <Input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="17.0" />
          </div>
          <div>
            <Label>{t(lang, "longitude")}</Label>
            <Input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="81.78" />
          </div>
          <div className="md:col-span-2">
            <Label>{t(lang, "mapsUrl")}</Label>
            <Input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." />
            <p className="text-xs text-muted-foreground mt-1">{t(lang, "locationHint")}</p>
          </div>
          {directionsUrl && (
            <div className="md:col-span-2">
              <Button asChild variant="outline" size="sm">
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" /> {t(lang, "verifyOnMaps")}
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category-specific details */}
      {category === "RESTAURANT" && (
        <Card className="p-0 mb-6">
          <CardHeader><CardTitle>Restaurant Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>{t(lang, "cuisine")}</Label><Input value={rest.cuisine} onChange={(e) => setRest({ ...rest, cuisine: e.target.value })} placeholder="Andhra, Multi-cuisine" /></div>
            <div>
              <Label>{t(lang, "foodType")}</Label>
              <Select value={rest.foodType} onValueChange={(v) => setRest({ ...rest, foodType: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VEG">Vegetarian</SelectItem>
                  <SelectItem value="NON_VEG">Non-vegetarian</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t(lang, "priceRange")}</Label><Input value={rest.priceRange} onChange={(e) => setRest({ ...rest, priceRange: e.target.value })} placeholder="₹₹" /></div>
            <div><Label>{t(lang, "openingHours")}</Label><Input value={rest.openingHours} onChange={(e) => setRest({ ...rest, openingHours: e.target.value })} placeholder="7 AM – 11 PM" /></div>
            <div><Label>{t(lang, "tableCapacity")}</Label><Input type="number" value={rest.tableCapacity} onChange={(e) => setRest({ ...rest, tableCapacity: e.target.value })} /></div>
            <div className="flex items-center gap-2 pt-7">
              <input type="checkbox" id="resAvail" checked={rest.reservationAvailable} onChange={(e) => setRest({ ...rest, reservationAvailable: e.target.checked })} />
              <Label htmlFor="resAvail">{t(lang, "reservationAvailable")}</Label>
            </div>
          </CardContent>
        </Card>
      )}

      {category === "HOTEL" && (
        <Card className="p-0 mb-6">
          <CardHeader><CardTitle>Hotel Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>{t(lang, "accommodationType")}</Label><Input value={hotel.accommodationType} onChange={(e) => setHotel({ ...hotel, accommodationType: e.target.value })} placeholder="Hotel, Lodge, Guest House" /></div>
            <div><Label>{t(lang, "roomTypes")}</Label><Input value={hotel.roomTypes} onChange={(e) => setHotel({ ...hotel, roomTypes: e.target.value })} placeholder="AC, Non-AC, Deluxe" /></div>
            <div><Label>{t(lang, "numRooms")}</Label><Input type="number" value={hotel.numRooms} onChange={(e) => setHotel({ ...hotel, numRooms: e.target.value })} /></div>
            <div><Label>Room Capacity</Label><Input type="number" value={hotel.roomCapacity} onChange={(e) => setHotel({ ...hotel, roomCapacity: e.target.value })} /></div>
            <div><Label>{t(lang, "checkIn")}</Label><Input type="time" value={hotel.checkInTime} onChange={(e) => setHotel({ ...hotel, checkInTime: e.target.value })} /></div>
            <div><Label>{t(lang, "checkOut")}</Label><Input type="time" value={hotel.checkOutTime} onChange={(e) => setHotel({ ...hotel, checkOutTime: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>{t(lang, "amenities")}</Label><Input value={hotel.amenities} onChange={(e) => setHotel({ ...hotel, amenities: e.target.value })} placeholder="WiFi, AC, Parking, Room Service" /></div>
            <div><Label>{t(lang, "priceRange")}</Label><Input value={hotel.priceRange} onChange={(e) => setHotel({ ...hotel, priceRange: e.target.value })} /></div>
            <div><Label>Booking Contact</Label><Input value={hotel.bookingContact} onChange={(e) => setHotel({ ...hotel, bookingContact: e.target.value })} /></div>
          </CardContent>
        </Card>
      )}

      {category === "GHAT" && (
        <Card className="p-0 mb-6">
          <CardHeader><CardTitle>Ghat Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div><Label>Access Routes</Label><Textarea value={ghat.accessRoutes} onChange={(e) => setGhat({ ...ghat, accessRoutes: e.target.value })} rows={2} /></div>
            <div><Label>Facilities</Label><Textarea value={ghat.facilities} onChange={(e) => setGhat({ ...ghat, facilities: e.target.value })} rows={2} /></div>
            <div><Label>Accessibility</Label><Textarea value={ghat.accessibility} onChange={(e) => setGhat({ ...ghat, accessibility: e.target.value })} rows={2} /></div>
            <div><Label>Medical Assistance</Label><Textarea value={ghat.medicalAssistance} onChange={(e) => setGhat({ ...ghat, medicalAssistance: e.target.value })} rows={2} /></div>
          </CardContent>
        </Card>
      )}

      {category === "HOSPITAL" && (
        <Card className="p-0 mb-6">
          <CardHeader><CardTitle>Hospital Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Facility Type</Label><Input value={hospital.facilityType} onChange={(e) => setHospital({ ...hospital, facilityType: e.target.value })} placeholder="Government, Private, Clinic" /></div>
            <div className="flex items-center gap-2 pt-7"><input type="checkbox" id="er" checked={hospital.emergencyAvailable} onChange={(e) => setHospital({ ...hospital, emergencyAvailable: e.target.checked })} /><Label htmlFor="er">Emergency Available 24x7</Label></div>
            <div className="md:col-span-2"><Label>Services</Label><Textarea value={hospital.services} onChange={(e) => setHospital({ ...hospital, services: e.target.value })} rows={2} /></div>
            <div><Label>Operating Hours</Label><Input value={hospital.operatingHours} onChange={(e) => setHospital({ ...hospital, operatingHours: e.target.value })} /></div>
          </CardContent>
        </Card>
      )}

      {category === "TRANSPORT" && (
        <Card className="p-0 mb-6">
          <CardHeader><CardTitle>Transport Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Transport Type</Label>
              <Select value={transport.transportType} onValueChange={(v) => setTransport({ ...transport, transportType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAXI">Taxi</SelectItem>
                  <SelectItem value="AUTO">Auto-rickshaw</SelectItem>
                  <SelectItem value="BUS">Bus</SelectItem>
                  <SelectItem value="RENTAL">Rental Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Vehicle Details</Label><Input value={transport.vehicleDetails} onChange={(e) => setTransport({ ...transport, vehicleDetails: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Service Areas</Label><Textarea value={transport.serviceAreas} onChange={(e) => setTransport({ ...transport, serviceAreas: e.target.value })} rows={2} /></div>
            <div><Label>Pricing</Label><Input value={transport.pricing} onChange={(e) => setTransport({ ...transport, pricing: e.target.value })} /></div>
            <div className="flex items-center gap-2 pt-7"><input type="checkbox" id="drv" checked={transport.driverOption} onChange={(e) => setTransport({ ...transport, driverOption: e.target.checked })} /><Label htmlFor="drv">Driver available</Label></div>
          </CardContent>
        </Card>
      )}

      {category === "TOURIST_SPOT" && (
        <Card className="p-0 mb-6">
          <CardHeader><CardTitle>Visitor Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Opening Hours</Label><Input value={tourist.openingHours} onChange={(e) => setTourist({ ...tourist, openingHours: e.target.value })} /></div>
            <div><Label>Entry Fee</Label><Input value={tourist.entryFee} onChange={(e) => setTourist({ ...tourist, entryFee: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Facilities</Label><Textarea value={tourist.facilities} onChange={(e) => setTourist({ ...tourist, facilities: e.target.value })} rows={2} /></div>
            <div className="md:col-span-2"><Label>Accessibility</Label><Textarea value={tourist.accessibility} onChange={(e) => setTourist({ ...tourist, accessibility: e.target.value })} rows={2} /></div>
            <div className="md:col-span-2"><Label>Directions</Label><Textarea value={tourist.directions} onChange={(e) => setTourist({ ...tourist, directions: e.target.value })} rows={2} /></div>
          </CardContent>
        </Card>
      )}

      {category === "FREE_ACCOMMODATION" && (
        <Card className="p-0 mb-6 border-indigo-200 dark:border-indigo-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-600" />
              Free Accommodation Centre Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Accommodation Type</Label>
                <Select value={freeAcc.accommodationType} onValueChange={(v) => setFreeAcc({ ...freeAcc, accommodationType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DORMITORY">Dormitory</SelectItem>
                    <SelectItem value="HALL">Community Hall / Chathram</SelectItem>
                    <SelectItem value="ROOMS">Private Pilgrim Rooms</SelectItem>
                    <SelectItem value="MIXED">Mixed (Halls & Rooms)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Available Types Description</Label>
                <Input value={freeAcc.availableTypes} onChange={(e) => setFreeAcc({ ...freeAcc, availableTypes: e.target.value })} placeholder="e.g. AC Halls, Non-AC Dormitory, Senior Citizen Rooms" />
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
              <h4 className="text-sm font-semibold">Capacity & Live Availability</h4>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <div>
                  <Label>Total Capacity</Label>
                  <Input type="number" min="0" value={freeAcc.totalCapacity} onChange={(e) => setFreeAcc({ ...freeAcc, totalCapacity: e.target.value })} placeholder="e.g. 500" />
                </div>
                <div>
                  <Label>Current Available</Label>
                  <Input type="number" min="0" value={freeAcc.availableCapacity} onChange={(e) => setFreeAcc({ ...freeAcc, availableCapacity: e.target.value })} placeholder="e.g. 120" />
                </div>
                <div>
                  <Label>Men (Total / Avail)</Label>
                  <div className="flex gap-1.5">
                    <Input type="number" min="0" placeholder="Tot" value={freeAcc.capacityMen} onChange={(e) => setFreeAcc({ ...freeAcc, capacityMen: e.target.value })} />
                    <Input type="number" min="0" placeholder="Avail" value={freeAcc.availableMen} onChange={(e) => setFreeAcc({ ...freeAcc, availableMen: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Women (Total / Avail)</Label>
                  <div className="flex gap-1.5">
                    <Input type="number" min="0" placeholder="Tot" value={freeAcc.capacityWomen} onChange={(e) => setFreeAcc({ ...freeAcc, capacityWomen: e.target.value })} />
                    <Input type="number" min="0" placeholder="Avail" value={freeAcc.availableWomen} onChange={(e) => setFreeAcc({ ...freeAcc, availableWomen: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3 pt-2">
                <div>
                  <Label>Family Capacity (Total / Avail)</Label>
                  <div className="flex gap-1.5">
                    <Input type="number" min="0" placeholder="Tot" value={freeAcc.capacityFamily} onChange={(e) => setFreeAcc({ ...freeAcc, capacityFamily: e.target.value })} />
                    <Input type="number" min="0" placeholder="Avail" value={freeAcc.availableFamily} onChange={(e) => setFreeAcc({ ...freeAcc, availableFamily: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Availability Status</Label>
                  <Select value={freeAcc.availabilityStatus} onValueChange={(v) => setFreeAcc({ ...freeAcc, availabilityStatus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">Available</SelectItem>
                      <SelectItem value="FEW_LEFT">Few Places Left</SelectItem>
                      <SelectItem value="FULL">Completely Full</SelectItem>
                      <SelectItem value="NOT_CONFIRMED">Not Confirmed</SelectItem>
                      <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="tempUnavail" checked={freeAcc.isTemporarilyUnavailable} onChange={(e) => setFreeAcc({ ...freeAcc, isTemporarilyUnavailable: e.target.checked })} />
                  <Label htmlFor="tempUnavail">Mark Temporarily Unavailable</Label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Check-in Time</Label>
                <Input value={freeAcc.checkInTime} onChange={(e) => setFreeAcc({ ...freeAcc, checkInTime: e.target.value })} placeholder="e.g. 06:00" />
              </div>
              <div>
                <Label>Check-out Time</Label>
                <Input value={freeAcc.checkOutTime} onChange={(e) => setFreeAcc({ ...freeAcc, checkOutTime: e.target.value })} placeholder="e.g. 21:00" />
              </div>
              <div>
                <Label>Max Permitted Stay (Days)</Label>
                <Input type="number" min="1" max="30" value={freeAcc.maxStayDays} onChange={(e) => setFreeAcc({ ...freeAcc, maxStayDays: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Rules & Restrictions</Label>
                <Textarea value={freeAcc.rules} onChange={(e) => setFreeAcc({ ...freeAcc, rules: e.target.value })} placeholder="e.g. Valid ID required. Alcohol strictly prohibited. Quiet hours 10 PM - 5 AM." rows={3} />
              </div>
              <div>
                <Label>Eligibility & Required Documents</Label>
                <Textarea value={freeAcc.eligibilityCriteria} onChange={(e) => setFreeAcc({ ...freeAcc, eligibilityCriteria: e.target.value })} placeholder="e.g. Aadhaar Card / Pilgrim Pass. Free for all bona fide pilgrims." rows={3} />
              </div>
            </div>

            <div>
              <Label>Amenities & Facility Details</Label>
              <Input value={freeAcc.amenities} onChange={(e) => setFreeAcc({ ...freeAcc, amenities: e.target.value })} placeholder="e.g. Clean Bathrooms, RO Drinking Water, Bedding Mats, Hot Water, Locker Facility" />
            </div>

            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="reqReg" checked={freeAcc.requiresRegistration} onChange={(e) => setFreeAcc({ ...freeAcc, requiresRegistration: e.target.checked })} />
                <Label htmlFor="reqReg" className="font-semibold">Advance Registration / Online Booking Required</Label>
              </div>
              {freeAcc.requiresRegistration && (
                <div className="grid gap-4 md:grid-cols-2 pt-2">
                  <div>
                    <Label>Registration URL / Portal (optional)</Label>
                    <Input value={freeAcc.registrationUrl} onChange={(e) => setFreeAcc({ ...freeAcc, registrationUrl: e.target.value })} placeholder="https://..." />
                  </div>
                  <div>
                    <Label>Registration Helpdesk Contact</Label>
                    <Input value={freeAcc.registrationContact} onChange={(e) => setFreeAcc({ ...freeAcc, registrationContact: e.target.value })} placeholder="Phone or email for registration support" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {category === "ANNADANAM" && (
        <Card className="p-0 mb-6 border-orange-200 dark:border-orange-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-orange-600" />
              Free Annadanam & Prasadam Location Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Organising Trust / Temple Name</Label>
                <Input value={annadanam.organizationName} onChange={(e) => setAnnadanam({ ...annadanam, organizationName: e.target.value })} placeholder="e.g. Sri Pushkaralu Annadana Trust" />
              </div>
              <div>
                <Label>Distribution Type</Label>
                <Select value={annadanam.distributionType} onValueChange={(v) => setAnnadanam({ ...annadanam, distributionType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Free Meals & Prasadam (Both)</SelectItem>
                    <SelectItem value="ANNADANAM">Annadanam / Full Meals</SelectItem>
                    <SelectItem value="PRASADAM">Temple Prasadam Distribution</SelectItem>
                    <SelectItem value="MEALS">Community Kitchen / Khichdi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dietary Information</Label>
                <Select value={annadanam.dietaryInfo} onValueChange={(v) => setAnnadanam({ ...annadanam, dietaryInfo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PURE_VEG">100% Pure Vegetarian</SelectItem>
                    <SelectItem value="SATVIK">Satvik (No Onion/Garlic)</SelectItem>
                    <SelectItem value="PRASADAM_ONLY">Sacred Pushkara Prasadam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
              <h4 className="text-sm font-semibold">Live Operational Status</h4>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label>Serving Status</Label>
                  <Select value={annadanam.servingStatus} onValueChange={(v) => setAnnadanam({ ...annadanam, servingStatus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active / Serving</SelectItem>
                      <SelectItem value="PAUSED">Paused Temporarily</SelectItem>
                      <SelectItem value="ENDED">Ended For Today</SelectItem>
                      <SelectItem value="TEMPORARILY_UNAVAILABLE">Temporarily Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Seating Capacity</Label>
                  <Input type="number" min="0" value={annadanam.seatingCapacity} onChange={(e) => setAnnadanam({ ...annadanam, seatingCapacity: e.target.value })} placeholder="e.g. 250" />
                </div>
                <div>
                  <Label>Est. Queue Wait (Minutes)</Label>
                  <Input type="number" min="0" value={annadanam.queueWaitMinutes} onChange={(e) => setAnnadanam({ ...annadanam, queueWaitMinutes: e.target.value })} placeholder="e.g. 15" />
                </div>
                <div>
                  <Label>Est. Remaining Servings</Label>
                  <Input type="number" min="0" value={annadanam.remainingServings} onChange={(e) => setAnnadanam({ ...annadanam, remainingServings: e.target.value })} placeholder="e.g. 500" />
                </div>
              </div>
            </div>

            <div>
              <Label>Distribution Sessions (JSON array of sessions)</Label>
              <Textarea
                className="font-mono text-xs"
                value={annadanam.sessions}
                onChange={(e) => setAnnadanam({ ...annadanam, sessions: e.target.value })}
                rows={5}
                placeholder='[{"name":"Lunch","startTime":"12:00","endTime":"15:00"}]'
              />
              <p className="text-xs text-muted-foreground mt-1">Specify session names, 24h start and end times in IST.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Eligibility & Entry Rules</Label>
                <Textarea value={annadanam.eligibilityRules} onChange={(e) => setAnnadanam({ ...annadanam, eligibilityRules: e.target.value })} placeholder="e.g. Open to all pilgrims freely. Tokens distributed at gate." rows={2} />
              </div>
              <div>
                <Label>Special Event or Festival Dates</Label>
                <Textarea value={annadanam.specialDates} onChange={(e) => setAnnadanam({ ...annadanam, specialDates: e.target.value })} placeholder="e.g. Daily during Pushkaram; extended hours on Ekadashi & Purnima" rows={2} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accessibility flags */}
      <Card className="p-0 mb-6">
        <CardHeader><CardTitle>{t(lang, "accessibility")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {["wheelchair_access", "senior_citizen_assist", "family_friendly", "accessible_toilet", "drinking_water", "first_aid", "emergency_point", "parking"].map((k) => (
              <label key={k} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent">
                <input type="checkbox" checked={!!accessibility[k]} onChange={(e) => setAccessibility({ ...accessibility, [k]: e.target.checked })} />
                <span className="text-sm capitalize">{k.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card className="p-0 mb-6">
        <CardHeader>
          <CardTitle>{t(lang, "gallery")} ({images.length}/8)</CardTitle>
        </CardHeader>
        <CardContent>
          {!isEdit && <p className="text-sm text-amber-600 mb-3">Save the listing first to enable image uploads.</p>}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!isEdit || uploading || images.length >= 8}
            className="w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-6 animate-spin" /> : <UploadCloud className="size-6" />}
            <span className="text-sm font-medium">{uploading ? t(lang, "loading") : t(lang, "addImage")}</span>
            <span className="text-xs">JPEG, PNG, WebP — max 5MB each</span>
          </button>
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {images.map((img, idx) => (
                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border">
                  { }
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {img.isPrimary && <Badge className="absolute top-1 left-1 bg-primary text-primary-foreground"><Star className="size-3" /></Badge>}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    {!img.isPrimary && <Button size="icon" variant="secondary" className="size-7" onClick={() => setPrimary(idx)} title="Set primary"><Star className="size-3" /></Button>}
                    <Button size="icon" variant="destructive" className="size-7" onClick={() => removeImage(img, idx)} title="Remove"><X className="size-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 justify-end sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-xl border">
        {isEdit && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
            onClick={() => setDeleteOpen(true)}
            disabled={saving || deleting}
          >
            <Trash2 className="size-4 mr-1" /> {t(lang, "delete")}
          </Button>
        )}
        <Button variant="outline" onClick={() => save("DRAFT")} disabled={saving || deleting}>{t(lang, "save")} Draft</Button>
        <Button variant="secondary" onClick={() => save("PENDING")} disabled={saving || deleting}>Submit for Review</Button>
        {canPublish && locationVerified && (
          <Button onClick={() => save("PUBLISHED")} disabled={saving || deleting || !locationVerified}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {t(lang, "publish")}
          </Button>
        )}
      </div>

      {isEdit && deleteOpen && (
        <DeleteListingDialog
          listing={{ id: id!, name, publicationStatus }}
          isDeleting={deleting}
          onClose={() => setDeleteOpen(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              const isArchived = publicationStatus === "ARCHIVED";
              await api.del(`/listings/${id}${isArchived ? "?permanent=true" : ""}`);
              toast({ title: "Success", description: t(lang, "listingDeleted") });
              setDeleteOpen(false);
              navigate({
                name: user?.role === "SUPER_ADMIN" ? "admin" : (user?.role === "BUSINESS_OWNER" ? "owner-dashboard" : "directory"),
              });
            } catch (e) {
              toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to delete", variant: "destructive" });
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
    </div>
  );
}

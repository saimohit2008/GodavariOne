"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { api, ApiError, CeremonyBookingRequest } from "@/lib/api-client";
import { useBookingAuth } from "../booking-auth-modal";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
  Flame, Search, CheckCircle2, MapPin, Calendar, Clock, Users,
  Globe2, Sparkles, AlertCircle, Phone, Mail, FileText, ArrowRight, X, HeartHandshake, ShieldCheck
} from "lucide-react";
import { CEREMONY_TYPES, CEREMONY_LOCATIONS, CEREMONY_LANGUAGES } from "@/lib/ceremonies";

interface PurohitItem {
  id: string;
  fullName: string;
  profilePhoto?: string | null;
  phone?: string | null;
  email?: string | null;
  serviceArea: string;
  languages: string[];
  ceremonies: string[];
  experienceYears: number;
  qualifications?: string | null;
  customaryPractices?: string | null;
  baseFee: number;
  includedServices?: string | null;
  isVerified: boolean;
  isPublished: boolean;
  isActive: boolean;
}

interface AvailableSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string;
}

export function CeremonyDirectoryView({
  initialCategory,
  initialPurohitId,
}: {
  initialCategory?: string;
  initialPurohitId?: string;
}) {
  const { user, navigate, pendingBooking } = useApp();
  const { requireAuth } = useBookingAuth();

  const [purohits, setPurohits] = useState<PurohitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("ALL");
  const normalizedCategory =
    initialCategory && initialCategory !== "CEREMONY" && initialCategory !== "ALL"
      ? initialCategory
      : "ALL";
  const [selectedCeremony, setSelectedCeremony] = useState<string>(normalizedCategory);

  // Booking Modal State
  const [selectedPurohit, setSelectedPurohit] = useState<PurohitItem | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [bookingCeremonyType, setBookingCeremonyType] = useState<string>(() => {
    if (normalizedCategory !== "ALL") {
      const match = CEREMONY_TYPES.find((c) => c.id === normalizedCategory || c.label === normalizedCategory);
      if (match) return match.id;
    }
    return CEREMONY_TYPES[0].id;
  });
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Form fields
  const [visitorName, setVisitorName] = useState(user?.name || "");
  const [visitorPhone, setVisitorPhone] = useState(user?.phone || "");
  const [visitorEmail, setVisitorEmail] = useState(user?.email || "");
  const [gotra, setGotra] = useState("");
  const [deceasedRelationship, setDeceasedRelationship] = useState("");
  const [participantCount, setParticipantCount] = useState(2);
  const [ceremonyLocation, setCeremonyLocation] = useState<string>(CEREMONY_LOCATIONS[0]);
  const [locationAddress, setLocationAddress] = useState("");
  const [customaryRequirements, setCustomaryRequirements] = useState("");
  const [visitorNotes, setVisitorNotes] = useState("");
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Confirmation state
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);

  const loadPurohits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedArea && selectedArea !== "ALL") params.set("area", selectedArea);
      if (selectedLanguage && selectedLanguage !== "ALL") params.set("language", selectedLanguage);
      if (selectedCeremony && selectedCeremony !== "ALL") params.set("ceremony", selectedCeremony);

      const res = await api.get<{ purohits?: PurohitItem[]; items?: PurohitItem[] }>(
        `/ceremonies/purohits?${params.toString()}`
      );
      const list = res.purohits || res.items || [];
      setPurohits(list);
    } catch (err: any) {
      toast({
        title: "Error loading purohits",
        description: err.message || "Could not retrieve purohit directory.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startBooking = (purohit: PurohitItem) => {
    setSelectedPurohit(purohit);
    setSelectedSlot(null);
    setVisitorName(user?.name || "");
    setVisitorPhone(user?.phone || "");
    setVisitorEmail(user?.email || "");
    // If purohit doesn't perform currently selected ceremony, pick first they support
    if (!purohit.ceremonies.includes(bookingCeremonyType) && purohit.ceremonies.length > 0) {
      setBookingCeremonyType(purohit.ceremonies[0]);
    }
  };

  // Load purohits
  useEffect(() => {
    loadPurohits();
  }, [search, selectedArea, selectedLanguage, selectedCeremony]);

  // Handle auto-open by initialPurohitId
  useEffect(() => {
    if (initialPurohitId && purohits.length > 0) {
      const match = purohits.find(p => p.id === initialPurohitId);
      if (match) {
        startBooking(match);
      }
    }
  }, [initialPurohitId, purohits]);

  // Fetch slots whenever selected purohit, date, or ceremony type changes
  useEffect(() => {
    if (!selectedPurohit || !bookingDate) return;

    const ceremonyMeta = CEREMONY_TYPES.find(c => c.id === bookingCeremonyType || c.label === bookingCeremonyType);
    const duration = ceremonyMeta?.duration || 60;

    let isMounted = true;
    setLoadingSlots(true);
    setSelectedSlot(null);

    api.get<{ availableSlots: AvailableSlot[] }>(
      `/ceremonies/purohits/${selectedPurohit.id}/availability?date=${bookingDate}&duration=${duration}`
    )
      .then((res) => {
        if (isMounted) {
          setAvailableSlots(res.availableSlots || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setAvailableSlots([]);
          toast({
            title: "Availability check",
            description: err.message || "Failed to load slots for this date.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPurohit, bookingDate, bookingCeremonyType]);

  // Restore pending ceremony booking on authentication
  useEffect(() => {
    if (user && pendingBooking && pendingBooking.type === "CEREMONY" && pendingBooking.data) {
      const d = pendingBooking.data;
      if (d.bookingDate) setBookingDate(d.bookingDate);
      if (d.bookingCeremonyType) setBookingCeremonyType(d.bookingCeremonyType);
      if (d.selectedSlot) setSelectedSlot(d.selectedSlot);
      if (d.gotra) setGotra(d.gotra);
      if (d.deceasedRelationship) setDeceasedRelationship(d.deceasedRelationship);
      if (d.participantCount) setParticipantCount(d.participantCount);
      if (d.ceremonyLocation) setCeremonyLocation(d.ceremonyLocation);
      if (d.locationAddress) setLocationAddress(d.locationAddress);
      if (d.customaryRequirements) setCustomaryRequirements(d.customaryRequirements);
      if (d.visitorNotes) setVisitorNotes(d.visitorNotes);
      setVisitorName(user.name || d.visitorName || "");
      setVisitorPhone(user.phone || d.visitorPhone || "");
      setVisitorEmail(user.email || d.visitorEmail || "");
      if (d.purohitId && purohits.length > 0) {
        const match = purohits.find(p => p.id === d.purohitId);
        if (match) setSelectedPurohit(match);
      }
    }
  }, [user, pendingBooking, purohits]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth({
      type: "CEREMONY",
      listingId: selectedPurohit?.id,
      title: `Ceremony · ${selectedPurohit?.fullName || "Purohit"}`,
      details: `${bookingCeremonyType} · ${bookingDate} ${selectedSlot ? `at ${selectedSlot.startTime}` : ""}`,
      data: {
        purohitId: selectedPurohit?.id,
        bookingDate,
        bookingCeremonyType,
        selectedSlot,
        visitorName,
        visitorPhone,
        visitorEmail,
        gotra,
        deceasedRelationship,
        participantCount,
        ceremonyLocation,
        locationAddress,
        customaryRequirements,
        visitorNotes,
      },
      returnView: { name: "ceremonies", purohitId: selectedPurohit?.id },
    }, (authenticatedUser) => {
      setVisitorName(authenticatedUser.name || visitorName);
      setVisitorPhone(authenticatedUser.phone || visitorPhone);
      setVisitorEmail(authenticatedUser.email || visitorEmail);
      toast({
        title: "Authenticated",
        description: "Please review your ceremony details and click 'Confirm & Book Ceremony' to submit.",
      });
    })) {
      return;
    }

    if (!selectedPurohit || !selectedSlot) {
      toast({
        title: "Selection required",
        description: "Please select an available time slot.",
        variant: "destructive",
      });
      return;
    }

    if (!visitorName.trim() || !visitorPhone.trim()) {
      toast({
        title: "Required information",
        description: "Please provide your contact name and phone number.",
        variant: "destructive",
      });
      return;
    }

    const ceremonyMeta = CEREMONY_TYPES.find(c => c.id === bookingCeremonyType || c.label === bookingCeremonyType);
    const duration = ceremonyMeta?.duration || 60;

    const isHomeOrHotel = ceremonyLocation.includes("Hotel") || ceremonyLocation.includes("Residence");
    const isTemple = ceremonyLocation.toLowerCase().includes("temple") || ceremonyLocation.toLowerCase().includes("kshetram");
    const locationType: "GHAT" | "HOME_HOTEL" | "TEMPLE" = isHomeOrHotel ? "HOME_HOTEL" : (isTemple ? "TEMPLE" : "GHAT");
    const resolvedLocationAddress = isHomeOrHotel
      ? (locationAddress.trim() || ceremonyLocation)
      : ceremonyLocation;

    setSubmittingBooking(true);
    try {
      const payload: CeremonyBookingRequest = {
        purohitId: selectedPurohit.id,
        ceremonyType: bookingCeremonyType,
        bookingDate,
        startTime: selectedSlot.startTime,
        durationMinutes: duration,
        visitorName: visitorName.trim(),
        visitorPhone: visitorPhone.trim(),
        visitorEmail: visitorEmail.trim() || null,
        ceremonyLocation,
        locationType,
        locationAddress: resolvedLocationAddress,
        gotra: gotra.trim() || null,
        deceasedRelationship: deceasedRelationship.trim() || null,
        participantCount: Number(participantCount) || 1,
        participantsCount: Number(participantCount) || 1,
        customaryRequirements: customaryRequirements.trim() || null,
        visitorNotes: visitorNotes.trim() || null,
      };

      const res = await api.post<{ success: boolean; booking: any; message: string }>(
        "/ceremonies/bookings",
        payload
      );

      toast({
        title: "Ceremony Requested Successfully",
        description: `Reference #${res.booking.bookingReference} reserved.`,
      });

      setConfirmedBooking(res.booking);
      setSelectedPurohit(null);
    } catch (err: any) {
      toast({
        title: "Booking Failed",
        description: err.message || "This slot may have just been booked. Please choose another slot.",
        variant: "destructive",
      });
      // Re-trigger availability fetch to update slots
      if (selectedPurohit) {
        const ceremonyMeta = CEREMONY_TYPES.find(c => c.id === bookingCeremonyType || c.label === bookingCeremonyType);
        const duration = ceremonyMeta?.duration || 60;
        const fresh = await api.get<{ availableSlots: AvailableSlot[] }>(
          `/ceremonies/purohits/${selectedPurohit.id}/availability?date=${bookingDate}&duration=${duration}`
        );
        setAvailableSlots(fresh.availableSlots || []);
      }
    } finally {
      setSubmittingBooking(false);
    }
  };

  const selectedCeremonyMeta = CEREMONY_TYPES.find(c => c.id === bookingCeremonyType || c.label === bookingCeremonyType);

  return (
    <div className="flex-1 container mx-auto max-w-7xl px-4 py-8">
      {/* Hero & Cultural Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-900 via-orange-800 to-amber-950 text-white p-8 md:p-12 mb-8 shadow-xl border border-amber-700/40">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-semibold mb-4 backdrop-blur-sm">
            <Flame className="size-3.5 text-amber-400" />
            <span>గోదావరి తీర పితృ తర్పణ & సంస్కార సేవలు · Ancestral Ceremonies & Rites</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            Ceremony Management & Vedic Purohit Directory
          </h1>
          <p className="text-amber-100/90 text-sm md:text-base leading-relaxed">
            Connect with qualified, verified Vedic Purohits for ancestral ceremonies, Pinda Pradanam,
            Pitru Tarpana, Pushkara Snanam sankalpams, and sacred rites at the sanctified ghats of River Godavari.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 pointer-events-none bg-radial from-amber-300 to-transparent blur-2xl" />
      </div>

      {/* Search & Filters */}
      <Card className="mb-8 shadow-sm border-border/70">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search purohit by name or area..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div>
              <Select value={selectedCeremony} onValueChange={setSelectedCeremony}>
                <SelectTrigger>
                  <SelectValue placeholder="All Ceremony Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Ceremonies</SelectItem>
                  {CEREMONY_TYPES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label} ({c.teLabel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger>
                  <SelectValue placeholder="All Ghat Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Ghats & Areas</SelectItem>
                  {CEREMONY_LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="All Languages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Languages</SelectItem>
                  {CEREMONY_LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick ceremony category pills */}
          <div className="flex gap-2 overflow-x-auto nice-scroll pt-2 border-t">
            <Button
              variant={selectedCeremony === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCeremony("ALL")}
              className="text-xs h-8 whitespace-nowrap"
            >
              All Ceremonies
            </Button>
            {CEREMONY_TYPES.map((c) => (
              <Button
                key={c.id}
                variant={selectedCeremony === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCeremony(c.id)}
                className="text-xs h-8 whitespace-nowrap"
              >
                {c.label.split(" (")[0]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Purohit Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : purohits.length === 0 ? (
        <Card className="text-center py-16 px-4">
          <CardContent className="space-y-4">
            <Flame className="size-12 mx-auto text-muted-foreground/60" />
            <h3 className="text-lg font-semibold">No Verified Purohits Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No verified and published purohits match your filter criteria. Try clearing filters or searching another ghat area.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setSelectedArea("ALL");
                setSelectedLanguage("ALL");
                setSelectedCeremony("ALL");
              }}
            >
              Reset All Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purohits.map((purohit) => (
            <Card key={purohit.id} className="flex flex-col overflow-hidden hover:border-amber-500/60 transition-all shadow-sm">
              <CardHeader className="pb-3 bg-muted/20 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-14 rounded-full bg-amber-100 text-amber-800 border-2 border-amber-300 font-bold flex items-center justify-center text-lg shadow-sm shrink-0 overflow-hidden">
                      {purohit.profilePhoto ? (
                        <img src={purohit.profilePhoto} alt={purohit.fullName} className="w-full h-full object-cover" />
                      ) : (
                        purohit.fullName?.charAt(0) || "P"
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-1.5">
                        {purohit.fullName}
                      </CardTitle>
                      <div className="flex items-center gap-1 text-xs text-amber-700 font-medium mt-0.5">
                        <ShieldCheck className="size-3.5 text-amber-600" />
                        <span>Verified Vedic Scholar</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300 text-xs shrink-0">
                    {purohit.experienceYears}y Exp
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 flex-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <MapPin className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{purohit.serviceArea}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Globe2 className="size-3.5 shrink-0 text-primary" />
                  <span>Languages: {purohit.languages?.join(", ") || "Telugu, Sanskrit"}</span>
                </div>

                {purohit.qualifications && (
                  <p className="text-xs text-muted-foreground line-clamp-2 italic bg-muted/30 p-2 rounded">
                    "{purohit.qualifications}"
                  </p>
                )}

                <div className="space-y-1 pt-1">
                  <p className="text-xs font-semibold text-foreground">Ceremonies Performed:</p>
                  <div className="flex flex-wrap gap-1">
                    {purohit.ceremonies?.slice(0, 3).map((cId) => {
                      const cMeta = CEREMONY_TYPES.find(c => c.id === cId || c.label === cId);
                      return (
                        <span key={cId} className="px-2 py-0.5 rounded bg-muted text-[11px] font-medium text-foreground">
                          {cMeta ? cMeta.label.split(" (")[0] : cId}
                        </span>
                      );
                    })}
                    {purohit.ceremonies?.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                        +{purohit.ceremonies.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {purohit.includedServices && (
                  <div className="text-xs text-muted-foreground pt-1">
                    <span className="font-semibold text-foreground">Includes: </span>
                    <span className="line-clamp-1">{purohit.includedServices}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-4 pt-0 border-t bg-muted/10 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground">Starting Dakshina</p>
                  <p className="text-base font-bold text-amber-900">₹{purohit.baseFee.toLocaleString("en-IN")}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => startBooking(purohit)}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-medium shadow-sm"
                >
                  <Flame className="size-3.5 mr-1 text-amber-300" />
                  Book Ceremony
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Booking Form Modal */}
      {selectedPurohit && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedPurohit(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto nice-scroll">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Flame className="size-5 text-amber-600" />
                Book Ceremony with {selectedPurohit.fullName}
              </DialogTitle>
              <DialogDescription>
                Select your preferred ceremony, date, and verified available time slot on the sanctified Godavari ghat.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleBookingSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ceremony Type *</Label>
                  <Select value={bookingCeremonyType} onValueChange={setBookingCeremonyType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedPurohit.ceremonies.map((cId) => {
                        const meta = CEREMONY_TYPES.find(c => c.id === cId || c.label === cId);
                        return (
                          <SelectItem key={cId} value={cId}>
                            {meta?.label || cId} (~{meta?.duration || 60}m)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Preferred Date *</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Time Slot Picker */}
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="size-3.5 text-primary" />
                    Available Time Slots on {bookingDate} ({selectedCeremonyMeta?.duration || 60} mins)
                  </Label>
                  {loadingSlots && <span className="text-xs text-muted-foreground animate-pulse">Checking availability...</span>}
                </div>

                {loadingSlots ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 rounded-md" />
                    ))}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-xs text-amber-700 py-3 text-center">
                    No open time slots available for this purohit on {bookingDate}. Please pick another date or purohit.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot?.startTime === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => slot.isAvailable && setSelectedSlot(slot)}
                          className={`px-3 py-2 text-xs rounded-md font-medium border text-center transition-all ${
                            !slot.isAvailable
                              ? "bg-muted/40 text-muted-foreground/50 border-transparent cursor-not-allowed line-through"
                              : isSelected
                              ? "bg-amber-700 text-white border-amber-800 shadow-sm"
                              : "bg-background hover:bg-amber-50 hover:border-amber-300 text-foreground"
                          }`}
                        >
                          {slot.startTime} - {slot.endTime}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedSlot && (
                  <p className="text-xs text-emerald-700 font-medium pt-1">
                    Selected slot: {selectedSlot.startTime} to {selectedSlot.endTime} (IST)
                  </p>
                )}
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ceremony Location *</Label>
                  <Select value={ceremonyLocation} onValueChange={setCeremonyLocation}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CEREMONY_LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Number of Participants</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={participantCount}
                    onChange={(e) => setParticipantCount(Number(e.target.value) || 1)}
                  />
                </div>
              </div>

              {(ceremonyLocation.includes("Hotel") || ceremonyLocation.includes("Residence")) && (
                <div className="space-y-1.5">
                  <Label>Exact Address / Room Details *</Label>
                  <Input
                    placeholder="Full address of hotel or residence where ceremony will take place..."
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Visitor Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Your Full Name *</Label>
                  <Input
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Phone Number *</Label>
                  <Input
                    type="tel"
                    placeholder="+91 / Country Code + Phone"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Gotra (Optional, for Sankalpam)</Label>
                  <Input
                    placeholder="e.g., Kasyapa, Bharadwaja, etc."
                    value={gotra}
                    onChange={(e) => setGotra(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ancestor Relationship (Optional)</Label>
                  <Input
                    placeholder="e.g., Grandfather, Parents, Ancestors"
                    value={deceasedRelationship}
                    onChange={(e) => setDeceasedRelationship(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Customary Requirements / Specific Rites</Label>
                <Textarea
                  placeholder="Mention any specific traditions, rituals, or samagri questions..."
                  value={customaryRequirements}
                  onChange={(e) => setCustomaryRequirements(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Fee Notice */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold text-amber-950">
                  <span>Standard Service Fee / Dakshina:</span>
                  <span className="text-sm">₹{selectedCeremonyMeta?.defaultFee || selectedPurohit.baseFee}</span>
                </div>
                <p className="text-amber-800">
                  Includes: {selectedPurohit.includedServices || "Purohit sankalpam, traditional vedic mantras, puja guidance."}
                </p>
                <p className="text-amber-700 italic">
                  * Note: Fee is payable directly upon ceremony completion or as confirmed with the purohit. No advance payment is charged online.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedPurohit(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingBooking || !selectedSlot}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-medium"
                >
                  {submittingBooking ? "Reserving Slot..." : "Confirm Ceremony Booking"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Screen Dialog */}
      {confirmedBooking && (
        <Dialog open={true} onOpenChange={() => setConfirmedBooking(null)}>
          <DialogContent className="max-w-md text-center space-y-4">
            <div className="size-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center mx-auto shadow-sm">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Ceremony Scheduled!</DialogTitle>
              <DialogDescription className="mt-1">
                Your ceremony request has been submitted to Vedic Purohit {confirmedBooking.purohit?.fullName}.
              </DialogDescription>
            </div>

            <div className="bg-muted/40 p-4 rounded-xl text-left text-xs space-y-2 border">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Booking Reference:</span>
                <span className="font-mono font-bold text-foreground">{confirmedBooking.bookingReference}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Ceremony:</span>
                <span className="font-medium text-foreground">{confirmedBooking.ceremonyType}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Date & Time:</span>
                <span className="font-medium text-foreground">
                  {confirmedBooking.bookingDate} at {confirmedBooking.startTime} ({confirmedBooking.durationMinutes}m)
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium text-foreground truncate max-w-[200px]">{confirmedBooking.ceremonyLocation}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                  {confirmedBooking.status}
                </Badge>
              </div>
              <div className="flex justify-between pt-1 font-semibold">
                <span className="text-muted-foreground">Agreed Dakshina:</span>
                <span className="text-amber-900">₹{confirmedBooking.serviceFee}</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              The Purohit has been notified. You can track this booking, view instructions, and check status updates in your account dashboard.
            </p>

            <DialogFooter className="flex sm:justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmedBooking(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setConfirmedBooking(null);
                  navigate({ name: "bookings" });
                }}
              >
                View My Bookings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

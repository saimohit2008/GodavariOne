"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { useBookingAuth } from "../booking-auth-modal";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Users, Calendar, MapPin, Building, Utensils, Sparkles, CheckCircle2,
  ShieldCheck, ArrowRight, Plane, Globe, Compass, Landmark, Phone, Mail,
  Search, AlertCircle, Clock, FileText, ChevronRight, Home, ArrowLeft, ExternalLink,
  Info, BellRing, Car, Flame, Check, XCircle,
} from "lucide-react";
import {
  NRI_MIN_GROUP_SIZE,
  NRI_MAX_GROUP_SIZE,
  NRI_STANDARD_PACKAGE_SERVICES,
  formatNriCurrency,
} from "@/lib/nri-constants";

const AIRPORT_RAILWAY_HUBS = [
  { value: "Rajahmundry Airport (RJA)", label: "Rajahmundry Airport (RJA) — Nearest Hub (15 km)" },
  { value: "Rajahmundry Railway Station (RJY)", label: "Rajahmundry Railway Station (RJY) — Central (3 km)" },
  { value: "Samalkot Junction (SLO)", label: "Samalkot Railway Junction (SLO) (45 km)" },
  { value: "Vijayawada Airport (VGA)", label: "Vijayawada International Airport (VGA) (150 km)" },
  { value: "Visakhapatnam Airport (VTZ)", label: "Visakhapatnam Airport (VTZ) (190 km)" },
  { value: "Hyderabad Airport (HYD)", label: "Hyderabad Rajiv Gandhi Airport (HYD) — Connecting Hub" },
];

const ACCOMMODATION_OPTIONS = [
  { value: "LUXURY_RIVERSIDE", label: "Luxury Riverside Resort & Cottages", desc: "Premium river view suites with scenic Godavari backwaters" },
  { value: "PREMIUM_4STAR", label: "Premium 3/4-Star City Hotel", desc: "Centrally located with executive amenities & easy ghat access" },
  { value: "HERITAGE_HAVELI", label: "Traditional Heritage Haveli / Homestay", desc: "Authentic Andhra architectural hospitality with serene courtyard" },
  { value: "TEMPLE_GUESTHOUSE", label: "Devasthanam AC Pilgrim Guest House", desc: "Located directly in temple premises for early morning rituals" },
  { value: "EXECUTIVE_SUITE", label: "Family Executive Multi-Room Suites", desc: "Interconnected deluxe rooms tailored for large family groups" },
];

const DIETARY_OPTIONS = [
  { value: "PURE_VEG", label: "Traditional Pure Vegetarian (Andhra & South Indian)" },
  { value: "SATVIK", label: "Satvik Brahmin Style (No Onion, No Garlic, Freshly Prepared)" },
  { value: "JAIN", label: "Jain Vegetarian (Root-Free Traditional Recipes)" },
  { value: "MULTI_CUISINE", label: "Multi-Cuisine (Vegetarian & Non-Vegetarian Allowed)" },
  { value: "ELDERLY_DIABETIC", label: "Elderly & Diabetic Friendly (Low Spice, Mild & Custom)" },
];

const ROOM_TYPE_OPTIONS = [
  { value: "RIVER_VIEW_SUITE", label: "Riverfront Luxury Suite", desc: "Panoramic view of Godavari river with private balcony" },
  { value: "DELUXE_KING", label: "Executive Deluxe King Room", desc: "Spacious master bedroom with plush king-sized bed" },
  { value: "TWIN_BEDS", label: "Twin Double Beds Room", desc: "Two separate full beds suitable for companions or family" },
  { value: "INTERCONNECTED_FAMILY", label: "Interconnected Family Suites", desc: "Two adjoining rooms with private internal connection" },
];

const TRANSPORT_OPTIONS = [
  { value: "INNOVA_CRYSTA", label: "Toyota Innova Crysta (AC)", desc: "Premium 6/7-seater captain chairs, comfortable highway & ghat travel" },
  { value: "LUXURY_SUV", label: "Luxury SUV (Fortuner / Hycross)", desc: "VIP high-stance air-conditioned SUV with priority parking permits" },
  { value: "TEMPO_TRAVELLER", label: "Luxury AC Tempo Traveller (10-12 Seater)", desc: "Ideal for joint families with extensive luggage space" },
  { value: "PREMIUM_SEDAN", label: "Executive Sedan (Camry / Honda City)", desc: "Smooth comfortable city and ghat transfers for small families" },
];

const CEREMONY_REQUIREMENT_OPTIONS = [
  { value: "PINDA_PRADANAM", label: "Pinda Pradanam & Ancestral Offering (90 mins)" },
  { value: "PITRU_TARPANA", label: "Pitru Tarpana & Pushkara Snanam (60 mins)" },
  { value: "PUSHKARA_SNANAM_SANKALPAM", label: "Pushkara Snanam Maha Sankalpam (45 mins)" },
  { value: "SAMOOHIKA_POOJA", label: "Family Samoohika Pushkara Pooja (90 mins)" },
  { value: "NONE", label: "None / Leisure & General Pilgrimage Only" },
];

const PACKAGE_TYPE_OPTIONS = [
  { value: "LUXURY_RIVERFRONT", label: "Luxury Riverfront Experience", desc: "5-Star Riverside resort, chauffeured SUV, dedicated butler & escort" },
  { value: "PREMIUM_SPIRITUAL", label: "Premium Spiritual Pilgrimage", desc: "Devasthanam VIP darshan, qualified purohit, 4-star boutique stay" },
  { value: "FAMILY_HERITAGE", label: "Joint Family Heritage Journey", desc: "Spacious interconnected suites, multi-generational vehicle, child & elder care" },
  { value: "CUSTOM", label: "Fully Tailored Custom Itinerary", desc: "Bespoke schedule designed with your dedicated NRI Service Coordinator" },
];

const COMMUNICATION_METHODS = [
  { value: "WHATSAPP", label: "WhatsApp (Recommended for fast updates & quotation PDFs)" },
  { value: "EMAIL", label: "Email (Detailed itemized proposals and vouchers)" },
  { value: "PHONE", label: "Phone Call / Direct Voice Coordination" },
];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia",
  "Singapore", "United Arab Emirates", "Germany", "New Zealand",
  "Malaysia", "Qatar", "Saudi Arabia", "Kuwait", "Switzerland", "Other"
];

export function NriPackageRequestForm({ initialRef }: { initialRef?: string }) {
  const { user, navigate, pendingBooking } = useApp();
  const { requireAuth } = useBookingAuth();
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [contentItems, setContentItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"new-request" | "track-request">(initialRef ? "track-request" : "new-request");
  const [lookupRef, setLookupRef] = useState(initialRef || "");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Group Details
  const [groupSize, setGroupSize] = useState(4);
  const [numAdults, setNumAdults] = useState(3);
  const [numChildren, setNumChildren] = useState(1);

  // Travel Dates
  const [arrivalDate, setArrivalDate] = useState("2027-07-15");
  const [departureDate, setDepartureDate] = useState("2027-07-20");
  const [arrivalHub, setArrivalHub] = useState("Rajahmundry Airport (RJA)");
  const [departureHub, setDepartureHub] = useState("Rajahmundry Airport (RJA)");

  // Preferences
  const [accommodationPref, setAccommodationPref] = useState("LUXURY_RIVERSIDE");
  const [preferredRoomType, setPreferredRoomType] = useState("RIVER_VIEW_SUITE");
  const [numRooms, setNumRooms] = useState(2);
  const [dietaryPref, setDietaryPref] = useState("PURE_VEG");
  const [transportRequirements, setTransportRequirements] = useState("INNOVA_CRYSTA");
  const [localGuideRequired, setLocalGuideRequired] = useState(true);
  const [guideLanguage, setGuideLanguage] = useState("English & Telugu");
  const [ceremonyRequirements, setCeremonyRequirements] = useState("PUSHKARA_SNANAM_SANKALPAM");
  const [packageTypePreference, setPackageTypePreference] = useState("LUXURY_RIVERFRONT");
  const [placesToVisit, setPlacesToVisit] = useState("Kotilingala Ghat, Pushkar Ghat, Draksharamam Temple");
  const [preferredGhats, setPreferredGhats] = useState("Kotilingala Ghat & Pushkar Ghat");
  const [preferredTemples, setPreferredTemples] = useState("Kotilingeshwara Temple & Draksharamam Bheemeswara");
  const [specialRequests, setSpecialRequests] = useState("");
  const [preferredItinerary, setPreferredItinerary] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [budgetRange, setBudgetRange] = useState("₹2,50,000 - ₹4,000,000");
  const [targetProviderId, setTargetProviderId] = useState<string>("ALL");

  // Visitor info
  const [visitorName, setVisitorName] = useState(user?.name || "");
  const [visitorEmail, setVisitorEmail] = useState(user?.email || "");
  const [countryCode, setCountryCode] = useState("+1");
  const [visitorPhone, setVisitorPhone] = useState(user?.phone || "");
  const [countryOfResidence, setCountryOfResidence] = useState("United States");
  const [preferredCommunication, setPreferredCommunication] = useState("WHATSAPP");
  const [accessibilityRequirements, setAccessibilityRequirements] = useState("");

  // Providers list for optional direct routing
  const [providers, setProviders] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<any>(null);

  // Calculate duration
  const diffDays = Math.max(1, Math.round((new Date(departureDate).getTime() - new Date(arrivalDate).getTime()) / (1000 * 60 * 60 * 24)));

  useEffect(() => {
    // Keep sum consistent
    if (numAdults + numChildren !== groupSize) {
      if (numAdults > groupSize) {
        setNumAdults(groupSize);
        setNumChildren(0);
      } else {
        setNumChildren(Math.max(0, groupSize - numAdults));
      }
    }
  }, [groupSize]);

  useEffect(() => {
    api.get<{ providers: any[] }>("/nri/providers")
      .then((res) => setProviders(res.providers || []))
      .catch(() => {});

    Promise.all([
      api.get<any>("/nri/config").catch(() => null),
      api.get<{ items: any[] }>("/nri/content").catch(() => ({ items: [] })),
    ]).then(([cfg, cnt]) => {
      if (cfg) setConfig(cfg);
      if (cnt?.items) setContentItems(cnt.items);
    }).finally(() => {
      setConfigLoading(false);
    });
  }, []);

  useEffect(() => {
    if (initialRef) {
      handleLookup(initialRef);
    }
  }, [initialRef]);

  // Restore pending NRI package request on authentication
  useEffect(() => {
    if (user && pendingBooking && pendingBooking.type === "NRI_PACKAGE" && pendingBooking.data) {
      const d = pendingBooking.data;
      if (d.groupSize) setGroupSize(d.groupSize);
      if (d.numAdults) setNumAdults(d.numAdults);
      if (d.numChildren) setNumChildren(d.numChildren);
      if (d.arrivalDate) setArrivalDate(d.arrivalDate);
      if (d.departureDate) setDepartureDate(d.departureDate);
      if (d.arrivalHub) setArrivalHub(d.arrivalHub);
      if (d.departureHub) setDepartureHub(d.departureHub);
      if (d.accommodationPref) setAccommodationPref(d.accommodationPref);
      if (d.preferredRoomType) setPreferredRoomType(d.preferredRoomType);
      if (d.numRooms) setNumRooms(d.numRooms);
      if (d.dietaryPref) setDietaryPref(d.dietaryPref);
      if (d.transportRequirements) setTransportRequirements(d.transportRequirements);
      if (d.localGuideRequired != null) setLocalGuideRequired(d.localGuideRequired);
      if (d.guideLanguage) setGuideLanguage(d.guideLanguage);
      if (d.ceremonyRequirements) setCeremonyRequirements(d.ceremonyRequirements);
      if (d.packageTypePreference) setPackageTypePreference(d.packageTypePreference);
      if (d.placesToVisit) setPlacesToVisit(d.placesToVisit);
      if (d.preferredGhats) setPreferredGhats(d.preferredGhats);
      if (d.preferredTemples) setPreferredTemples(d.preferredTemples);
      if (d.specialRequests) setSpecialRequests(d.specialRequests);
      if (d.preferredItinerary) setPreferredItinerary(d.preferredItinerary);
      if (d.additionalInstructions) setAdditionalInstructions(d.additionalInstructions);
      if (d.budgetRange) setBudgetRange(d.budgetRange);
      if (d.targetProviderId) setTargetProviderId(d.targetProviderId);
      if (d.countryOfResidence) setCountryOfResidence(d.countryOfResidence);
      if (d.preferredCommunication) setPreferredCommunication(d.preferredCommunication);
      if (d.accessibilityRequirements) setAccessibilityRequirements(d.accessibilityRequirements);
      setVisitorName(user.name || d.visitorName || "");
      setVisitorEmail(user.email || d.visitorEmail || "");
      setVisitorPhone(user.phone || d.visitorPhone || "");
    }
  }, [user, pendingBooking]);

  // Tracking actions state
  const [revisionQuote, setRevisionQuote] = useState<any | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [declineQuote, setDeclineQuote] = useState<any | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [itineraryItems, setItineraryItems] = useState<any[]>([]);

  async function handleLookup(ref: string) {
    if (!ref.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    setItineraryItems([]);
    try {
      const res = await api.get<{ item: any }>(`/nri/requests?referenceNumber=${encodeURIComponent(ref.trim())}`);
      setLookupResult(res.item);
      if (res.item?.id && ["CONFIRMED", "QUOTATION_ACCEPTED", "IN_PROGRESS"].includes(res.item.status)) {
        try {
          const coord = await api.get<{ items: any[] }>(`/nri/requests/${res.item.id}/coordination`);
          setItineraryItems(coord.items || []);
        } catch {}
      }
    } catch (err: any) {
      toast({
        title: "Request not found",
        description: err instanceof ApiError ? err.message : "No request found matching this reference number.",
        variant: "destructive",
      });
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleAcceptQuotation(quoteId: string) {
    if (!lookupResult) return;
    if (!requireAuth({
      type: "NRI_PACKAGE",
      title: "Accept NRI Package Quotation",
      details: `Reference #${lookupResult.referenceNumber}`,
      returnView: { name: "nri-access", ref: lookupResult.referenceNumber },
    }, () => handleAcceptQuotation(quoteId))) {
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/nri/quotations/${quoteId}/accept`, {
        referenceNumber: lookupResult.referenceNumber,
        visitorEmail: lookupResult.visitorEmail,
      });
      toast({
        title: "Quotation Accepted",
        description: "Your coordinator has been notified to proceed with trip coordination.",
      });
      handleLookup(lookupResult.referenceNumber);
    } catch (err: any) {
      toast({
        title: "Acceptance failed",
        description: err.message || "Failed to accept quotation",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestRevision() {
    if (!revisionQuote || !lookupResult) return;
    setActionLoading(true);
    try {
      await api.post(`/nri/quotations/${revisionQuote.id}/request-revision`, {
        revisionNotes: revisionNotes.trim(),
      });
      toast({
        title: "Revision Requested",
        description: "Your change request has been sent to your NRI Service Manager.",
      });
      setRevisionQuote(null);
      setRevisionNotes("");
      handleLookup(lookupResult.referenceNumber);
    } catch (err: any) {
      toast({
        title: "Request failed",
        description: err.message || "Failed to request revision",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeclineQuotation() {
    if (!declineQuote || !lookupResult) return;
    setActionLoading(true);
    try {
      await api.post(`/nri/quotations/${declineQuote.id}/decline`, {
        reason: declineReason.trim(),
      });
      toast({
        title: "Quotation Declined",
        description: "Your coordinator has been notified.",
      });
      setDeclineQuote(null);
      setDeclineReason("");
      handleLookup(lookupResult.referenceNumber);
    } catch (err: any) {
      toast({
        title: "Decline failed",
        description: err.message || "Failed to decline quotation",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelTrip() {
    if (!lookupResult) return;
    setActionLoading(true);
    try {
      await api.patch(`/nri/requests/${lookupResult.id}`, {
        status: "CANCELLED",
        cancellationReason: cancellationReason.trim() || "Cancelled by visitor",
      });
      toast({
        title: "Trip Request Cancelled",
        description: "Your trip request has been marked as cancelled.",
      });
      setCancelModalOpen(false);
      setCancellationReason("");
      handleLookup(lookupResult.referenceNumber);
    } catch (err: any) {
      toast({
        title: "Cancellation failed",
        description: err.message || "Failed to cancel request",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (groupSize < NRI_MIN_GROUP_SIZE || groupSize > NRI_MAX_GROUP_SIZE) {
      toast({ title: "Invalid group size", description: `Please choose between ${NRI_MIN_GROUP_SIZE} and ${NRI_MAX_GROUP_SIZE} travelers.`, variant: "destructive" });
      return;
    }

    if (numAdults + numChildren !== groupSize) {
      toast({ title: "Invalid head count", description: "Adults + Children count must equal total travelers.", variant: "destructive" });
      return;
    }

    if (departureDate < arrivalDate) {
      toast({ title: "Invalid travel dates", description: "Departure date must be after arrival date.", variant: "destructive" });
      return;
    }

    if (!requireAuth({
      type: "NRI_PACKAGE",
      title: "NRI Custom Pilgrimage Package",
      details: `${groupSize} travelers (${numAdults} adults, ${numChildren} children) · ${arrivalDate} to ${departureDate}`,
      data: {
        groupSize,
        numAdults,
        numChildren,
        arrivalDate,
        departureDate,
        arrivalHub,
        departureHub,
        accommodationPref,
        preferredRoomType,
        numRooms,
        dietaryPref,
        transportRequirements,
        localGuideRequired,
        guideLanguage,
        ceremonyRequirements,
        packageTypePreference,
        placesToVisit,
        preferredGhats,
        preferredTemples,
        specialRequests,
        preferredItinerary,
        additionalInstructions,
        budgetRange,
        targetProviderId,
        visitorName,
        visitorEmail,
        countryCode,
        visitorPhone,
        countryOfResidence,
        preferredCommunication,
        accessibilityRequirements,
      },
      returnView: { name: "nri-access" },
    }, (authenticatedUser) => {
      setVisitorName(authenticatedUser.name || visitorName);
      setVisitorEmail(authenticatedUser.email || visitorEmail);
      setVisitorPhone(authenticatedUser.phone || visitorPhone);
      toast({
        title: "Authenticated",
        description: "Please review your package request details and click 'Submit Custom Package Request' to confirm.",
      });
    })) {
      return;
    }

    setSubmitting(true);
    try {
      const formattedPhone = visitorPhone.startsWith("+") ? visitorPhone : `${countryCode} ${visitorPhone}`;
      const diffD = Math.max(1, Math.round((new Date(departureDate).getTime() - new Date(arrivalDate).getTime()) / (1000 * 60 * 60 * 24)));
      const payload = {
        groupSize,
        numAdults,
        numChildren,
        arrivalDate,
        departureDate,
        daysCount: diffD + 1,
        nightsCount: diffD,
        arrivalLocation: arrivalHub,
        departureLocation: departureHub,
        accommodationPreference: accommodationPref,
        preferredRoomType,
        numRooms,
        dietaryPreference: dietaryPref,
        transportRequirements,
        localGuideRequired,
        guideLanguage: localGuideRequired ? guideLanguage : null,
        ceremonyRequirements,
        packageTypePreference,
        placesToVisit: placesToVisit.trim() || null,
        preferredGhats: preferredGhats.trim() || null,
        preferredTemples: preferredTemples.trim() || null,
        specialRequests: specialRequests.trim() || null,
        preferredItinerary: preferredItinerary.trim() || null,
        additionalInstructions: additionalInstructions.trim() || null,
        budgetRange: budgetRange.trim() || null,
        currency: "INR",
        visitorName: visitorName.trim(),
        visitorEmail: visitorEmail.trim(),
        visitorPhone: formattedPhone,
        countryOfResidence,
        preferredCommunication,
        accessibilityRequirements: accessibilityRequirements.trim() || null,
        targetProviderId: targetProviderId === "ALL" ? null : targetProviderId,
      };

      const res = await api.post<{ ok: boolean; request: any; referenceNumber: string; message: string }>("/nri/requests", payload);
      setSubmittedRequest(res.request);
      toast({
        title: "Quotation Request Submitted!",
        description: `Reference #${res.referenceNumber}. Your request has been routed to verified partners.`,
      });
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err instanceof ApiError ? err.message : "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!configLoading && config && config.isEnabled === false) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6 py-12 text-center animate-in fade-in-50">
        <div className="size-20 rounded-full bg-amber-500/10 text-amber-600 grid place-items-center mx-auto border border-amber-500/20">
          <AlertCircle className="size-10" />
        </div>
        <div className="space-y-2">
          <Badge variant="outline" className="text-amber-700 border-amber-300">Portal Advisory</Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">NRI & International Pilgrims Portal Inactive</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            {config.welcomeMessage || "The NRI Access section is currently offline for scheduled administrative review. Public directory listings and emergency services remain active."}
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-card max-w-md mx-auto text-xs text-muted-foreground space-y-2 text-left">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Phone className="size-3.5 text-primary" /> Urgent Inquiries & Pushkara Helpline:
          </p>
          <p>Helpline: {config.supportPhone || "+91 883 2450000 / 14500"}</p>
          <p>Email: {config.supportEmail || "nri-desk@godavarione.ap.gov.in"}</p>
        </div>
        <div className="pt-4 flex justify-center gap-3">
          <Button
            size="lg"
            onClick={() => navigate({ name: "home" })}
            className="font-bold gap-2 shadow-sm"
            id="nri-disabled-back-to-home"
          >
            <Home className="size-4" /> Back to Main Homepage
          </Button>
        </div>
      </div>
    );
  }

  if (submittedRequest) {
    return (
      <Card className="max-w-3xl mx-auto shadow-xl border-teal-200 dark:border-teal-900 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-800 text-white p-8 text-center">
          <div className="size-16 rounded-full bg-white/20 text-white grid place-items-center mx-auto mb-4 border border-white/30">
            <CheckCircle2 className="size-9 text-emerald-300" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Custom Package Request Submitted!</h2>
          <p className="text-teal-100 text-sm mt-1 max-w-md mx-auto">
            Your Pushkaralu 2027 all-inclusive itinerary request is securely recorded and routed to authorized regional operators.
          </p>
          <div className="mt-6 inline-block bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/20">
            <span className="text-xs uppercase tracking-wider text-teal-200 block font-semibold">Reference Number</span>
            <span className="text-3xl font-mono font-bold tracking-wider text-amber-300">{submittedRequest.referenceNumber}</span>
          </div>
        </div>

        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Primary Contact</span>
              <span className="font-semibold text-foreground">{submittedRequest.visitorName}</span>
              <span className="text-muted-foreground block text-xs mt-0.5">{submittedRequest.visitorEmail} · {submittedRequest.visitorPhone}</span>
              <span className="text-muted-foreground block text-xs mt-0.5">Origin: {submittedRequest.countryOfResidence}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Group & Schedule</span>
              <span className="font-semibold text-foreground">{submittedRequest.groupSize} Travelers ({submittedRequest.numAdults} Adults, {submittedRequest.numChildren} Children)</span>
              <span className="text-muted-foreground block text-xs mt-0.5">{submittedRequest.arrivalDate} → {submittedRequest.departureDate} ({diffDays} days)</span>
              <span className="text-muted-foreground block text-xs mt-0.5">Hub: {submittedRequest.arrivalLocation}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-teal-600" /> What Happens Next:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg border bg-card">
                <span className="size-6 rounded-full bg-teal-100 text-teal-800 font-bold grid place-items-center mb-2">1</span>
                <p className="font-semibold text-foreground">Operator Review</p>
                <p className="text-muted-foreground mt-1">Verified travel operators inspect room inventory, VIP vehicle permits, and holy bath schedule.</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="size-6 rounded-full bg-teal-100 text-teal-800 font-bold grid place-items-center mb-2">2</span>
                <p className="font-semibold text-foreground">Quotation Proposals</p>
                <p className="text-muted-foreground mt-1">You will receive complete proposed packages with itemized prices in ₹ INR and day-by-day plans.</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="size-6 rounded-full bg-teal-100 text-teal-800 font-bold grid place-items-center mb-2">3</span>
                <p className="font-semibold text-foreground">Accept & Confirm</p>
                <p className="text-muted-foreground mt-1">Accept the best package. The provider verifies room & car bookings to finalize your trip.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white font-semibold"
              onClick={() => {
                setLookupRef(submittedRequest.referenceNumber);
                setActiveTab("track-request");
                handleLookup(submittedRequest.referenceNumber);
                setSubmittedRequest(null);
              }}
            >
              Track This Request Now <ArrowRight className="size-4 ml-1.5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ name: "home" })}
              className="flex-1 font-semibold gap-1.5"
              id="nri-submitted-back-to-home"
            >
              <Home className="size-4" /> Return to Homepage
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSubmittedRequest(null);
              }}
            >
              Submit Another Request
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const notices = contentItems.filter((item) => item.type === "NOTICE" || item.type === "ANNOUNCEMENT");
  const services = contentItems.filter((item) => item.type === "SERVICE" || item.type === "CARD");

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Visible Back to Main Homepage Bar */}
      <div className="flex items-center justify-between pb-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ name: "home" })}
          className="gap-2 font-semibold text-primary hover:text-primary/90 shadow-xs"
          id="nri-form-back-to-home"
        >
          <ArrowLeft className="size-4" /> Back to Main Homepage
        </Button>
        {config?.helplineHours && (
          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 font-medium">
            <Clock className="size-3.5 text-teal-600" /> {config.helplineHours}
          </span>
        )}
      </div>

      {/* Published NRI Notices & Announcements */}
      {notices.length > 0 && (
        <div className="space-y-3">
          {notices.map((n) => (
            <div
              key={n.id}
              className="p-4 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-xs"
            >
              <BellRing className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground">{n.title}</span>
                  {n.badgeText && (
                    <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-400 bg-amber-100/50">
                      {n.badgeText}
                    </Badge>
                  )}
                </div>
                {n.subtitle && <p className="text-[11px] font-medium text-amber-900/80 mt-0.5">{n.subtitle}</p>}
                {n.description && <p className="text-muted-foreground mt-1 leading-relaxed">{n.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hero Banner for NRI Page */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-teal-800 via-teal-900 to-cyan-900 text-white p-6 md:p-10 shadow-lg border border-teal-700/50">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none hidden lg:block bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 via-teal-300 to-transparent" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <Badge className="bg-amber-400 text-amber-950 font-bold border-none text-xs px-3 py-1">
            <Globe className="size-3.5 mr-1.5" /> NRI & Global Pilgrims Exclusive Portal
          </Badge>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
            {config?.heroTitle || "Curated All-Inclusive Pilgrimage Packages for Godavari Pushkaralu 2027"}
          </h1>
          <p className="text-teal-100 text-sm md:text-base leading-relaxed">
            {config?.heroDescription || "Experience the divine Maha Pushkaralu without logistics stress. Receive transparent, itemized quotations covering private airport pickup, riverside luxury accommodation, VIP Pushkara snanam passes, and chauffeured transit."}
          </p>
          {config?.welcomeMessage && (
            <p className="text-xs text-teal-200/90 italic pt-1 border-t border-teal-700/50">
              {config.welcomeMessage}
            </p>
          )}
        </div>
      </div>

      {/* Managed Services & Cards Grid */}
      {services.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-teal-600" /> Exclusive NRI Pilgrimage Services & Amenities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {services.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border bg-card shadow-xs flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="size-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 grid place-items-center font-bold">
                      <Sparkles className="size-4" />
                    </span>
                    {s.badgeText && (
                      <Badge variant="outline" className="text-[10px] text-teal-700 border-teal-300">
                        {s.badgeText}
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-foreground">{s.title}</h4>
                  {s.subtitle && <p className="text-[11px] text-teal-600 font-medium">{s.subtitle}</p>}
                  {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{s.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <div className="flex justify-center mb-6 w-full max-w-full px-1">
          <TabsList className="w-full max-w-md grid grid-cols-2 h-auto p-1 bg-muted border">
            <TabsTrigger
              value="new-request"
              className="text-xs sm:text-sm px-2 sm:px-4 py-2 font-semibold flex items-center justify-center text-center gap-1.5 whitespace-normal sm:whitespace-nowrap h-auto min-h-9"
            >
              <Compass className="size-4 shrink-0" />
              <span>Request Custom Package</span>
            </TabsTrigger>
            <TabsTrigger
              value="track-request"
              className="text-xs sm:text-sm px-2 sm:px-4 py-2 font-semibold flex items-center justify-center text-center gap-1.5 whitespace-normal sm:whitespace-nowrap h-auto min-h-9"
            >
              <Search className="size-4 shrink-0" />
              <span>Track Existing Request</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: NEW REQUEST */}
        <TabsContent value="new-request" className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Group Size & Travel Schedule */}
            <Card className="border-teal-100 dark:border-teal-900 shadow-sm">
              <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-full bg-teal-600 text-white text-xs font-bold grid place-items-center">1</span>
                  <CardTitle className="text-lg">Group Size & Travel Schedule</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Minimum 2 people, maximum 10 people for personalized private VIP coordination.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Group size stepper */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Users className="size-4 text-teal-600" /> Total People Travelling
                    </Label>
                    <Badge variant="outline" className="text-teal-700 border-teal-300 font-mono text-sm px-3 py-0.5 font-bold">
                      {groupSize} Travelers
                    </Badge>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-9 gap-2">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        variant={groupSize === num ? "default" : "outline"}
                        className={`h-12 font-bold text-base ${
                          groupSize === num
                            ? "bg-teal-700 hover:bg-teal-800 text-white shadow-sm ring-2 ring-teal-500/30"
                            : "hover:bg-teal-50 dark:hover:bg-teal-950/40 text-foreground"
                        }`}
                        onClick={() => setGroupSize(num)}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    * Groups of 2 to 10 travelers ensure dedicated private transport and priority ghat escorting.
                  </p>
                </div>

                {/* Adults and Children breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground block mb-1.5">Number of Adults (12+ yrs)</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="size-8 p-0"
                        disabled={numAdults <= 1}
                        onClick={() => {
                          const next = Math.max(1, numAdults - 1);
                          setNumAdults(next);
                          setNumChildren(groupSize - next);
                        }}
                      >
                        -
                      </Button>
                      <span className="font-bold text-lg min-w-8 text-center">{numAdults}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="size-8 p-0"
                        disabled={numAdults >= groupSize}
                        onClick={() => {
                          const next = Math.min(groupSize, numAdults + 1);
                          setNumAdults(next);
                          setNumChildren(groupSize - next);
                        }}
                      >
                        +
                      </Button>
                      <span className="text-xs text-muted-foreground ml-2">Adult travelers</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground block mb-1.5">Number of Children (Under 12 yrs)</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="size-8 p-0"
                        disabled={numChildren <= 0}
                        onClick={() => {
                          const next = Math.max(0, numChildren - 1);
                          setNumChildren(next);
                          setNumAdults(groupSize - next);
                        }}
                      >
                        -
                      </Button>
                      <span className="font-bold text-lg min-w-8 text-center">{numChildren}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="size-8 p-0"
                        disabled={numChildren >= groupSize - 1}
                        onClick={() => {
                          const next = Math.min(groupSize - 1, numChildren + 1);
                          setNumChildren(next);
                          setNumAdults(groupSize - next);
                        }}
                      >
                        +
                      </Button>
                      <span className="text-xs text-muted-foreground ml-2">Children</span>
                    </div>
                  </div>
                </div>

                {/* Dates & Hubs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                      <Calendar className="size-3.5 text-teal-600" /> Expected Arrival Date
                    </Label>
                    <Input
                      type="date"
                      value={arrivalDate}
                      onChange={(e) => setArrivalDate(e.target.value)}
                      className="bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                      <Calendar className="size-3.5 text-teal-600" /> Expected Departure Date
                    </Label>
                    <Input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="bg-card"
                    />
                  </div>
                </div>

                {/* Duration indicator */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200">
                  <span className="font-semibold">Calculated Trip Duration:</span>
                  <Badge variant="outline" className="font-mono bg-teal-100 text-teal-800 border-teal-300 font-bold">
                    {diffDays + 1} Days / {diffDays} Nights
                  </Badge>
                </div>

                {/* Places, Ghats & Temples */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                      <Landmark className="size-3.5 text-teal-600" /> Preferred Ghats & Holy Bath Locations
                    </Label>
                    <Input
                      placeholder="e.g. Kotilingala Ghat, Pushkar Ghat, Saraswati Ghat"
                      value={preferredGhats}
                      onChange={(e) => setPreferredGhats(e.target.value)}
                      className="bg-card text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                      <Landmark className="size-3.5 text-teal-600" /> Preferred Temples & Sacred Kshetrams
                    </Label>
                    <Input
                      placeholder="e.g. Kotilingeshwara Swamy, Draksharamam, Annavaram"
                      value={preferredTemples}
                      onChange={(e) => setPreferredTemples(e.target.value)}
                      className="bg-card text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                      <Plane className="size-3.5 text-teal-600" /> Pickup Hub (Airport or Railway Station)
                    </Label>
                    <Select value={arrivalHub} onValueChange={setArrivalHub}>
                      <SelectTrigger className="w-full bg-card">
                        <SelectValue placeholder="Select pickup point" />
                      </SelectTrigger>
                      <SelectContent>
                        {AIRPORT_RAILWAY_HUBS.map((h) => (
                          <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                      <Plane className="size-3.5 text-teal-600" /> Drop-off Hub (Departure)
                    </Label>
                    <Select value={departureHub} onValueChange={setDepartureHub}>
                      <SelectTrigger className="w-full bg-card">
                        <SelectValue placeholder="Select departure point" />
                      </SelectTrigger>
                      <SelectContent>
                        {AIRPORT_RAILWAY_HUBS.map((h) => (
                          <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Accommodation & Hospitality Preferences */}
            <Card className="border-teal-100 dark:border-teal-900 shadow-sm">
              <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-full bg-teal-600 text-white text-xs font-bold grid place-items-center">2</span>
                  <CardTitle className="text-lg">Accommodation, Room Types & Accessibility</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Specify your desired comfort level, room arrangements, and special assistance.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                    <Building className="size-4 text-teal-600" /> Hotel / Stay Style Preference
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ACCOMMODATION_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        onClick={() => setAccommodationPref(opt.value)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          accommodationPref === opt.value
                            ? "bg-teal-50 dark:bg-teal-950/40 border-teal-600 ring-1 ring-teal-600/30"
                            : "hover:bg-muted/50 border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-foreground">{opt.label}</span>
                          {accommodationPref === opt.value && <CheckCircle2 className="size-4 text-teal-600" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preferred Room Type */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                    <Home className="size-4 text-teal-600" /> Preferred Room Type
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ROOM_TYPE_OPTIONS.map((room) => (
                      <div
                        key={room.value}
                        onClick={() => setPreferredRoomType(room.value)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          preferredRoomType === room.value
                            ? "bg-teal-50 dark:bg-teal-950/40 border-teal-600 ring-1 ring-teal-600/30"
                            : "hover:bg-muted/50 border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">{room.label}</span>
                          {preferredRoomType === room.value && <CheckCircle2 className="size-3.5 text-teal-600" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{room.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Estimated Number of Rooms Required</Label>
                    <Select value={String(numRooms)} onValueChange={(v) => setNumRooms(Number(v))}>
                      <SelectTrigger className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "Room" : "Rooms"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                      <Utensils className="size-3.5 text-teal-600" /> Food & Dietary Preferences
                    </Label>
                    <Select value={dietaryPref} onValueChange={setDietaryPref}>
                      <SelectTrigger className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIETARY_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Accessibility & Special Assistance */}
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-teal-600" /> Accessibility & Special Assistance Requirements (Optional)
                  </Label>
                  <Input
                    placeholder="e.g. Wheelchair assistance at ghat, Ground floor room, Senior citizen slow-pace walking escort..."
                    value={accessibilityRequirements}
                    onChange={(e) => setAccessibilityRequirements(e.target.value)}
                    className="bg-card text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Transport, Guides, Ceremonies & Package Type */}
            <Card className="border-teal-100 dark:border-teal-900 shadow-sm">
              <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-full bg-teal-600 text-white text-xs font-bold grid place-items-center">3</span>
                  <CardTitle className="text-lg">Transport, Local Guide, Ceremonies & Package Type</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Configure private ground transit, ceremony purohit assistance, and package tier.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Transport Options */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                    <Car className="size-4 text-teal-600" /> Transport Requirements (Dedicated AC Vehicle)
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {TRANSPORT_OPTIONS.map((tOpt) => (
                      <div
                        key={tOpt.value}
                        onClick={() => setTransportRequirements(tOpt.value)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          transportRequirements === tOpt.value
                            ? "bg-teal-50 dark:bg-teal-950/40 border-teal-600 ring-1 ring-teal-600/30"
                            : "hover:bg-muted/50 border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">{tOpt.label}</span>
                          {transportRequirements === tOpt.value && <CheckCircle2 className="size-3.5 text-teal-600" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tOpt.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Local Guide & Ceremony */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold block flex items-center gap-1.5">
                      <Users className="size-3.5 text-teal-600" /> Local Escort Guide Required?
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={localGuideRequired ? "default" : "outline"}
                        onClick={() => setLocalGuideRequired(true)}
                        className="flex-1 text-xs"
                      >
                        Yes, Dedicated Escort
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!localGuideRequired ? "default" : "outline"}
                        onClick={() => setLocalGuideRequired(false)}
                        className="flex-1 text-xs"
                      >
                        No Guide Needed
                      </Button>
                    </div>
                    {localGuideRequired && (
                      <Input
                        placeholder="Preferred Guide Language (e.g. English, Telugu, Hindi)"
                        value={guideLanguage}
                        onChange={(e) => setGuideLanguage(e.target.value)}
                        className="bg-card text-xs mt-1"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold block flex items-center gap-1.5">
                      <Flame className="size-3.5 text-amber-600" /> Ceremony / Sacred Service Requirement
                    </Label>
                    <Select value={ceremonyRequirements} onValueChange={setCeremonyRequirements}>
                      <SelectTrigger className="bg-card text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CEREMONY_REQUIREMENT_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      * Coordinated with qualified Vedic purohits at reserved ghat locations.
                    </p>
                  </div>
                </div>

                {/* Package Type Preference */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                    <Sparkles className="size-4 text-teal-600" /> Preferred Package Type
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PACKAGE_TYPE_OPTIONS.map((pkg) => (
                      <div
                        key={pkg.value}
                        onClick={() => setPackageTypePreference(pkg.value)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          packageTypePreference === pkg.value
                            ? "bg-teal-50 dark:bg-teal-950/40 border-teal-600 ring-1 ring-teal-600/30"
                            : "hover:bg-muted/50 border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">{pkg.label}</span>
                          {packageTypePreference === pkg.value && <CheckCircle2 className="size-3.5 text-teal-600" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{pkg.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Estimated Package Budget (Total for group)</Label>
                    <Input
                      placeholder="e.g. ₹2,00,000 - ₹3,50,000 or $3,000 - $4,500"
                      value={budgetRange}
                      onChange={(e) => setBudgetRange(e.target.value)}
                      className="bg-card"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Quotations will be calculated in ₹ INR with full itemization.</p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Assigned / Target Partner Routing</Label>
                    <Select value={targetProviderId} onValueChange={setTargetProviderId}>
                      <SelectTrigger className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Authorized NRI Service Partners</SelectItem>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.categories.join(", ") || "Partner"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                    <FileText className="size-3.5 text-teal-600" /> Additional Instructions & Specific Wishes
                  </Label>
                  <Textarea
                    placeholder="Provide any additional requests, special pooja requirements, specific timing preferences, or dietary notes..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    rows={2}
                    className="bg-card"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Step 4: Visitor Contact Details & Communication Method */}
            <Card className="border-teal-100 dark:border-teal-900 shadow-sm">
              <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded-full bg-teal-600 text-white text-xs font-bold grid place-items-center">4</span>
                  <CardTitle className="text-lg">Contact Details & Communication Preferences</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Where your dedicated NRI Service Coordinator will send itemized quotations and itinerary updates.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Primary Contact Full Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Srikant Varma"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      className="bg-card"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                      <Mail className="size-3.5 text-teal-600" /> Email Address (For Itemized Quotation) *
                    </Label>
                    <Input
                      required
                      type="email"
                      placeholder="name@example.com"
                      value={visitorEmail}
                      onChange={(e) => setVisitorEmail(e.target.value)}
                      className="bg-card"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Country of Residence *</Label>
                    <Select value={countryOfResidence} onValueChange={setCountryOfResidence}>
                      <SelectTrigger className="w-full bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                      <Phone className="size-3.5 text-teal-600" /> Contact Number (with Country Code) *
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        className="w-24 bg-card font-mono text-xs"
                        placeholder="+1"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                      />
                      <Input
                        required
                        placeholder="e.g. 9876543210"
                        value={visitorPhone}
                        onChange={(e) => setVisitorPhone(e.target.value)}
                        className="flex-1 bg-card font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Preferred Communication Method */}
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">
                    Preferred Communication Method *
                  </Label>
                  <Select value={preferredCommunication} onValueChange={setPreferredCommunication}>
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMUNICATION_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* All-Inclusive Guarantee Callout */}
                <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 mt-4 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="size-4 text-teal-700 dark:text-teal-400" />
                    <span>The 10 Godavari One All-Inclusive Package Guarantees</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground text-[11px]">
                    {NRI_STANDARD_PACKAGE_SERVICES.map((s) => (
                      <div key={s.id} className="flex items-start gap-1.5">
                        <CheckCircle2 className="size-3 text-teal-600 shrink-0 mt-0.5" />
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 italic pt-1">
                    * Submitting this form creates a quotation request, not an instant binding charge. You will review and accept verified package proposals before any commitment.
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full whitespace-normal text-sm sm:text-base h-auto min-h-12 py-3 px-4 text-center leading-snug bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-800 hover:from-teal-800 hover:to-cyan-900 text-white font-bold shadow-md flex items-center justify-center gap-2"
                  >
                    <span>{submitting ? "Submitting Quotation Request..." : "Request All-Inclusive Package Quotations"}</span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* TAB 2: TRACK EXISTING REQUEST */}
        <TabsContent value="track-request" className="space-y-6">
          <Card className="max-w-2xl mx-auto shadow-md">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">Track Your Package Request</CardTitle>
              <CardDescription className="text-xs">
                Enter your unique Reference Number (e.g. NRI-2027-ABC123) to review received quotations, message providers, or accept offers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Enter Reference Number (e.g. NRI-2027-XXXXXX)"
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value.toUpperCase())}
                  className="font-mono uppercase font-semibold text-center h-11"
                />
                <Button
                  onClick={() => handleLookup(lookupRef)}
                  disabled={lookupLoading || !lookupRef.trim()}
                  className="bg-teal-700 hover:bg-teal-800 text-white px-6 h-11 shrink-0"
                >
                  {lookupLoading ? "Searching..." : <><Search className="size-4 mr-1.5" /> Search</>}
                </Button>
              </div>

              {lookupResult && (
                <div className="border rounded-xl p-5 space-y-5 bg-card mt-6 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b pb-3">
                    <div>
                      <span className="text-xs text-muted-foreground block">Reference Number</span>
                      <span className="font-mono font-bold text-lg text-teal-800 dark:text-teal-300">{lookupResult.referenceNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-semibold">
                        {lookupResult.status.replace(/_/g, " ")}
                      </Badge>
                      {lookupResult.status !== "CANCELLED" && lookupResult.status !== "COMPLETED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCancelModalOpen(true)}
                          className="text-xs text-destructive hover:bg-destructive/10 h-7"
                        >
                          Cancel Trip
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Assigned Manager Display */}
                  {lookupResult.assignedManager ? (
                    <div className="p-3 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-teal-600" />
                        <span>Dedicated NRI Service Coordinator: <strong>{lookupResult.assignedManager.name}</strong> ({lookupResult.assignedManager.email})</span>
                      </div>
                      <Badge variant="secondary" className="bg-teal-100 text-teal-800 text-[10px]">Assigned</Badge>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-muted/40 border rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="size-3.5 text-muted-foreground" />
                      <span>Request logged. Super Admin / Coordinator assignment in progress.</span>
                    </div>
                  )}

                  {/* Rejection / Cancellation Notes */}
                  {lookupResult.rejectionReason && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                      <strong>Request Declined Reason:</strong> {lookupResult.rejectionReason}
                    </div>
                  )}
                  {lookupResult.cancellationReason && (
                    <div className="p-3 bg-muted/50 border rounded-lg text-xs text-muted-foreground italic">
                      <strong>Cancellation Note:</strong> {lookupResult.cancellationReason}
                    </div>
                  )}

                  {/* Trip details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-muted/30 p-3 rounded-lg border">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Travelers</span>
                      <span className="font-medium text-foreground">{lookupResult.groupSize} Guests ({lookupResult.numAdults}A, {lookupResult.numChildren}C)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Travel Dates & Nights</span>
                      <span className="font-medium text-foreground">{lookupResult.arrivalDate} → {lookupResult.departureDate} ({lookupResult.daysCount || diffDays + 1}D / {lookupResult.nightsCount || diffDays}N)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Pickup & Drop-off</span>
                      <span className="font-medium text-foreground">{lookupResult.arrivalLocation}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Accommodation</span>
                      <span className="font-medium text-foreground">{lookupResult.accommodationPreference?.replace(/_/g, " ")} ({lookupResult.numRooms} Rooms)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Vehicle Style</span>
                      <span className="font-medium text-foreground">{lookupResult.transportRequirements?.replace(/_/g, " ") || "Innova Crysta"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Sacred Rites</span>
                      <span className="font-medium text-foreground">{lookupResult.ceremonyRequirements?.replace(/_/g, " ") || "Pushkara Snanam"}</span>
                    </div>
                  </div>

                  {/* Quotations summary & interactive cards */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">
                        Itemized Quotations ({lookupResult.quotations?.length || 0})
                      </span>
                    </div>

                    {lookupResult.quotations?.length > 0 ? (
                      <div className="space-y-4">
                        {lookupResult.quotations.map((q: any) => (
                          <div key={q.id} className="p-4 rounded-xl border bg-card space-y-3 shadow-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-sm text-foreground">{q.title}</h4>
                                <p className="text-xs text-muted-foreground">
                                  Proposal #{q.quotationNumber} · by {q.provider?.name || "NRI Service Desk"} · {q.durationDays} Days
                                </p>
                              </div>
                              <Badge variant={q.status === "ACCEPTED" || q.status === "CONFIRMED" ? "default" : q.status === "DECLINED" ? "destructive" : "secondary"}>
                                {q.status}
                              </Badge>
                            </div>

                            {/* Itemized breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-muted/40 p-2.5 rounded-lg border">
                              <div><span className="text-muted-foreground block">Stay & Rooms:</span> <span className="font-mono font-medium">₹{q.accommodationCost?.toLocaleString("en-IN")}</span></div>
                              <div><span className="text-muted-foreground block">Transport:</span> <span className="font-mono font-medium">₹{q.transportCost?.toLocaleString("en-IN")}</span></div>
                              <div><span className="text-muted-foreground block">Meals:</span> <span className="font-mono font-medium">₹{q.foodCost?.toLocaleString("en-IN")}</span></div>
                              <div><span className="text-muted-foreground block">Guide Services:</span> <span className="font-mono font-medium">₹{q.guideCost?.toLocaleString("en-IN")}</span></div>
                              {q.ceremonyCost > 0 && (
                                <div><span className="text-muted-foreground block">Ceremony & Purohit:</span> <span className="font-mono font-medium text-amber-700">₹{q.ceremonyCost?.toLocaleString("en-IN")}</span></div>
                              )}
                              <div><span className="text-muted-foreground block">Taxes & Levies:</span> <span className="font-mono font-medium">₹{q.taxAmount?.toLocaleString("en-IN")}</span></div>
                              {q.discountAmount > 0 && (
                                <div><span className="text-muted-foreground block">Discount:</span> <span className="font-mono font-medium text-emerald-600">-₹{q.discountAmount?.toLocaleString("en-IN")}</span></div>
                              )}
                              {q.additionalFees > 0 && (
                                <div><span className="text-muted-foreground block">Other Fees:</span> <span className="font-mono font-medium">₹{q.additionalFees?.toLocaleString("en-IN")}</span></div>
                              )}
                            </div>

                            {q.additionalFeesExplanation && (
                              <p className="text-[11px] text-muted-foreground italic">
                                Fee Explanation: {q.additionalFeesExplanation}
                              </p>
                            )}

                            {q.validUntil && (
                              <div className="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                                <Clock className="size-3.5" />
                                <span>Quotation Validity: {q.validUntil}</span>
                              </div>
                            )}

                            {q.managerNotes && (
                              <div className="p-2.5 rounded bg-muted/30 border text-xs text-muted-foreground">
                                <strong className="text-foreground">Coordinator Note: </strong>{q.managerNotes}
                              </div>
                            )}

                            <div className="flex items-baseline justify-between pt-2 border-t">
                              <div>
                                <span className="text-xs text-muted-foreground block">Total Estimated Amount</span>
                                <span className="text-xl font-bold font-mono text-teal-800 dark:text-teal-300">
                                  {formatNriCurrency(q.totalPrice)}
                                </span>
                              </div>

                              {/* Quotation action buttons */}
                              {lookupResult.status !== "CANCELLED" && (q.status === "SENT" || q.status === "PENDING_REVIEW" || q.status === "REVISED") && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setDeclineQuote(q);
                                      setDeclineReason("");
                                    }}
                                    className="text-xs h-8 text-destructive hover:bg-destructive/10"
                                  >
                                    Decline
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setRevisionQuote(q);
                                      setRevisionNotes("");
                                    }}
                                    className="text-xs h-8"
                                  >
                                    Request Changes
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={actionLoading}
                                    onClick={() => handleAcceptQuotation(q.id)}
                                    className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs h-8"
                                  >
                                    Accept Quotation
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic py-3">
                        {lookupResult.status === "SUBMITTED"
                          ? "Our NRI service manager desk is reviewing your requirements and preparing an itemized quotation proposal."
                          : "Operators are currently preparing day-by-day itineraries and vehicle arrangements."}
                      </p>
                    )}
                  </div>

                  {/* Coordinated Day-by-Day Itinerary Section */}
                  {itineraryItems.length > 0 && (
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Calendar className="size-4 text-teal-600" />
                        <span>Confirmed Day-by-Day Trip Itinerary ({itineraryItems.length} Activities)</span>
                      </div>
                      <div className="space-y-2">
                        {itineraryItems.map((item) => (
                          <div key={item.id} className="p-3 rounded-lg border bg-card text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-teal-800 dark:text-teal-300">
                                Day {item.dayNumber} · {item.startTime || "Morning"} : {item.title}
                              </span>
                              <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                            </div>
                            {item.locationName && (
                              <p className="text-muted-foreground flex items-center gap-1">
                                <MapPin className="size-3 text-primary" /> {item.locationName}
                              </p>
                            )}
                            {item.description && <p className="text-muted-foreground">{item.description}</p>}
                            {item.serviceProvider && (
                              <p className="text-[11px] text-teal-700 font-medium">Provider: {item.serviceProvider}</p>
                            )}
                            {item.instructions && (
                              <p className="text-[11px] text-amber-800 dark:text-amber-300 italic">Instructions: {item.instructions}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Revision Request Dialog */}
              {revisionQuote && (
                <Dialog open={true} onOpenChange={(o) => !o && setRevisionQuote(null)}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold">Request Quotation Revision</DialogTitle>
                      <DialogDescription className="text-xs">
                        Specify what changes or customizations you would like your NRI Service Manager to make to proposal #{revisionQuote.quotationNumber}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                      <Label className="text-xs">Requested Changes / Preferences *</Label>
                      <Textarea
                        placeholder="e.g. Please change the room type to River View Suite, include lunch and dinner, or adjust arrival pickup time..."
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        rows={4}
                        className="text-xs"
                      />
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" size="sm" onClick={() => setRevisionQuote(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        disabled={actionLoading || !revisionNotes.trim()}
                        onClick={handleRequestRevision}
                        className="bg-teal-700 hover:bg-teal-800 text-white"
                      >
                        {actionLoading ? "Submitting..." : "Send Revision Request"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* Decline Quotation Dialog */}
              {declineQuote && (
                <Dialog open={true} onOpenChange={(o) => !o && setDeclineQuote(null)}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-destructive">Decline Quotation</DialogTitle>
                      <DialogDescription className="text-xs">
                        Are you sure you want to decline proposal #{declineQuote.quotationNumber}?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                      <Label className="text-xs">Reason for declining (optional):</Label>
                      <Input
                        placeholder="e.g. Budget constraints, selected alternative package, etc."
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDeclineQuote(null)}>Keep Quotation</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading}
                        onClick={handleDeclineQuotation}
                      >
                        {actionLoading ? "Declining..." : "Confirm Decline"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* Cancel Trip Dialog */}
              {cancelModalOpen && (
                <Dialog open={true} onOpenChange={(o) => !o && setCancelModalOpen(false)}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-destructive">Cancel Trip Request</DialogTitle>
                      <DialogDescription className="text-xs">
                        Are you sure you want to cancel this entire trip planning request?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                      <Label className="text-xs">Reason for trip cancellation:</Label>
                      <Input
                        placeholder="e.g. Personal emergency, travel plans changed..."
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCancelModalOpen(false)}>Keep Trip</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading}
                        onClick={handleCancelTrip}
                      >
                        {actionLoading ? "Cancelling..." : "Confirm Cancel Trip"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              <div className="pt-4 border-t flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ name: "home" })}
                  className="gap-2 text-primary font-medium"
                  id="nri-track-back-to-home"
                >
                  <Home className="size-4" /> Return to Main Homepage
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dedicated Support, Emergency Contacts & Official External Links */}
      <div className="border rounded-2xl p-6 bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <Phone className="size-4 text-teal-600" /> Dedicated NRI & Global Pilgrim Assistance Desk
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {config?.supportInstructions || "Direct administrative assistance for itinerary queries, VIP permits, and airport liaison."}
            </p>
          </div>
          {config?.externalGuideUrl && (
            <Button size="sm" variant="outline" asChild className="text-xs gap-1.5 shadow-xs">
              <a href={config.externalGuideUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="size-3.5 text-teal-600" />
                <span>AP Tourism Pushkaralu Portal</span>
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="size-7 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 grid place-items-center shrink-0">
              <Phone className="size-3.5" />
            </span>
            <div>
              <span className="text-muted-foreground block text-[11px]">Helpline & WhatsApp</span>
              <span className="font-semibold text-foreground text-sm">{config?.supportPhone || "+91 883 2450000 / 14500"}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="size-7 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 grid place-items-center shrink-0">
              <Mail className="size-3.5" />
            </span>
            <div>
              <span className="text-muted-foreground block text-[11px]">Official NRI Support Email</span>
              <a href={`mailto:${config?.supportEmail || "nri-desk@godavarione.ap.gov.in"}`} className="font-semibold text-primary hover:underline text-sm">
                {config?.supportEmail || "nri-desk@godavarione.ap.gov.in"}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="size-7 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 grid place-items-center shrink-0">
              <Clock className="size-3.5" />
            </span>
            <div>
              <span className="text-muted-foreground block text-[11px]">Operational Hours</span>
              <span className="font-semibold text-foreground">{config?.helplineHours || "24x7 Continuous Support During Pushkaralu"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

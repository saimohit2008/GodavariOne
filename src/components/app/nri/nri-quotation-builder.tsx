"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  FileText, Calendar, Building, Car, Utensils, Users, Plus, Trash2,
  CheckCircle2, AlertCircle, Eye, Send, Save, ArrowLeft, ShieldCheck,
  FileCheck2, DollarSign, Clock, HelpCircle, Check, X
} from "lucide-react";
import {
  NRI_DEFAULT_INCLUSIONS,
  NRI_DEFAULT_EXCLUSIONS,
  formatNriCurrency,
  type NriDaySchedule,
  type NriLineItemInput,
} from "@/lib/nri-constants";

interface Props {
  request: any;
  existingQuotation?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function NriQuotationBuilder({ request, existingQuotation, onSuccess, onCancel }: Props) {
  const isEditing = Boolean(existingQuotation);

  // Package Details
  const [title, setTitle] = useState(existingQuotation?.title || `Godavari Pushkaralu Sacred Pilgrimage (${request.groupSize} Guests)`);
  const [description, setDescription] = useState(existingQuotation?.description || `Personalized all-inclusive spiritual pilgrimage package customized for ${request.visitorName}'s group visiting from ${request.countryOfResidence}.`);
  const [durationDays, setDurationDays] = useState(existingQuotation?.durationDays || 5);
  const [checkInDate, setCheckInDate] = useState(existingQuotation?.checkInDate || request.arrivalDate);
  const [checkOutDate, setCheckOutDate] = useState(existingQuotation?.checkOutDate || request.departureDate);

  // Itinerary (Day-by-day)
  let initialDays: NriDaySchedule[] = [];
  try {
    if (existingQuotation?.itinerary) {
      initialDays = typeof existingQuotation.itinerary === "string" ? JSON.parse(existingQuotation.itinerary) : existingQuotation.itinerary;
    }
  } catch {
    initialDays = [];
  }

  if (!initialDays || initialDays.length === 0) {
    initialDays = [
      {
        day: 1,
        title: "Arrival, VIP Check-in & Pushkar Ghat Evening Harathi",
        description: "Private chauffeur pickup from airport/railway station. Refreshment and check-in. Evening holy attendance at Pushkar Ghat for the divine Maha Godavari Harathi with reserved seating.",
        ghatVisits: "Pushkar Ghat (Evening Harathi)",
        templeVisits: "Markandeya Swamy Temple",
        mealsIncluded: "Welcome Refreshments & Traditional South Indian Dinner",
      },
      {
        day: 2,
        title: "Sacred Pushkara Snanam & Kotilingeshwara Darshan",
        description: "Early morning auspicious pushkara snanam at Kotilingala Ghat with dedicated purohit (priest) assistance. Sankalpam pooja and direct darshan at the ancient Kotilingeshwara Swamy temple.",
        ghatVisits: "Kotilingala Ghat (Morning Snanam)",
        templeVisits: "Kotilingeshwara Swamy Temple",
        mealsIncluded: "Breakfast & Pure Satvik Lunch",
      },
      {
        day: 3,
        title: "Draksharamam Pancharama Kshetra Pilgrimage",
        description: "Day excursion in private AC Innova to Draksharamam Bhimeswara Swamy Temple (Pancharama & Shakti Peetham). Return for sunset boat cruise along the tranquil Godavari river.",
        ghatVisits: "Saraswati Ghat",
        templeVisits: "Draksharamam Bhimeswara Swamy",
        mealsIncluded: "Breakfast, Temple Prasadam & Dinner",
      },
      {
        day: 4,
        title: "Pattiseema Veerabhadra Temple & Dindi River Excursion",
        description: "Scenic boat journey to the historic island temple of Sri Veerabhadra Swamy at Pattiseema, followed by serene Godavari backwaters experience.",
        ghatVisits: "Pattiseema River Ghat",
        templeVisits: "Sri Veerabhadra Swamy Temple",
        mealsIncluded: "Breakfast, Traditional Andhra Lunch, Dinner",
      },
      {
        day: 5,
        title: "Morning Farewell Pooja & Airport Departure Drop",
        description: "Concluding blessings, souvenir presentation with holy Godavari water (Theertham) sealed in sacred brass kalasam. Chauffeur drop to airport / station for onward journey.",
        ghatVisits: "Kotilingala Ghat (Farewell Pradakshina)",
        templeVisits: "Local heritage shrines",
        mealsIncluded: "Breakfast",
      },
    ];
  }

  const [itineraryDays, setItineraryDays] = useState<NriDaySchedule[]>(initialDays);

  // Transit & Stay
  const [pickupDropDetails, setPickupDropDetails] = useState(existingQuotation?.pickupDropDetails || `Private AC vehicle meet & greet at ${request.arrivalLocation} with chauffeur baggage assistance.`);
  const [vehicleType, setVehicleType] = useState(existingQuotation?.vehicleType || (request.groupSize > 6 ? "Tempo Traveller AC (12 Seater Luxury)" : "Toyota Innova Crysta AC (7 Seater)"));
  const [vehicleCapacity, setVehicleCapacity] = useState(existingQuotation?.vehicleCapacity || (request.groupSize > 6 ? 12 : 7));
  const [hotelName, setHotelName] = useState(existingQuotation?.hotelName || "River Bay Resort / La Hospin Executive Hotel");
  const [roomType, setRoomType] = useState(existingQuotation?.roomType || "River View Deluxe AC Rooms");
  const [numberOfRooms, setNumberOfRooms] = useState(existingQuotation?.numberOfRooms || request.numRooms || 2);
  const [accommodationDetails, setAccommodationDetails] = useState(existingQuotation?.accommodationDetails || `Inclusive of daily breakfast, high-speed Wi-Fi, 24/7 room service, and verified pushkaralu hospitality standards.`);
  const [mealPlan, setMealPlan] = useState(existingQuotation?.mealPlan || `Daily traditional South Indian breakfast and curated Satvik / Pure Vegetarian dinners included.`);
  const [guideServices, setGuideServices] = useState(existingQuotation?.guideServices || "Dedicated English & Telugu speaking pilgrimage coordinator & temple guide for all 5 days.");

  // Inclusions & Exclusions
  let initialInclusions = NRI_DEFAULT_INCLUSIONS;
  try {
    if (existingQuotation?.inclusions) {
      initialInclusions = typeof existingQuotation.inclusions === "string" ? JSON.parse(existingQuotation.inclusions) : existingQuotation.inclusions;
    }
  } catch {}

  let initialExclusions = NRI_DEFAULT_EXCLUSIONS;
  try {
    if (existingQuotation?.exclusions) {
      initialExclusions = typeof existingQuotation.exclusions === "string" ? JSON.parse(existingQuotation.exclusions) : existingQuotation.exclusions;
    }
  } catch {}

  const [inclusions, setInclusions] = useState<string[]>(initialInclusions);
  const [newInclusion, setNewInclusion] = useState("");
  const [exclusions, setExclusions] = useState<string[]>(initialExclusions);
  const [newExclusion, setNewExclusion] = useState("");

  const [termsAndConditions, setTermsAndConditions] = useState(existingQuotation?.termsAndConditions || "Package valid specifically for the confirmed travel dates. Hotel room availability confirmed upon acceptance.");
  const [cancellationPolicy, setCancellationPolicy] = useState(existingQuotation?.cancellationPolicy || "Full refund up to 15 days before arrival date. 50% refund between 7 to 14 days. Non-refundable within 7 days of Pushkaralu start.");

  // Pricing Breakdown (Server-validated)
  const [accommodationCost, setAccommodationCost] = useState<number>(existingQuotation?.accommodationCost ?? 80000);
  const [transportCost, setTransportCost] = useState<number>(existingQuotation?.transportCost ?? 45000);
  const [foodCost, setFoodCost] = useState<number>(existingQuotation?.foodCost ?? 25000);
  const [guideCost, setGuideCost] = useState<number>(existingQuotation?.guideCost ?? 15000);
  const [otherCharges, setOtherCharges] = useState<number>(existingQuotation?.otherCharges ?? 5000);
  const [taxAmount, setTaxAmount] = useState<number>(existingQuotation?.taxAmount ?? 8500);
  const [discountAmount, setDiscountAmount] = useState<number>(existingQuotation?.discountAmount ?? 0);
  const [pricingNotes, setPricingNotes] = useState<string>(existingQuotation?.pricingNotes || "");

  // Live total calculations
  const subtotal = accommodationCost + transportCost + foodCost + guideCost + otherCharges;
  const totalPrice = Math.max(0, subtotal + taxAmount - discountAmount);
  const pricePerPerson = Math.round(totalPrice / Math.max(1, request.groupSize));

  // Preview & Submit state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleAddDay() {
    setItineraryDays([
      ...itineraryDays,
      {
        day: itineraryDays.length + 1,
        title: `Day ${itineraryDays.length + 1} Excursion`,
        description: "Sacred ghat visits, local temple prayers and heritage sight-seeing.",
        ghatVisits: "Kotilingala Ghat",
        templeVisits: "Local temple darshan",
        mealsIncluded: "Breakfast & Dinner",
      },
    ]);
  }

  function handleRemoveDay(idx: number) {
    if (itineraryDays.length <= 1) return;
    const updated = itineraryDays.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day: i + 1 }));
    setItineraryDays(updated);
  }

  async function handleSave(status: "DRAFT" | "SENT") {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a package title", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        durationDays: Number(durationDays),
        checkInDate,
        checkOutDate,
        itinerary: itineraryDays,
        pickupDropDetails: pickupDropDetails.trim() || null,
        vehicleType: vehicleType.trim() || null,
        vehicleCapacity: Number(vehicleCapacity),
        hotelName: hotelName.trim() || null,
        roomType: roomType.trim() || null,
        numberOfRooms: Number(numberOfRooms),
        accommodationDetails: accommodationDetails.trim() || null,
        mealPlan: mealPlan.trim() || null,
        guideServices: guideServices.trim() || null,
        inclusions,
        exclusions,
        termsAndConditions: termsAndConditions.trim() || null,
        cancellationPolicy: cancellationPolicy.trim() || null,
        accommodationCost: Number(accommodationCost),
        transportCost: Number(transportCost),
        foodCost: Number(foodCost),
        guideCost: Number(guideCost),
        otherCharges: Number(otherCharges),
        taxAmount: Number(taxAmount),
        discountAmount: Number(discountAmount),
        pricingNotes: pricingNotes.trim() || null,
        status,
        action: status === "SENT" ? (isEditing ? "REVISE" : "SEND") : "SAVE_DRAFT",
      };

      if (isEditing) {
        await api.patch(`/nri/quotations/${existingQuotation.id}`, payload);
        toast({ title: status === "SENT" ? "Quotation Sent to Visitor!" : "Draft Saved" });
      } else {
        await api.post(`/nri/requests/${request.id}/quotations`, payload);
        toast({ title: status === "SENT" ? "Quotation Prepared & Sent!" : "Draft Saved" });
      }
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err instanceof ApiError ? err.message : "Failed to process quotation",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top summary card */}
      <Card className="border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/20">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-teal-800 dark:text-teal-300">
                {request.referenceNumber}
              </span>
              <Badge variant="outline" className="text-xs">
                Group of {request.groupSize} ({request.numAdults} Adults, {request.numChildren} Children)
              </Badge>
            </div>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              Visitor: {request.visitorName} ({request.countryOfResidence}) · {request.visitorEmail}
            </p>
            <p className="text-xs text-muted-foreground">
              Travel Dates: {request.arrivalDate} → {request.departureDate} · Preferred Hub: {request.arrivalLocation}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Proposed Total</span>
            <span className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400">
              {formatNriCurrency(totalPrice)}
            </span>
            <span className="text-[11px] text-muted-foreground block font-medium">
              ₹{pricePerPerson.toLocaleString("en-IN")}/person
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Package Title & Schedule */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4 text-teal-600" /> 1. Package Title, Overview & Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs font-semibold mb-1 block">Package Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 5-Day Sacred Godavari Pushkaralu VIP Pilgrimage"
                className="bg-card font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Package Duration (Days)</Label>
              <Input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="bg-card font-mono"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Package Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-card"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Check-in Date</Label>
              <Input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="bg-card"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Check-out Date</Label>
              <Input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="bg-card"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Day-by-Day Sacred Itinerary */}
      <Card>
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="size-4 text-teal-600" /> 2. Day-by-Day Ghat, Temple & Sightseeing Schedule
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleAddDay} className="h-8 text-xs">
            <Plus className="size-3.5 mr-1" /> Add Day
          </Button>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {itineraryDays.map((day, idx) => (
            <div key={idx} className="p-3.5 rounded-xl border bg-muted/20 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <span className="size-5 rounded-full bg-teal-600 text-white text-[10px] grid place-items-center">{day.day}</span>
                  Day {day.day} Itinerary
                </span>
                {itineraryDays.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveDay(idx)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">Day Heading / Title</Label>
                  <Input
                    value={day.title}
                    onChange={(e) => {
                      const updated = [...itineraryDays];
                      updated[idx].title = e.target.value;
                      setItineraryDays(updated);
                    }}
                    placeholder="e.g. VIP Pushkara Snanam & Kotilingeshwara Darshan"
                    className="bg-card text-xs h-9 font-medium"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">Ghats & Temples Covered</Label>
                  <Input
                    value={day.ghatVisits || ""}
                    onChange={(e) => {
                      const updated = [...itineraryDays];
                      updated[idx].ghatVisits = e.target.value;
                      setItineraryDays(updated);
                    }}
                    placeholder="e.g. Kotilingala Ghat (Morning Snanam), Pushkar Ghat (Harathi)"
                    className="bg-card text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">Activities & Logistics</Label>
                <Textarea
                  value={day.description}
                  onChange={(e) => {
                    const updated = [...itineraryDays];
                    updated[idx].description = e.target.value;
                    setItineraryDays(updated);
                  }}
                  rows={2}
                  className="bg-card text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">Included Meals for this Day</Label>
                <Input
                  value={day.mealsIncluded || ""}
                  onChange={(e) => {
                    const updated = [...itineraryDays];
                    updated[idx].mealsIncluded = e.target.value;
                    setItineraryDays(updated);
                  }}
                  placeholder="e.g. South Indian Breakfast, Satvik Brahmin Lunch, Dinner"
                  className="bg-card text-xs h-8"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 3: Accommodation, Transport & Services */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="size-4 text-teal-600" /> 3. Stay, Transport & Coordination Services
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Hotel / Resort Name *</Label>
              <Input
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                placeholder="e.g. River Bay Resort"
                className="bg-card text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Room Type</Label>
              <Input
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                placeholder="e.g. Executive AC Deluxe Suites"
                className="bg-card text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Number of Rooms</Label>
              <Input
                type="number"
                min={1}
                value={numberOfRooms}
                onChange={(e) => setNumberOfRooms(Number(e.target.value))}
                className="bg-card text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Accommodation Details & Amenities</Label>
            <Input
              value={accommodationDetails}
              onChange={(e) => setAccommodationDetails(e.target.value)}
              placeholder="e.g. Interconnected rooms with river balcony, complimentary breakfast, extra bedding for children"
              className="bg-card text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold mb-1 block flex items-center gap-1.5">
                <Car className="size-3.5 text-teal-600" /> Dedicated Vehicle Type
              </Label>
              <Input
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                placeholder="e.g. Toyota Innova Crysta AC / Force Urbania"
                className="bg-card text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Vehicle Passenger Capacity</Label>
              <Input
                type="number"
                min={2}
                value={vehicleCapacity}
                onChange={(e) => setVehicleCapacity(Number(e.target.value))}
                className="bg-card text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Pickup & Drop-off Logistics</Label>
            <Input
              value={pickupDropDetails}
              onChange={(e) => setPickupDropDetails(e.target.value)}
              placeholder="e.g. Airport meet & greet with welcome garland, luggage handling, direct private transit"
              className="bg-card text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold mb-1 block flex items-center gap-1.5">
                <Utensils className="size-3.5 text-teal-600" /> Food & Included Meal Arrangements
              </Label>
              <Input
                value={mealPlan}
                onChange={(e) => setMealPlan(e.target.value)}
                placeholder="e.g. Pure Veg South Indian breakfast and Satvik dinners included"
                className="bg-card text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Tour Guide & Language Assistance</Label>
              <Input
                value={guideServices}
                onChange={(e) => setGuideServices(e.target.value)}
                placeholder="e.g. Dedicated English & Telugu spiritual guide"
                className="bg-card text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Inclusions & Exclusions */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-teal-600" /> 4. Package Inclusions & Exclusions
          </CardTitle>
          <CardDescription className="text-xs">
            Clearly state what services are included and what services are not included.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inclusions */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                <Check className="size-4" /> Package Inclusions ({inclusions.length})
              </Label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {inclusions.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border text-xs">
                    <span className="flex-1">{item}</span>
                    <button
                      type="button"
                      onClick={() => setInclusions(inclusions.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Add custom inclusion..."
                  value={newInclusion}
                  onChange={(e) => setNewInclusion(e.target.value)}
                  className="bg-card text-xs h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newInclusion.trim()) {
                      e.preventDefault();
                      setInclusions([...inclusions, newInclusion.trim()]);
                      setNewInclusion("");
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (newInclusion.trim()) {
                      setInclusions([...inclusions, newInclusion.trim()]);
                      setNewInclusion("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Exclusions */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <X className="size-4" /> Package Exclusions ({exclusions.length})
              </Label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {exclusions.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border text-xs">
                    <span className="flex-1">{item}</span>
                    <button
                      type="button"
                      onClick={() => setExclusions(exclusions.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Add custom exclusion..."
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  className="bg-card text-xs h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newExclusion.trim()) {
                      e.preventDefault();
                      setExclusions([...exclusions, newExclusion.trim()]);
                      setNewExclusion("");
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (newExclusion.trim()) {
                      setExclusions([...exclusions, newExclusion.trim()]);
                      setNewExclusion("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Terms & Additional Conditions</Label>
              <Textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={2}
                className="bg-card text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Cancellation & Refund Policy</Label>
              <Textarea
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                rows={2}
                className="bg-card text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Transparent Itemized Pricing Breakdown */}
      <Card className="border-teal-300 dark:border-teal-800 shadow-sm">
        <CardHeader className="bg-teal-50/70 dark:bg-teal-950/30 border-b pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="size-4 text-teal-600" /> 5. Itemized Pricing Breakdown (INR ₹)
            </span>
            <Badge className="bg-teal-700 text-white font-mono">
              ₹ Total: {formatNriCurrency(totalPrice)}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Totals are verified server-side. Prices clearly labeled in INR (₹).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Accommodation Cost (₹)</Label>
              <Input
                type="number"
                min={0}
                value={accommodationCost}
                onChange={(e) => setAccommodationCost(Number(e.target.value))}
                className="bg-card font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Transport & Transit Cost (₹)</Label>
              <Input
                type="number"
                min={0}
                value={transportCost}
                onChange={(e) => setTransportCost(Number(e.target.value))}
                className="bg-card font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Food & Meals Cost (₹)</Label>
              <Input
                type="number"
                min={0}
                value={foodCost}
                onChange={(e) => setFoodCost(Number(e.target.value))}
                className="bg-card font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Guide & Sightseeing (₹)</Label>
              <Input
                type="number"
                min={0}
                value={guideCost}
                onChange={(e) => setGuideCost(Number(e.target.value))}
                className="bg-card font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Taxes & Applicable Fees (₹)</Label>
              <Input
                type="number"
                min={0}
                value={taxAmount}
                onChange={(e) => setTaxAmount(Number(e.target.value))}
                className="bg-card font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Promotional Discount (₹)</Label>
              <Input
                type="number"
                min={0}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className="bg-card font-mono text-sm text-emerald-600"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1 block">Pricing Explanation / Notes for Visitor</Label>
            <Input
              value={pricingNotes}
              onChange={(e) => setPricingNotes(e.target.value)}
              placeholder="e.g. Includes all river tolls, permit charges, driver allowance, and GST."
              className="bg-card text-xs"
            />
          </div>

          <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-xs text-muted-foreground block">Verified Group Total ({request.groupSize} People)</span>
              <span className="text-2xl font-bold font-mono text-teal-800 dark:text-teal-200">
                {formatNriCurrency(totalPrice)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Comparison Price Per Person</span>
              <span className="text-lg font-bold font-mono text-teal-700 dark:text-teal-300">
                ₹{pricePerPerson.toLocaleString("en-IN")} / traveler
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
          <ArrowLeft className="size-4 mr-1.5" /> Back to Requests
        </Button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setPreviewOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <Eye className="size-4 mr-1.5" /> Preview Quotation
          </Button>

          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => handleSave("DRAFT")}
            className="flex-1 sm:flex-none"
          >
            <Save className="size-4 mr-1.5" /> Save Draft
          </Button>

          <Button
            disabled={saving}
            onClick={() => handleSave("SENT")}
            className="flex-1 sm:flex-none bg-teal-700 hover:bg-teal-800 text-white font-bold"
          >
            <Send className="size-4 mr-1.5" /> {isEditing ? "Send Revised Quotation" : "Send Quotation to Visitor"}
          </Button>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-teal-800 dark:text-teal-300">
              Quotation Preview — {title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              This is the complete all-inclusive package the visitor will see in their portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div className="bg-teal-50 dark:bg-teal-950/40 p-4 rounded-xl border border-teal-200 dark:border-teal-800 flex justify-between items-center">
              <div>
                <p className="font-bold text-lg text-teal-900 dark:text-teal-100">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{durationDays} Days · {request.groupSize} Travelers ({checkInDate} to {checkOutDate})</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono text-teal-800 dark:text-teal-300">{formatNriCurrency(totalPrice)}</span>
                <span className="text-xs text-muted-foreground block">₹{pricePerPerson.toLocaleString("en-IN")}/person</span>
              </div>
            </div>

            <div>
              <h5 className="font-semibold text-sm mb-2 text-foreground">Day-by-Day Sacred Itinerary</h5>
              <div className="space-y-2">
                {itineraryDays.map((d) => (
                  <div key={d.day} className="p-2.5 rounded-lg border text-xs bg-card">
                    <span className="font-bold text-teal-700 dark:text-teal-400">Day {d.day}: {d.title}</span>
                    <p className="text-muted-foreground mt-1">{d.description}</p>
                    {d.ghatVisits && <p className="text-[11px] text-teal-600 dark:text-teal-300 mt-1">Ghats: {d.ghatVisits}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg border">
                <span className="font-bold block mb-1">Accommodation</span>
                <p>{hotelName} · {roomType} ({numberOfRooms} rooms)</p>
              </div>
              <div className="p-3 rounded-lg border">
                <span className="font-bold block mb-1">Transport</span>
                <p>{vehicleType} (Capacity: {vehicleCapacity} Pax)</p>
              </div>
            </div>

            <div>
              <h5 className="font-semibold text-xs mb-1.5 text-foreground">Inclusions</h5>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                {inclusions.map((inc, i) => <li key={i}>{inc}</li>)}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close Preview</Button>
            <Button
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold"
              onClick={() => {
                setPreviewOpen(false);
                handleSave("SENT");
              }}
            >
              Confirm & Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

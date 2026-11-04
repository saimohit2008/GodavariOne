"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, ApiError } from "@/lib/api-client";
import { useBookingAuth } from "../booking-auth-modal";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accessibility,
  Heart,
  ShieldCheck,
  Upload,
  Calendar,
  User,
  Users,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Waves,
  Sparkles,
} from "lucide-react";
import { calculateAgeOnDate, type PriorityCategory } from "@/lib/priority-booking-utils";

interface PriorityBookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedGhatId?: string;
  onSuccess?: (booking: any) => void;
}

export function PriorityBookingFormDialog({
  open,
  onOpenChange,
  preselectedGhatId,
  onSuccess,
}: PriorityBookingFormDialogProps) {
  const { lang, user, navigate, pendingBooking } = useApp();
  const { requireAuth } = useBookingAuth();
  const [ghats, setGhats] = useState<any[]>([]);
  const [loadingGhats, setLoadingGhats] = useState(false);

  // Form State
  const [category, setCategory] = useState<PriorityCategory>("SENIOR_CITIZEN");
  const [selectedGhatId, setSelectedGhatId] = useState(preselectedGhatId || "");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryDob, setBeneficiaryDob] = useState("");
  const [beneficiaryPhone, setBeneficiaryPhone] = useState(user?.phone || "");
  const [beneficiaryEmail, setBeneficiaryEmail] = useState(user?.email || "");
  const [visitDate, setVisitDate] = useState(() => {
    // Default to tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [accompanyingCount, setAccompanyingCount] = useState("1");

  // Accessibility flags
  const [wheelchair, setWheelchair] = useState(false);
  const [ramp, setRamp] = useState(false);
  const [batteryVehicle, setBatteryVehicle] = useState(false);
  const [guide, setGuide] = useState(false);
  const [otherAssistance, setOtherAssistance] = useState("");

  // Caregiver / Family applicant
  const [isCaregiver, setIsCaregiver] = useState(false);
  const [applicantName, setApplicantName] = useState(user?.name || "");
  const [applicantPhone, setApplicantPhone] = useState(user?.phone || "");
  const [applicantRelationship, setApplicantRelationship] = useState("");

  // Document file
  const [file, setFile] = useState<File | null>(null);

  // Declarations
  const [declaration, setDeclaration] = useState(false);
  const [consent, setConsent] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);

  // Load ghats
  useEffect(() => {
    if (open) {
      if (preselectedGhatId) {
        setSelectedGhatId(preselectedGhatId);
      }
      setLoadingGhats(true);
      api
        .get<{ items: any[] }>("/listings?category=GHAT&limit=100")
        .then((res) => {
          setGhats(res.items || []);
          if (!selectedGhatId && res.items?.length > 0 && !preselectedGhatId) {
            setSelectedGhatId(res.items[0].id);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingGhats(false));
    }
  }, [open, preselectedGhatId]);

  // Recalculate age when DOB or visitDate changes
  useEffect(() => {
    if (category === "SENIOR_CITIZEN" && beneficiaryDob && visitDate) {
      try {
        const age = calculateAgeOnDate(beneficiaryDob, visitDate);
        setCalculatedAge(age);
        if (age < 65) {
          setAgeError(
            lang === "te"
              ? `సందర్శన తేదీ నాటికి లబ్ధిదారుడి వయస్సు కనీసం 65 ఏళ్లు ఉండాలి. ప్రస్తుత లెక్కించిన వయస్సు: ${age} సంవత్సరాలు.`
              : `Beneficiary must be 65 years or older on the visit date. Calculated age is ${age} years.`
          );
        } else {
          setAgeError(null);
        }
      } catch {
        setCalculatedAge(null);
        setAgeError(null);
      }
    } else {
      setCalculatedAge(null);
      setAgeError(null);
    }
  }, [category, beneficiaryDob, visitDate, lang]);

  // Restore pending priority booking on authentication
  useEffect(() => {
    if (user && pendingBooking && pendingBooking.type === "PRIORITY_GHAT" && pendingBooking.data) {
      const d = pendingBooking.data;
      if (d.category) setCategory(d.category);
      if (d.selectedGhatId) setSelectedGhatId(d.selectedGhatId);
      if (d.beneficiaryName) setBeneficiaryName(d.beneficiaryName);
      if (d.beneficiaryDob) setBeneficiaryDob(d.beneficiaryDob);
      if (d.visitDate) setVisitDate(d.visitDate);
      if (d.accompanyingCount) setAccompanyingCount(d.accompanyingCount);
      if (d.wheelchair != null) setWheelchair(d.wheelchair);
      if (d.ramp != null) setRamp(d.ramp);
      if (d.batteryVehicle != null) setBatteryVehicle(d.batteryVehicle);
      if (d.guide != null) setGuide(d.guide);
      if (d.otherAssistance) setOtherAssistance(d.otherAssistance);
      if (d.isCaregiver != null) setIsCaregiver(d.isCaregiver);
      if (d.applicantName) setApplicantName(d.applicantName);
      if (d.applicantRelationship) setApplicantRelationship(d.applicantRelationship);
      setBeneficiaryPhone(user.phone || d.beneficiaryPhone || "");
      setBeneficiaryEmail(user.email || d.beneficiaryEmail || "");
    }
  }, [user, pendingBooking]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedGhatId) {
      toast({ title: t(lang, "error"), description: "Please select a destination ghat.", variant: "destructive" });
      return;
    }

    if (!beneficiaryName.trim()) {
      toast({ title: t(lang, "error"), description: t(lang, "requiredField"), variant: "destructive" });
      return;
    }

    if (category === "SENIOR_CITIZEN") {
      if (!beneficiaryDob) {
        toast({ title: t(lang, "error"), description: "Date of birth is required.", variant: "destructive" });
        return;
      }
      if (calculatedAge != null && calculatedAge < 65) {
        toast({ title: t(lang, "error"), description: ageError || "Beneficiary does not meet the 65-year age requirement.", variant: "destructive" });
        return;
      }
    }

    if (!file) {
      toast({ title: t(lang, "error"), description: "Supporting proof document is required.", variant: "destructive" });
      return;
    }

    if (!declaration || !consent) {
      toast({ title: t(lang, "error"), description: "Please confirm applicant declaration and processing consent.", variant: "destructive" });
      return;
    }

    if (!requireAuth({
      type: "PRIORITY_GHAT",
      listingId: selectedGhatId,
      title: "Priority Ghat Pass (65+ & PwD)",
      details: `${category === "SENIOR_CITIZEN" ? "Senior Citizen" : "Person with Disability"} · ${visitDate} · ${beneficiaryName}`,
      data: {
        category,
        selectedGhatId,
        beneficiaryName,
        beneficiaryDob,
        beneficiaryPhone,
        beneficiaryEmail,
        visitDate,
        accompanyingCount,
        wheelchair,
        ramp,
        batteryVehicle,
        guide,
        otherAssistance,
        isCaregiver,
        applicantName,
        applicantPhone,
        applicantRelationship,
      },
      returnView: preselectedGhatId ? { name: "listing", id: preselectedGhatId } : { name: "home" },
    }, (authenticatedUser) => {
      setBeneficiaryPhone(authenticatedUser.phone || beneficiaryPhone);
      setBeneficiaryEmail(authenticatedUser.email || beneficiaryEmail);
      toast({
        title: "Authenticated",
        description: "Please attach supporting ID proof and submit your application.",
      });
    })) {
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("ghatId", selectedGhatId);
      formData.append("beneficiaryName", beneficiaryName.trim());
      formData.append("beneficiaryPhone", beneficiaryPhone.trim());
      if (beneficiaryEmail) formData.append("beneficiaryEmail", beneficiaryEmail.trim());
      if (beneficiaryDob) formData.append("beneficiaryDob", beneficiaryDob);
      formData.append("visitDate", visitDate);
      formData.append("accompanyingCount", accompanyingCount);

      // Collect accessibility assistance requirements
      const assistanceItems: string[] = [];
      if (wheelchair) assistanceItems.push("Wheelchair");
      if (ramp) assistanceItems.push("Ramp Access");
      if (batteryVehicle) assistanceItems.push("Battery Vehicle");
      if (guide) assistanceItems.push("Physical Guide");
      if (otherAssistance.trim()) assistanceItems.push(otherAssistance.trim());
      if (assistanceItems.length > 0) {
        formData.append("accessibilityNeeds", assistanceItems.join(", "));
      }

      // Caregiver information
      formData.append("isCaregiverApplication", String(isCaregiver));
      if (isCaregiver) {
        formData.append("applicantName", applicantName.trim());
        formData.append("applicantPhone", applicantPhone.trim());
        formData.append("applicantRelationship", applicantRelationship.trim());
      }

      formData.append("applicantDeclaration", "true");
      formData.append("consentGiven", "true");
      formData.append("file", file);

      const res = await fetch("/api/v1/priority-bookings", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      toast({
        title: t(lang, "applicationSuccess"),
        description: `${t(lang, "applicationNumber")}: ${data.applicationNumber}. ${t(lang, "underReview")}.`,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess(data);

      // Reset form
      setFile(null);
      setBeneficiaryName("");
      setBeneficiaryDob("");
      setOtherAssistance("");
      setDeclaration(false);
      setConsent(false);
    } catch (err: any) {
      toast({
        title: t(lang, "error"),
        description: err.message || "Failed to submit priority booking application.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto nice-scroll">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <Accessibility className="size-5" />
            </span>
            <Badge variant="outline" className="text-sky-700 border-sky-300 dark:text-sky-300">
              Pushkaralu 2027 Priority
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {t(lang, "priorityBookingTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(lang, "priorityBookingSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Eligibility Category Selector Tabs */}
          <Tabs
            value={category}
            onValueChange={(val) => setCategory(val as PriorityCategory)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full h-11">
              <TabsTrigger value="SENIOR_CITIZEN" className="gap-2 font-medium">
                <Heart className="size-4 text-rose-500" />
                {t(lang, "seniorCitizen")}
              </TabsTrigger>
              <TabsTrigger value="PERSON_WITH_DISABILITY" className="gap-2 font-medium">
                <Accessibility className="size-4 text-sky-500" />
                {t(lang, "personWithDisability")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="SENIOR_CITIZEN" className="pt-2">
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Age Requirement: 65+ Years</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {t(lang, "supportingDocHelpSenior")}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="PERSON_WITH_DISABILITY" className="pt-2">
              <div className="p-3 rounded-lg border border-sky-200 bg-sky-50/70 dark:bg-sky-950/20 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2">
                <ShieldCheck className="size-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Human Verification & Accessible Assistance</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {t(lang, "supportingDocHelpDisability")}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Destination Ghat Selection */}
          <div className="space-y-2">
            <Label htmlFor="ghat-select" className="text-sm font-semibold flex items-center gap-1.5">
              <Waves className="size-4 text-sky-600" />
              {t(lang, "selectedGhat")} *
            </Label>
            <Select value={selectedGhatId} onValueChange={setSelectedGhatId} disabled={loadingGhats}>
              <SelectTrigger id="ghat-select" className="h-10">
                <SelectValue placeholder={loadingGhats ? "Loading ghats..." : "Select a ghat"} />
              </SelectTrigger>
              <SelectContent>
                {ghats.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} · {[g.town, g.district].filter(Boolean).join(", ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Proposed Visit Date and Accompanying Persons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="visit-date" className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="size-4 text-primary" />
                {t(lang, "visitDate")} *
              </Label>
              <Input
                id="visit-date"
                type="date"
                value={visitDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setVisitDate(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accompanying-count" className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="size-4 text-primary" />
                {t(lang, "accompanyingPersons")} *
              </Label>
              <Select value={accompanyingCount} onValueChange={setAccompanyingCount}>
                <SelectTrigger id="accompanying-count" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 (Solo visitor)</SelectItem>
                  <SelectItem value="1">1 Attendant / Caregiver</SelectItem>
                  <SelectItem value="2">2 Family Members (Max)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Beneficiary Information Card */}
          <Card className="border-muted shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  <User className="size-4 text-primary" />
                  {t(lang, "beneficiaryDetails")}
                </span>
                <span className="text-xs text-muted-foreground">The person visiting the ghat</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="beneficiary-name" className="text-xs font-medium">
                    {t(lang, "beneficiaryName")} *
                  </Label>
                  <Input
                    id="beneficiary-name"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    placeholder="Enter full legal name as per ID"
                    required
                    className="h-9"
                  />
                </div>

                {category === "SENIOR_CITIZEN" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="beneficiary-dob" className="text-xs font-medium">
                        {t(lang, "beneficiaryDob")} *
                      </Label>
                      {calculatedAge != null && (
                        <span
                          className={`text-xs font-semibold ${
                            calculatedAge >= 65 ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          Age on visit date: {calculatedAge} years
                        </span>
                      )}
                    </div>
                    <Input
                      id="beneficiary-dob"
                      type="date"
                      value={beneficiaryDob}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setBeneficiaryDob(e.target.value)}
                      required={category === "SENIOR_CITIZEN"}
                      className="h-9"
                    />
                    {ageError && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1 font-medium">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        {ageError}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="beneficiary-phone" className="text-xs font-medium">
                    {t(lang, "beneficiaryPhone")} *
                  </Label>
                  <Input
                    id="beneficiary-phone"
                    type="tel"
                    value={beneficiaryPhone}
                    onChange={(e) => setBeneficiaryPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    required
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="beneficiary-email" className="text-xs font-medium">
                    {t(lang, "beneficiaryEmail")}
                  </Label>
                  <Input
                    id="beneficiary-email"
                    type="email"
                    value={beneficiaryEmail}
                    onChange={(e) => setBeneficiaryEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Caregiver / Family Submitter Distinction */}
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="caregiver-toggle"
                checked={isCaregiver}
                onCheckedChange={(c) => setIsCaregiver(Boolean(c))}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="caregiver-toggle" className="text-xs font-semibold cursor-pointer">
                  {t(lang, "caregiverApplication")}
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Check this box if you are a caregiver, family member, or authorized volunteer submitting this application on behalf of the beneficiary.
                </p>
              </div>
            </div>

            {isCaregiver && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                <div className="space-y-1">
                  <Label htmlFor="applicant-name" className="text-xs font-medium">
                    {t(lang, "caregiverName")} *
                  </Label>
                  <Input
                    id="applicant-name"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="Caregiver Name"
                    required={isCaregiver}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="applicant-phone" className="text-xs font-medium">
                    {t(lang, "caregiverPhone")} *
                  </Label>
                  <Input
                    id="applicant-phone"
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    placeholder="Caregiver Phone"
                    required={isCaregiver}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="applicant-rel" className="text-xs font-medium">
                    {t(lang, "caregiverRelationship")} *
                  </Label>
                  <Input
                    id="applicant-rel"
                    value={applicantRelationship}
                    onChange={(e) => setApplicantRelationship(e.target.value)}
                    placeholder="e.g. Son, Daughter, Nurse"
                    required={isCaregiver}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Accessibility Requirements */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Accessibility className="size-4 text-sky-600" />
              {t(lang, "accessibilityRequirements")}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={wheelchair} onCheckedChange={(c) => setWheelchair(Boolean(c))} />
                <span>{t(lang, "wheelchairAssistance")}</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={ramp} onCheckedChange={(c) => setRamp(Boolean(c))} />
                <span>{t(lang, "rampAccess")}</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={batteryVehicle} onCheckedChange={(c) => setBatteryVehicle(Boolean(c))} />
                <span>{t(lang, "batteryVehicle")}</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={guide} onCheckedChange={(c) => setGuide(Boolean(c))} />
                <span>{t(lang, "guideAssistance")}</span>
              </label>
            </div>
            <Input
              value={otherAssistance}
              onChange={(e) => setOtherAssistance(e.target.value)}
              placeholder="Any other specific accessibility requirements (optional)"
              className="h-8 text-xs mt-1.5"
            />
          </div>

          {/* Secure Document Upload */}
          <div className="space-y-2">
            <Label htmlFor="doc-file" className="text-sm font-semibold flex items-center gap-1.5">
              <Upload className="size-4 text-primary" />
              {t(lang, "supportingDocument")} *
            </Label>
            <div className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 text-center transition-colors">
              <input
                id="doc-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
                className="hidden"
                required
              />
              <label htmlFor="doc-file" className="cursor-pointer block">
                <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
                {file ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-xs text-primary flex items-center justify-center gap-1">
                      <FileCheck className="size-4" />
                      {file.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Click to upload supporting certificate or proof
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Supported formats: PDF, JPEG, PNG, WebP (Max 5MB)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Declarations & Legal Consent */}
          <div className="space-y-3 pt-2 border-t text-xs">
            <div className="flex items-start gap-2">
              <Checkbox
                id="declaration"
                checked={declaration}
                onCheckedChange={(c) => setDeclaration(Boolean(c))}
                className="mt-0.5"
                required
              />
              <Label htmlFor="declaration" className="cursor-pointer leading-snug text-muted-foreground">
                {t(lang, "applicantDeclaration")}
              </Label>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(c) => setConsent(Boolean(c))}
                className="mt-0.5"
                required
              />
              <Label htmlFor="consent" className="cursor-pointer leading-snug text-muted-foreground">
                {t(lang, "consentProcessing")}
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t(lang, "cancel")}
            </Button>
            <Button
              type="submit"
              disabled={submitting || (category === "SENIOR_CITIZEN" && calculatedAge != null && calculatedAge < 65)}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold"
            >
              {submitting ? "Submitting..." : t(lang, "submitApplication")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

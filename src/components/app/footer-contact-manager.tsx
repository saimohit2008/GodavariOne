"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useApi, useToastHelpers } from "./use-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PhoneCall,
  Phone,
  Mail,
  MapPin,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

export interface FooterPhoneItem {
  id: string;
  number: string;
  label: string;
  isEnabled: boolean;
}

export interface FooterContactAdminResponse {
  id?: string;
  name?: string;
  description?: string;
  isEnabled: boolean;
  email: string | null;
  emailEnabled: boolean;
  phones: FooterPhoneItem[];
  address: string | null;
  addressEnabled: boolean;
  updatedAt?: string;
  isConfigured?: boolean;
}

const PHONE_LABEL_PRESETS = [
  "Helpline",
  "Support",
  "Emergency",
  "Pushkara Control Room",
  "Toll-Free",
  "WhatsApp Desk",
  "VIP Pilgrims Desk",
];

export function FooterContactManager() {
  const toast = useToastHelpers();
  const { data, loading, refetch } = useApi<FooterContactAdminResponse>("/footer-contact");

  // Form State
  const [isMasterEnabled, setIsMasterEnabled] = useState(true);
  const [email, setEmail] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [phones, setPhones] = useState<FooterPhoneItem[]>([]);
  const [address, setAddress] = useState("");
  const [addressEnabled, setAddressEnabled] = useState(true);

  // Status & Validation
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    phones?: Record<string, string>;
    address?: string;
  }>({});
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Sync form state when backend data loads or updates
  useEffect(() => {
    if (data) {
      setIsMasterEnabled(data.isEnabled ?? true);
      setEmail(data.email || "");
      setEmailEnabled(data.emailEnabled ?? (!!data.email));
      setPhones(Array.isArray(data.phones) ? data.phones : []);
      setAddress(data.address || "");
      setAddressEnabled(data.addressEnabled ?? (!!data.address));
      setValidationErrors({});
    }
  }, [data]);

  // Phone helper functions
  const handleAddPhone = () => {
    const newPhone: FooterPhoneItem = {
      id: `phone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      number: "",
      label: "Helpline",
      isEnabled: true,
    };
    setPhones((prev) => [...prev, newPhone]);
  };

  const handleUpdatePhone = (id: string, updates: Partial<FooterPhoneItem>) => {
    setPhones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    // Clear phone validation error if fixed
    if (validationErrors.phones?.[id]) {
      setValidationErrors((prev) => {
        const nextPhones = { ...prev.phones };
        delete nextPhones[id];
        return { ...prev, phones: nextPhones };
      });
    }
  };

  const handleRemovePhone = (id: string) => {
    setPhones((prev) => prev.filter((p) => p.id !== id));
    if (validationErrors.phones?.[id]) {
      setValidationErrors((prev) => {
        const nextPhones = { ...prev.phones };
        delete nextPhones[id];
        return { ...prev, phones: nextPhones };
      });
    }
  };

  // Client-side validation before submission
  const validateForm = (): boolean => {
    const errors: {
      email?: string;
      phones?: Record<string, string>;
      address?: string;
    } = {};

    // Validate email
    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        errors.email = "Please enter a valid email address (e.g. contact@godavari.gov.in)";
      } else if (trimmedEmail.length > 100) {
        errors.email = "Email cannot exceed 100 characters";
      }
    }

    // Validate phone numbers
    const phoneErrors: Record<string, string> = {};
    const phoneRegex = /^[+]?[0-9\s\-()]+$/;
    for (const phone of phones) {
      const trimmedNumber = phone.number.trim();
      if (!trimmedNumber) {
        phoneErrors[phone.id] = "Phone number cannot be empty";
      } else if (trimmedNumber.length < 3) {
        phoneErrors[phone.id] = "Phone number must be at least 3 digits";
      } else if (trimmedNumber.length > 30) {
        phoneErrors[phone.id] = "Phone number cannot exceed 30 characters";
      } else if (!phoneRegex.test(trimmedNumber)) {
        phoneErrors[phone.id] = "Only digits, spaces, hyphens, parentheses, and '+' are allowed";
      }
    }

    if (Object.keys(phoneErrors).length > 0) {
      errors.phones = phoneErrors;
    }

    // Validate address
    if (address.trim().length > 300) {
      errors.address = "Address cannot exceed 300 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save changes to backend
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please correct the validation errors before saving.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        isEnabled: isMasterEnabled,
        email: email.trim() || null,
        emailEnabled,
        phones: phones.map((p) => ({
          id: p.id,
          number: p.number.trim(),
          label: p.label.trim() || "Helpline",
          isEnabled: p.isEnabled,
        })),
        address: address.trim() || null,
        addressEnabled,
      };

      await api.patch("/footer-contact", payload);
      toast.success("Footer contact settings updated and published successfully!");

      // Dispatch custom event to immediately trigger public footer refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("godavari_footer_contact_updated"));
      }

      await refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to save footer contact settings";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Reset/Clear all contact settings
  const handleReset = async () => {
    setResetting(true);
    try {
      await api.del("/footer-contact");
      toast.success("Footer contact settings have been reset.");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("godavari_footer_contact_updated"));
      }

      setResetDialogOpen(false);
      await refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to reset footer contact settings";
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const enabledPhones = phones.filter((p) => p.isEnabled && p.number.trim());
  const activeCount =
    (isMasterEnabled && emailEnabled && email.trim() ? 1 : 0) +
    (isMasterEnabled ? enabledPhones.length : 0) +
    (isMasterEnabled && addressEnabled && address.trim() ? 1 : 0);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shadow-xs">
            <PhoneCall className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Footer Contact Settings</h2>
            <p className="text-sm text-muted-foreground">
              Manage official public contact information, helpline numbers, and office location displayed in the website footer.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={saving}
          >
            <RotateCcw className="size-3.5 mr-1.5" /> Discard / Reload
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="shadow-sm font-medium"
          >
            <Save className="size-3.5 mr-1.5" />
            {saving ? "Saving..." : "Save & Publish"}
          </Button>
        </div>
      </div>

      {/* Master Enable & Live Status Card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="size-4 text-primary" /> Master Footer Contact Visibility
                </CardTitle>
                <CardDescription>
                  Enable or disable the entire Contact Us section in the public website footer.
                </CardDescription>
              </div>
              <Switch
                checked={isMasterEnabled}
                onCheckedChange={setIsMasterEnabled}
                aria-label="Master contact toggle"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={isMasterEnabled ? "default" : "secondary"}>
                {isMasterEnabled ? "Status: Publicly Active" : "Status: Hidden from Public"}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {activeCount} active contact item{activeCount === 1 ? "" : "s"} visible
              </Badge>
              {data?.updatedAt && (
                <span className="text-muted-foreground ml-auto">
                  Last updated: {new Date(data.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Public Footer Preview */}
        <Card className="bg-muted/40 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-muted-foreground">
              <Eye className="size-3.5" /> Live Public Footer Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-background p-4 text-sm shadow-xs">
              <h4 className="font-semibold text-xs tracking-wider uppercase text-muted-foreground mb-2">
                Contact Us
              </h4>
              {!isMasterEnabled || activeCount === 0 ? (
                <p className="text-xs italic text-muted-foreground py-2">
                  (No contact information will appear in the public footer)
                </p>
              ) : (
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {emailEnabled && email.trim() && (
                    <li className="flex items-center gap-2 text-foreground font-mono">
                      <Mail className="size-3 text-primary shrink-0" />
                      <span className="truncate">{email.trim()}</span>
                    </li>
                  )}
                  {enabledPhones.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-foreground">
                      <Phone className="size-3 text-primary shrink-0" />
                      <span>{p.number.trim()}</span>
                      {p.label && (
                        <span className="text-muted-foreground">({p.label.trim()})</span>
                      )}
                    </li>
                  ))}
                  {addressEnabled && address.trim() && (
                    <li className="flex items-start gap-2 text-foreground">
                      <MapPin className="size-3 text-primary shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{address.trim()}</span>
                    </li>
                  )}
                </ul>
              )}
              <div className="mt-3 pt-2 border-t flex items-center gap-1 text-[11px] text-muted-foreground">
                <Shield className="size-3" /> Admin Portal Link
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Email Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 grid place-items-center">
                <Mail className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Contact Email Address</CardTitle>
                <CardDescription>
                  Official inquiries email. Clickable via <code className="text-xs">mailto:</code> in the footer.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="email-enable-toggle" className="text-xs text-muted-foreground cursor-pointer">
                {emailEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id="email-enable-toggle"
                checked={emailEnabled}
                onCheckedChange={setEmailEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5 max-w-xl">
            <Label htmlFor="contact-email">Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="contact-email"
                type="email"
                placeholder="e.g. help@godavarione.ap.gov.in"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationErrors.email) {
                    setValidationErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                className={validationErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {email && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmail("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            {validationErrors.email ? (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="size-3" /> {validationErrors.email}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Leave empty or toggle off to hide the email row completely from the public footer.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phone Numbers & Helplines Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 grid place-items-center">
                <PhoneCall className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Contact Phone Numbers & Helplines</CardTitle>
                <CardDescription>
                  Configure toll-free helplines, emergency assistance, and desk contacts. Clickable via <code className="text-xs">tel:</code>.
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPhone}
              className="shadow-xs self-start sm:self-auto"
            >
              <Plus className="size-3.5 mr-1.5" /> Add Phone Number
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {phones.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center bg-muted/20">
              <PhoneCall className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-semibold">No Phone Numbers Configured</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                No phone or helpline numbers are currently added. The phone contact row will remain completely hidden in the public footer.
              </p>
              <Button size="sm" variant="secondary" onClick={handleAddPhone}>
                <Plus className="size-3.5 mr-1.5" /> Add First Helpline Number
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {phones.map((phone, index) => {
                const phoneError = validationErrors.phones?.[phone.id];
                return (
                  <div
                    key={phone.id}
                    className={`rounded-lg border p-4 transition-all ${
                      phone.isEnabled ? "bg-card" : "bg-muted/40 opacity-75"
                    } ${phoneError ? "border-destructive/80 ring-1 ring-destructive/40" : ""}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                      <div className="flex-1 grid gap-3 sm:grid-cols-2">
                        {/* Phone Number Input */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium flex items-center justify-between">
                            <span>Phone / Helpline Number #{index + 1}</span>
                            {!phone.isEnabled && (
                              <span className="text-[10px] text-muted-foreground font-normal">
                                (Currently Disabled)
                              </span>
                            )}
                          </Label>
                          <Input
                            placeholder="e.g. 14500 or +91 883 2450000"
                            value={phone.number}
                            onChange={(e) =>
                              handleUpdatePhone(phone.id, { number: e.target.value })
                            }
                            className={phoneError ? "border-destructive" : ""}
                          />
                          {phoneError && (
                            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                              <AlertCircle className="size-3" /> {phoneError}
                            </p>
                          )}
                        </div>

                        {/* Label Input with quick preset dropdown/buttons */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Custom Label</Label>
                          <Input
                            placeholder="e.g. Helpline, Support, Emergency"
                            value={phone.label}
                            onChange={(e) =>
                              handleUpdatePhone(phone.id, { label: e.target.value })
                            }
                          />
                          {/* Quick Preset Badges */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {PHONE_LABEL_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleUpdatePhone(phone.id, { label: preset })}
                                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                                  phone.label.toLowerCase() === preset.toLowerCase()
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Enable/Disable switch & Remove */}
                      <div className="flex items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 justify-end">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`phone-switch-${phone.id}`} className="text-xs cursor-pointer">
                            {phone.isEnabled ? "Active" : "Disabled"}
                          </Label>
                          <Switch
                            id={`phone-switch-${phone.id}`}
                            checked={phone.isEnabled}
                            onCheckedChange={(checked) =>
                              handleUpdatePhone(phone.id, { isEnabled: checked })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePhone(phone.id)}
                          className="text-destructive hover:bg-destructive/10 size-8"
                          title="Remove phone number"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organization Address & Location Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 grid place-items-center">
                <MapPin className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Organization Address & Location</CardTitle>
                <CardDescription>
                  Official administrative headquarters or nodal center location shown in the footer.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="address-enable-toggle" className="text-xs text-muted-foreground cursor-pointer">
                {addressEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id="address-enable-toggle"
                checked={addressEnabled}
                onCheckedChange={setAddressEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5 max-w-xl">
            <Label htmlFor="org-address">Physical Address / Headquarters Location</Label>
            <Textarea
              id="org-address"
              rows={3}
              placeholder="e.g. Godavari Pushkaralu Central Office, Rajahmundry, Andhra Pradesh, India"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (validationErrors.address) {
                  setValidationErrors((prev) => ({ ...prev, address: undefined }));
                }
              }}
              className={validationErrors.address ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {validationErrors.address ? (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="size-3" /> {validationErrors.address}
              </p>
            ) : (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Leave empty or toggle off to hide the address row completely.</span>
                <span>{address.length}/300</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Footer & Danger Zone */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetDialogOpen(true)}
          className="text-destructive hover:bg-destructive/10 border-destructive/30"
        >
          <Trash2 className="size-3.5 mr-1.5" /> Clear All Contact Details
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={saving}
          >
            Discard Changes
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="shadow-sm font-semibold"
          >
            <CheckCircle2 className="size-4 mr-1.5" />
            {saving ? "Publishing Changes..." : "Save & Publish Changes"}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog for Reset */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Footer Contact Details?</DialogTitle>
            <DialogDescription>
              This will remove all configured email addresses, phone numbers, and location details from the footer. The footer will display no contact details until re-configured.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? "Clearing..." : "Yes, Clear All Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

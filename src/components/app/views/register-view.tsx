"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Waves,
  Phone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  User,
  Loader2,
  ShieldCheck,
  Check,
  Radio,
} from "lucide-react";
import { SUPPORTED_COUNTRIES, DEFAULT_COUNTRY, CountryInfo } from "@/lib/country-data";
import { GoogleIcon } from "./login-view";

interface PhoneValidationState {
  isValidated: boolean;
  isAcceptable: boolean;
  carrierName: string | null;
  lineType: string;
  allocationStatus: string;
  rejectionReason?: string;
  provider: string;
}

export function RegisterView() {
  const { lang, navigate, setUser } = useApp();
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicateAccount, setIsDuplicateAccount] = useState(false);

  // External Phone Number Intelligence state
  const [validatingPhone, setValidatingPhone] = useState(false);
  const [phoneValidation, setPhoneValidation] = useState<PhoneValidationState | null>(null);

  // Client-side quick validation checks
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const isPasswordLongEnough = password.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

  function handleGoogleSignIn() {
    setGoogleLoading(true);
    const returnUrl = encodeURIComponent(window.location.pathname);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/v1/auth/google/initiate?returnUrl=${returnUrl}`;
  }

  // Validate phone number using external telephone intelligence (NO SMS OTP)
  async function validatePhoneNumber() {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      toast({ title: "Enter Phone Number", description: "Please enter a mobile number first to validate.", variant: "destructive" });
      return;
    }

    setValidatingPhone(true);
    setPhoneValidation(null);
    setErrorMessage(null);

    try {
      const res = await api.post<{ ok: boolean; data: any }>("/auth/phone/validate", {
        phone: cleanPhone,
        countryCode: selectedCountry.code,
      });

      const data = res.data;
      const isAcceptable = Boolean(data.isAcceptableForRegistration);

      setPhoneValidation({
        isValidated: true,
        isAcceptable,
        carrierName: data.carrierName,
        lineType: data.lineType,
        allocationStatus: data.allocationStatus,
        rejectionReason: data.rejectionReason,
        provider: data.provider,
      });

      if (isAcceptable) {
        toast({
          title: "Mobile Number Validated",
          description: `${data.carrierName ? `${data.carrierName} · ` : ""}Allocated ${data.lineType.toLowerCase()} number. (No SMS OTP required)`,
        });
      } else {
        toast({
          title: "Number Check Failed",
          description: data.rejectionReason || "This telephone number is not accepted for registration.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Validation Inconclusive",
        description: "External provider temporarily unavailable. Structural fallback applied.",
      });
      // Graceful resilience: allow proceeding with structural validation
      setPhoneValidation({
        isValidated: true,
        isAcceptable: true,
        carrierName: null,
        lineType: "MOBILE",
        allocationStatus: "UNKNOWN",
        provider: "fallback",
      });
    } finally {
      setValidatingPhone(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsDuplicateAccount(false);

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMessage("Please enter your mobile number.");
      return;
    }

    if (phoneValidation && !phoneValidation.isAcceptable) {
      setErrorMessage(phoneValidation.rejectionReason || "Please enter a valid mobile number.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter a password.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (!hasLetterAndNumber) {
      setErrorMessage("Password must contain both letters and numbers.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t(lang, "passwordsDoNotMatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<any>("/auth/register", {
        phone: cleanPhone,
        countryCode: selectedCountry.code,
        password,
        confirmPassword,
        name: name.trim() || undefined,
      });

      setUser(res);
      toast({
        title: "Welcome to Godavari One",
        description: res.name ? `Account created for ${res.name}!` : "Your visitor account has been created successfully.",
      });

      let targetView: any = { name: "home" };
      try {
        const pendingBookingRaw = sessionStorage.getItem("godavari_pending_booking");
        if (pendingBookingRaw) {
          const pending = JSON.parse(pendingBookingRaw);
          if (pending?.returnView) targetView = pending.returnView;
          else if (pending?.listingId) targetView = { name: "listing", id: pending.listingId };
          else if (pending?.type === "CEREMONY") targetView = { name: "ceremonies" };
          else if (pending?.type === "NRI_PACKAGE") targetView = { name: "nri-access" };
        } else {
          const pendingViewRaw = sessionStorage.getItem("godavari_pending_view");
          if (pendingViewRaw) {
            sessionStorage.removeItem("godavari_pending_view");
            const v = JSON.parse(pendingViewRaw);
            if (v?.name) targetView = v;
          }
        }
      } catch {}
      navigate(targetView);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create account. Please try again.";
      setErrorMessage(msg);

      if (
        (err instanceof ApiError && err.status === 409) ||
        msg.toLowerCase().includes("already exists") ||
        msg.toLowerCase().includes("already registered")
      ) {
        setIsDuplicateAccount(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-border/80">
        <CardHeader className="text-center pb-4">
          <span className="size-12 rounded-xl bg-primary text-primary-foreground grid place-items-center mx-auto mb-2 shadow-sm">
            <Waves className="size-6" />
          </span>
          <CardTitle className="text-2xl font-bold tracking-tight">{t(lang, "registerTitle")}</CardTitle>
          <CardDescription className="text-sm">
            {lang === "te"
              ? "గోదావరి పుష్కరాలు 2027 డిజిటల్ ప్లాట్‌ఫారమ్‌లో నమోదు చేసుకోండి"
              : "Register to access divine pilgrimages, bookings, and digital services"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Option 1: Continue with Google */}
          <Button
            type="button"
            variant="outline"
            className="w-full font-medium flex items-center justify-center gap-2.5 h-10 border-border/80 hover:bg-muted/80 transition-colors shadow-xs"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <GoogleIcon className="size-4" />}
            <span>Continue with Google</span>
          </Button>

          {/* Divider */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-medium">Or register with mobile</span>
            </div>
          </div>

          {errorMessage && (
            <Alert variant={isDuplicateAccount ? "default" : "destructive"} className={isDuplicateAccount ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800" : ""}>
              <AlertCircle className="size-4" />
              <AlertTitle className="font-semibold text-sm">
                {isDuplicateAccount ? t(lang, "alreadyRegistered") : "Registration Error"}
              </AlertTitle>
              <AlertDescription className="text-xs mt-1 flex flex-col gap-2">
                <span>{errorMessage}</span>
                {isDuplicateAccount && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-fit mt-1"
                    onClick={() => navigate({ name: "login" })}
                  >
                    {t(lang, "loginInstead")}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* International Country Selector & Mobile Number */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="register-phone" className="text-sm font-medium">
                  {t(lang, "mobileNumber")} <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={validatePhoneNumber}
                  disabled={validatingPhone || !phone.trim()}
                  className="text-xs text-primary hover:underline font-semibold cursor-pointer disabled:text-muted-foreground flex items-center gap-1"
                >
                  {validatingPhone ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      Checking...
                    </>
                  ) : phoneValidation?.isAcceptable ? (
                    <>
                      <Check className="size-3 text-emerald-600" />
                      Validated
                    </>
                  ) : (
                    "Validate Number"
                  )}
                </button>
              </div>

              <div className="flex gap-2 mt-1">
                <div className="relative w-[130px] shrink-0">
                  <select
                    aria-label="Country calling code"
                    className="w-full h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                    value={selectedCountry.code}
                    onChange={(e) => {
                      const found = SUPPORTED_COUNTRIES.find((c) => c.code === e.target.value);
                      if (found) {
                        setSelectedCountry(found);
                        setPhoneValidation(null);
                      }
                    }}
                  >
                    {SUPPORTED_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.callingCode} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="register-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                      if (phoneValidation) setPhoneValidation(null);
                    }}
                    placeholder={selectedCountry.placeholder}
                    className={`pl-9 h-9 ${phoneValidation?.isValidated && !phoneValidation.isAcceptable ? "border-destructive" : phoneValidation?.isAcceptable ? "border-emerald-500" : ""}`}
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>

              {/* Number Intelligence Status Feedback */}
              {phoneValidation && (
                <div className="mt-2 text-xs">
                  {phoneValidation.isAcceptable ? (
                    <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {phoneValidation.carrierName ? `${phoneValidation.carrierName} · ` : ""}
                          Valid {phoneValidation.lineType.toLowerCase()} number
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-background border-emerald-300 text-emerald-700 dark:text-emerald-300 py-0 h-4">
                        Allocated
                      </Badge>
                    </div>
                  ) : (
                    <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-1.5">
                      <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                      <span>{phoneValidation.rejectionReason || "Invalid or unallocated telephone number."}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground mt-1">
                {lang === "te"
                  ? "అంతర్జాతీయ నంబర్ ఇంటెలిజెన్స్ ద్వారా తనిఖీ చేయబడుతుంది (SMS OTP అవసరం లేదు)"
                  : "Validated via external telephone intelligence without SMS OTP"}
              </p>
            </div>

            {/* Optional Name Field */}
            <div>
              <Label htmlFor="register-name" className="text-sm font-medium">
                {t(lang, "name")} <span className="text-xs text-muted-foreground">({lang === "te" ? "ఐచ్ఛికం" : "Optional"})</span>
              </Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rama Rao"
                  className="pl-9 h-9"
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <Label htmlFor="register-password" className="text-sm font-medium">
                {t(lang, "password")} <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="pl-9 pr-10 h-9"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                  aria-label={showPassword ? t(lang, "hidePassword") : t(lang, "showPassword")}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className={`text-xs mt-1 transition-colors ${password && (!isPasswordLongEnough || !hasLetterAndNumber) ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                {t(lang, "passwordPolicyHint")}
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <Label htmlFor="register-confirm-password" className="text-sm font-medium">
                {t(lang, "confirmPassword")} <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="register-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className={`pl-9 pr-10 h-9 ${confirmPassword && !passwordsMatch ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                  aria-label={showConfirmPassword ? t(lang, "hidePassword") : t(lang, "showPassword")}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-destructive mt-1 font-medium">
                  {t(lang, "passwordsDoNotMatch")}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full mt-2 font-medium"
              disabled={loading || !phone.trim() || !password || !confirmPassword || !passwordsMatch || (phoneValidation?.isValidated && !phoneValidation.isAcceptable)}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t(lang, "loading")}
                </>
              ) : (
                t(lang, "registerButton")
              )}
            </Button>
          </form>

          {/* Link to Login */}
          <div className="text-center text-sm text-muted-foreground pt-2 border-t border-border/60">
            {t(lang, "haveAccount")}{" "}
            <button
              type="button"
              className="text-primary font-semibold hover:underline cursor-pointer"
              onClick={() => navigate({ name: "login" })}
            >
              {t(lang, "loginButton")}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

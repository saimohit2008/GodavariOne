"use client";

import { useState, useEffect } from "react";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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
  Mail,
  Smartphone,
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
  const [registerMethod, setRegisterMethod] = useState<"mobile" | "email">("mobile");

  // Registration input fields
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicateAccount, setIsDuplicateAccount] = useState(false);

  // Stage B: External Phone Number Intelligence state
  const [validatingPhone, setValidatingPhone] = useState(false);
  const [phoneValidation, setPhoneValidation] = useState<PhoneValidationState | null>(null);

  // Stage C: Phone Ownership Verification (SMS OTP)
  const [phoneOtpRequested, setPhoneOtpRequested] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [requestingPhoneOtp, setRequestingPhoneOtp] = useState(false);
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
  const [phoneOwnershipVerified, setPhoneOwnershipVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [smsServiceUnconfigured, setSmsServiceUnconfigured] = useState(false);

  // Email OTP Registration state
  const [emailOtpRequested, setEmailOtpRequested] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [requestingEmailOtp, setRequestingEmailOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);

  // Client-side quick validation checks
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const isPasswordLongEnough = password.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

  // Real-time Indian national number starting digit check
  const cleanPhoneDigits = phone.replace(/\D/g, "");
  let indianNational = cleanPhoneDigits;
  if (cleanPhoneDigits.length === 11 && cleanPhoneDigits.startsWith("0")) indianNational = cleanPhoneDigits.slice(1);
  else if (cleanPhoneDigits.length === 12 && cleanPhoneDigits.startsWith("91")) indianNational = cleanPhoneDigits.slice(2);
  const isIndianInvalidPrefix =
    selectedCountry.code === "IN" &&
    indianNational.length > 0 &&
    !["6", "7", "8", "9"].includes(indianNational[0]);

  // Check URL parameters on mount for OAuth errors
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      if (authError) {
        setErrorMessage(authError);
        toast({ title: "Sign-In Alert", description: authError, variant: "destructive" });
      }
    }
  }, []);

  function handleGoogleSignIn() {
    setGoogleLoading(true);
    const returnUrl = encodeURIComponent(window.location.pathname);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/v1/auth/google/initiate?returnUrl=${returnUrl}`;
  }

  // Stage B: Validate phone number using external telephone intelligence
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
          description: `${data.carrierName ? `${data.carrierName} · ` : ""}Allocated ${data.lineType.toLowerCase()} number.`,
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

  // Stage C: Request phone ownership verification OTP challenge
  async function requestPhoneOtp() {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMessage("Please enter a mobile number first.");
      return;
    }
    if (isIndianInvalidPrefix) {
      setErrorMessage("Indian mobile numbers must start with 6, 7, 8, or 9.");
      return;
    }

    setRequestingPhoneOtp(true);
    setErrorMessage(null);
    setSmsServiceUnconfigured(false);

    try {
      const res = await api.post<any>("/auth/phone/otp/request", {
        phone: cleanPhone,
        countryCode: selectedCountry.code,
      });
      setPhoneOtpRequested(true);
      toast({
        title: "Verification Code Sent",
        description: res.message || "A 6-digit OTP has been sent to your mobile number via SMS.",
      });
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Failed to send verification code.";
      if (err instanceof ApiError && err.status === 503) {
        setSmsServiceUnconfigured(true);
      }
      setErrorMessage(msg);
      toast({ title: "SMS Service Notice", description: msg, variant: "destructive" });
    } finally {
      setRequestingPhoneOtp(false);
    }
  }

  // Stage C: Confirm phone ownership verification OTP challenge
  async function verifyPhoneOtp() {
    if (phoneOtpCode.trim().length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setVerifyingPhoneOtp(true);
    setErrorMessage(null);

    try {
      const res = await api.post<any>("/auth/phone/otp/verify", {
        phone: phone.trim(),
        otpCode: phoneOtpCode.trim(),
        countryCode: selectedCountry.code,
      });
      setPhoneOwnershipVerified(true);
      setVerificationToken(res.verificationToken || null);
      toast({
        title: "Phone Verified",
        description: "Your mobile number ownership has been verified successfully.",
      });
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Invalid verification code. Please try again.";
      setErrorMessage(msg);
      toast({ title: "Verification Failed", description: msg, variant: "destructive" });
    } finally {
      setVerifyingPhoneOtp(false);
    }
  }

  // Email OTP: Initiate registration via Resend
  async function initiateEmailRegistration() {
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 8 || !hasLetterAndNumber) {
      setErrorMessage("Please enter a secure password (at least 8 characters with letters and numbers).");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t(lang, "passwordsDoNotMatch"));
      return;
    }

    setRequestingEmailOtp(true);
    setErrorMessage(null);

    try {
      const res = await api.post<any>("/auth/register/initiate", {
        name: name.trim() || "Visitor",
        email: email.trim(),
        phone: `email_user_${Date.now()}`,
        password,
      });
      setEmailOtpRequested(true);
      toast({
        title: "Verification Email Sent",
        description: res.message || "A 6-digit verification code was sent to your email address via Resend.",
      });
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Failed to send email verification code.";
      setErrorMessage(msg);
      toast({ title: "Email Delivery Notice", description: msg, variant: "destructive" });
    } finally {
      setRequestingEmailOtp(false);
    }
  }

  // Email OTP: Confirm registration
  async function completeEmailRegistration() {
    if (emailOtpCode.trim().length !== 6) {
      setErrorMessage("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setVerifyingEmailOtp(true);
    setErrorMessage(null);

    try {
      // 1. Verify email token
      await api.post<any>("/auth/email/verify", {
        email: email.trim(),
        token: emailOtpCode.trim(),
      });

      // 2. Complete registration
      const res = await api.post<any>("/auth/register/complete", {
        email: email.trim(),
      });

      setUser(res);
      toast({
        title: "Welcome to Godavari One",
        description: `Account created successfully for ${res.name || res.email}!`,
      });
      navigate({ name: "home" });
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Verification failed. Please check the code and try again.";
      setErrorMessage(msg);
      toast({ title: "Registration Failed", description: msg, variant: "destructive" });
    } finally {
      setVerifyingEmailOtp(false);
    }
  }

  // Complete Verified Phone Registration
  async function handlePhoneRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsDuplicateAccount(false);

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMessage("Please enter your mobile number.");
      return;
    }

    if (isIndianInvalidPrefix) {
      setErrorMessage("Indian mobile numbers must start with 6, 7, 8, or 9.");
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

    if (!phoneOwnershipVerified && !verificationToken) {
      setErrorMessage("Mobile number ownership verification is required. Please verify your number with an OTP challenge first.");
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
        verificationToken,
      });

      setUser(res);
      toast({
        title: "Welcome to Godavari One",
        description: res.name ? `Account created for ${res.name}!` : "Your visitor account has been created successfully.",
      });

      navigate({ name: "home" });
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
              <span className="bg-background px-2 text-muted-foreground font-medium">Or choose registration method</span>
            </div>
          </div>

          {/* Registration Method Toggle */}
          <div className="flex rounded-lg bg-muted p-1 gap-1">
            <button
              type="button"
              onClick={() => {
                setRegisterMethod("mobile");
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                registerMethod === "mobile"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="size-3.5" />
              <span>Mobile OTP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRegisterMethod("email");
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                registerMethod === "email"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="size-3.5" />
              <span>Email OTP (Instant)</span>
            </button>
          </div>

          {errorMessage && (
            <Alert
              variant={isDuplicateAccount ? "default" : "destructive"}
              className={
                isDuplicateAccount
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800"
                  : ""
              }
            >
              <AlertCircle className="size-4" />
              <AlertTitle className="font-semibold text-sm">
                {isDuplicateAccount ? "Account Already Exists" : "Registration Notice"}
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                {errorMessage}
                {isDuplicateAccount && (
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-xs text-primary font-bold underline block mt-2"
                    onClick={() => navigate({ name: "login" })}
                  >
                    {t(lang, "loginInstead")}
                  </Button>
                )}
                {smsServiceUnconfigured && (
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-xs text-primary font-bold underline block mt-2"
                    onClick={() => {
                      setRegisterMethod("email");
                      setErrorMessage(null);
                      setSmsServiceUnconfigured(false);
                    }}
                  >
                    Switch to Instant Email OTP Registration →
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* METHOD 1: MOBILE REGISTRATION */}
          {registerMethod === "mobile" && (
            <form onSubmit={handlePhoneRegister} className="space-y-4">
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
                          setPhoneOwnershipVerified(false);
                          setPhoneOtpRequested(false);
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
                        if (phoneOwnershipVerified) setPhoneOwnershipVerified(false);
                        if (phoneOtpRequested) setPhoneOtpRequested(false);
                      }}
                      placeholder={selectedCountry.placeholder}
                      className={`pl-9 h-9 ${
                        isIndianInvalidPrefix || (phoneValidation?.isValidated && !phoneValidation.isAcceptable)
                          ? "border-destructive focus-visible:ring-destructive"
                          : phoneOwnershipVerified
                          ? "border-emerald-500"
                          : ""
                      }`}
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>

                {/* Real-time Stage A validation feedback for India */}
                {isIndianInvalidPrefix && (
                  <p className="text-[11px] text-destructive mt-1 font-medium">
                    Indian mobile numbers must start with 6, 7, 8, or 9
                  </p>
                )}

                {/* Stage B Number Intelligence Feedback */}
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
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-background border-emerald-300 text-emerald-700 dark:text-emerald-300 py-0 h-4"
                        >
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
              </div>

              {/* Stage C: Phone Ownership Challenge (OTP) */}
              <div className="p-3 rounded-lg border border-border/80 bg-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className={`size-4 ${phoneOwnershipVerified ? "text-emerald-600" : "text-muted-foreground"}`} />
                    <span className="text-xs font-semibold">Phone Ownership Verification</span>
                  </div>
                  {phoneOwnershipVerified ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0 h-4 flex items-center gap-1">
                      <Check className="size-2.5" /> Verified
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={requestPhoneOtp}
                      disabled={requestingPhoneOtp || !phone.trim() || isIndianInvalidPrefix}
                      className="h-7 text-xs font-medium cursor-pointer"
                    >
                      {requestingPhoneOtp ? (
                        <>
                          <Loader2 className="size-3 animate-spin mr-1" />
                          Sending...
                        </>
                      ) : phoneOtpRequested ? (
                        "Resend OTP"
                      ) : (
                        "Send OTP"
                      )}
                    </Button>
                  )}
                </div>

                {phoneOtpRequested && !phoneOwnershipVerified && (
                  <div className="space-y-2 pt-1 border-t border-border/40">
                    <Label className="text-xs text-muted-foreground">Enter 6-digit SMS verification code:</Label>
                    <div className="flex items-center gap-2">
                      <InputOTP maxLength={6} value={phoneOtpCode} onChange={(v) => setPhoneOtpCode(v)}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                      <Button
                        type="button"
                        size="sm"
                        onClick={verifyPhoneOtp}
                        disabled={verifyingPhoneOtp || phoneOtpCode.length !== 6}
                        className="h-9 px-3 text-xs"
                      >
                        {verifyingPhoneOtp ? <Loader2 className="size-3 animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                  </div>
                )}
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
                disabled={
                  loading ||
                  !phone.trim() ||
                  isIndianInvalidPrefix ||
                  !password ||
                  !confirmPassword ||
                  !passwordsMatch ||
                  !phoneOwnershipVerified ||
                  (phoneValidation?.isValidated && !phoneValidation.isAcceptable)
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t(lang, "loading")}
                  </>
                ) : !phoneOwnershipVerified ? (
                  "Verify Phone OTP to Register"
                ) : (
                  t(lang, "registerButton")
                )}
              </Button>
            </form>
          )}

          {/* METHOD 2: INSTANT EMAIL OTP REGISTRATION (Resend Integration) */}
          {registerMethod === "email" && (
            <div className="space-y-4">
              {!emailOtpRequested ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="register-email" className="text-sm font-medium">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-9 h-9"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="register-email-name" className="text-sm font-medium">
                      {t(lang, "name")} <span className="text-xs text-muted-foreground">({lang === "te" ? "ఐచ్ఛికం" : "Optional"})</span>
                    </Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="register-email-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Rama Rao"
                        className="pl-9 h-9"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="register-email-password" className="text-sm font-medium">
                      {t(lang, "password")} <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="register-email-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-10 h-9"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t(lang, "passwordPolicyHint")}</p>
                  </div>

                  <div>
                    <Label htmlFor="register-email-confirm" className="text-sm font-medium">
                      {t(lang, "confirmPassword")} <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="register-email-confirm"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-9 pr-10 h-9"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={initiateEmailRegistration}
                    disabled={requestingEmailOtp || !email.trim() || !password || !confirmPassword || !passwordsMatch}
                    className="w-full mt-2 font-medium"
                  >
                    {requestingEmailOtp ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Sending Email OTP...
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/80">
                    <Mail className="size-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold">Verification Code Sent</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      We sent a 6-digit verification code to <span className="font-medium text-foreground">{email}</span>. Valid for 15 minutes.
                    </p>
                    <div className="mt-4 flex justify-center">
                      <InputOTP maxLength={6} value={emailOtpCode} onChange={(v) => setEmailOtpCode(v)}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={completeEmailRegistration}
                    disabled={verifyingEmailOtp || emailOtpCode.length !== 6}
                    className="w-full font-medium"
                  >
                    {verifyingEmailOtp ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Confirm & Create Account"
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setEmailOtpRequested(false)}
                    className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Change Email Address
                  </button>
                </div>
              )}
            </div>
          )}

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

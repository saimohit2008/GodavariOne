"use client";

import { useState, useEffect } from "react";
import { useApp, CurrentUser, PendingBooking, View } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  User,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { GoogleIcon } from "./views/login-view";

export function BookingAuthModal() {
  const {
    lang,
    user,
    setUser,
    navigate,
    bookingAuthModal,
    closeBookingAuthModal,
    pendingBooking,
    setPendingBooking,
  } = useApp();

  const [authTab, setAuthTab] = useState<"otp" | "password" | "register">("otp");

  // Email OTP state
  const [emailIdentifier, setEmailIdentifier] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Password state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Register state
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Reset internal state when modal opens/closes
  useEffect(() => {
    if (!bookingAuthModal.isOpen) {
      setOtpSent(false);
      setOtpCode("");
      setOtpError(null);
      setPasswordError(null);
      setRegError(null);
    } else {
      // Pre-fill email identifier if user had provided in pending context
      const ctxData = bookingAuthModal.context?.data;
      if (ctxData?.visitorEmail) setEmailIdentifier(ctxData.visitorEmail);
      else if (ctxData?.beneficiaryEmail) setEmailIdentifier(ctxData.beneficiaryEmail);
    }
  }, [bookingAuthModal.isOpen, bookingAuthModal.context]);

  // Handle countdown timer for Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleAuthSuccess = (authenticatedUser: CurrentUser) => {
    setUser(authenticatedUser);
    closeBookingAuthModal();

    toast({
      title: lang === "te" ? "సైన్ ఇన్ విజయవంతమైంది" : "Signed in successfully",
      description: lang === "te"
        ? "మీ బుకింగ్ వివరాలను సమీక్షించి, కన్ఫర్మ్ బటన్ క్లిక్ చేయండి."
        : "Please review your preserved booking details and confirm to proceed.",
    });

    if (bookingAuthModal.onAuthenticated) {
      bookingAuthModal.onAuthenticated(authenticatedUser);
    }
  };

  // Request Email OTP via Resend
  async function handleRequestOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const raw = emailIdentifier.trim();
    if (!raw) {
      setOtpError(lang === "te" ? "దయచేసి మీ నమోదిత ఇమెయిల్ లేదా ఫోన్ నంబర్ నమోదు చేయండి" : "Please enter your registered email address or mobile number");
      return;
    }

    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await api.post<{ ok: boolean; emailMasked?: string; message?: string }>("/auth/otp/request", {
        identifier: raw,
        purpose: "LOGIN",
      });

      if (res.emailMasked) {
        setMaskedEmail(res.emailMasked);
      }
      setOtpSent(true);
      setResendCooldown(60);
      toast({
        title: lang === "te" ? "OTP పంపబడింది" : "Verification Code Sent",
        description: res.message || (lang === "te" ? "ధృవీకరణ కోడ్ మీ ఇమెయిల్‌కు పంపబడింది." : "Verification code sent to your registered email."),
      });
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Failed to request verification code";
      setOtpError(msg);
      toast({
        title: lang === "te" ? "లోపం" : "OTP Request Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setOtpLoading(false);
    }
  }

  // Verify Email OTP
  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError(lang === "te" ? "దయచేసి పూర్తి 6-అంకెల కోడ్ నమోదు చేయండి" : "Please enter the full 6-digit verification code");
      return;
    }

    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await api.post<CurrentUser>("/auth/otp/verify", {
        identifier: emailIdentifier.trim(),
        otpCode: otpCode.trim(),
      });
      handleAuthSuccess(res);
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Invalid verification code";
      setOtpError(msg);
      toast({
        title: lang === "te" ? "ధృవీకరణ విఫలమైంది" : "Verification Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setOtpLoading(false);
    }
  }

  // Password Login
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword) {
      setPasswordError(lang === "te" ? "ఫోన్ నంబర్ మరియు పాస్‌వర్డ్ అవసరం" : "Mobile number and password are required");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    try {
      const res = await api.post<CurrentUser>("/auth/login", {
        phone: loginPhone.trim(),
        password: loginPassword,
      });
      handleAuthSuccess(res);
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Invalid mobile number or password";
      setPasswordError(msg);
      toast({
        title: lang === "te" ? "లాగిన్ విఫలమైంది" : "Login Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  // Visitor Registration
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regPhone.trim() || !regPassword) {
      setRegError(lang === "te" ? "మొబైల్ నంబర్ మరియు పాస్‌వర్డ్ అవసరం" : "Mobile number and password are required");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError(lang === "te" ? "పాస్‌వర్డ్‌లు సరిపోలడం లేదు" : "Passwords do not match");
      return;
    }

    setRegLoading(true);
    setRegError(null);
    try {
      const res = await api.post<{ ok: boolean; user?: CurrentUser }>("/auth/register", {
        phone: regPhone.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
        name: regName.trim() || null,
        email: regEmail.trim() || null,
      });

      // Fetch user profile from /auth/me after registration
      const meRes = await api.get<{ user: CurrentUser }>("/auth/me");
      handleAuthSuccess(meRes.user);
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Failed to create account";
      setRegError(msg);
      toast({
        title: lang === "te" ? "నమోదు విఫలమైంది" : "Registration Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setRegLoading(false);
    }
  }

  const contextTitle = bookingAuthModal.context?.title;
  const contextDetails = bookingAuthModal.context?.details;

  return (
    <Dialog open={bookingAuthModal.isOpen} onOpenChange={(open) => !open && closeBookingAuthModal()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-teal-200 dark:border-teal-900 shadow-2xl">
        {/* Header with Godavari One Sacred River Branding */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-800 text-white p-5 sm:p-6 text-center relative">
          <div className="size-11 rounded-xl bg-white/15 text-white grid place-items-center mx-auto mb-2.5 backdrop-blur-xs border border-white/20 shadow-xs">
            <ShieldCheck className="size-6 text-emerald-300" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {t(lang, "bookingAuthTitle")}
          </DialogTitle>
          <DialogDescription className="text-teal-100 text-xs sm:text-sm mt-1 max-w-sm mx-auto leading-relaxed">
            {t(lang, "bookingAuthRequired")}
          </DialogDescription>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Preserved Booking Info Pill */}
          {contextTitle && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 dark:bg-teal-950/20 dark:border-teal-900/60 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-teal-900 dark:text-teal-200">
                <Sparkles className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate">{contextTitle}</span>
              </div>
              {contextDetails && (
                <p className="text-teal-700 dark:text-teal-300 line-clamp-1 pl-5">
                  {contextDetails}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5 pl-5">
                <CheckCircle2 className="size-3 text-emerald-600" />
                {t(lang, "bookingPreservedNotice")}
              </p>
            </div>
          )}

          {/* Quick Google Sign-In */}
          <Button
            type="button"
            variant="outline"
            className="w-full font-medium flex items-center justify-center gap-2 h-9 text-xs border-border/80 hover:bg-muted/80 shadow-xs"
            onClick={() => {
              if (bookingAuthModal.context) {
                try {
                  sessionStorage.setItem(
                    "godavari_pending_booking",
                    JSON.stringify({
                      type: bookingAuthModal.context.type,
                      data: bookingAuthModal.context.data,
                      returnView: { name: "home" },
                    })
                  );
                } catch {}
              }
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = `/api/v1/auth/google/initiate?returnUrl=${encodeURIComponent(window.location.pathname)}`;
            }}
          >
            <GoogleIcon className="size-3.5" />
            <span>Continue with Google</span>
          </Button>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-background px-2 text-muted-foreground font-medium">Or choose login method</span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setAuthTab("otp");
                setOtpError(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                authTab === "otp"
                  ? "bg-background shadow-xs font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(lang, "signInToBook")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab("password");
                setPasswordError(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                authTab === "password"
                  ? "bg-background shadow-xs font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(lang, "signInWithPassword")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab("register");
                setRegError(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                authTab === "register"
                  ? "bg-background shadow-xs font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(lang, "quickRegister")}
            </button>
          </div>

          {/* TAB 1: Email OTP Login (Mandatory Primary Option) */}
          {authTab === "otp" && (
            <div className="space-y-4">
              {otpError && (
                <Alert variant="destructive" className="py-2.5 text-xs">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="space-y-1">
                    <p>{otpError}</p>
                    {otpError.toLowerCase().includes("register") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs mt-1 bg-background"
                        onClick={() => setAuthTab("register")}
                      >
                        {t(lang, "quickRegister")}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {!otpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="booking-auth-email" className="text-xs font-medium">
                      {t(lang, "registeredEmailOrPhone")}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="booking-auth-email"
                        type="text"
                        value={emailIdentifier}
                        onChange={(e) => {
                          setEmailIdentifier(e.target.value);
                          if (otpError) setOtpError(null);
                        }}
                        placeholder="your-email@example.com or mobile"
                        className="pl-9 h-10 text-sm"
                        autoComplete="email"
                        required
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      We will send a secure single-use 6-digit verification code to your email.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold h-10"
                    disabled={otpLoading || !emailIdentifier.trim()}
                  >
                    {otpLoading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-4 animate-spin" /> Sending Code...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {t(lang, "sendEmailOtp")} <ArrowRight className="size-4" />
                      </span>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                  <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                    <p className="font-medium text-foreground">
                      Verification code sent via Resend email to:
                    </p>
                    <p className="font-mono text-xs text-teal-800 dark:text-teal-300 font-bold">
                      {maskedEmail || emailIdentifier}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Valid for 15 minutes. Enter the 6-digit code below.
                    </p>
                  </div>

                  <div className="space-y-1.5 flex flex-col items-center">
                    <Label className="text-xs font-medium self-start">
                      {t(lang, "enterOtpCode")}
                    </Label>
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(val) => {
                        setOtpCode(val);
                        if (otpError) setOtpError(null);
                      }}
                      autoFocus
                    >
                      <InputOTPGroup className="gap-1.5 sm:gap-2">
                        <InputOTPSlot index={0} className="size-10 text-base font-bold" />
                        <InputOTPSlot index={1} className="size-10 text-base font-bold" />
                        <InputOTPSlot index={2} className="size-10 text-base font-bold" />
                        <InputOTPSlot index={3} className="size-10 text-base font-bold" />
                        <InputOTPSlot index={4} className="size-10 text-base font-bold" />
                        <InputOTPSlot index={5} className="size-10 text-base font-bold" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold h-10"
                    disabled={otpLoading || otpCode.length !== 6}
                  >
                    {otpLoading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="size-4 animate-spin" /> Verifying...
                      </span>
                    ) : (
                      <span>{t(lang, "verifyAndContinue")}</span>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode("");
                        setOtpError(null);
                      }}
                    >
                      Change email
                    </Button>

                    {resendCooldown > 0 ? (
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <Clock className="size-3" /> Resend in {resendCooldown}s
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-7 text-xs text-teal-700 dark:text-teal-300 p-0"
                        onClick={() => handleRequestOtp()}
                        disabled={otpLoading}
                      >
                        Resend code
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: Mobile Number & Password Login */}
          {authTab === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-3.5">
              {passwordError && (
                <Alert variant="destructive" className="py-2.5 text-xs">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label htmlFor="booking-login-phone" className="text-xs font-medium">
                  {t(lang, "mobileNumber")}
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="booking-login-phone"
                    type="tel"
                    value={loginPhone}
                    onChange={(e) => {
                      setLoginPhone(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="9876543210 or +91 98765 43210"
                    className="pl-9 h-10 text-sm"
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="booking-login-password" className="text-xs font-medium">
                  {t(lang, "password")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="booking-login-password"
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    className="pl-9 pr-10 h-10 text-sm"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold h-10"
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-4 animate-spin" /> Signing In...
                  </span>
                ) : (
                  <span>{t(lang, "loginButton")}</span>
                )}
              </Button>
            </form>
          )}

          {/* TAB 3: Quick Registration */}
          {authTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-3">
              {regError && (
                <Alert variant="destructive" className="py-2.5 text-xs">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{regError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1">
                <Label htmlFor="booking-reg-name" className="text-xs font-medium">
                  {t(lang, "name")}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="booking-reg-name"
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Sri Rama / Devotee Name"
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="booking-reg-phone" className="text-xs font-medium">
                    {t(lang, "mobileNumber")} *
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      id="booking-reg-phone"
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="9876543210"
                      className="pl-8 h-9 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="booking-reg-email" className="text-xs font-medium">
                    {t(lang, "email")} (for OTP & vouchers)
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      id="booking-reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="devotee@example.com"
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="booking-reg-password" className="text-xs font-medium">
                    {t(lang, "password")} *
                  </Label>
                  <Input
                    id="booking-reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="h-9 text-sm"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="booking-reg-confirm" className="text-xs font-medium">
                    {t(lang, "confirmPassword")} *
                  </Label>
                  <Input
                    id="booking-reg-confirm"
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="h-9 text-sm"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold h-10 mt-1"
                disabled={regLoading}
              >
                {regLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-4 animate-spin" /> Creating Account...
                  </span>
                ) : (
                  <span>Register & Continue to Booking</span>
                )}
              </Button>
            </form>
          )}

          <div className="border-t pt-3 text-center">
            <p className="text-[11px] text-muted-foreground">
              By signing in, you accept Godavari One pushkaralu fair-usage and holy pilgrimage security terms.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reusable hook for any booking button, form, or card across the application.
 * If user is already authenticated, returns true immediately.
 * If unauthenticated, preserves the booking state, displays the sign-in requirement,
 * and executes onAuthenticated only when verified.
 */
export function useBookingAuth() {
  const { user, openBookingAuthModal, setPendingBooking } = useApp();

  const requireAuth = (
    booking: {
      type: "HOTEL" | "RESTAURANT" | "FREE_ACCOMMODATION" | "CEREMONY" | "PRIORITY_GHAT" | "NRI_PACKAGE";
      listingId?: string;
      title?: string;
      details?: string;
      data?: Record<string, any>;
      returnView?: View;
    },
    onAuthenticated: (user: CurrentUser) => void
  ): boolean => {
    if (user) {
      return true;
    }

    // Preserve non-sensitive booking details in Zustand store and sessionStorage
    setPendingBooking({
      type: booking.type,
      listingId: booking.listingId,
      title: booking.title,
      data: booking.data,
      returnView: booking.returnView,
    });

    // Display the clean centralized authentication gate dialog
    openBookingAuthModal({
      context: {
        type: booking.type,
        title: booking.title,
        details: booking.details,
        data: booking.data,
      },
      onAuthenticated: (authenticatedUser) => {
        onAuthenticated(authenticatedUser);
      },
    });

    return false;
  };

  return { user, requireAuth };
}

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
import { Waves, Phone, Lock, Eye, EyeOff, Mail, AlertCircle, Send, Loader2, Globe2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { SUPPORTED_COUNTRIES, DEFAULT_COUNTRY, CountryInfo } from "@/lib/country-data";

export function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function LoginView() {
  const { lang, navigate, setUser } = useApp();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [linkRequiredEmail, setLinkRequiredEmail] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      const isLinkRequired = params.get("link_required");
      const linkEmail = params.get("email");

      if (authError) {
        setLoginError(authError);
        toast({ title: "Sign-In Alert", description: authError, variant: "destructive" });
      }

      if (isLinkRequired && linkEmail) {
        setLinkRequiredEmail(linkEmail);
        setEmailOrPhone(linkEmail);
        setMode("password");
      }
    }
  }, []);

  function getRedirectTarget(): any {
    try {
      const pendingBookingRaw = sessionStorage.getItem("godavari_pending_booking");
      if (pendingBookingRaw) {
        const pending = JSON.parse(pendingBookingRaw);
        if (pending?.returnView) return pending.returnView;
        if (pending?.listingId) return { name: "listing", id: pending.listingId };
        if (pending?.type === "CEREMONY") return { name: "ceremonies" };
        if (pending?.type === "NRI_PACKAGE") return { name: "nri-access" };
      }
      const pendingViewRaw = sessionStorage.getItem("godavari_pending_view");
      if (pendingViewRaw) {
        sessionStorage.removeItem("godavari_pending_view");
        const v = JSON.parse(pendingViewRaw);
        if (v?.name) return v;
      }
    } catch {}
    return { name: "home" };
  }

  function handleGoogleSignIn() {
    setGoogleLoading(true);
    const returnUrl = encodeURIComponent(window.location.pathname);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/v1/auth/google/initiate?returnUrl=${returnUrl}`;
  }

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      const res = await api.post<any>("/auth/login", {
        phone: phone.trim(),
        countryCode: selectedCountry.code,
        password,
      });
      setUser(res);
      toast({ title: "Welcome back", description: res.name || res.phone });
      navigate(getRedirectTarget());
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Invalid mobile number or password.";
      setLoginError(msg);
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function startCooldown() {
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function requestOtp() {
    if (!emailOrPhone.trim()) {
      toast({ title: "Error", description: "Enter your registered email address or phone", variant: "destructive" });
      return;
    }
    setLoading(true);
    setOtpError(null);
    try {
      const res = await api.post<any>("/auth/otp/request", { identifier: emailOrPhone.trim(), purpose: "LOGIN" });
      if (res.emailMasked) setMaskedEmail(res.emailMasked);
      setOtpRequested(true);
      startCooldown();
      toast({ title: "Email OTP Sent", description: res.message || "Verification code sent to your email." });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to request verification code";
      setOtpError(msg);
      toast({ title: "OTP Request Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otpCode.length !== 6) {
      toast({ title: "Incomplete Code", description: "Please enter the full 6-digit code.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<any>("/auth/otp/verify", { identifier: emailOrPhone.trim(), otpCode });
      setUser(res);
      toast({ title: "Welcome", description: res.name || res.phone });
      navigate(getRedirectTarget());
    } catch (e) {
      toast({ title: "Verification failed", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" });
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
          <CardTitle className="text-2xl font-bold tracking-tight">{t(lang, "loginTitle")}</CardTitle>
          <CardDescription className="text-sm">
            {t(lang, "brand")} · {t(lang, "tagline")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Security Alert: Account Linking Required */}
          {linkRequiredEmail && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
              <AlertCircle className="size-4" />
              <AlertTitle className="font-semibold text-sm">Account Verification Required</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                An account with <strong>{linkRequiredEmail}</strong> already exists. To securely link your Google account and prevent unauthorized access, please log in below using your password or email OTP.
              </AlertDescription>
            </Alert>
          )}

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
              <span className="bg-background px-2 text-muted-foreground font-medium">Or continue with</span>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => { setMode("password"); setOtpRequested(false); setOtpError(null); }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${mode === "password" ? "bg-background shadow-sm font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(lang, "loginWithPassword")}
            </button>
            <button
              type="button"
              onClick={() => { setMode("otp"); setOtpError(null); }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${mode === "otp" ? "bg-background shadow-sm font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(lang, "loginWithOtp")}
            </button>
          </div>

          {/* Mode 1: Mobile Number & Password Login (Default) */}
          {mode === "password" ? (
            <form onSubmit={loginPassword} className="space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle className="font-semibold text-sm">Login Failed</AlertTitle>
                  <AlertDescription className="flex flex-col gap-2 mt-1 text-xs">
                    <span>{loginError}</span>
                    {(loginError.toLowerCase().includes("register") || loginError.toLowerCase().includes("no longer exists")) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-fit bg-background text-foreground hover:bg-muted font-medium mt-1"
                        onClick={() => navigate({ name: "register" })}
                      >
                        {t(lang, "registerButton")}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* International Country Selector & Mobile Number */}
              <div>
                <Label htmlFor="login-phone" className="text-sm font-medium">
                  {t(lang, "mobileNumber")}
                </Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative w-[130px] shrink-0">
                    <select
                      aria-label="Country calling code"
                      className="w-full h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                      value={selectedCountry.code}
                      onChange={(e) => {
                        const found = SUPPORTED_COUNTRIES.find((c) => c.code === e.target.value);
                        if (found) setSelectedCountry(found);
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
                      id="login-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (loginError) setLoginError(null);
                      }}
                      placeholder={selectedCountry.placeholder}
                      className="pl-9 h-9"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Password Field with Show/Hide Toggle */}
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-sm font-medium">
                    {t(lang, "password")}
                  </Label>
                  <button
                    type="button"
                    onClick={() => navigate({ name: "forgot-password" })}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    {t(lang, "forgotPassword")}
                  </button>
                </div>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    className="pl-9 pr-10"
                    autoComplete="current-password"
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
              </div>

              <Button type="submit" className="w-full mt-2 font-medium" disabled={loading || !phone.trim() || !password}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t(lang, "loading")}
                  </>
                ) : (
                  t(lang, "loginButton")
                )}
              </Button>
            </form>
          ) : !otpRequested ? (
            /* Mode 2: Email OTP Login via Resend (preserved backward compatibility) */
            <div className="space-y-4">
              <div>
                <Label htmlFor="login-identifier" className="text-sm font-medium">Registered Email or Phone</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="login-identifier"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder="name@example.com or 9876543210"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  We'll send a single-use 6-digit login code to your verified email address via Resend.
                </p>
              </div>

              {otpError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle className="font-semibold text-sm">OTP Error</AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    {otpError}
                    {otpError.includes("password") && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMode("password");
                            if (!phone && /^\d+$/.test(emailOrPhone.trim())) {
                              setPhone(emailOrPhone.trim());
                            }
                            setOtpError(null);
                          }}
                        >
                          Log in with Password Instead
                        </Button>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={requestOtp} className="w-full" disabled={loading || !emailOrPhone.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t(lang, "loading")}
                  </>
                ) : (
                  "Send Email OTP"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <Label className="text-sm font-medium">{t(lang, "enterOtp")}</Label>
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to {maskedEmail || "your registered email"}. Check your inbox (or Spam folder).
                </p>
              </div>

              <div className="py-2">
                <InputOTP maxLength={6} value={otpCode} onChange={(v) => setOtpCode(v)} className="mx-auto">
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button onClick={verifyOtp} className="w-full" disabled={loading || otpCode.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t(lang, "loading")}
                  </>
                ) : (
                  t(lang, "verifyOtp")
                )}
              </Button>

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setOtpRequested(false); setOtpCode(""); setOtpError(null); }}
                >
                  ← {t(lang, "back")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={requestOtp}
                  disabled={loading || resendCooldown > 0}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Send className="size-3 mr-1" />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </Button>
              </div>
            </div>
          )}

          {/* Links: Register and Admin Login */}
          <div className="text-center text-sm text-muted-foreground pt-2 border-t border-border/60">
            {t(lang, "noAccount")}{" "}
            <button
              type="button"
              className="text-primary font-semibold hover:underline cursor-pointer"
              onClick={() => navigate({ name: "register" })}
            >
              {t(lang, "registerButton")}
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => navigate({ name: "admin-login" })}
          >
            {t(lang, "adminLogin")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

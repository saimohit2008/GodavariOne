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
import { Waves, Phone, Lock, Eye, EyeOff, Mail, AlertCircle, Send, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function LoginView() {
  const { lang, navigate, setUser } = useApp();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    try {
      const res = await api.post<any>("/auth/login", {
        phone: phone.trim(),
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

              {/* Mobile Number Field */}
              <div>
                <Label htmlFor="login-phone" className="text-sm font-medium">
                  {t(lang, "mobileNumber")}
                </Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="login-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="9876543210 or +91 98765 43210"
                    className="pl-9"
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>

              {/* Password Field with Show/Hide Toggle */}
              <div>
                <Label htmlFor="login-password" className="text-sm font-medium">
                  {t(lang, "password")}
                </Label>
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

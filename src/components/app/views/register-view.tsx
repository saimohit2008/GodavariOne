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
import { Waves, Phone, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, User, Loader2 } from "lucide-react";

export function RegisterView() {
  const { lang, navigate, setUser } = useApp();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicateAccount, setIsDuplicateAccount] = useState(false);

  // Client-side quick validation checks
  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const isPasswordLongEnough = password.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsDuplicateAccount(false);

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMessage("Please enter your mobile number.");
      return;
    }

    const digitsOnly = cleanPhone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      setErrorMessage("Please enter a valid mobile number with at least 10 digits.");
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
              : "Register with your mobile number to access all digital services"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            {/* Mobile Number Field */}
            <div>
              <Label htmlFor="register-phone" className="text-sm font-medium">
                {t(lang, "mobileNumber")} <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="register-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="9876543210 or +91 98765 43210"
                  className="pl-9"
                  autoComplete="tel"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "te"
                  ? "10-అంకెల భారతీయ మొబైల్ లేదా దేశం కోడ్‌తో కూడిన అంతర్జాతీయ నంబర్"
                  : "Standard 10-digit mobile number, or include country code (e.g. +91 / +1)"}
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
                  className="pl-9"
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
                  className="pl-9 pr-10"
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
                  className={`pl-9 pr-10 ${confirmPassword && !passwordsMatch ? "border-destructive focus-visible:ring-destructive" : ""}`}
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
              disabled={loading || !phone.trim() || !password || !confirmPassword || !passwordsMatch}
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

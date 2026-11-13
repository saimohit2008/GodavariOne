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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Lock,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  ShieldCheck,
  Send,
} from "lucide-react";

interface ForgotPasswordViewProps {
  initialEmail?: string;
}

export function ForgotPasswordView({ initialEmail = "" }: ForgotPasswordViewProps) {
  const { lang, navigate } = useApp();

  // Multi-step state: "request" | "verify" | "reset" | "success"
  const [step, setStep] = useState<"request" | "verify" | "reset" | "success">("request");
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend OTP cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Step 1: Request Password Reset OTP
  async function handleRequestOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const res = await api.post<{ ok: boolean; message: string; expiresInSeconds?: number }>("/auth/password/forgot", {
        email: cleanEmail,
      });

      setStatusMessage(res.message || "A 6-digit recovery code has been sent to your email.");
      setCooldown(60);
      setStep("verify");
      toast({
        title: "Code Dispatched",
        description: "Check your email for your 6-digit verification code.",
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to send reset code. Please try again.";
      setError(msg);
      toast({ title: "Request Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify 6-digit OTP Code
  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{ ok: boolean; resetToken: string; message: string }>("/auth/password/verify", {
        email: email.trim(),
        otpCode: otpCode.trim(),
      });

      if (res.resetToken) {
        setResetToken(res.resetToken);
        setStep("reset");
        toast({
          title: "Code Verified",
          description: "You may now create a new password.",
        });
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Invalid or expired verification code.";
      setError(msg);
      toast({ title: "Verification Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Complete Password Reset
  async function handleCompleteReset(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError(t(lang, "passwordsDoNotMatch"));
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError(t(lang, "passwordPolicyHint"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        email: email.trim(),
        newPassword,
        confirmPassword,
      };

      if (resetToken) {
        payload.resetToken = resetToken;
      } else {
        payload.otpCode = otpCode.trim();
      }

      await api.post<{ ok: boolean; message: string }>("/auth/password/reset", payload);

      setStep("success");
      toast({
        title: "Password Reset Successfully",
        description: "Your account is secure. Please log in with your new password.",
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to reset password. Please try again.";
      setError(msg);
      toast({ title: "Reset Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Live password validation checks
  const hasMinLength = newPassword.length >= 8;
  const hasLetters = /[a-zA-Z]/.test(newPassword);
  const hasNumbers = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-border/80">
        <CardHeader className="text-center pb-4">
          <div className="size-12 rounded-xl bg-primary text-primary-foreground grid place-items-center mx-auto mb-2 shadow-sm">
            {step === "success" ? (
              <CheckCircle2 className="size-6 text-primary-foreground" />
            ) : step === "reset" ? (
              <KeyRound className="size-6 text-primary-foreground" />
            ) : (
              <Lock className="size-6 text-primary-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {step === "success"
              ? t(lang, "passwordResetSuccessTitle")
              : step === "reset"
              ? t(lang, "newPassword")
              : t(lang, "forgotPasswordTitle")}
          </CardTitle>
          <CardDescription className="text-sm">
            {step === "success"
              ? t(lang, "passwordResetSuccessMessage")
              : step === "reset"
              ? t(lang, "newPasswordDescription")
              : step === "verify"
              ? `Enter the 6-digit code sent to ${email}`
              : t(lang, "forgotPasswordDescription")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle className="font-semibold text-sm">Error</AlertTitle>
              <AlertDescription className="text-xs mt-1">{error}</AlertDescription>
            </Alert>
          )}

          {statusMessage && step === "verify" && (
            <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="size-4" />
              <AlertDescription className="text-xs">{statusMessage}</AlertDescription>
            </Alert>
          )}

          {/* STEP 1: Email Input Form */}
          {step === "request" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <Label htmlFor="reset-email" className="text-sm font-medium">
                  Registered Email Address
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="name@example.com"
                    className="pl-9 h-10"
                    autoComplete="email"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Recovery codes are delivered exclusively to verified email addresses.
                </p>
              </div>

              <Button type="submit" className="w-full h-10 font-medium" disabled={loading || !email.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t(lang, "loading")}
                  </>
                ) : (
                  <>
                    <Send className="size-4 mr-2" />
                    {t(lang, "sendRecoveryCode")}
                  </>
                )}
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => navigate({ name: "login" })}
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft className="size-3.5 mr-1" />
                  {t(lang, "backToLogin")}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: 6-Digit OTP Verification Form */}
          {step === "verify" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center space-y-2">
                <Label className="text-sm font-medium">Enter 6-Digit Verification Code</Label>
                <div className="flex justify-center pt-2">
                  <InputOTP maxLength={6} value={otpCode} onChange={(val) => { setOtpCode(val); if (error) setError(null); }}>
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
                <p className="text-xs text-muted-foreground pt-1">
                  ⏱️ Code is valid for 15 minutes.
                </p>
              </div>

              <Button type="submit" className="w-full h-10 font-medium" disabled={loading || otpCode.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Continue"
                )}
              </Button>

              {/* Resend Cooldown Section */}
              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("request");
                    setOtpCode("");
                    setError(null);
                  }}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center font-medium cursor-pointer"
                >
                  <ArrowLeft className="size-3 mr-1" />
                  Change email
                </button>

                {cooldown > 0 ? (
                  <span className="text-muted-foreground">Resend code in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRequestOtp()}
                    disabled={loading}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          )}

          {/* STEP 3: Create New Password Form */}
          {step === "reset" && (
            <form onSubmit={handleCompleteReset} className="space-y-4">
              <div>
                <Label htmlFor="new-password" className="text-sm font-medium">
                  {t(lang, "newPassword")}
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter new password"
                    className="pl-9 pr-10 h-10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-new-password" className="text-sm font-medium">
                  {t(lang, "confirmPassword")}
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Confirm new password"
                    className="pl-9 pr-10 h-10"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Live Password Strength Indicator */}
              <div className="p-3 bg-muted/60 rounded-lg space-y-1.5 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">Password Requirements:</div>
                <div className="flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${hasMinLength ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <span className={hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${hasLetters && hasNumbers ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <span className={hasLetters && hasNumbers ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                    Contains both letters and numbers
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${passwordsMatch ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <span className={passwordsMatch ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                    Passwords match
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 font-medium"
                disabled={loading || !hasMinLength || !hasLetters || !hasNumbers || !passwordsMatch}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  t(lang, "resetPasswordButton")
                )}
              </Button>
            </form>
          )}

          {/* STEP 4: Password Reset Complete */}
          {step === "success" && (
            <div className="space-y-4 pt-2 text-center">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-200 text-xs text-left space-y-1">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Account Secured
                </div>
                <p>All previous active sessions have been safely terminated.</p>
                <p>Please log in using your registered mobile number and your new password.</p>
              </div>

              <Button
                type="button"
                className="w-full h-10 font-medium cursor-pointer"
                onClick={() => navigate({ name: "login" })}
              >
                {t(lang, "loginButton")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

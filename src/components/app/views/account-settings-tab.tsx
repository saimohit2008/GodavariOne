"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  History,
  Check,
  Smartphone,
  Info,
  QrCode,
  Copy,
  Key,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SecurityLog {
  id: string;
  action: string;
  createdAt: string;
  ip: string | null;
  details: string | null;
}

interface AccountData {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function AccountSettingsTab() {
  const { user, setUser } = useApp();

  // Account data and security log state
  const [account, setAccount] = useState<AccountData | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [loadingAccount, setLoadingAccount] = useState(true);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Change Mobile Number state
  const [currentPasswordForPhone, setCurrentPasswordForPhone] = useState("");
  const [showCurrentPasswordForPhone, setShowCurrentPasswordForPhone] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  const [otpCode, setOtpCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // MFA state
  const [mfaData, setMfaData] = useState<{ mfaEnabled: boolean; remainingRecoveryCodes: number } | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUri: string; qrSvg: string; recoveryCodes: string[] } | null>(null);
  const [mfaTotpInput, setMfaTotpInput] = useState("");
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaDisableModalOpen, setMfaDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [regenTotp, setRegenTotp] = useState("");
  const [newRegenCodes, setNewRegenCodes] = useState<string[] | null>(null);

  async function loadMfaStatus() {
    try {
      const res = await api.get<{ mfaEnabled: boolean; remainingRecoveryCodes: number }>("/admin/mfa/status");
      setMfaData(res);
    } catch {
      // fallback
    }
  }

  async function handleStartMfaSetup() {
    setMfaLoading(true);
    try {
      const res = await api.get<any>("/admin/mfa/setup");
      setMfaSetupData(res);
      setMfaTotpInput("");
      setCopiedCodes(false);
      setCopiedSecret(false);
      setMfaModalOpen(true);
    } catch (e: any) {
      toast({ title: "Setup Failed", description: e?.message || "Failed to start MFA setup", variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleConfirmEnableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaTotpInput || mfaTotpInput.length !== 6) {
      toast({ title: "Invalid Code", description: "Please enter the 6-digit TOTP code.", variant: "destructive" });
      return;
    }
    setMfaLoading(true);
    try {
      await api.post("/admin/mfa/enable", { totpCode: mfaTotpInput });
      toast({ title: "MFA Enabled", description: "Super Admin account is now protected with authenticator TOTP." });
      setMfaModalOpen(false);
      await loadMfaStatus();
      await loadAccountData();
    } catch (e: any) {
      toast({ title: "Verification Failed", description: e?.message || "Invalid code", variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleConfirmDisableMfa(e: React.FormEvent) {
    e.preventDefault();
    setMfaLoading(true);
    try {
      await api.post("/admin/mfa/disable", { password: disablePassword, confirmCode: disableCode });
      toast({ title: "MFA Disabled", description: "Two-factor authentication has been disabled." });
      setMfaDisableModalOpen(false);
      setDisablePassword("");
      setDisableCode("");
      await loadMfaStatus();
      await loadAccountData();
    } catch (e: any) {
      toast({ title: "Disable Failed", description: e?.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleConfirmRegenCodes(e: React.FormEvent) {
    e.preventDefault();
    setMfaLoading(true);
    try {
      const res = await api.post<any>("/admin/mfa/recovery-codes", { password: regenPassword, totpCode: regenTotp });
      setNewRegenCodes(res.recoveryCodes);
      setRegenPassword("");
      setRegenTotp("");
      toast({ title: "Recovery Codes Regenerated", description: "8 new single-use recovery codes have been generated." });
      await loadMfaStatus();
    } catch (e: any) {
      toast({ title: "Regeneration Failed", description: e?.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  }

  // Load account profile and security logs
  async function loadAccountData() {
    setLoadingAccount(true);
    try {
      const res = await api.get<{ account: AccountData; securityLogs: SecurityLog[] }>("/admin/account");
      setAccount(res.account);
      setSecurityLogs(res.securityLogs || []);
    } catch {
      // Fallback to Zustand user if endpoint unavailable
      if (user) {
        setAccount({
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          status: user.status,
          phoneVerified: user.phoneVerified,
          emailVerified: false,
          mfaEnabled: user.mfaEnabled,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } finally {
      setLoadingAccount(false);
    }
  }

  useEffect(() => {
    loadAccountData();
    loadMfaStatus();
  }, []);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Password Update
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password cannot be identical to your current password.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.post<{ ok: boolean; message: string }>("/admin/account/password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordSuccess(res.message || "Password updated successfully. Use your new password on next login.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password Updated",
        description: "Your Super Admin password was changed securely.",
      });
      loadAccountData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update password.";
      setPasswordError(msg);
      toast({
        title: "Password Update Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  // Handle Mobile Number Change — Step 1: Request Verification Code
  async function handleRequestPhoneVerification(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    setPhoneSuccess(null);
    setDevCode(null);

    if (!currentPasswordForPhone) {
      setPhoneError("Current password is required to verify your identity.");
      return;
    }

    const cleanNew = newPhone.replace(/\D/g, "").slice(-10);
    if (cleanNew.length < 10) {
      setPhoneError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    const currentClean = (account?.phone || user?.phone || "").replace(/\D/g, "").slice(-10);
    if (cleanNew === currentClean) {
      setPhoneError("The new mobile number cannot be the same as your current registered number.");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await api.post<{
        ok: boolean;
        message: string;
        phone: string;
        ttlSeconds: number;
        devCode?: string;
      }>("/admin/account/phone/request", {
        currentPassword: currentPasswordForPhone,
        newPhone: cleanNew,
      });

      setPhoneStep(2);
      setResendCooldown(60);
      if (res.devCode) {
        setDevCode(res.devCode);
      }
      toast({
        title: "Verification Code Sent",
        description: res.message || `Code dispatched to ${cleanNew}.`,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to initiate mobile number change.";
      setPhoneError(msg);
      toast({
        title: "Request Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setPhoneLoading(false);
    }
  }

  // Handle Mobile Number Change — Step 2: Confirm OTP Verification
  async function handleConfirmPhoneVerification(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    setPhoneSuccess(null);

    if (!otpCode || otpCode.trim().length < 4) {
      setPhoneError("Please enter the verification code sent to the new mobile number.");
      return;
    }

    const cleanNew = newPhone.replace(/\D/g, "").slice(-10);

    setPhoneLoading(true);
    try {
      const res = await api.post<{
        ok: boolean;
        message: string;
        user: AccountData;
      }>("/admin/account/phone/confirm", {
        currentPassword: currentPasswordForPhone,
        newPhone: cleanNew,
        otpCode: otpCode.trim(),
      });

      setPhoneSuccess(res.message || `Mobile number successfully updated to ${cleanNew}.`);
      setPhoneStep(1);
      setOtpCode("");
      setNewPhone("");
      setCurrentPasswordForPhone("");
      setDevCode(null);

      // Update active user in Zustand store so Header and views reflect the new phone immediately
      if (user) {
        setUser({
          ...user,
          phone: cleanNew,
          phoneVerified: true,
        });
      }

      toast({
        title: "Mobile Number Updated",
        description: `Your login mobile number is now ${cleanNew}.`,
      });

      loadAccountData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to verify code.";
      setPhoneError(msg);
      toast({
        title: "Verification Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setPhoneLoading(false);
    }
  }

  const currentDisplayPhone = account?.phone || user?.phone || "9999999999";
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = newPassword && confirmPassword && newPassword !== confirmPassword;

  return (
    <div className="space-y-6">
      {/* 1. Account Profile Summary Header */}
      <Card className="border-primary/20 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <ShieldCheck className="size-6" />
              </span>
              <div>
                <CardTitle className="text-xl">Super Admin Account Security</CardTitle>
                <CardDescription>
                  Manage your administrative credentials, primary login phone, and security policies.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 px-3 py-1 font-semibold">
                SUPER_ADMIN
              </Badge>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1">
                Active System Principal
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t text-sm">
          <div className="p-3 rounded-lg bg-muted/40">
            <span className="text-xs text-muted-foreground block mb-0.5">Administrator Name</span>
            <span className="font-semibold">{account?.name || user?.name || "Super Admin"}</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/40">
            <span className="text-xs text-muted-foreground block mb-0.5">Primary Login Mobile</span>
            <div className="flex items-center gap-1.5 font-semibold font-mono">
              <Phone className="size-3.5 text-primary" />
              <span>{currentDisplayPhone}</span>
              <span title="Verified"><Check className="size-3.5 text-emerald-600 ml-1" /></span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/40">
            <span className="text-xs text-muted-foreground block mb-0.5">Password Hashing Standard</span>
            <span className="font-medium text-xs font-mono text-foreground flex items-center gap-1">
              <Lock className="size-3 text-muted-foreground" /> scrypt-64 (Salted)
            </span>
          </div>
          <div className="p-3 rounded-lg bg-muted/40">
            <span className="text-xs text-muted-foreground block mb-0.5">Two-Step Login Protection</span>
            <span className="font-semibold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> Enforced by System
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2-Column Grid: Change Password & Change Mobile */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* ==================================================================== */}
        {/* SECTION 1: CHANGE ADMINISTRATIVE PASSWORD */}
        {/* ==================================================================== */}
        <Card className="border-border/80 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <span className="size-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 grid place-items-center">
                  <Lock className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-lg">Change Password</CardTitle>
                  <CardDescription>
                    Requires your current password. Passwords are securely hashed via scrypt.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {passwordSuccess && (
                  <Alert className="border-emerald-600/30 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription className="text-xs text-emerald-800 dark:text-emerald-300">
                      {passwordSuccess}
                    </AlertDescription>
                  </Alert>
                )}

                {passwordError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="text-xs">{passwordError}</AlertDescription>
                  </Alert>
                )}

                {/* 1. Current Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current Password *</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="pl-9 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                      aria-label="Toggle password visibility"
                    >
                      {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* 2. New Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="pl-9 pr-10"
                      minLength={6}
                      maxLength={128}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                      aria-label="Toggle password visibility"
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Must be at least 6 characters long. Choose a strong combination.
                  </span>
                </div>

                {/* 3. Confirm New Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="confirm-password">Confirm New Password *</Label>
                    {passwordsMatch && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="size-3" /> Passwords match
                      </span>
                    )}
                    {passwordsMismatch && (
                      <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
                        Passwords do not match
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="pl-9 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                      aria-label="Toggle password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError(null);
                      setPasswordSuccess(null);
                    }}
                    disabled={passwordLoading}
                  >
                    Clear Form
                  </Button>
                  <Button type="submit" disabled={passwordLoading} className="shadow-sm">
                    {passwordLoading ? (
                      <>
                        <RefreshCw className="size-4 mr-2 animate-spin" /> Updating...
                      </>
                    ) : (
                      <>
                        <Lock className="size-4 mr-1.5" /> Update Password
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </div>
          <CardFooter className="bg-muted/20 border-t py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0" />
            <span>Updating password preserves your active session. Use the new password for your next login.</span>
          </CardFooter>
        </Card>

        {/* ==================================================================== */}
        {/* SECTION 2: CHANGE ADMINISTRATIVE MOBILE NUMBER */}
        {/* ==================================================================== */}
        <Card className="border-border/80 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <span className="size-9 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 grid place-items-center">
                  <Smartphone className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-lg">Change Login Mobile Number</CardTitle>
                  <CardDescription>
                    Requires current-password confirmation and OTP code verification.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {phoneSuccess && (
                <Alert className="mb-4 border-emerald-600/30 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <AlertTitle>Mobile Number Updated</AlertTitle>
                  <AlertDescription className="text-xs text-emerald-800 dark:text-emerald-300">
                    {phoneSuccess}
                  </AlertDescription>
                </Alert>
              )}

              {phoneError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="text-xs">{phoneError}</AlertDescription>
                </Alert>
              )}

              {phoneStep === 1 ? (
                /* Step 1: Request OTP with Current Password Confirmation */
                <form onSubmit={handleRequestPhoneVerification} className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex items-center justify-between">
                    <span>Current Registered Mobile:</span>
                    <span className="font-bold font-mono text-foreground">{currentDisplayPhone}</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone-current-password">Current Password Confirmation *</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="phone-current-password"
                        type={showCurrentPasswordForPhone ? "text" : "password"}
                        value={currentPasswordForPhone}
                        onChange={(e) => setCurrentPasswordForPhone(e.target.value)}
                        placeholder="Confirm with current password"
                        className="pl-9 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPasswordForPhone(!showCurrentPasswordForPhone)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label="Toggle password visibility"
                      >
                        {showCurrentPasswordForPhone ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      To prevent unauthorized changes, password re-authentication is mandatory.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-mobile">New Mobile Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="new-mobile"
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Enter 10-digit mobile number"
                        className="pl-9 font-mono"
                        maxLength={15}
                        required
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      A 6-digit verification code will be dispatched to this number.
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button type="submit" disabled={phoneLoading} className="shadow-sm">
                      {phoneLoading ? (
                        <>
                          <RefreshCw className="size-4 mr-2 animate-spin" /> Verifying...
                        </>
                      ) : (
                        <>
                          Send Verification Code <ArrowRight className="size-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                /* Step 2: Confirm OTP */
                <form onSubmit={handleConfirmPhoneVerification} className="space-y-4">
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Target Mobile Number:</span>
                      <span className="font-bold font-mono text-primary">{newPhone}</span>
                    </div>
                    <p className="text-[11px]">
                      Enter the 6-digit verification code dispatched to complete the mobile number update.
                    </p>
                  </div>

                  {devCode && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <span className="font-medium">Verification Code (Dev Mode):</span>
                      <code className="px-2 py-0.5 rounded bg-amber-500/20 font-bold font-mono tracking-widest text-sm">
                        {devCode}
                      </code>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="otp-input">6-Digit Verification Code *</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="otp-input"
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="000000"
                        className="pl-9 font-mono tracking-widest text-base"
                        maxLength={8}
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPhoneStep(1);
                        setOtpCode("");
                        setPhoneError(null);
                      }}
                      disabled={phoneLoading}
                    >
                      ← Back
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRequestPhoneVerification}
                        disabled={phoneLoading || resendCooldown > 0}
                      >
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend Code"}
                      </Button>

                      <Button type="submit" disabled={phoneLoading} className="shadow-sm">
                        {phoneLoading ? (
                          <>
                            <RefreshCw className="size-4 mr-2 animate-spin" /> Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-4 mr-1.5" /> Apply Change
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </div>
          <CardFooter className="bg-muted/20 border-t py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 shrink-0" />
            <span>Once applied, this new mobile number must be used for administrative logins.</span>
          </CardFooter>
        </Card>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2.5: SUPER ADMIN MULTI-FACTOR AUTHENTICATION (MFA / TOTP) */}
      {/* ==================================================================== */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="size-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 grid place-items-center">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Multi-Factor Authentication (TOTP)</CardTitle>
                {mfaData?.mfaEnabled ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs">
                    Protected & Enforced
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-xs">
                    Disabled
                  </Badge>
                )}
              </div>
              <CardDescription>
                Authenticator-app-based TOTP verification (Google Authenticator, Microsoft Authenticator, 1Password, Authy).
              </CardDescription>
            </div>
          </div>
          {mfaData?.mfaEnabled ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setNewRegenCodes(null); setRegenModalOpen(true); }}
                className="text-xs gap-1.5"
              >
                <Key className="size-3.5" /> Recovery Codes ({mfaData.remainingRecoveryCodes}/8)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMfaDisableModalOpen(true)}
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                Disable MFA
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleStartMfaSetup}
              disabled={mfaLoading}
              className="gap-1.5 shadow-sm"
            >
              <QrCode className="size-4" /> Set Up Authenticator App
            </Button>
          )}
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          {mfaData?.mfaEnabled ? (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-start gap-3 text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-foreground">Authenticator App Enforced</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Every sign-in to the Super Admin dashboard strictly requires a 6-digit TOTP code or single-use recovery code. MFA secrets are encrypted at rest with AES-256-GCM.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-3 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-foreground">MFA is Currently Disabled</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enabling MFA is strongly recommended before deploying to public production to prevent unauthorized administrative takeover.
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/20 border-t py-2.5 text-xs text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5 shrink-0" />
            <span>Time-based One-Time Passwords (RFC 6238) with AES-256-GCM encrypted secret storage.</span>
          </span>
          <span className="font-mono text-[11px]">
            {mfaData?.mfaEnabled ? `${mfaData.remainingRecoveryCodes} recovery codes remaining` : "0 / 8 codes active"}
          </span>
        </CardFooter>
      </Card>

      {/* MFA Enrollment Modal */}
      <Dialog open={mfaModalOpen} onOpenChange={setMfaModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> Set Up Authenticator App (MFA)
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, or Authy).
            </DialogDescription>
          </DialogHeader>

          {mfaSetupData && (
            <div className="space-y-4 py-2 text-xs">
              {/* QR Code */}
              <div className="flex flex-col items-center justify-center p-3 bg-muted/40 rounded-xl border border-border">
                <div
                  dangerouslySetInnerHTML={{ __html: mfaSetupData.qrSvg }}
                  className="size-48 bg-white p-2 rounded-lg shadow-sm grid place-items-center"
                />
                <span className="mt-2 text-[11px] text-muted-foreground">Scan with your mobile authenticator app</span>
              </div>

              {/* Manual Entry Secret */}
              <div className="space-y-1.5">
                <Label className="text-xs">Can't scan? Enter this key manually:</Label>
                <div className="flex items-center gap-2">
                  <Input value={mfaSetupData.secret} readOnly className="font-mono text-xs bg-muted/50" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(mfaSetupData.secret);
                      setCopiedSecret(true);
                      setTimeout(() => setCopiedSecret(false), 2000);
                    }}
                  >
                    {copiedSecret ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    {copiedSecret ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              {/* Recovery Codes */}
              <div className="space-y-1.5 bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Key className="size-3.5 text-primary" /> Single-Use Recovery Codes
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(mfaSetupData.recoveryCodes.join("\n"));
                      setCopiedCodes(true);
                      setTimeout(() => setCopiedCodes(false), 2000);
                    }}
                  >
                    {copiedCodes ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    {copiedCodes ? "Copied All" : "Copy Codes"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Save these codes now. If you lose access to your device, each code can be used once to sign in.
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1 font-mono text-[11px]">
                  {mfaSetupData.recoveryCodes.map((code, idx) => (
                    <div key={idx} className="bg-background px-2 py-1 rounded border text-center">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Form */}
              <form onSubmit={handleConfirmEnableMfa} className="space-y-3 pt-2 border-t">
                <div>
                  <Label className="text-xs">Enter 6-digit code from your authenticator app to confirm:</Label>
                  <Input
                    value={mfaTotpInput}
                    onChange={(e) => setMfaTotpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="font-mono text-center tracking-widest text-lg font-bold mt-1"
                    required
                    autoFocus
                  />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMfaModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={mfaLoading || mfaTotpInput.length !== 6}>
                    {mfaLoading ? <RefreshCw className="size-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="size-4 mr-1.5" />}
                    Verify & Enable MFA
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MFA Disable Confirmation Modal */}
      <Dialog open={mfaDisableModalOpen} onOpenChange={setMfaDisableModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" /> Disable Multi-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Reauthentication is required to disable MFA. You will need your current password and a current authenticator code.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmDisableMfa} className="space-y-3 py-2 text-xs">
            <div>
              <Label>Account Password</Label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Current Authenticator or Recovery Code</Label>
              <Input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="6-digit code or XXXX-XXXXXX"
                required
                className="mt-1 font-mono"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setMfaDisableModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" size="sm" disabled={mfaLoading || !disablePassword || !disableCode}>
                {mfaLoading ? <RefreshCw className="size-4 mr-1.5 animate-spin" /> : "Confirm Disable MFA"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Regenerate Recovery Codes Modal */}
      <Dialog open={regenModalOpen} onOpenChange={setRegenModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-5 text-primary" /> Regenerate Recovery Codes
            </DialogTitle>
            <DialogDescription>
              Generates 8 new single-use recovery codes. All previously generated codes will be invalidated.
            </DialogDescription>
          </DialogHeader>

          {newRegenCodes ? (
            <div className="space-y-3 py-2 text-xs">
              <Alert className="border-emerald-600/30 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <AlertTitle>New Codes Generated</AlertTitle>
                <AlertDescription className="text-xs">
                  Copy and store these codes immediately. Previous codes are no longer valid.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-center text-xs">
                {newRegenCodes.map((code, idx) => (
                  <div key={idx} className="bg-muted p-1.5 rounded border">
                    {code}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newRegenCodes.join("\n"));
                    toast({ title: "Copied", description: "All recovery codes copied to clipboard." });
                  }}
                  className="w-full gap-1.5"
                >
                  <Copy className="size-4" /> Copy All & Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleConfirmRegenCodes} className="space-y-3 py-2 text-xs">
              <div>
                <Label>Account Password</Label>
                <Input
                  type="password"
                  value={regenPassword}
                  onChange={(e) => setRegenPassword(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Current 6-Digit Authenticator Code</Label>
                <Input
                  value={regenTotp}
                  onChange={(e) => setRegenTotp(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="mt-1 font-mono text-center tracking-widest text-base font-bold"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setRegenModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={mfaLoading || !regenPassword || !regenTotp}>
                  {mfaLoading ? <RefreshCw className="size-4 mr-1.5 animate-spin" /> : "Regenerate Codes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* SECTION 3: RECENT ADMINISTRATIVE SECURITY AUDIT LOG */}
      {/* ==================================================================== */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <History className="size-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-semibold">Security Activity & Audit Log</CardTitle>
              <CardDescription className="text-xs">
                Real-time record of Super Admin credential actions and login events.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAccountData}
            disabled={loadingAccount}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`size-3.5 ${loadingAccount ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loadingAccount ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading security events...</div>
          ) : securityLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No recent credential updates recorded.
            </div>
          ) : (
            <div className="divide-y text-xs">
              {securityLogs.map((log) => {
                const actionBadgeColor =
                  log.action === "ADMIN_PASSWORD_CHANGED" || log.action === "ADMIN_PHONE_CHANGED"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : log.action.includes("FAILED")
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-muted text-muted-foreground border-border";

                return (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${actionBadgeColor}`}>
                        {log.action}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {log.details ? log.details : "System administrative operation"}
                      </span>
                    </div>
                    <div className="shrink-0 text-right text-muted-foreground font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

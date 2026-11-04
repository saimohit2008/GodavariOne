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
import { Shield, Phone, Lock, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

export function AdminLoginView() {
  const { lang, navigate, setUser } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function step1(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<any>("/auth/admin-login", { phone, password });
      setRequiresMfa(!!res.requiresMfa);
      setStep(2);
      toast({ title: "Credentials verified", description: "Complete the second step to continue." });
    } catch (e) {
      toast({ title: "Access denied", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function step2(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<any>("/auth/admin-login/verify", { phone, password, confirmCode });
      setUser(res);
      toast({ title: "Welcome, Administrator", description: res.name });
      navigate({ name: "admin", tab: "overview" });
    } catch (e) {
      toast({ title: "Verification failed", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-6 bg-muted/30">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center">
          <span className="size-12 rounded-xl bg-primary text-primary-foreground grid place-items-center mx-auto mb-2">
            <Shield className="size-6" />
          </span>
          <CardTitle className="text-2xl">{t(lang, "adminLogin")}</CardTitle>
          <CardDescription>
            {step === 1 ? t(lang, "adminLoginStep1") : t(lang, "adminLoginStep2")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className={`size-7 rounded-full grid place-items-center text-xs font-bold ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>1</span>
            <span className="h-0.5 w-8 bg-border" />
            <span className={`size-7 rounded-full grid place-items-center text-xs font-bold ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>2</span>
          </div>

          {step === 1 ? (
            <form onSubmit={step1} className="space-y-4">
              <div>
                <Label>{t(lang, "phone")}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-9" required />
                </div>
              </div>
              <div>
                <Label>{t(lang, "password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? t(lang, "loading") : t(lang, "confirm")}</Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate({ name: "home" })}>
                <ArrowLeft className="size-4" /> {t(lang, "backHome")}
              </Button>
            </form>
          ) : (
            <form onSubmit={step2} className="space-y-4">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-muted-foreground">
                {requiresMfa
                  ? "Enter the 6-digit TOTP code from your authenticator app, or an unused 10-character recovery code."
                  : "Confirm to complete the secure administrative sign-in."}
              </div>
              {requiresMfa && (
                <div>
                  <Label>{t(lang, "confirmCode")}</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      className="pl-9 font-mono"
                      placeholder="e.g. 123456 or XXXX-XXXXXX"
                      maxLength={16}
                      required
                      autoFocus
                    />
                  </div>
                </div>
              )}
              {!requiresMfa && (
                <div className="flex items-center justify-center py-3">
                  <CheckCircle2 className="size-10 text-primary" />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? t(lang, "loading") : t(lang, "confirm")}</Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep(1)}>← {t(lang, "back")}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

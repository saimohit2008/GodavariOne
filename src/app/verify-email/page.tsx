"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Mail, Waves } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || searchParams.get("code");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token || !email) {
      setStatus("error");
      setErrorMessage("Verification link is missing required code or email parameter.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch("/api/v1/auth/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Verification failed. The link may have expired or already been used.");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMessage("Network error verifying email. Please check your connection.");
      }
    }

    verify();
  }, [token, email]);

  return (
    <Card className="w-full max-w-md shadow-lg border-muted">
      <CardHeader className="text-center pb-2">
        <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center mx-auto mb-2">
          <Waves className="size-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Godavari One</CardTitle>
        <CardDescription>Godavari Pushkaralu 2027 Email Verification</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 text-center space-y-4">
        {status === "loading" && (
          <div className="py-8 space-y-3">
            <Loader2 className="size-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Validating your email verification link...</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-6 space-y-4">
            <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto">
              <CheckCircle2 className="size-10" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Email Verified Successfully!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your email address <strong className="text-foreground">{email}</strong> has been verified. You can now complete your registration or log in.
              </p>
            </div>
            <Button onClick={() => router.push("/")} className="w-full mt-4">
              Return to Godavari One
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 space-y-4">
            <div className="size-16 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto">
              <XCircle className="size-10" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Verification Failed</h3>
              <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
            </div>
            <Button variant="outline" onClick={() => router.push("/")} className="w-full mt-4">
              Return to Home
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Suspense
        fallback={
          <Card className="w-full max-w-md p-8 text-center">
            <Loader2 className="size-8 animate-spin text-primary mx-auto" />
          </Card>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { NriPackageRequestForm } from "@/components/app/nri/nri-package-request-form";
import { Suspense } from "react";
import { BookingAuthModal } from "@/components/app/booking-auth-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Globe } from "lucide-react";

function NriAccessContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") || undefined;

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Breadcrumb & Visible "Back to Home" Navigation Bar */}
      <div className="bg-muted/40 border-b py-2 px-3 sm:px-4 sticky top-16 z-30 backdrop-blur-md">
        <div className="container mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors group"
            id="nri-top-back-to-home"
            title="Return to Godavari One Homepage"
          >
            <ArrowLeft className="size-3.5 sm:size-4 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline">← Back to Main Homepage</span>
            <span className="sm:hidden">Home</span>
          </Link>

          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary flex items-center gap-1">
              <Home className="size-3 sm:size-3.5" />
              <span>Home</span>
            </Link>
            <span>/</span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Globe className="size-3 text-teal-600" />
              <span>NRI Access</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto max-w-7xl px-4 py-6 md:py-10">
        <NriPackageRequestForm initialRef={initialRef} />
      </div>
    </div>
  );
}

export default function NriAccessPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 container mx-auto max-w-5xl px-4 py-12 space-y-4">
              <Skeleton className="h-12 w-2/3 mx-auto" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          }
        >
          <NriAccessContent />
        </Suspense>
      </main>
      <Footer />
      <BookingAuthModal />
    </div>
  );
}

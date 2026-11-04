"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Calendar,
  Building,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Sparkles,
  Share2,
  Check,
  Tag,
  ShieldCheck,
  Compass,
  ArrowRight,
  Info,
  Clock,
  Eye,
  Layers,
} from "lucide-react";

export interface CarouselDetailData {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl: string;
  destinationUrl?: string | null;
  orderIdx: number;
  isEnabled: boolean;
  status: "PUBLISHED" | "DRAFT";
  contentType: string;
  advertiserName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  location?: string | null;
  websiteUrl?: string | null;
  ctaLabel?: string | null;
  destinationType?: string | null;
  listingId?: string | null;
  slug?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: {
    id: string;
    name: string;
    category: string;
    address: string;
    town?: string | null;
    district?: string | null;
    phone?: string | null;
    email?: string | null;
    description?: string | null;
    mapsUrl?: string | null;
    images?: Array<{ url: string; isPrimary: boolean }>;
  } | null;
  createdBy?: { id: string; name: string | null } | null;
  lastEditedBy?: { id: string; name: string | null } | null;
}

const CONTENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ADVERTISEMENT: { label: "Advertisement & Sponsorship", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300" },
  EVENT: { label: "Festival & Event Spotlight", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300" },
  ANNOUNCEMENT: { label: "Official Announcement", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300" },
  TOURIST_ATTRACTION: { label: "Tourist Attraction", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300" },
  HOTEL: { label: "Hotel & Stay Spotlight", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-300" },
  RESTAURANT: { label: "Restaurant & Culinary", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300" },
  NRI_INFORMATION: { label: "NRI & International Pilgrims", color: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-300" },
  GENERAL_PROMOTION: { label: "Pushkaralu 2027 Highlight", color: "bg-primary/10 text-primary border-primary/30" },
};

export function CarouselDetailView({ id }: { id: string }) {
  const { navigate } = useApp();
  const [data, setData] = useState<CarouselDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadItem() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<CarouselDetailData>(`/carousel/${id}`);
        if (isMounted) setData(res);
      } catch (err: any) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : "Item not found or unavailable");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadItem();
    return () => {
      isMounted = false;
    };
  }, [id]);

  function copyShareLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast({ title: "Link copied to clipboard", description: "You can share this detail page with others." });
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleCtaClick() {
    if (!data) return;

    // 1. Linked directory listing
    if (data.destinationType === "DIRECTORY_LISTING" && data.listing?.id) {
      navigate({ name: "listing", id: data.listing.id });
      return;
    }

    // 2. NRI section
    if (data.destinationType === "NRI_SECTION" || data.destinationUrl?.startsWith("/nri-access")) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/nri-access";
      return;
    }

    // 3. Custom internal destination
    if (data.destinationUrl?.startsWith("/")) {
      if (data.destinationUrl.startsWith("/directory")) {
        const urlObj = new URL(data.destinationUrl, "http://localhost");
        const category = urlObj.searchParams.get("category") || undefined;
        const q = urlObj.searchParams.get("q") || undefined;
        navigate({ name: "directory", category, q });
      } else if (data.destinationUrl === "/" || data.destinationUrl === "") {
        navigate({ name: "home" });
      } else {
        window.location.assign(data.destinationUrl);
      }
      return;
    }

    // 4. External URL
    if (data.destinationUrl) {
      window.open(data.destinationUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // 5. Fallback to websiteUrl
    if (data.websiteUrl) {
      window.open(data.websiteUrl, "_blank", "noopener,noreferrer");
      return;
    }

    toast({ title: "Information Item", description: "This advertisement is an informative bulletin." });
  }

  const formatIstDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <div className="grid md:grid-cols-3 gap-6 pt-4">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 container mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <div className="size-16 rounded-full bg-muted grid place-items-center mx-auto text-muted-foreground">
          <Info className="size-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Campaign Detail Unavailable</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {error || "The requested advertisement or highlight details could not be found."}
        </p>
        <div className="pt-4 flex justify-center gap-3">
          <Button variant="default" onClick={() => navigate({ name: "home" })}>
            <ArrowLeft className="size-4 mr-2" /> Return to Homepage
          </Button>
          <Button variant="outline" onClick={() => navigate({ name: "directory" })}>
            Explore Directory
          </Button>
        </div>
      </div>
    );
  }

  const typeMeta = CONTENT_TYPE_LABELS[data.contentType] || CONTENT_TYPE_LABELS.GENERAL_PROMOTION;
  const startFmt = formatIstDate(data.startDate);
  const endFmt = formatIstDate(data.endDate);
  const hasDates = Boolean(startFmt || endFmt);
  const hasContact = Boolean(data.advertiserName || data.contactPhone || data.contactEmail || data.location || data.websiteUrl);

  return (
    <div className="flex-1 container mx-auto max-w-5xl px-4 py-8 space-y-8 animate-in fade-in-50 duration-300">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ name: "home" })}
          className="gap-2 font-semibold text-primary hover:text-primary/80"
          id="carousel-back-to-home"
        >
          <ArrowLeft className="size-4" /> Back to Homepage
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyShareLink}
            className="gap-1.5 text-xs shadow-xs"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Share2 className="size-3.5" />}
            <span>{copied ? "Link Copied" : "Share"}</span>
          </Button>
        </div>
      </div>

      {/* Hero Banner Showcase */}
      <div className="relative aspect-[16/9] sm:aspect-[21/9] md:aspect-[2.4/1] w-full rounded-2xl overflow-hidden border bg-muted shadow-md">
        <img
          src={data.imageUrl}
          alt={data.title}
          className="w-full h-full object-cover object-center"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&auto=format&fit=crop&q=80";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute top-4 left-4">
          <Badge variant="outline" className={`backdrop-blur-md px-3 py-1 text-xs font-semibold ${typeMeta.color} bg-background/90`}>
            <Sparkles className="size-3 mr-1.5" />
            {typeMeta.label}
          </Badge>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight drop-shadow-md text-white">
            {data.title}
          </h1>
          {data.subtitle && (
            <p className="text-xs sm:text-sm text-white/90 font-medium drop-shadow-xs mt-1">
              {data.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Description & Rich Details */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="size-4 text-primary" /> Campaign & Event Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {data.description ? (
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {data.description}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No additional description was provided for this highlight.
                </p>
              )}

              {/* Validity timeline badge if scheduled/dates */}
              {hasDates && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 border text-xs text-muted-foreground mt-4">
                  <Calendar className="size-4 text-primary shrink-0" />
                  <span>
                    <strong>Validity / Dates:</strong>{" "}
                    {startFmt ? startFmt : "Immediate"} {endFmt ? `through ${endFmt}` : "(Open Ongoing)"}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Directory Listing Card (if linked) */}
          {data.listing && (
            <Card className="shadow-xs border-teal-200 dark:border-teal-900 overflow-hidden">
              <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 border-b pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-teal-900 dark:text-teal-200">
                    <Compass className="size-4 text-teal-600" /> Linked Directory Destination
                  </CardTitle>
                  <Badge variant="outline" className="text-teal-700 border-teal-300 text-[10px]">
                    {data.listing.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-base text-foreground">{data.listing.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                      <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                      {data.listing.address} {data.listing.town ? `· ${data.listing.town}` : ""}
                    </p>
                    {data.listing.description && (
                      <p className="text-xs text-foreground/80 line-clamp-2 mt-2">
                        {data.listing.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs gap-1.5"
                    onClick={() => navigate({ name: "listing", id: data.listing!.id })}
                  >
                    <span>View Directory Listing</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                  {data.listing.phone && (
                    <Button size="sm" variant="outline" asChild className="text-xs gap-1.5">
                      <a href={`tel:${data.listing.phone}`}>
                        <Phone className="size-3.5" />
                        <span>Call</span>
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Organization / Contact Sidebar & CTA */}
        <div className="space-y-6">
          {/* Call to Action Box */}
          <Card className="shadow-md border-primary/20 bg-gradient-to-b from-primary/5 to-card">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Action Destination
                </span>
                <p className="text-xs text-muted-foreground">
                  {data.destinationType === "DIRECTORY_LISTING"
                    ? "Proceed to the verified directory page on Godavari One."
                    : data.destinationType === "NRI_SECTION"
                    ? "Open the NRI & International Pilgrims Portal for all-inclusive packages."
                    : data.destinationUrl?.startsWith("http")
                    ? "Visit the official partner website."
                    : "Access the designated application destination."}
                </p>
              </div>

              <Button
                size="lg"
                className="w-full font-bold shadow-sm gap-2"
                onClick={handleCtaClick}
                id="carousel-cta-button"
              >
                <span>{data.ctaLabel || "Learn More"}</span>
                {data.destinationUrl?.startsWith("http") ? (
                  <ExternalLink className="size-4" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Advertiser / Organizer Contact Card */}
          {hasContact && (
            <Card className="shadow-xs border-border/80">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building className="size-4 text-primary" /> Sponsor / Organizer
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                {data.advertiserName && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Organization / Entity</span>
                    <span className="font-semibold text-foreground text-sm">{data.advertiserName}</span>
                  </div>
                )}

                {data.location && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{data.location}</span>
                  </div>
                )}

                {data.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 text-primary shrink-0" />
                    <a href={`tel:${data.contactPhone}`} className="text-foreground hover:underline font-medium">
                      {data.contactPhone}
                    </a>
                  </div>
                )}

                {data.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 text-primary shrink-0" />
                    <a href={`mailto:${data.contactEmail}`} className="text-foreground hover:underline font-medium">
                      {data.contactEmail}
                    </a>
                  </div>
                )}

                {data.websiteUrl && (
                  <div className="pt-2 border-t mt-2">
                    <a
                      href={data.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                    >
                      <ExternalLink className="size-3" /> Visit Organizer Website
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Verification Shield */}
          <div className="p-4 rounded-xl border bg-muted/40 text-xs text-muted-foreground flex items-start gap-3">
            <ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground block">Verified Platform Notice</span>
              <span>
                Authorized highlight managed by the Godavari One Digital Administration for Godavari Pushkaralu 2027.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "./category-icon";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { CATEGORY_META, type ListingCategory } from "@/lib/constants";
import { MapPin, Phone, Clock } from "lucide-react";

export interface ListingCardData {
  id: string;
  name: string;
  category: ListingCategory;
  description: string;
  address: string;
  town?: string | null;
  district?: string | null;
  phone?: string | null;
  primaryImage: string | null;
  locationVerified: boolean;
  ghat?: { currentCrowdStatus?: string | null; statusUpdatedAt?: string | null } | null;
  freeAccommodation?: {
    availableCapacity?: number | null;
    totalCapacity?: number | null;
    availabilityStatus?: string | null;
    isTemporarilyUnavailable?: boolean | null;
  } | null;
  annadanam?: {
    servingStatus?: string | null;
    sessions?: any;
    queueWaitMinutes?: number | null;
    remainingServings?: number | null;
  } | null;
  timingStatus?: {
    code: string;
    label: string;
    detail: string;
    isOpen?: boolean;
    badgeVariant?: string;
  } | null;
}

const CROWD_COLORS: Record<string, string> = {
  FREE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  MODERATE: "bg-amber-100 text-amber-700 border-amber-200",
  CROWDED: "bg-orange-100 text-orange-700 border-orange-200",
  CLOSED: "bg-slate-100 text-slate-700 border-slate-300",
  OVERCROWDED: "bg-red-100 text-red-700 border-red-200",
  EMERGENCY: "bg-red-600 text-white border-red-700",
};

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const { lang, navigate } = useApp();
  const meta = CATEGORY_META[listing.category];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const hasValidImage = Boolean(listing.primaryImage && failedUrl !== listing.primaryImage);

  return (
    <Card className="group overflow-hidden p-0 gap-0 hover:shadow-md transition-shadow cursor-pointer flex flex-col h-full" onClick={() => navigate({ name: "listing", id: listing.id })}>
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {hasValidImage ? (
           
          <img
            src={listing.primaryImage!}
            alt={listing.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => {
              if (listing.primaryImage) {
                setFailedUrl(listing.primaryImage);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent to-secondary">
            <CategoryIcon category={listing.category} className="size-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge variant="secondary" className="bg-white/90 backdrop-blur text-foreground shadow-sm">
            <CategoryIcon category={listing.category} className="size-3" />
            <span className="hidden sm:inline">{lang === "te" ? meta.teLabel : meta.label}</span>
          </Badge>
        </div>
        {listing.category === "GHAT" && (
          <div className="absolute top-2 right-2">
            {listing.ghat?.currentCrowdStatus ? (
              <Badge className={`${CROWD_COLORS[listing.ghat.currentCrowdStatus] || "bg-muted"} shadow-sm text-xs font-semibold`} variant="outline">
                {listing.ghat.currentCrowdStatus}
              </Badge>
            ) : (
              <Badge className="bg-white/90 backdrop-blur text-slate-700 border-border text-xs font-medium shadow-sm" variant="outline">
                Status not yet reported
              </Badge>
            )}
          </div>
        )}
        {listing.category === "FREE_ACCOMMODATION" && (
          <div className="absolute top-2 right-2">
            {listing.freeAccommodation?.isTemporarilyUnavailable ? (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 shadow-sm text-xs font-medium" variant="outline">
                Unavailable
              </Badge>
            ) : listing.freeAccommodation?.availableCapacity === 0 ? (
              <Badge className="bg-rose-100 text-rose-800 border-rose-300 shadow-sm text-xs font-medium" variant="outline">
                Full
              </Badge>
            ) : listing.freeAccommodation?.availableCapacity != null ? (
              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 shadow-sm text-xs font-medium" variant="outline">
                {listing.freeAccommodation.availableCapacity} available
              </Badge>
            ) : (
              <Badge className="bg-white/90 backdrop-blur text-indigo-800 border-indigo-200 shadow-sm text-xs font-medium" variant="outline">
                Free Stay
              </Badge>
            )}
          </div>
        )}
        {listing.category === "ANNADANAM" && (
          <div className="absolute top-2 right-2">
            {listing.annadanam?.servingStatus === "TEMPORARILY_UNAVAILABLE" ? (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 shadow-sm text-xs font-medium" variant="outline">
                Unavailable
              </Badge>
            ) : listing.annadanam?.servingStatus === "PAUSED" ? (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 shadow-sm text-xs font-medium" variant="outline">
                Paused
              </Badge>
            ) : listing.annadanam?.servingStatus === "ENDED" ? (
              <Badge className="bg-slate-100 text-slate-700 border-slate-300 shadow-sm text-xs font-medium" variant="outline">
                Ended today
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm text-xs font-medium flex items-center gap-1" variant="outline">
                <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" /> Free Meals
              </Badge>
            )}
          </div>
        )}
      </div>
      <CardContent className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-semibold text-base leading-snug line-clamp-1">{listing.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{listing.description}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="line-clamp-1">
            {[listing.town, listing.district].filter(Boolean).join(", ") || listing.address}
          </span>
        </div>
        {/* Operating Hours / Timing status */}
        <div className="pt-0.5">
          {listing.timingStatus?.code === "OPEN_NOW" && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-medium py-0 h-5 flex items-center gap-1">
              <Clock className="size-3" />
              <span className="truncate">{listing.timingStatus.detail}</span>
            </Badge>
          )}
          {listing.timingStatus?.code === "OPEN_24_HOURS" && (
            <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px] font-medium py-0 h-5 flex items-center gap-1">
              <Clock className="size-3" />
              <span>Open 24 hours</span>
            </Badge>
          )}
          {listing.timingStatus?.code === "TEMPORARILY_CLOSED" && (
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-medium py-0 h-5 flex items-center gap-1">
              <Clock className="size-3" />
              <span className="truncate">Temporarily closed</span>
            </Badge>
          )}
          {listing.timingStatus?.code === "CLOSED_NOW" && (
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-[11px] font-medium py-0 h-5 flex items-center gap-1">
              <Clock className="size-3" />
              <span className="truncate">{listing.timingStatus.detail}</span>
            </Badge>
          )}
          {(!listing.timingStatus || listing.timingStatus.code === "HOURS_NOT_AVAILABLE") && (
            <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
              <Clock className="size-3 opacity-60" />
              <span>Hours not available</span>
            </span>
          )}
        </div>
        {!listing.locationVerified && (
          <p className="text-xs text-amber-600">{t(lang, "locationNotVerified")}</p>
        )}
      </CardContent>
      <CardFooter className="p-3 pt-0 gap-2 border-t bg-muted/30">
        {listing.phone && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${listing.phone}`; }}
          >
            <Phone className="size-3.5" /> {t(lang, "callNow")}
          </Button>
        )}
        <Button size="sm" className="h-8 text-xs ml-auto" variant="outline" onClick={(e) => { e.stopPropagation(); navigate({ name: "listing", id: listing.id }); }}>
          {t(lang, "explore")}
        </Button>
      </CardFooter>
    </Card>
  );
}

"use client";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "../use-api";
import { ListingCard } from "../listing-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "../category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal, X, Info, Accessibility, Heart, Waves, CheckCircle2 } from "lucide-react";
import { CATEGORY_META, type ListingCategory } from "@/lib/constants";
import { useState, useEffect, useMemo } from "react";
import { CeremonyDirectoryView } from "./ceremony-directory-view";
import { PriorityBookingFormDialog } from "../priority-booking/priority-booking-form-dialog";

export function DirectoryView({ initialCategory, initialQ }: { initialCategory?: string; initialQ?: string }) {
  const { lang, navigate } = useApp();
  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [q, setQ] = useState(initialQ || "");
  const [district, setDistrict] = useState("");
  const [accessibilityOnly, setAccessibilityOnly] = useState(false);
  const [crowdStatus, setCrowdStatus] = useState("");
  const [priorityBookingOpen, setPriorityBookingOpen] = useState(false);

  // This component is remounted via a `key` prop when initialCategory/initialQ
  // change (see page.tsx), so initial state below is sufficient — no effect.

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "60" });
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    if (district) params.set("district", district);
    if (accessibilityOnly) params.set("accessibility", "true");
    if (crowdStatus) params.set("crowdStatus", crowdStatus);
    return `/listings?${params.toString()}`;
  }, [category, q, district, accessibilityOnly, crowdStatus]);

  const { data, loading } = useApi<{ items: any[]; total: number }>(query, [query]);

  const categories = Object.entries(CATEGORY_META) as [ListingCategory, typeof CATEGORY_META[ListingCategory]][];

  function clearFilters() {
    setCategory(undefined); setQ(""); setDistrict(""); setAccessibilityOnly(false); setCrowdStatus("");
  }

  const hasFilters = category || q || district || accessibilityOnly || crowdStatus;

  return (
    <div className="flex-1 container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">{t(lang, "directory")}</h1>
        <p className="text-sm text-muted-foreground">
          {data ? `${data.total} ${t(lang, "results")}` : t(lang, "loading")}
        </p>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setCategory(undefined)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${!category ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent border-border"}`}
        >
          {t(lang, "anyStatus")}
        </button>
        {categories.map(([cat, meta]) => (
          <button
            key={cat}
            onClick={() => setCategory(cat === category ? undefined : cat)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${cat === category ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent border-border"}`}
          >
            <CategoryIcon category={cat} className="size-3.5" />
            {lang === "te" ? meta.teLabel : meta.label}
          </button>
        ))}
      </div>

      {category === "CEREMONY" ? (
        <CeremonyDirectoryView initialCategory="CEREMONY" />
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Filters sidebar */}
          <aside className="lg:col-span-1">
            <Card className="p-0 gap-0 sticky top-20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2 text-sm">
                    <SlidersHorizontal className="size-4" /> {t(lang, "filters")}
                  </h2>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                      <X className="size-3" /> {t(lang, "clearFilters")}
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t(lang, "search")}</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, "searchPlaceholder")} className="pl-8 h-9" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t(lang, "district")}</label>
                    <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="East Godavari" className="h-9" />
                  </div>
                  {category === "GHAT" && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t(lang, "crowdStatus")}</label>
                      <select value={crowdStatus} onChange={(e) => setCrowdStatus(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                        <option value="">Any</option>
                        <option value="FREE">Free</option>
                        <option value="MODERATE">Moderate</option>
                        <option value="CROWDED">Crowded</option>
                        <option value="OVERCROWDED">Overcrowded</option>
                        <option value="EMERGENCY">Emergency</option>
                      </select>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={accessibilityOnly} onChange={(e) => setAccessibilityOnly(e.target.checked)} className="rounded border-input" />
                    <span className="text-sm">{t(lang, "accessibilityFilter")}</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Priority Ghat Booking Banner for Senior Citizens & Persons with Disabilities */}
            {category === "GHAT" && (
              <Card className="mb-5 p-0 border-sky-300 bg-gradient-to-r from-sky-50 via-indigo-50/40 to-sky-50 dark:from-sky-950/30 dark:via-indigo-950/20 dark:to-sky-950/30 shadow-sm overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-md bg-sky-600 text-white">
                          <Accessibility className="size-4" />
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-foreground">
                          {t(lang, "priorityBookingTitle")}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                        {t(lang, "priorityBookingSubtitle")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setPriorityBookingOpen(true)}
                      className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm"
                    >
                      Apply for Priority Pass
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="p-0 gap-0 overflow-hidden">
                    <Skeleton className="aspect-[4/3] w-full" />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : data?.items?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {data.items.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            ) : (
              <Card className="p-0">
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Info className="size-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">{t(lang, "noListings")}</p>
                  <p className="text-sm mt-1">{t(lang, "noListingsHint")}</p>
                  {hasFilters && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                      {t(lang, "clearFilters")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      {priorityBookingOpen && (
        <PriorityBookingFormDialog
          open={priorityBookingOpen}
          onOpenChange={setPriorityBookingOpen}
        />
      )}
    </div>
  );
}

"use client";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "../use-api";
import { ListingCard } from "../listing-card";
import { CategoryIcon } from "../category-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Waves, Phone, Accessibility as AccessIcon, ShieldAlert,
  ArrowRight, Info, Stethoscope, Heart, HeartHandshake, Megaphone,
} from "lucide-react";
import { CATEGORY_META, EMERGENCY_CONTACTS, type ListingCategory } from "@/lib/constants";
import { HomeCarousel } from "../home-carousel";

export function HomeView() {
  const { lang, navigate, searchQuery, setSearchQuery } = useApp();
  const { data: featured } = useApi<{ items: any[] }>("/listings?limit=6");
  const { data: ghats } = useApi<{ items: any[] }>("/listings?category=GHAT&limit=6");
  const { data: homepageData } = useApi<{ sections: any[]; items: any[] }>("/homepage-content");

  const sections = homepageData?.sections || [];
  const homepageItems = homepageData?.items || [];

  const isSectionEnabled = (id: string, def = true) => {
    const s = sections.find((x) => x.id === id);
    return s ? s.isEnabled : def;
  };

  const getSectionSettings = (id: string) => {
    const s = sections.find((x) => x.id === id);
    if (!s?.settings) return {};
    try {
      return JSON.parse(s.settings);
    } catch {
      return {};
    }
  };

  // Hero section settings
  const heroSettings = getSectionSettings("hero");
  const showHero = isSectionEnabled("hero", true);
  const showStatue = heroSettings.showStatue ?? true;
  const statueUrl = heroSettings.statueImageUrl || "/images/godavari-devi.png";
  const statueAlt = heroSettings.statueAlt || "Goddess Godavari Devi statue";
  const statueGlow = heroSettings.statueGlow ?? true;
  const statueAlignment = heroSettings.statueAlignment || "right";
  const heroTitle = heroSettings.heroTitle || t(lang, "heroTitle");
  const heroSubtitle = heroSettings.heroSubtitle || t(lang, "heroSubtitle");
  const tagline = heroSettings.tagline || t(lang, "tagline");
  const searchBarVisible = heroSettings.searchBarVisible ?? true;

  // Announcements & promo banners
  const announcements = homepageItems.filter((i) => i.section === "ANNOUNCEMENT" || i.section === "PROMO_BANNER");

  // Free services & highlights
  const showFreeServices = isSectionEnabled("free_services", true);
  const freeServiceItems = homepageItems.filter((i) => i.section === "FREE_SERVICES");

  // Featured directory listings
  const showFeatured = isSectionEnabled("featured_listings", true);
  const customFeaturedItems = homepageItems.filter((i) => i.section === "FEATURED_LISTING");

  // Other sections
  const showCarousel = isSectionEnabled("carousel", true);
  const showCategories = isSectionEnabled("categories", true);
  const showGhatCrowd = isSectionEnabled("ghat_crowd", true);
  const showAccessibility = isSectionEnabled("accessibility", true);

  const categories = Object.entries(CATEGORY_META) as [ListingCategory, typeof CATEGORY_META[ListingCategory]][];

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ name: "directory", q: searchQuery });
  }

  return (
    <div className="flex-1">
      {/* Promotional Announcements Banner */}
      {announcements.length > 0 && isSectionEnabled("announcements", true) && (
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-800 text-white shadow-sm border-b border-teal-900">
          <div className="container mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-center sm:text-left">
              {announcements[0].badgeText ? (
                <Badge variant="secondary" className="bg-amber-400 text-amber-950 font-bold border-none shrink-0 text-xs shadow-xs">
                  {announcements[0].badgeText}
                </Badge>
              ) : (
                <span className="size-6 rounded-full bg-white/20 grid place-items-center shrink-0">
                  <Megaphone className="size-3.5" />
                </span>
              )}
              <div>
                <p className="font-semibold text-sm leading-snug">{announcements[0].title}</p>
                {announcements[0].description && (
                  <p className="text-xs text-teal-100 line-clamp-1">{announcements[0].description}</p>
                )}
              </div>
            </div>
            {(announcements[0].destinationUrl || announcements[0].listing) && (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 bg-white text-teal-900 hover:bg-teal-50 font-medium text-xs shadow-xs"
                onClick={() => {
                  if (announcements[0].listing) {
                    navigate({ name: "listing", id: announcements[0].listing.id });
                  } else if (announcements[0].destinationUrl?.startsWith("/")) {
                    const url = announcements[0].destinationUrl;
                    if (url.includes("category=GHAT")) {
                      navigate({ name: "directory", category: "GHAT" });
                    } else {
                      navigate({ name: "directory" });
                    }
                  } else if (announcements[0].destinationUrl) {
                    window.open(announcements[0].destinationUrl, "_blank");
                  }
                }}
              >
                {announcements[0].buttonText || "Learn More"} <ArrowRight className="size-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Hero */}
      {showHero && (
        <section className="relative hero-wave overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden>
              <path d="M0,100 C240,160 480,40 720,90 C960,140 1200,60 1440,110 L1440,200 L0,200 Z" fill="white" fillOpacity="0.5" />
              <path d="M0,140 C240,80 480,180 720,130 C960,80 1200,180 1440,130 L1440,200 L0,200 Z" fill="white" fillOpacity="0.7" />
            </svg>
          </div>
          <div className="container mx-auto max-w-7xl px-4 py-12 md:py-20 lg:py-24 relative">
            <div className={`grid grid-cols-1 ${showStatue ? "lg:grid-cols-12" : ""} gap-8 lg:gap-12 items-center`}>
              <div className={showStatue ? "lg:col-span-7 xl:col-span-8" : "max-w-3xl"}>
                <Badge variant="secondary" className="mb-4 bg-white/70 text-primary border-primary/20">
                  <Waves className="size-3" /> {tagline}
                </Badge>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4 leading-tight">
                  {heroTitle}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
                  {heroSubtitle}
                </p>

                {searchBarVisible && (
                  <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t(lang, "searchPlaceholder")}
                        className="w-full h-12 pl-12 pr-4 rounded-xl bg-white shadow-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                      />
                    </div>
                    <Button size="lg" className="h-12 px-8 shadow-sm" type="submit">
                      {t(lang, "search")}
                    </Button>
                  </form>
                )}

                {showCategories && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {categories.slice(0, 6).map(([cat, meta]) => (
                      <button
                        key={cat}
                        onClick={() => navigate({ name: "directory", category: cat })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 border border-border text-sm hover:bg-white hover:border-primary/40 transition-colors"
                      >
                        <CategoryIcon category={cat} className="size-3.5 text-primary" />
                        {lang === "te" ? meta.teLabel : meta.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {showStatue && (
                <div className={`lg:col-span-5 xl:col-span-4 flex ${statueAlignment === "center" ? "justify-center" : "justify-center lg:justify-end"} items-center mt-6 lg:mt-0`}>
                  <div className="relative w-full max-w-[320px] md:max-w-[380px] lg:max-w-[440px] flex items-center justify-center">
                    {/* Soft, restrained golden glow backdrop */}
                    {statueGlow && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-amber-500/20 via-amber-300/25 to-yellow-200/15 rounded-full blur-2xl transform scale-90 pointer-events-none -z-10"
                      />
                    )}
                    {/* Goddess Godavari Devi Image */}
                    <img
                      src={statueUrl}
                      alt={statueAlt}
                      className="w-full h-auto max-h-[360px] md:max-h-[440px] lg:max-h-[500px] object-contain select-none pointer-events-none drop-shadow-[0_8px_20px_rgba(217,119,6,0.22)]"
                      loading="eager"
                      onError={(e) => {
                        (e.currentTarget as any).src = "/logo.svg";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Featured Highlights Carousel */}
      {showCarousel && <HomeCarousel />}

      {/* Categories */}
      {showCategories && (
        <section className="container mx-auto max-w-7xl px-4 py-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{t(lang, "categories")}</h2>
              <p className="text-sm text-muted-foreground">{t(lang, "explore")} · {t(lang, "pushkaraluInfo")}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate({ name: "directory" })}>
              {t(lang, "viewAll")} <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
            {categories.map(([cat, meta]) => (
              <Card
                key={cat}
                className="p-0 gap-0 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate({ name: "directory", category: cat })}
              >
                <CardContent className="p-5 flex flex-col items-center text-center gap-2">
                  <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <CategoryIcon category={cat} className="size-6" />
                  </div>
                  <span className="text-sm font-medium leading-tight">
                    {lang === "te" ? meta.teLabel : meta.label}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Free Accommodation & Annadanam Highlights */}
      {showFreeServices && (
        <section className="container mx-auto max-w-7xl px-4 py-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-50/80 via-amber-50/50 to-teal-50/60 border border-rose-200/70 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="size-8 rounded-lg bg-rose-600 text-white grid place-items-center shadow-xs">
                    <HeartHandshake className="size-4" />
                  </span>
                  <h2 className="text-xl font-bold tracking-tight">Free Accommodation & Annadanam Seva</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Verified free pilgrim shelters, dormitories, and daily Annadanam & Prasadam distribution centres for Pushkaralu 2027.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => navigate({ name: "directory", category: "FREE_ACCOMMODATION" })}>
                  Free Stays <ArrowRight className="size-3.5 ml-1" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate({ name: "directory", category: "ANNADANAM" })}>
                  Annadanam <ArrowRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>

            {freeServiceItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {freeServiceItems.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors shadow-xs bg-white dark:bg-card"
                    onClick={() => {
                      if (item.listing) {
                        navigate({ name: "listing", id: item.listing.id });
                      } else if (item.destinationUrl?.startsWith("/")) {
                        navigate({ name: "directory" });
                      }
                    }}
                  >
                    <CardContent className="p-4 space-y-2">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.title} className="w-full h-36 object-cover rounded-lg mb-2" />
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-rose-100 text-rose-800 text-[10px]">
                          {item.badgeText || "Free Pilgrim Seva"}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-sm">{item.title}</h4>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Ghat crowd status + Emergency */}
      {showGhatCrowd && (
        <section className="container mx-auto max-w-7xl px-4 py-6 grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-0 gap-0 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-5 border-b">
                <div className="flex items-center gap-2">
                  <Waves className="size-5 text-primary" />
                  <h2 className="font-bold">{t(lang, "ghatCrowdStatus")}</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate({ name: "directory", category: "GHAT" })}>
                  {t(lang, "viewAll")} <ArrowRight className="size-4" />
                </Button>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto nice-scroll">
                {ghats?.items?.length ? (
                  ghats.items.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => navigate({ name: "listing", id: g.id })}
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/50 text-left transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{g.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{[g.town, g.district].filter(Boolean).join(", ") || "Godavari Riverbank"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                        <CrowdBadge status={g.ghat?.currentCrowdStatus} />
                        {g.ghat?.statusUpdatedAt && (
                          <span className="text-[11px] text-muted-foreground">
                            Updated {formatLastUpdated(g.ghat.statusUpdatedAt)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {t(lang, "noListings")}
                    <p className="text-xs mt-1">{t(lang, "noListingsHint")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="p-0 gap-0">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="size-5 text-destructive" />
                <h2 className="font-bold">{t(lang, "emergencyContacts")}</h2>
              </div>
              <div className="space-y-2">
                {EMERGENCY_CONTACTS.map((c) => (
                  <a
                    key={c.number}
                    href={`tel:${c.number}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-destructive" />
                      <span className="text-sm font-medium">{lang === "te" ? c.teName : c.name}</span>
                    </div>
                    <Badge variant="secondary" className="font-mono">{c.number}</Badge>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Featured Listings */}
      {showFeatured && (
        <section className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl font-bold">{t(lang, "featured")}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate({ name: "directory" })}>
              {t(lang, "viewAll")} <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {customFeaturedItems.length > 0 ? (
              customFeaturedItems.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group overflow-hidden"
                  onClick={() => {
                    if (item.listing) {
                      navigate({ name: "listing", id: item.listing.id });
                    } else if (item.destinationUrl) {
                      navigate({ name: "directory" });
                    }
                  }}
                >
                  {item.imageUrl && (
                    <div className="h-44 w-full overflow-hidden bg-muted">
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  <CardContent className="p-5 space-y-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]">
                      {item.badgeText || "Featured Highlight"}
                    </Badge>
                    <h3 className="font-bold text-base group-hover:text-primary transition-colors">{item.title}</h3>
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                    {item.listing && (
                      <p className="text-xs text-primary font-medium flex items-center gap-1 pt-1">
                        [{item.listing.category}] {item.listing.town ? `${item.listing.town}, ` : ""}{item.listing.district}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : featured?.items?.length ? (
              featured.items.map((l) => <ListingCard key={l.id} listing={l} />)
            ) : (
              <div className="col-span-full">
                <Card className="p-0">
                  <CardContent className="p-10 text-center text-muted-foreground">
                    <Info className="size-8 mx-auto mb-2 opacity-50" />
                    <p>{t(lang, "noListings")}</p>
                    <p className="text-sm mt-1">{t(lang, "noListingsHint")}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Accessibility + Info */}
      {showAccessibility && (
        <section className="container mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-2 gap-6">
          <Card className="p-0 gap-0 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <AccessIcon className="size-5 text-primary" />
                <h2 className="font-bold">{t(lang, "accessibility")}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {lang === "te"
                  ? "వీల్‌చైర్ యాక్సెస్, వృద్ధుల సహాయం, ప్రాథమిక చికిత్స, మరియు అత్యవసర సహాయ కేంద్రాల సమాచారం."
                  : "Find wheelchair-accessible ghat routes, senior-citizen assistance, first-aid, drinking water, and emergency help points with verified details."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary"><Heart className="size-3" /> Senior Citizens</Badge>
                <Badge variant="secondary"><AccessIcon className="size-3" /> Wheelchair Access</Badge>
                <Badge variant="secondary"><Stethoscope className="size-3" /> First-aid</Badge>
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate({ name: "directory", q: "accessible" })}>
                {t(lang, "explore")} <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="p-0 gap-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Info className="size-5 text-primary" />
                <h2 className="font-bold">{t(lang, "pushkaraluInfo")}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{t(lang, "pushkaraluInfoText")}</p>
              <Button variant="link" className="px-0 mt-2 h-auto" onClick={() => navigate({ name: "directory" })}>
                {t(lang, "browseDirectory")} <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function formatLastUpdated(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function CrowdBadge({ status }: { status?: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 font-medium inline-flex items-center gap-1.5 py-0.5">
        <span className="size-1.5 rounded-full bg-slate-400" />
        Status not yet reported
      </Badge>
    );
  }
  const meta: Record<string, { label: string; bg: string; dot: string }> = {
    FREE: { label: "Free (Low Crowd)", bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400", dot: "bg-emerald-500" },
    MODERATE: { label: "Moderate Crowd", bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400", dot: "bg-amber-500" },
    CROWDED: { label: "Crowded (High)", bg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400", dot: "bg-orange-500" },
    CLOSED: { label: "Temporarily Closed", bg: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-500" },
    OVERCROWDED: { label: "Overcrowded", bg: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400", dot: "bg-red-500 animate-pulse" },
    EMERGENCY: { label: "Emergency", bg: "bg-red-600 text-white border-red-700 shadow-sm", dot: "bg-white animate-ping" },
  };
  const config = meta[status] || { label: status, bg: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };
  return (
    <Badge variant="outline" className={`${config.bg} font-semibold inline-flex items-center gap-1.5 py-0.5`}>
      <span className={`size-2 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
}

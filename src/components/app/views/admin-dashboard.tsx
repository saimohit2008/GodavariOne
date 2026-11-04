"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "../use-api";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Building2, CalendarCheck, Waves, ScrollText, LayoutDashboard,
  Plus, Search, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Activity, Trash2,
  Utensils, Hotel, Stethoscope, Bus, Compass, Briefcase, Eye, Edit3, RefreshCw,
  UserCheck, History, ArrowRight, Check, MapPin, ChevronLeft, ChevronRight, SlidersHorizontal,
  Lock, KeyRound, Clock, BedDouble, Star, Images, Home, Soup, Layers, Globe, Flame, Accessibility,
  PhoneCall, Mail, Sparkles,
} from "lucide-react";
import { DeleteListingDialog } from "../delete-listing-dialog";
import { AccountSettingsTab } from "./account-settings-tab";
import { TimingManagerDialog } from "../timing-manager-dialog";
import { HotelRoomManager } from "../hotel-room-manager";
import { ReviewsModerationPanel } from "../reviews-moderation-panel";
import { CarouselManager } from "../carousel-manager";
import { HomepageContentManager } from "../homepage-content-manager";
import { NriAdminSection } from "../nri/nri-admin-section";
import { NriManagementSection } from "../nri/nri-management-section";
import { NriServiceManagerAdminSection } from "../nri/nri-service-manager-admin-section";
import { CeremonyManagementAdminSection } from "../ceremonies/ceremony-admin-section";
import { AdminPriorityBookingSection } from "../priority-booking/admin-priority-booking-section";
import { FooterContactManager } from "../footer-contact-manager";
import { AdminEmailNotificationsPanel } from "../admin-email-notifications-panel";
import { AdminAiPanel } from "../admin-ai-panel";
import type { AdminTab } from "@/lib/store";
import { ADMIN_CREATABLE_ROLES, CATEGORY_META, type ListingCategory } from "@/lib/constants";

export function AdminDashboard({ tab = "overview" }: { tab?: AdminTab }) {
  const { lang, navigate, user } = useApp();
  const active = tab;

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">
        Access denied. This dashboard is restricted to system administrators.
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: any }[] = [
    { id: "overview", label: t(lang, "overview"), icon: LayoutDashboard },
    { id: "nri-service-manager", label: "NRI Service Manager", icon: UserCheck },
    { id: "ceremony-management", label: "Ceremony Management", icon: Flame },
    { id: "homepage-content", label: "Homepage Content Management", icon: Layers },
    { id: "carousel", label: "Homepage Carousel & Ads", icon: Images },
    { id: "footer-contact", label: "Footer Contact Settings", icon: PhoneCall },
    { id: "nri-management", label: "NRI Portal Management", icon: Globe },
    { id: "nri-requests", label: "NRI Requests & Packages", icon: Briefcase },
    { id: "listings", label: "All Listings", icon: Building2 },
    { id: "restaurants", label: "Restaurants", icon: Utensils },
    { id: "hotels", label: "Hotels", icon: Hotel },
    { id: "ghats", label: "Ghats", icon: Waves },
    { id: "hospitals", label: "Hospitals", icon: Stethoscope },
    { id: "transport", label: "Travel Facilities", icon: Bus },
    { id: "tourist-spots", label: "Tourist Spots", icon: Compass },
    { id: "free-accommodation", label: "Free Accommodation", icon: Home },
    { id: "annadanam", label: "Free Annadanam & Prasadam", icon: Soup },
    { id: "roles", label: "Staff & Role Management", icon: Users },
    { id: "ghat-monitoring", label: "Ghat Monitoring", icon: Waves },
    { id: "priority-bookings", label: "Priority Ghat Bookings (65+ & PwD)", icon: Accessibility },
    { id: "bookings", label: "All Bookings & Registrations", icon: CalendarCheck },
    { id: "email-notifications", label: "Email Notifications & Logs", icon: Mail },
    { id: "ai-assistant", label: "AI Assistant & Copilot", icon: Sparkles },
    { id: "ownership", label: "Business Ownership", icon: Briefcase },
    { id: "reviews", label: "Reviews & Moderation", icon: Star },
    { id: "audit", label: "Reports & Audit Logs", icon: ScrollText },
    { id: "settings", label: "Account Settings", icon: KeyRound },
  ];

  return (
    <div className="flex-1 container mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Super Admin Control Center</h1>
            <p className="text-sm text-muted-foreground">
              {t(lang, "brand")} · Complete Directory & Operational Staff Oversight
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={active === "settings" ? "default" : "outline"}
            onClick={() => navigate({ name: "admin", tab: "settings" })}
            className="shadow-sm"
          >
            <KeyRound className="size-4 mr-1.5" /> Account Settings
          </Button>
          <Button
            size="sm"
            onClick={() => navigate({ name: "listing-form" })}
            className="shadow-sm"
          >
            <Plus className="size-4 mr-1.5" /> New Listing
          </Button>
        </div>
      </div>

      {/* Primary Dashboard Navigation Tabs */}
      <div className="flex gap-1.5 overflow-x-auto nice-scroll border-b mb-6 pb-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => navigate({ name: "admin", tab: tb.id })}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg font-medium transition-colors whitespace-nowrap ${
              active === tb.id || (active === "users" && tb.id === "roles") || ((active === "restaurant-bookings" || active === "hotel-bookings") && tb.id === "bookings")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <tb.icon className="size-4 shrink-0" />
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {active === "overview" && <OverviewTab onNavigateTab={(t) => navigate({ name: "admin", tab: t })} />}
      {active === "nri-service-manager" && <NriServiceManagerAdminSection />}
      {active === "ceremony-management" && <CeremonyManagementAdminSection />}
      {active === "homepage-content" && <HomepageContentManager />}
      {active === "carousel" && <CarouselManager />}
      {active === "footer-contact" && <FooterContactManager />}
      {active === "listings" && <ListingsManager />}
      {active === "restaurants" && <ListingsManager fixedCategory="RESTAURANT" title="Restaurant Listings" />}
      {active === "hotels" && <ListingsManager fixedCategory="HOTEL" title="Hotel & Accommodation Listings" />}
      {active === "ghats" && <ListingsManager fixedCategory="GHAT" title="Ghat Directory Listings" />}
      {active === "hospitals" && <ListingsManager fixedCategory="HOSPITAL" title="Hospital & Medical Centers" />}
      {active === "transport" && <ListingsManager fixedCategory="TRANSPORT" title="Travel & Transport Facilities" />}
      {active === "tourist-spots" && <ListingsManager fixedCategory="TOURIST_SPOT" title="Tourist Spots & Heritage Sites" />}
      {active === "free-accommodation" && <ListingsManager fixedCategory="FREE_ACCOMMODATION" title="Free Accommodation Centres" />}
      {active === "annadanam" && <ListingsManager fixedCategory="ANNADANAM" title="Free Annadanam & Prasadam Locations" />}
      {(active === "roles" || active === "users") && <RolesAndStaffTab />}
      {active === "ghat-monitoring" && <GhatMonitoringTab />}
      {active === "priority-bookings" && <AdminPriorityBookingSection />}
      {(active === "bookings" || active === "restaurant-bookings" || active === "hotel-bookings") && (
        <BookingsTab initialKind={active === "hotel-bookings" ? "hotel" : "restaurant"} />
      )}
      {active === "email-notifications" && <AdminEmailNotificationsPanel />}
      {active === "ai-assistant" && <AdminAiPanel />}
      {active === "ownership" && <BusinessOwnershipTab />}
      {active === "reviews" && <ReviewsModerationPanel />}
      {active === "audit" && <AuditTab />}
      {active === "nri-management" && <NriManagementSection />}
      {active === "nri-requests" && <NriAdminSection />}
      {active === "settings" && <AccountSettingsTab />}
    </div>
  );
}

// ============================================================================
// 1. OVERVIEW TAB
// ============================================================================
function OverviewTab({ onNavigateTab }: { onNavigateTab: (tab: AdminTab) => void }) {
  const { lang, navigate } = useApp();
  const { data, loading, refetch } = useApi<any>("/stats");

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const stats = [
    { label: "Total Platform Users", value: data.totalUsers, icon: Users, color: "text-sky-600 bg-sky-50", tab: "roles" as AdminTab },
    { label: "Active Staff Accounts", value: data.activeOperational, icon: ShieldCheck, color: "text-emerald-600 bg-emerald-50", tab: "roles" as AdminTab },
    { label: "Total Directory Listings", value: data.totalListings, icon: Building2, color: "text-violet-600 bg-violet-50", tab: "listings" as AdminTab },
    { label: "Homepage Content Items", value: data.totalHomepageItems ?? 0, icon: Layers, color: "text-teal-600 bg-teal-50", tab: "homepage-content" as AdminTab },
    { label: "Published Listings", value: data.publishedListings, icon: CheckCircle2, color: "text-teal-600 bg-teal-50", tab: "listings" as AdminTab },
    { label: "Pending Review", value: data.pendingListings, icon: AlertTriangle, color: "text-amber-600 bg-amber-50", tab: "listings" as AdminTab },
    { label: "Carousel Banners", value: data.totalCarouselBanners ?? 0, icon: Images, color: "text-indigo-600 bg-indigo-50", tab: "carousel" as AdminTab },
    { label: "Active Alerts", value: data.activeAlerts, icon: AlertTriangle, color: "text-red-600 bg-red-50", tab: "ghat-monitoring" as AdminTab },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="cursor-pointer hover:border-primary/50 transition-colors shadow-sm"
            onClick={() => onNavigateTab(s.tab)}
          >
            <CardContent className="p-5 flex items-center gap-3.5">
              <span className={`size-12 rounded-xl grid place-items-center ${s.color}`}>
                <s.icon className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-bold leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Listings by Category</CardTitle>
            <CardDescription>Click any category to manage records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byCategory?.length ? (
              data.byCategory.map((c: any) => {
                return (
                  <div
                    key={c.category}
                    onClick={() => {
                      if (c.category === "RESTAURANT") onNavigateTab("restaurants");
                      else if (c.category === "HOTEL") onNavigateTab("hotels");
                      else if (c.category === "GHAT") onNavigateTab("ghats");
                      else if (c.category === "HOSPITAL") onNavigateTab("hospitals");
                      else if (c.category === "TRANSPORT") onNavigateTab("transport");
                      else if (c.category === "TOURIST_SPOT") onNavigateTab("tourist-spots");
                      else if (c.category === "FREE_ACCOMMODATION") onNavigateTab("free-accommodation");
                      else if (c.category === "ANNADANAM") onNavigateTab("annadanam");
                      else onNavigateTab("listings");
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <span className="text-sm font-medium">{c.category.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary">{c._count}</Badge>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No listings found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{t(lang, "recentActivity")}</CardTitle>
              <CardDescription>Real-time audit log stream</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigateTab("audit")}>
              View All Logs →
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto nice-scroll pr-1">
              {data.recentActivity?.length ? (
                data.recentActivity.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/20 text-sm">
                    <Activity className="size-4 mt-0.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {a.action.replace(/_/g, " ")}{" "}
                        {a.actor?.name && <span className="text-muted-foreground font-normal">by {a.actor.name}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(a.createdAt).toLocaleString()} · Target: {a.targetType || "SYSTEM"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Security Quick Action Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-background shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <KeyRound className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Super Admin Credentials & Security</p>
              <p className="text-xs text-muted-foreground">
                Update your administrative login password and verified mobile phone with secure authentication.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => onNavigateTab("settings")} className="shadow-sm shrink-0">
            Manage Credentials <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 2. COMPLETE LISTINGS MANAGEMENT (Supports All & Category-specific tabs)
// ============================================================================
function ListingsManager({ fixedCategory, title }: { fixedCategory?: string; title?: string }) {
  const { lang, navigate } = useApp();
  const [category, setCategory] = useState<string>(fixedCategory || "ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [rejectOpen, setRejectOpen] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [timingTarget, setTimingTarget] = useState<any>(null);
  const [roomTarget, setRoomTarget] = useState<any>(null);

  const activeCategory = fixedCategory || category;
  const queryUrl = `/listings?limit=20&page=${page}&status=${status === "ALL" ? "" : status}&category=${activeCategory === "ALL" ? "" : activeCategory}&q=${encodeURIComponent(q)}&sortBy=${sortBy}&sortOrder=${sortOrder}`;

  const { data, loading, refetch } = useApi<{ items: any[]; total: number; page: number; limit: number }>(queryUrl, [queryUrl]);

  async function handlePublish(id: string) {
    try {
      await api.patch(`/listings/${id}`, { publicationStatus: "PUBLISHED" });
      toast({ title: "Success", description: "Listing published successfully" });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to publish", variant: "destructive" });
    }
  }

  async function handleUnpublish(id: string) {
    try {
      await api.patch(`/listings/${id}`, { publicationStatus: "DRAFT" });
      toast({ title: "Success", description: "Listing returned to Draft status" });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to unpublish", variant: "destructive" });
    }
  }

  async function handleArchive(id: string) {
    try {
      await api.del(`/listings/${id}`);
      toast({ title: "Success", description: "Listing soft-archived successfully" });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to archive", variant: "destructive" });
    }
  }

  async function handleReject(id: string, reason: string) {
    try {
      await api.post(`/listings/${id}/reject`, { reason });
      toast({ title: "Listing Rejected", description: reason });
      setRejectOpen(null);
      refetch();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to reject", variant: "destructive" });
    }
  }

  async function handleDelete(listing: any) {
    setDeleting(true);
    try {
      const isArchived = listing.publicationStatus === "ARCHIVED";
      await api.del(`/listings/${listing.id}${isArchived ? "?permanent=true" : ""}`);
      toast({ title: "Success", description: "Listing deleted successfully" });
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      toast({
        title: "Deletion Blocked",
        description: e instanceof ApiError ? e.message : "Failed to delete listing",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.ceil((data?.total || 0) / 20) || 1;

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title || "Directory Listings Management"}</h2>
          <p className="text-xs text-muted-foreground">
            {data?.total ?? 0} listing{data?.total === 1 ? "" : "s"} found · Page {page} of {totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate({ name: "listing-form", category: fixedCategory || (category !== "ALL" ? category : "RESTAURANT") })}
          >
            <Plus className="size-4 mr-1.5" /> Create {fixedCategory ? fixedCategory.replace(/_/g, " ") : "Listing"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()} title="Refresh list">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 bg-muted/40 p-3 rounded-xl border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by name, address, town..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        {!fixedCategory && (
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {Object.keys(CATEGORY_META).map((c) => (
                <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Date Created</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="updatedAt">Last Updated</SelectItem>
            <SelectItem value="publicationStatus">Status</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2.5"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          title={`Order: ${sortOrder.toUpperCase()}`}
        >
          {sortOrder === "asc" ? "Asc ↑" : "Desc ↓"}
        </Button>
      </div>

      {/* Listings Table / Cards */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : data?.items?.length ? (
            <div className="divide-y">
              {data.items.map((l: any) => (
                <div key={l.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="size-12 rounded-xl bg-muted grid place-items-center overflow-hidden shrink-0 border">
                      {l.primaryImage ? (
                        <img src={l.primaryImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="size-5 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-base truncate">{l.name}</p>
                        <Badge variant="secondary" className="text-xs">
                          {l.category.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant={
                            l.publicationStatus === "PUBLISHED"
                              ? "default"
                              : l.publicationStatus === "PENDING"
                              ? "outline"
                              : l.publicationStatus === "REJECTED"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs font-normal"
                        >
                          {l.publicationStatus}
                        </Badge>
                        {l.locationVerified && (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                            Verified Location
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {[l.address, l.locality, l.town, l.district].filter(Boolean).join(", ")}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>Owner: {l.owner ? `${l.owner.name} (${l.owner.phone})` : "Unassigned"}</span>
                        <span>·</span>
                        <span>Updated: {new Date(l.updatedAt || l.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0 self-end md:self-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate({ name: "listing", id: l.id })}
                      title="Public View"
                    >
                      <Eye className="size-3.5 mr-1" /> View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate({ name: "listing-form", id: l.id })}
                      title="Edit Listing Details"
                    >
                      <Edit3 className="size-3.5 mr-1" /> Edit
                    </Button>

                    {l.category === "HOTEL" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRoomTarget(l)}
                        title="Manage Hotel Room Types & Capacity"
                      >
                        <BedDouble className="size-3.5 mr-1" /> Rooms
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTimingTarget(l)}
                      title="Manage Operating Hours & Closures"
                    >
                      <Clock className="size-3.5 mr-1" /> Hours
                    </Button>

                    {l.publicationStatus === "PENDING" && (
                      <Button size="sm" onClick={() => handlePublish(l.id)}>
                        <CheckCircle2 className="size-3.5 mr-1" /> Approve & Publish
                      </Button>
                    )}
                    {l.publicationStatus === "PENDING" && (
                      <Button size="sm" variant="outline" onClick={() => setRejectOpen(l)}>
                        <XCircle className="size-3.5 mr-1" /> Reject
                      </Button>
                    )}
                    {l.publicationStatus === "DRAFT" && (
                      <Button size="sm" onClick={() => handlePublish(l.id)}>
                        <CheckCircle2 className="size-3.5 mr-1" /> Publish
                      </Button>
                    )}
                    {l.publicationStatus === "PUBLISHED" && (
                      <Button size="sm" variant="ghost" onClick={() => handleUnpublish(l.id)}>
                        Unpublish
                      </Button>
                    )}
                    {l.publicationStatus !== "ARCHIVED" && (
                      <Button size="sm" variant="ghost" onClick={() => handleArchive(l.id)}>
                        Archive
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(l)}
                      title="Delete Listing"
                    >
                      <Trash2 className="size-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No listings found matching the specified filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Showing page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="size-4 mr-1" /> Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectOpen && (
        <RejectDialog
          listing={rejectOpen}
          onClose={() => setRejectOpen(null)}
          onConfirm={(reason) => handleReject(rejectOpen.id, reason)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteListingDialog
          listing={deleteTarget}
          isDeleting={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}

      {/* Timing and Operating Hours Modal */}
      {timingTarget && (
        <TimingManagerDialog
          listingId={timingTarget.id}
          listingName={timingTarget.name}
          category={timingTarget.category}
          currentSchedule={timingTarget.schedule}
          onClose={() => setTimingTarget(null)}
          onSaved={() => {
            setTimingTarget(null);
            refetch();
          }}
        />
      )}

      {/* Hotel Room Inventory Modal */}
      {roomTarget && (
        <Dialog open onOpenChange={(o) => !o && setRoomTarget(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <HotelRoomManager
              hotelId={roomTarget.id}
              hotelName={roomTarget.name}
              onClose={() => {
                setRoomTarget(null);
                refetch();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================================
// 3. CENTRALIZED STAFF & ROLE MANAGEMENT
// ============================================================================
type StaffSubCategory = "ALL" | "GHAT_SUPERVISOR" | "BUSINESS_OWNER" | "BOOKING_REVIEWER" | "PUROHIT" | "NRI_SERVICE_MANAGER";

function RolesAndStaffTab() {
  const { lang, navigate, user: currentUser } = useApp();
  const [subTab, setSubTab] = useState<StaffSubCategory>("ALL");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignExistingOpen, setAssignExistingOpen] = useState(false);
  const [editUserTarget, setEditUserTarget] = useState<any>(null);
  const [assignmentsTarget, setAssignmentsTarget] = useState<any>(null);
  const [auditTarget, setAuditTarget] = useState<any>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<any>(null);

  const roleQueryParam = subTab === "ALL" ? "" : subTab;
  const statusParam = statusFilter === "ALL" ? "" : statusFilter;
  const query = `/admin/users?q=${encodeURIComponent(q)}&role=${roleQueryParam}&status=${statusParam}`;

  const { data, loading, refetch } = useApi<{ items: any[]; total: number }>(query, [query]);

  const categories = [
    { id: "ALL", label: "All Staff", count: data?.items?.length },
    { id: "GHAT_SUPERVISOR", label: "Ghat Supervisors", icon: Waves },
    { id: "BUSINESS_OWNER", label: "Business Owners", icon: Briefcase },
    { id: "BOOKING_REVIEWER", label: "Booking Reviewers", icon: CalendarCheck },
    { id: "PUROHIT", label: "Purohits", icon: Flame },
    { id: "NRI_SERVICE_MANAGER", label: "NRI Coordinators", icon: Globe },
  ];

  return (
    <div className="space-y-5">
      {/* Role Categories Sub-Navigation */}
      <div className="flex gap-2 overflow-x-auto nice-scroll pb-1">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSubTab(c.id as StaffSubCategory)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${
              subTab === c.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Action and Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search user by name, phone, or email..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAssignExistingOpen(true)}>
            <UserCheck className="size-4 mr-1.5" /> Assign Registered User
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" /> Invite / Create Staff
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : data?.items?.length ? (
            <div className="divide-y">
              {data.items.map((u: any) => (
                <div key={u.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="size-11 rounded-full bg-primary/15 text-primary grid place-items-center font-bold text-sm shrink-0 border border-primary/20">
                      {(u.name || u.phone).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-base">{u.name || "Unnamed User"}</p>
                        <Badge variant="secondary" className="text-xs">
                          {u.role.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant={u.status === "ACTIVE" ? "default" : u.status === "SUSPENDED" ? "outline" : "destructive"}
                          className="text-xs font-normal"
                        >
                          {u.status}
                        </Badge>
                        {u.phoneVerified && (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                            Verified Phone
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Phone: {u.phone} {u.email && `· Email: ${u.email}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Account created on {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAssignmentsTarget(u)}
                      title="Manage Scoped Resource Assignments"
                    >
                      <Briefcase className="size-3.5 mr-1" /> Assignments
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditUserTarget(u)}
                      title="Edit Profile, Role & Status"
                    >
                      <Edit3 className="size-3.5 mr-1" /> Edit Profile
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAuditTarget(u)}
                      title="User Audit Trail"
                    >
                      <History className="size-3.5 mr-1" /> Audit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteUserTarget(u)}
                      title="Delete Staff"
                    >
                      <Trash2 className="size-3.5 mr-1 text-destructive" /> Delete Staff
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No staff members found matching the specified criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create New Staff Dialog */}
      {createOpen && (
        <CreateStaffDialog
          defaultRole={subTab === "ALL" ? "GHAT_SUPERVISOR" : subTab}
          onClose={() => setCreateOpen(false)}
          onDone={() => { setCreateOpen(false); refetch(); }}
        />
      )}

      {/* Assign Existing User Dialog */}
      {assignExistingOpen && (
        <AssignExistingUserDialog
          defaultRole={subTab === "ALL" ? "GHAT_SUPERVISOR" : subTab}
          onClose={() => setAssignExistingOpen(false)}
          onDone={() => { setAssignExistingOpen(false); refetch(); }}
        />
      )}

      {/* Edit User Profile, Role, Status Dialog */}
      {editUserTarget && (
        <EditStaffUserDialog
          user={editUserTarget}
          onClose={() => setEditUserTarget(null)}
          onDone={() => { setEditUserTarget(null); refetch(); }}
        />
      )}

      {/* Manage Scoped Assignments Dialog */}
      {assignmentsTarget && (
        <ManageAssignmentsDialog
          user={assignmentsTarget}
          onClose={() => setAssignmentsTarget(null)}
          onDone={() => { refetch(); }}
        />
      )}

      {/* User Specific Audit History Dialog */}
      {auditTarget && (
        <UserAuditHistoryDialog
          user={auditTarget}
          onClose={() => setAuditTarget(null)}
        />
      )}

      {/* Delete Staff Member Confirmation Dialog */}
      {deleteUserTarget && (
        <DeleteStaffDialog
          user={deleteUserTarget}
          currentUserId={currentUser?.id}
          onClose={() => setDeleteUserTarget(null)}
          onDone={() => {
            setDeleteUserTarget(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// 4. GHAT MONITORING TAB
// ============================================================================
function GhatMonitoringTab() {
  const { navigate } = useApp();
  const { data: ghats, loading: loadingGhats, refetch: refetchGhats } = useApi<{ items: any[] }>("/listings?category=GHAT&limit=100");
  const { data: reports, loading: loadingReports, refetch: refetchReports } = useApi<{ items: any[] }>("/ghats/reports?limit=25");
  const [updatingReport, setUpdatingReport] = useState<string | null>(null);
  const [crowdStatusTarget, setCrowdStatusTarget] = useState<any>(null);

  async function updateReportStatus(reportId: string, status: string) {
    setUpdatingReport(reportId);
    try {
      await api.patch(`/ghats/reports/${reportId}`, { status });
      toast({ title: "Report Status Updated", description: `Marked as ${status}` });
      refetchReports();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to update", variant: "destructive" });
    } finally {
      setUpdatingReport(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Real-Time Ghat Crowd & Safety Monitoring</h2>
          <p className="text-xs text-muted-foreground">Monitor crowd statuses and acknowledge incoming ground reports</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { refetchGhats(); refetchReports(); }}>
          <RefreshCw className="size-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Ghat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingGhats ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : ghats?.items?.length ? (
          ghats.items.map((g: any) => {
            const crowd = g.ghat?.currentCrowdStatus;

            return (
              <Card key={g.id} className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base truncate">{g.name}</CardTitle>
                    {!crowd ? (
                      <Badge variant="outline" className="font-medium text-xs bg-slate-50 text-slate-600 border-slate-200 shrink-0">
                        <span className="size-1.5 rounded-full bg-slate-400 mr-1 inline-block" /> Status not yet reported
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`font-semibold text-xs shrink-0 ${
                          crowd === "FREE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : crowd === "MODERATE"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : crowd === "CROWDED"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : crowd === "CLOSED"
                            ? "bg-slate-100 text-slate-700 border-slate-300"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {crowd}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="truncate">
                    {[g.locality, g.town, g.district].filter(Boolean).join(", ") || "Godavari Riverbank"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2 text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Supervisor:</span>
                    <span className="font-medium text-foreground">{g.ghat?.supervisor?.name || "Assigned by Sector"}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Medical Help:</span>
                    <span>{g.ghat?.medicalAssistance || "Available on site"}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Status Reported:</span>
                    <span className="font-medium text-foreground">
                      {g.ghat?.statusUpdatedAt
                        ? new Date(g.ghat.statusUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : "Not reported yet"}
                    </span>
                  </div>
                  <div className="pt-2 flex justify-end gap-2 flex-wrap">
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => navigate({ name: "listing", id: g.id })}>
                      View Ghat
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate({ name: "listing-form", id: g.id })}>
                      Edit Details
                    </Button>
                    <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setCrowdStatusTarget(g)}>
                      <Waves className="size-3.5 mr-1" /> Update Status
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <p className="col-span-3 text-center py-8 text-sm text-muted-foreground">No ghat listings found.</p>
        )}
      </div>

      {crowdStatusTarget && (
        <AdminGhatCrowdStatusDialog
          ghat={crowdStatusTarget}
          onClose={() => setCrowdStatusTarget(null)}
          onDone={() => {
            setCrowdStatusTarget(null);
            refetchGhats();
            refetchReports();
          }}
        />
      )}

      {/* Recent Ground Reports Stream */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Incoming Ground Reports</CardTitle>
          <CardDescription>Submitted by Ghat Reporters & Supervisors in real-time</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingReports ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : reports?.items?.length ? (
            <div className="divide-y">
              {reports.items.map((r: any) => (
                <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{r.listing?.name || "Ghat"}</span>
                      <Badge variant="outline" className="text-xs">
                        {r.crowdStatus}
                      </Badge>
                      <Badge
                        variant={r.status === "APPROVED" || r.status === "ACKNOWLEDGED" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {r.status || r.reviewStatus || "SUBMITTED"}
                      </Badge>
                    </div>
                    {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reporter: {r.reporter?.name || "Ground Reporter"} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingReport === r.id}
                      onClick={() => updateReportStatus(r.id, "ACKNOWLEDGED")}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      disabled={updatingReport === r.id}
                      onClick={() => updateReportStatus(r.id, "RESOLVED")}
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No recent crowd reports submitted.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 5. RESTAURANT & HOTEL BOOKINGS OVERSIGHT
// ============================================================================
function BookingsTab({ initialKind = "restaurant" }: { initialKind?: "restaurant" | "hotel" | "accommodation" }) {
  const { lang, navigate } = useApp();
  const [kind, setKind] = useState<"restaurant" | "hotel" | "accommodation">(initialKind);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const path = kind === "restaurant" ? "restaurant" : kind === "hotel" ? "hotel" : "accommodation";
  const query = `/bookings/${path}?status=${statusFilter === "ALL" ? "" : statusFilter}`;
  const { data, loading, refetch } = useApi<{ items: any[] }>(query, [query]);

  async function decide(id: string, status: string) {
    try {
      if (kind === "accommodation") {
        await api.patch("/bookings/accommodation", { bookingId: id, status });
      } else {
        await api.patch(`/bookings/${path}/${id}`, { status });
      }
      toast({ title: `Booking ${status.toLowerCase()}` });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={kind === "restaurant" ? "default" : "outline"}
            onClick={() => setKind("restaurant")}
          >
            <Utensils className="size-4 mr-1.5" /> Restaurant Bookings
          </Button>
          <Button
            size="sm"
            variant={kind === "hotel" ? "default" : "outline"}
            onClick={() => setKind("hotel")}
          >
            <Hotel className="size-4 mr-1.5" /> Hotel Bookings
          </Button>
          <Button
            size="sm"
            variant={kind === "accommodation" ? "default" : "outline"}
            onClick={() => setKind("accommodation")}
          >
            <Home className="size-4 mr-1.5" /> Free Accommodation
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : data?.items?.length ? (
            <div className="divide-y">
              {data.items.map((b: any) => (
                <div key={b.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-base">{b.listing?.name || "Business"}</p>
                      <Badge variant={b.status === "APPROVED" ? "default" : b.status === "REJECTED" ? "destructive" : "outline"}>
                        {b.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {kind === "restaurant"
                        ? `Date: ${b.bookingDate} · Slot: ${b.timeSlot} · Guests: ${b.peopleCount}`
                        : kind === "hotel"
                        ? `Stay: ${b.checkIn} → ${b.checkOut} · Rooms: ${b.rooms} · Guests: ${b.guests}`
                        : `Stay: ${b.checkInDate} → ${b.checkOutDate} · Pilgrims: ${b.peopleCount} (${b.groupType})`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Guest: {b.guestName || b.user?.name || "Visitor"} ({b.guestPhone || b.user?.phone || "Phone N/A"})
                    </p>
                    {(b.specialRequest || b.specialNotes) && (
                      <p className="text-xs bg-muted/50 p-1.5 rounded mt-1">Note: "{b.specialRequest || b.specialNotes}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {b.status === "PENDING" && (
                      <>
                        <Button size="sm" onClick={() => decide(b.id, "APPROVED")}>
                          <CheckCircle2 className="size-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decide(b.id, "REJECTED")}>
                          <XCircle className="size-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    {b.listingId && (
                      <Button size="sm" variant="ghost" onClick={() => navigate({ name: "listing", id: b.listingId })}>
                        View Listing
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No {statusFilter.toLowerCase()} {kind} bookings found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 6. BUSINESS OWNERSHIP & ASSIGNMENT MANAGEMENT
// ============================================================================
function BusinessOwnershipTab() {
  const { navigate } = useApp();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");
  const [ownershipFilter, setOwnershipFilter] = useState("ALL");
  const [assignTarget, setAssignTarget] = useState<any>(null);

  const query = `/listings?limit=100&q=${encodeURIComponent(q)}&category=${category === "ALL" ? "" : category}`;
  const { data, loading, refetch } = useApi<{ items: any[] }>(query, [query]);

  // Client side filtering for ownership status
  const items = (data?.items || []).filter((l: any) => {
    if (ownershipFilter === "ASSIGNED") return !!l.ownerId;
    if (ownershipFilter === "UNASSIGNED") return !l.ownerId;
    return true;
  });

  async function handleRemoveOwnership(listingId: string) {
    if (!confirm("Are you sure you want to remove the current owner from this business listing?")) return;
    try {
      await api.patch(`/listings/${listingId}`, { ownerId: null });
      toast({ title: "Ownership Cleared", description: "Listing is now unassigned." });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed to unassign", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Business Listing Ownership Management</h2>
          <p className="text-xs text-muted-foreground">Assign or transfer official business ownership to verified Business Owners</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="size-4 mr-1.5" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 bg-muted/40 p-3 rounded-xl border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search business by name or locality..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            <SelectItem value="RESTAURANT">Restaurants</SelectItem>
            <SelectItem value="HOTEL">Hotels</SelectItem>
            <SelectItem value="TRANSPORT">Travel Facilities</SelectItem>
            <SelectItem value="TOURIST_SPOT">Tourist Spots</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Ownership Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Listings</SelectItem>
            <SelectItem value="ASSIGNED">Assigned Owner</SelectItem>
            <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : items.length ? (
            <div className="divide-y">
              {items.map((l: any) => (
                <div key={l.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-base">{l.name}</p>
                      <Badge variant="secondary" className="text-xs">{l.category.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className="text-xs">{l.publicationStatus}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[l.locality, l.town, l.district].filter(Boolean).join(", ")}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-medium">Assigned Owner:</span>
                      {l.owner ? (
                        <span className="text-xs font-semibold text-primary">
                          {l.owner.name} ({l.owner.phone})
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 bg-amber-50 border-amber-200">
                          Unassigned
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => setAssignTarget(l)}
                    >
                      <UserCheck className="size-3.5 mr-1" /> {l.owner ? "Transfer Ownership" : "Assign Owner"}
                    </Button>
                    {l.owner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveOwnership(l.id)}
                      >
                        Remove Owner
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate({ name: "listing", id: l.id })}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No business listings found matching criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {assignTarget && (
        <AssignListingOwnerDialog
          listing={assignTarget}
          onClose={() => setAssignTarget(null)}
          onDone={() => { setAssignTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// 7. AUDIT LOGS & REPORTS TAB
// ============================================================================
function AuditTab() {
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("ALL");
  const query = `/audit?limit=150&action=${encodeURIComponent(action)}&targetType=${targetType === "ALL" ? "" : targetType}`;
  const { data, loading, refetch } = useApi<{ items: any[] }>(query, [query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter by action keyword (e.g. USER, LISTING, ASSIGN)..."
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={targetType} onValueChange={setTargetType}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Target Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Target Types</SelectItem>
            <SelectItem value="USER">User</SelectItem>
            <SelectItem value="LISTING">Listing</SelectItem>
            <SelectItem value="BOOKING">Booking</SelectItem>
            <SelectItem value="REPORT">Ghat Report</SelectItem>
          </SelectContent>
        </Select>

        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="size-4 mr-1.5" /> Refresh
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : data?.items?.length ? (
            <div className="divide-y max-h-[70vh] overflow-y-auto nice-scroll">
              {data.items.map((a: any) => (
                <div key={a.id} className="p-3.5 flex items-start gap-3 text-sm hover:bg-muted/10 transition-colors">
                  <ScrollText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-primary">{a.action.replace(/_/g, " ")}</span>
                      {a.targetType && <Badge variant="outline" className="text-xs">{a.targetType}</Badge>}
                      {a.actor?.name && (
                        <span className="text-xs text-muted-foreground">
                          by <span className="font-medium text-foreground">{a.actor.name}</span> ({a.actor.role.replace(/_/g, " ")})
                        </span>
                      )}
                    </div>
                    {a.details && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate bg-muted/40 p-1 rounded">
                        {typeof a.details === "string" ? a.details : JSON.stringify(a.details)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.createdAt).toLocaleString()} {a.ip && `· IP: ${a.ip}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">No audit entries found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MODAL DIALOGS
// ============================================================================

function RejectDialog({ listing, onClose, onConfirm }: { listing: any; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Listing</DialogTitle>
          <DialogDescription>Provide a clear reason for rejecting "{listing.name}".</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Inaccurate location, duplicate record, incomplete information"
            required
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => onConfirm(reason || "Does not meet platform guidelines.")}>
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateStaffDialog({ defaultRole, onClose, onDone }: { defaultRole: string; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole === "ALL" ? "GHAT_SUPERVISOR" : defaultRole);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name || !phone || !password) {
      toast({ title: "Error", description: "Name, phone, and password are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/admin/users", { name, phone, email: email || undefined, password, role });
      toast({ title: "Staff Account Created", description: `Assigned role: ${role.replace(/_/g, " ")}` });
      onDone();
    } catch (e) {
      toast({ title: "Creation Failed", description: e instanceof ApiError ? e.message : "Failed to create user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite / Create Operational Staff</DialogTitle>
          <DialogDescription>Create an authorized operational account with assigned permissions.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5 py-2">
          <div>
            <Label>Staff Full Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mobile Phone *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" required />
            </div>
            <div>
              <Label>Email (Optional)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@godavari2027.in" />
            </div>
          </div>
          <div>
            <Label>Initial Password *</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set secure password" required />
          </div>
          <div>
            <Label>Operational Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADMIN_CREATABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Operational roles have strict server-side scoping.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignExistingUserDialog({ defaultRole, onClose, onDone }: { defaultRole: string; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [targetUser, setTargetUser] = useState<any>(null);
  const [role, setRole] = useState(defaultRole === "ALL" ? "GHAT_SUPERVISOR" : defaultRole);
  const [loading, setLoading] = useState(false);

  const { data, loading: searching } = useApi<{ items: any[] }>(`/admin/users?q=${encodeURIComponent(q)}&role=VISITOR`, [q]);

  async function handleAssign() {
    if (!targetUser) return;
    setLoading(true);
    try {
      await api.patch(`/admin/users/${targetUser.id}`, { role });
      toast({ title: "Role Assigned", description: `${targetUser.name || targetUser.phone} promoted to ${role.replace(/_/g, " ")}.` });
      onDone();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error assigning role", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Existing User to Staff Role</DialogTitle>
          <DialogDescription>Promote a registered visitor to an operational role without recreating their account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-2">
          <div>
            <Label>Search Registered Users</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or phone..."
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y border rounded-lg">
            {searching ? (
              <p className="p-3 text-xs text-muted-foreground text-center">Searching...</p>
            ) : data?.items?.length ? (
              data.items.map((u: any) => (
                <div
                  key={u.id}
                  onClick={() => setTargetUser(u)}
                  className={`p-2.5 flex items-center justify-between text-sm cursor-pointer transition-colors ${
                    targetUser?.id === u.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                  }`}
                >
                  <div>
                    <p className="font-medium">{u.name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{u.phone}</p>
                  </div>
                  {targetUser?.id === u.id && <Check className="size-4 text-primary" />}
                </div>
              ))
            ) : (
              <p className="p-4 text-xs text-muted-foreground text-center">
                {q ? "No registered visitor accounts found." : "Type a phone or name to search."}
              </p>
            )}
          </div>

          {targetUser && (
            <div>
              <Label>Select Operational Role to Assign</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADMIN_CREATABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={loading || !targetUser}>
            {loading ? "Assigning..." : "Assign Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffUserDialog({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [status, setStatus] = useState(user.status || "ACTIVE");
  const [role, setRole] = useState(user.role || "VISITOR");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await api.patch(`/admin/users/${user.id}`, {
        name,
        email: email || null,
        status,
        role,
        password: password || undefined,
      });
      toast({ title: "User Updated", description: "Changes saved successfully." });
      onDone();
    } catch (e) {
      toast({ title: "Update Failed", description: e instanceof ApiError ? e.message : "Error updating user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveRole() {
    if (!confirm(`Are you sure you want to remove the operational role from ${user.name || user.phone}? The user account will remain active as a VISITOR without staff permissions.`)) return;
    setLoading(true);
    try {
      await api.patch(`/admin/users/${user.id}`, { role: "VISITOR" });
      toast({ title: "Role Removed", description: "User has been safely demoted to Visitor." });
      onDone();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Failed to remove role", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile, Role & Access</DialogTitle>
          <DialogDescription>Modify user permissions or remove role assignments.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5 py-2">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mobile Phone</Label>
              <Input value={user.phone} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Account Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADMIN_CREATABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                  ))}
                  <SelectItem value="VISITOR">Visitor (No Staff Permissions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Reset Password (leave empty to keep current)</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
          </div>

          {user.role !== "VISITOR" && (
            <div className="pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10"
                onClick={handleRemoveRole}
              >
                Remove Staff Role Assignment (Demote to Visitor)
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStaffDialog({
  user,
  currentUserId,
  onClose,
  onDone,
}: {
  user: any;
  currentUserId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const isSelf = user.id === currentUserId;
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await api.del<{ ok: boolean; action: string; message: string }>(
        `/admin/users/${user.id}`
      );
      toast({
        title: "Account permanently deleted",
        description: res.message || `Account permanently deleted: Staff member ${user.name || user.phone} has been removed.`,
      });
      onDone();
    } catch (e) {
      toast({
        title: "Deletion Failed",
        description: e instanceof ApiError ? e.message : "Failed to delete staff member.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-1">
            <Trash2 className="size-5" />
            <DialogTitle>Permanently Delete Staff Member</DialogTitle>
          </div>
          <DialogDescription>
            Review staff identity and role below, and explicitly confirm permanent deletion from Godavari One.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2 text-sm my-2">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-foreground">Staff Name:</span>
            <span className="font-semibold">{user.name || "Unnamed Staff Member"}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-foreground">Mobile Phone:</span>
            <span className="font-mono font-medium">{user.phone}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-foreground">Operational Role:</span>
            <Badge variant="secondary" className="font-semibold text-xs">
              {user.role.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-foreground">Current Status:</span>
            <Badge
              variant={user.status === "ACTIVE" ? "default" : user.status === "SUSPENDED" ? "outline" : "destructive"}
              className="text-xs font-normal"
            >
              {user.status}
            </Badge>
          </div>
        </div>

        {isSelf ? (
          <div className="flex items-start gap-2 p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p>
              <strong>Action Blocked:</strong> You are currently logged in with this Super Admin account. Self-deletion is prohibited to prevent administrative lockout and session loss.
            </p>
          </div>
        ) : isSuperAdmin ? (
          <div className="flex items-start gap-2 p-3 text-xs rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p>
              <strong>Super Admin Account:</strong> Deleting administrative accounts is strictly monitored. If this is the last active Super Admin, the request will be rejected to protect administrative access.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This action will permanently delete this staff account from Godavari One. The user will be completely removed, all operational assignments and active sessions will be terminated, and the user will lose all staff privileges immediately.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || isSelf}
          >
            {loading ? "Deleting..." : "Permanently Delete Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminGhatCrowdStatusDialog({
  ghat,
  onClose,
  onDone,
}: {
  ghat: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<string>(ghat.ghat?.currentCrowdStatus || "FREE");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await api.patch<{ ok: boolean; message: string }>(`/ghats/${ghat.id}/status`, {
        crowdStatus: status,
        notes: notes || undefined,
      });
      toast({
        title: "Ghat Crowd Status Updated",
        description: res.message || `${ghat.name} crowd status updated to ${status}.`,
      });
      onDone();
    } catch (e) {
      toast({
        title: "Update Failed",
        description: e instanceof ApiError ? e.message : "Failed to update ghat status.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-sky-600 mb-1">
            <Waves className="size-5" />
            <DialogTitle>Update Ghat Crowd Status</DialogTitle>
          </div>
          <DialogDescription>
            Super Admin Override: Update real-time crowd status for <strong>{ghat.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Crowd Status Level</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">FREE — Low crowd level</SelectItem>
                <SelectItem value="MODERATE">MODERATE — Medium crowd level</SelectItem>
                <SelectItem value="CROWDED">CROWDED — High crowd level</SelectItem>
                <SelectItem value="CLOSED">CLOSED — Temporarily closed</SelectItem>
                <SelectItem value="OVERCROWDED">OVERCROWDED — Very high crowd level</SelectItem>
                <SelectItem value="EMERGENCY">EMERGENCY — Emergency alert status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Admin Observation Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified via drone/CCTV feed, barricades adjusted..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white">
            {submitting ? "Saving..." : "Save Crowd Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageAssignmentsDialog({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const { data, loading, refetch } = useApi<{ items: any[] }>(`/admin/users/${user.id}/assign`);
  const [newType, setNewType] = useState<string>(
    user.role === "GHAT_SUPERVISOR"
      ? "GHAT_SUPERVISOR"
      : user.role === "BUSINESS_OWNER"
      ? "LISTING_OWNER"
      : user.role === "BOOKING_REVIEWER"
      ? "BOOKING_REVIEWER"
      : "LISTING_OWNER"
  );
  const [selectedListingId, setSelectedListingId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("RESTAURANT");
  const [adding, setAdding] = useState(false);

  // Load candidate listings (Ghats for supervisors, all for business owners)
  const isGhatRole = newType === "GHAT_SUPERVISOR";
  const candidateCategory = isGhatRole ? "GHAT" : "";
  const { data: candidateListings } = useApi<{ items: any[] }>(`/listings?limit=100&category=${candidateCategory}`);

  async function handleAddAssignment() {
    setAdding(true);
    try {
      await api.post(`/admin/users/${user.id}/assign`, {
        type: newType,
        listingId: selectedListingId || undefined,
        category: newType === "CATEGORY_EDITOR" ? selectedCategory : undefined,
      });
      toast({ title: "Assignment Added" });
      setSelectedListingId("");
      refetch();
      onDone();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error adding assignment", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    try {
      await api.del(`/admin/users/${user.id}/assign?assignmentId=${assignmentId}`);
      toast({ title: "Assignment Removed" });
      refetch();
      onDone();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error removing assignment", variant: "destructive" });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scoped Resource Assignments</DialogTitle>
          <DialogDescription>
            Manage specific listings or categories assigned to {user.name || user.phone} ({user.role.replace(/_/g, " ")}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Assignments List */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Active Assignments
            </Label>
            <div className="mt-2 divide-y border rounded-lg max-h-40 overflow-y-auto">
              {loading ? (
                <p className="p-3 text-xs text-muted-foreground text-center">Loading...</p>
              ) : data?.items?.length ? (
                data.items.map((a: any) => (
                  <div key={a.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold">{a.type.replace(/_/g, " ")}</p>
                      <p className="text-muted-foreground">
                        {a.listing?.name ? `Listing: ${a.listing.name} (${a.listing.category})` : a.category ? `Category: ${a.category}` : "Global Scope"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveAssignment(a.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              ) : (
                <p className="p-4 text-xs text-muted-foreground text-center">No active scoped assignments.</p>
              )}
            </div>
          </div>

          {/* Add Assignment Section */}
          <div className="p-3 bg-muted/40 rounded-lg border space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Add New Scoped Assignment
            </Label>
            <div>
              <Label className="text-xs">Assignment Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHAT_SUPERVISOR">Ghat Supervisor</SelectItem>
                  <SelectItem value="LISTING_OWNER">Listing Owner</SelectItem>
                  <SelectItem value="BOOKING_REVIEWER">Booking Reviewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newType === "CATEGORY_EDITOR" ? (
              <div>
                <Label className="text-xs">Permitted Category Scope</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(CATEGORY_META).map((c) => (
                      <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Select Specific Listing Target</Label>
                <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose a listing" /></SelectTrigger>
                  <SelectContent>
                    {candidateListings?.items?.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              size="sm"
              className="w-full h-8 text-xs"
              onClick={handleAddAssignment}
              disabled={adding || (newType !== "CATEGORY_EDITOR" && !selectedListingId)}
            >
              {adding ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignListingOwnerDialog({ listing, onClose, onDone }: { listing: any; onClose: () => void; onDone: () => void }) {
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch users with BUSINESS_OWNER role
  const { data: owners, loading: loadingOwners } = useApi<{ items: any[] }>("/admin/users?role=BUSINESS_OWNER&limit=100");

  async function handleConfirm() {
    if (!selectedOwnerId) return;
    setLoading(true);
    try {
      await api.patch(`/listings/${listing.id}`, { ownerId: selectedOwnerId });
      toast({ title: "Ownership Assigned", description: "Business ownership updated successfully." });
      onDone();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error assigning owner", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign or Transfer Business Owner</DialogTitle>
          <DialogDescription>
            Select a verified Business Owner for "{listing.name}" ({listing.category}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Select Business Owner Account</Label>
            {loadingOwners ? (
              <p className="text-xs text-muted-foreground py-2">Loading owners...</p>
            ) : owners?.items?.length ? (
              <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select Business Owner" /></SelectTrigger>
                <SelectContent>
                  {owners.items.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name || "Owner"} ({o.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                No active Business Owner accounts found. You can create or promote a user in the Staff & Role Management section.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading || !selectedOwnerId}>
            {loading ? "Assigning..." : "Confirm Owner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserAuditHistoryDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const { data, loading } = useApi<{ items: any[] }>(`/audit?targetId=${user.id}&limit=50`);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Audit & Activity History</DialogTitle>
          <DialogDescription>
            Historical actions and administrative updates for {user.name || user.phone}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : data?.items?.length ? (
            <div className="divide-y max-h-80 overflow-y-auto nice-scroll border rounded-lg">
              {data.items.map((a: any) => (
                <div key={a.id} className="p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary">{a.action.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  {a.details && (
                    <p className="text-muted-foreground mt-1 font-mono bg-muted/40 p-1 rounded truncate">
                      {typeof a.details === "string" ? a.details : JSON.stringify(a.details)}
                    </p>
                  )}
                  {a.actor?.name && (
                    <p className="text-muted-foreground mt-0.5">By actor: {a.actor.name}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No audit logs found for this user.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

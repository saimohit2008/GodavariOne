"use client";

import { useState, useRef, useMemo } from "react";
import { useApp } from "@/lib/store";
import { useApi } from "./use-api";
import { api } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Images,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  Eye,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Smartphone,
  Monitor,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  Calendar,
  X,
  Loader2,
  Building,
  Phone,
  Mail,
  MapPin,
  Tag,
  Compass,
  FileText,
  Globe,
  Share2,
} from "lucide-react";

export interface CarouselBannerAdmin {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string | null;
  imageUrl: string;
  contentType?: string;
  advertiserName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  location?: string | null;
  websiteUrl?: string | null;
  ctaLabel?: string | null;
  destinationType?: string;
  listingId?: string | null;
  destinationUrl: string | null;
  slug?: string | null;
  orderIdx: number;
  isEnabled: boolean;
  status: "PUBLISHED" | "DRAFT";
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  timingState: "ACTIVE" | "SCHEDULED" | "EXPIRED";
  isPubliclyVisible: boolean;
  listing?: {
    id: string;
    title: string;
    category: string;
    location: string;
    imageUrl?: string | null;
  } | null;
  createdBy?: { id: string; name: string | null; phone: string } | null;
  lastEditedBy?: { id: string; name: string | null; phone: string } | null;
}

const CONTENT_TYPES = [
  { value: "ADVERTISEMENT", label: "Advertisement / Commercial Campaign", requiresAdvertiser: true },
  { value: "EVENT", label: "Event / Festival / Pushkaralu Yatra", requiresAdvertiser: false },
  { value: "ANNOUNCEMENT", label: "Official Announcement / Advisory", requiresAdvertiser: false },
  { value: "TOURIST_ATTRACTION", label: "Tourist Attraction / Temple / Ghat", requiresAdvertiser: false },
  { value: "HOTEL", label: "Hotel / Accommodation / Riverside Stay", requiresAdvertiser: false },
  { value: "RESTAURANT", label: "Restaurant / Dining / Annadanam", requiresAdvertiser: false },
  { value: "NRI_INFORMATION", label: "NRI Information / Exclusive Service", requiresAdvertiser: false },
  { value: "GENERAL_PROMOTION", label: "General Promotion / Godavari Heritage", requiresAdvertiser: false },
];

const DESTINATION_TYPES = [
  { value: "DIRECTORY_LISTING", label: "Linked Directory Listing" },
  { value: "NRI_SECTION", label: "NRI Access Portal (/nri-access)" },
  { value: "INTERNAL_PAGE", label: "Internal Application Route" },
  { value: "EXTERNAL_URL", label: "External Website URL" },
];

export function CarouselManager() {
  const { user, navigate } = useApp();
  const { data, loading, refetch } = useApi<{ items: CarouselBannerAdmin[]; total: number }>(
    "/carousel?all=true"
  );
  const { data: listingsData } = useApi<{ items: Array<{ id: string; title: string; category: string; location: string }> }>(
    "/listings?limit=100"
  );

  const banners = data?.items || [];
  const listings = listingsData?.items || [];

  // Filter tab state
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "SCHEDULED" | "DRAFTS" | "EXPIRED">("ALL");

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<CarouselBannerAdmin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CarouselBannerAdmin | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewBannerTarget, setPreviewBannerTarget] = useState<CarouselBannerAdmin | null>(null);
  const [previewMode, setPreviewMode] = useState<"card" | "detail">("card");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formContentType, setFormContentType] = useState("GENERAL_PROMOTION");
  const [formAdvertiserName, setFormAdvertiserName] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formWebsiteUrl, setFormWebsiteUrl] = useState("");
  const [formCtaLabel, setFormCtaLabel] = useState("Learn More");
  const [formDestinationType, setFormDestinationType] = useState("INTERNAL_PAGE");
  const [formListingId, setFormListingId] = useState("");
  const [formDestinationUrl, setFormDestinationUrl] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formOrderIdx, setFormOrderIdx] = useState(0);
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [formStatus, setFormStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute stats
  const totalBanners = banners.length;
  const activePublished = banners.filter((b) => b.isPubliclyVisible).length;
  const scheduledCount = banners.filter((b) => b.timingState === "SCHEDULED" && b.isEnabled).length;
  const expiredCount = banners.filter((b) => b.timingState === "EXPIRED").length;
  const draftsCount = banners.filter((b) => b.status === "DRAFT" || !b.isEnabled).length;

  // Filtered banners
  const filteredBanners = useMemo(() => {
    switch (activeTab) {
      case "ACTIVE":
        return banners.filter((b) => b.isPubliclyVisible);
      case "SCHEDULED":
        return banners.filter((b) => b.timingState === "SCHEDULED" && b.isEnabled);
      case "DRAFTS":
        return banners.filter((b) => b.status === "DRAFT" || !b.isEnabled);
      case "EXPIRED":
        return banners.filter((b) => b.timingState === "EXPIRED");
      default:
        return banners;
    }
  }, [banners, activeTab]);

  // Format date helper for IST
  const formatIst = (dateStr?: string | null) => {
    if (!dateStr) return "None";
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }) + " IST"
      );
    } catch {
      return dateStr;
    }
  };

  const toInputDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const pad = (n: number) => String(n).padStart(2, "0");
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${mins}`;
    } catch {
      return "";
    }
  };

  const openCreateDialog = () => {
    setEditingBanner(null);
    setFormTitle("");
    setFormSubtitle("");
    setFormDescription("");
    setFormImageUrl("");
    setFormContentType("GENERAL_PROMOTION");
    setFormAdvertiserName("");
    setFormContactPhone("");
    setFormContactEmail("");
    setFormLocation("");
    setFormWebsiteUrl("");
    setFormCtaLabel("Learn More");
    setFormDestinationType("INTERNAL_PAGE");
    setFormListingId("");
    setFormDestinationUrl("");
    setFormSlug("");
    setFormOrderIdx(banners.length);
    setFormIsEnabled(true);
    setFormStatus("PUBLISHED");
    setFormStartDate("");
    setFormEndDate("");
    setFormErrors([]);
    setIsFormOpen(true);
  };

  const openEditDialog = (banner: CarouselBannerAdmin) => {
    setEditingBanner(banner);
    setFormTitle(banner.title);
    setFormSubtitle(banner.subtitle || "");
    setFormDescription(banner.description || "");
    setFormImageUrl(banner.imageUrl);
    setFormContentType(banner.contentType || "GENERAL_PROMOTION");
    setFormAdvertiserName(banner.advertiserName || "");
    setFormContactPhone(banner.contactPhone || "");
    setFormContactEmail(banner.contactEmail || "");
    setFormLocation(banner.location || "");
    setFormWebsiteUrl(banner.websiteUrl || "");
    setFormCtaLabel(banner.ctaLabel || "Learn More");
    setFormDestinationType(
      banner.destinationType ||
        (banner.listingId
          ? "DIRECTORY_LISTING"
          : banner.destinationUrl === "/nri-access"
          ? "NRI_SECTION"
          : banner.destinationUrl?.startsWith("http")
          ? "EXTERNAL_URL"
          : "INTERNAL_PAGE")
    );
    setFormListingId(banner.listingId || "");
    setFormDestinationUrl(banner.destinationUrl || "");
    setFormSlug(banner.slug || "");
    setFormOrderIdx(banner.orderIdx);
    setFormIsEnabled(banner.isEnabled);
    setFormStatus(banner.status);
    setFormStartDate(toInputDateTime(banner.startDate));
    setFormEndDate(toInputDateTime(banner.endDate));
    setFormErrors([]);
    setIsFormOpen(true);
  };

  // Image Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast({
        title: "Unsupported format",
        description: "Please upload a JPEG, PNG, WebP, or GIF image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image size must be 5MB or less.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/carousel/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload image");
      }

      const data = await res.json();
      setFormImageUrl(data.url);
      toast({
        title: "Image uploaded",
        description: "Banner image successfully stored.",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save Banner (Create or Update)
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!formTitle.trim()) {
      errors.push("Title is required.");
    }
    if (!formImageUrl.trim()) {
      errors.push("Image is required (upload or provide URL).");
    }

    // Conditional requirements
    if (formContentType === "ADVERTISEMENT" && !formAdvertiserName.trim()) {
      errors.push("Advertiser or Organization name is required for Advertisements.");
    }

    if (formDestinationType === "DIRECTORY_LISTING" && !formListingId) {
      errors.push("Please select a linked directory listing.");
    }

    if (formDestinationType === "EXTERNAL_URL") {
      const urlToCheck = formDestinationUrl.trim() || formWebsiteUrl.trim();
      if (!urlToCheck) {
        errors.push("External website URL is required.");
      } else if (!urlToCheck.startsWith("http://") && !urlToCheck.startsWith("https://")) {
        errors.push("External website URL must begin with http:// or https://");
      }
    }

    if (formStartDate && formEndDate) {
      const s = new Date(formStartDate).getTime();
      const en = new Date(formEndDate).getTime();
      if (s > en) {
        errors.push("Start date cannot be after end date.");
      }
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      toast({
        title: "Validation errors",
        description: "Please resolve the highlighted issues before saving.",
        variant: "destructive",
      });
      return;
    }

    setFormErrors([]);

    // Determine final destinationUrl based on destinationType
    let computedDestinationUrl = formDestinationUrl.trim() || null;
    if (formDestinationType === "NRI_SECTION") {
      computedDestinationUrl = "/nri-access";
    } else if (formDestinationType === "DIRECTORY_LISTING" && formListingId) {
      computedDestinationUrl = `/directory/${formListingId}`;
    }

    try {
      setSaving(true);
      const payload = {
        title: formTitle.trim(),
        subtitle: formSubtitle.trim() || null,
        description: formDescription.trim() || null,
        imageUrl: formImageUrl.trim(),
        contentType: formContentType,
        advertiserName: formAdvertiserName.trim() || null,
        contactPhone: formContactPhone.trim() || null,
        contactEmail: formContactEmail.trim() || null,
        location: formLocation.trim() || null,
        websiteUrl: formWebsiteUrl.trim() || null,
        ctaLabel: formCtaLabel.trim() || "Learn More",
        destinationType: formDestinationType,
        listingId: formListingId || null,
        destinationUrl: computedDestinationUrl,
        slug: formSlug.trim() || undefined,
        orderIdx: Number(formOrderIdx) || 0,
        isEnabled: formIsEnabled,
        status: formStatus,
        startDate: formStartDate ? new Date(formStartDate).toISOString() : null,
        endDate: formEndDate ? new Date(formEndDate).toISOString() : null,
      };

      if (editingBanner) {
        await api.patch(`/carousel/${editingBanner.id}`, payload);
        toast({ title: "Banner updated", description: "Changes saved successfully without duplication." });
      } else {
        await api.post("/carousel", payload);
        toast({ title: "Banner created", description: "New carousel banner information created successfully." });
      }

      setIsFormOpen(false);
      refetch();
    } catch (err: any) {
      setFormErrors([err.message || "Failed to save carousel item."]);
      toast({
        title: "Error saving banner",
        description: err.message || "Failed to save carousel banner.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle enable/disable
  const handleToggleEnabled = async (banner: CarouselBannerAdmin) => {
    try {
      await api.patch(`/carousel/${banner.id}`, { isEnabled: !banner.isEnabled });
      refetch();
      toast({
        title: banner.isEnabled ? "Banner disabled" : "Banner enabled",
        description: `"${banner.title}" is now ${banner.isEnabled ? "hidden from" : "visible on"} public carousel.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" });
    }
  };

  // Quick toggle status (PUBLISHED / DRAFT)
  const handleToggleStatus = async (banner: CarouselBannerAdmin) => {
    const nextStatus = banner.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await api.patch(`/carousel/${banner.id}`, { status: nextStatus });
      refetch();
      toast({
        title: nextStatus === "PUBLISHED" ? "Banner Published" : "Banner Saved as Draft",
        description: `Status changed to ${nextStatus}.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update status", variant: "destructive" });
    }
  };

  // Delete banner
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/carousel/${deleteTarget.id}`);
      toast({ title: "Banner deleted", description: `"${deleteTarget.title}" was deleted.` });
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Error deleting", description: err.message || "Failed to delete banner", variant: "destructive" });
    }
  };

  // Reordering: Move up or down
  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    try {
      setReordering(true);
      const newBanners = [...banners];
      const temp = newBanners[index];
      newBanners[index] = newBanners[targetIndex];
      newBanners[targetIndex] = temp;

      const bannerIds = newBanners.map((b) => b.id);
      await api.post("/carousel/reorder", { bannerIds });
      refetch();
      toast({ title: "Order updated", description: "Carousel banners sequence refreshed." });
    } catch (err: any) {
      toast({ title: "Reorder failed", description: err.message || "Failed to update sequence", variant: "destructive" });
    } finally {
      setReordering(false);
    }
  };

  // Trigger preview modal for a specific banner or all banners
  const handleOpenPreview = (banner?: CarouselBannerAdmin) => {
    setPreviewBannerTarget(banner || banners[0] || null);
    setPreviewMode(banner ? "detail" : "card");
    setIsPreviewModalOpen(true);
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center shadow-xs">
            <Images className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Carousel & Advertisements Management</h2>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                Super Admin
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Structured information forms for homepage banners, commercial ads, events, and linked directory listings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenPreview()}
            className="gap-1.5"
            disabled={banners.length === 0}
          >
            <Eye className="size-4" /> Preview Live & Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
            title="Refresh banner list"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={openCreateDialog} className="gap-1.5 shadow-xs">
            <Plus className="size-4" /> Add Item / Advertisement
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card
          className={`p-4 gap-0 cursor-pointer transition-colors ${
            activeTab === "ALL" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/40"
          }`}
          onClick={() => setActiveTab("ALL")}
        >
          <p className="text-xs font-medium text-muted-foreground">Total Items</p>
          <p className="text-2xl font-bold mt-1">{totalBanners}</p>
        </Card>
        <Card
          className={`p-4 gap-0 border-emerald-500/20 cursor-pointer transition-colors ${
            activeTab === "ACTIVE"
              ? "ring-2 ring-emerald-600 bg-emerald-500/15"
              : "bg-emerald-500/5 hover:bg-emerald-500/10"
          }`}
          onClick={() => setActiveTab("ACTIVE")}
        >
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live on Public Site</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{activePublished}</p>
        </Card>
        <Card
          className={`p-4 gap-0 border-purple-500/20 cursor-pointer transition-colors ${
            activeTab === "SCHEDULED"
              ? "ring-2 ring-purple-600 bg-purple-500/15"
              : "bg-purple-500/5 hover:bg-purple-500/10"
          }`}
          onClick={() => setActiveTab("SCHEDULED")}
        >
          <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Scheduled (Future)</p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">{scheduledCount}</p>
        </Card>
        <Card
          className={`p-4 gap-0 cursor-pointer transition-colors ${
            activeTab === "DRAFTS" ? "ring-2 ring-amber-500 bg-amber-500/15" : "hover:bg-muted/40"
          }`}
          onClick={() => setActiveTab("DRAFTS")}
        >
          <p className="text-xs font-medium text-muted-foreground">Drafts / Disabled</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{draftsCount}</p>
        </Card>
        <Card
          className={`p-4 gap-0 cursor-pointer transition-colors ${
            activeTab === "EXPIRED" ? "ring-2 ring-slate-500 bg-slate-500/15" : "hover:bg-muted/40"
          }`}
          onClick={() => setActiveTab("EXPIRED")}
        >
          <p className="text-xs font-medium text-muted-foreground">Expired (Past)</p>
          <p className="text-2xl font-bold text-muted-foreground mt-1">{expiredCount}</p>
        </Card>
      </div>

      {/* Filter notice if activeTab !== 'ALL' */}
      {activeTab !== "ALL" && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg text-xs">
          <span>
            Filtering by: <strong>{activeTab}</strong> ({filteredBanners.length} items)
          </span>
          <Button variant="ghost" size="sm" onClick={() => setActiveTab("ALL")} className="h-6 text-xs px-2">
            Show All
          </Button>
        </div>
      )}

      {/* Public Homepage Status Notice */}
      {activePublished === 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">No carousel items are currently active or published</p>
            <p className="text-xs mt-0.5 opacity-90">
              The public homepage carousel is currently hidden. Create or publish an item with <strong>Published</strong> status, <strong>Enabled</strong> toggle on, and current IST scheduling to display on the live site.
            </p>
          </div>
        </div>
      )}

      {/* Banners Table / List */}
      <Card className="p-0 gap-0 overflow-hidden">
        <CardHeader className="p-5 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Carousel Items ({filteredBanners.length})</CardTitle>
            <CardDescription className="text-xs">
              Every item has a structured information form and opens a dedicated detail page when clicked by visitors.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBanners.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Images className="size-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-foreground">No carousel items found</p>
              <p className="text-xs mt-1 max-w-md mx-auto">
                {activeTab === "ALL"
                  ? "Create carousel advertisements, attractions, or events using the rich information form."
                  : `No items matching the "${activeTab}" filter.`}
              </p>
              <Button size="sm" onClick={openCreateDialog} className="mt-4 gap-1.5">
                <Plus className="size-4" /> Add Item
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredBanners.map((banner, index) => {
                const contentTypeObj = CONTENT_TYPES.find((c) => c.value === banner.contentType);
                return (
                  <div
                    key={banner.id}
                    className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors ${
                      !banner.isEnabled || banner.status === "DRAFT" ? "opacity-75" : ""
                    }`}
                  >
                    {/* Left: Order, Thumbnail, Details */}
                    <div className="flex items-start sm:items-center gap-4 flex-1">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={index === 0 || reordering}
                          onClick={() => handleMoveOrder(index, "up")}
                          title="Move Up"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <span className="text-center text-xs font-mono font-semibold text-muted-foreground">
                          #{banner.orderIdx + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={index === filteredBanners.length - 1 || reordering}
                          onClick={() => handleMoveOrder(index, "down")}
                          title="Move Down"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </div>

                      {/* Thumbnail with Click to preview */}
                      <div
                        className="relative w-28 sm:w-36 aspect-[16/9] rounded-lg overflow-hidden border bg-muted shrink-0 cursor-pointer group"
                        onClick={() => setPreviewImage(banner.imageUrl)}
                        title="Click to view full image"
                      >
                        <img
                          src={banner.imageUrl}
                          alt={banner.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium">
                          <Eye className="size-4 mr-1" /> View
                        </div>
                      </div>

                      {/* Banner Info */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-base text-foreground truncate max-w-sm">
                            {banner.title}
                          </h4>

                          {/* Content Type Badge */}
                          <Badge variant="outline" className="text-[10px] font-medium bg-muted/60">
                            {contentTypeObj ? contentTypeObj.label.split(" / ")[0] : banner.contentType || "General"}
                          </Badge>

                          {/* Status Badges */}
                          <Badge
                            variant={banner.status === "PUBLISHED" ? "default" : "secondary"}
                            className={`text-[11px] font-semibold cursor-pointer ${
                              banner.status === "PUBLISHED"
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                            }`}
                            onClick={() => handleToggleStatus(banner)}
                            title="Click to toggle Published/Draft"
                          >
                            {banner.status}
                          </Badge>

                          {/* Timing State Badge */}
                          {banner.timingState === "ACTIVE" && (
                            <Badge
                              variant="outline"
                              className="text-[11px] border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                            >
                              Active
                            </Badge>
                          )}
                          {banner.timingState === "SCHEDULED" && (
                            <Badge
                              variant="outline"
                              className="text-[11px] border-purple-500/40 text-purple-600 bg-purple-50 dark:bg-purple-950/30"
                            >
                              <Clock className="size-3 mr-1" /> Scheduled
                            </Badge>
                          )}
                          {banner.timingState === "EXPIRED" && (
                            <Badge
                              variant="outline"
                              className="text-[11px] border-slate-400 text-slate-500 bg-slate-50 dark:bg-slate-900"
                            >
                              Expired
                            </Badge>
                          )}

                          {banner.isPubliclyVisible ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] border-emerald-600 text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50"
                            >
                              <CheckCircle2 className="size-3 mr-1" /> Live
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground border-border">
                              Hidden
                            </Badge>
                          )}
                        </div>

                        {banner.subtitle && (
                          <p className="text-xs font-medium text-foreground/80 line-clamp-1">{banner.subtitle}</p>
                        )}

                        {banner.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-xl">
                            {banner.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-0.5">
                          {banner.advertiserName && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/90">
                              <Building className="size-3 text-primary" /> {banner.advertiserName}
                            </span>
                          )}

                          {banner.location && (
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <MapPin className="size-3 text-muted-foreground" /> {banner.location}
                            </span>
                          )}

                          {banner.destinationUrl ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary font-mono truncate max-w-xs">
                              <LinkIcon className="size-3 shrink-0" /> {banner.destinationUrl}
                            </span>
                          ) : banner.listing ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary truncate max-w-xs">
                              <Compass className="size-3 shrink-0" /> Listing: {banner.listing.title}
                            </span>
                          ) : null}

                          {(banner.startDate || banner.endDate) && (
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <Calendar className="size-3 text-muted-foreground" />
                              {banner.startDate ? formatIst(banner.startDate).split(",")[0] : "Start"} →{" "}
                              {banner.endDate ? formatIst(banner.endDate).split(",")[0] : "End"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => handleOpenPreview(banner)}
                        title="Preview Detail Page & Card"
                      >
                        <Eye className="size-3.5" /> Preview
                      </Button>

                      <div className="flex items-center gap-2 pl-2">
                        <Label htmlFor={`enable-${banner.id}`} className="text-xs cursor-pointer sr-only">
                          Enable
                        </Label>
                        <Switch
                          id={`enable-${banner.id}`}
                          checked={banner.isEnabled}
                          onCheckedChange={() => handleToggleEnabled(banner)}
                          title="Enable or disable without deleting"
                        />
                      </div>

                      <div className="flex items-center gap-1 border-l pl-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEditDialog(banner)}
                          title="Edit Information Form"
                        >
                          <Edit3 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(banner)}
                          title="Delete Item"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comprehensive Add / Edit Information Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto nice-scroll">
          <form onSubmit={handleSaveBanner}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileText className="size-5 text-primary" />
                {editingBanner ? "Edit Carousel Item / Advertisement" : "Create New Carousel Item / Advertisement"}
              </DialogTitle>
              <DialogDescription>
                Collect complete information for this carousel entry. Every item provides a rich detail page for visitors.
              </DialogDescription>
            </DialogHeader>

            {/* Validation Errors Alert Banner */}
            {formErrors.length > 0 && (
              <div className="mt-3 p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="size-4" /> Please resolve the following errors:
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {formErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4 py-4">
              {/* Content Type & Publication Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="content-type">
                    Content Type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formContentType} onValueChange={setFormContentType}>
                    <SelectTrigger id="content-type">
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Determines category badge and required advertiser details.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="banner-status">
                    Publication Status <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formStatus}
                    onValueChange={(val: "PUBLISHED" | "DRAFT") => setFormStatus(val)}
                  >
                    <SelectTrigger id="banner-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLISHED">Published (Show on site per schedule)</SelectItem>
                      <SelectItem value="DRAFT">Draft (Save privately without publishing)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Draft items are never shown to visitors.</p>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="banner-title">
                    Title / Campaign Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="banner-title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Godavari Pushkaralu 2027 Grand Snanam Packages"
                    maxLength={150}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="banner-subtitle">Short Subtitle (Optional)</Label>
                  <Input
                    id="banner-subtitle"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="e.g. Official riverside VIP accommodations & spiritual guided yatras"
                    maxLength={200}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="banner-desc">Full Description</Label>
                  <Textarea
                    id="banner-desc"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Provide detailed description of the advertisement, attraction, event, or announcement displayed on the full details page..."
                    rows={4}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This full text will be presented to visitors on the item's detail page.
                  </p>
                </div>
              </div>

              {/* Image Upload / URL */}
              <div className="space-y-2 border-t pt-3">
                <Label>
                  Banner / Advertisement Image <span className="text-destructive">*</span>
                </Label>

                {formImageUrl ? (
                  <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border bg-muted group">
                    <img src={formImageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Replace Image
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setFormImageUrl("")}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 cursor-pointer bg-muted/20 transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="size-8 text-primary animate-spin" />
                    ) : (
                      <UploadCloud className="size-8 text-muted-foreground" />
                    )}
                    <div className="text-sm">
                      <span className="font-semibold text-primary">Click to upload</span> banner photograph
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPEG, PNG, WebP, or GIF (up to 5MB, 16:9 ratio recommended)
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />

                <Input
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="Or paste /uploads/... or https:// image URL"
                  className="text-xs font-mono"
                />
              </div>

              {/* Advertiser & Contact Details (Conditionally Required for ADVERTISEMENT) */}
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Building className="size-3.5 text-primary" />
                  Organization / Advertiser Information
                  {formContentType === "ADVERTISEMENT" && (
                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                      Required for Ads
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="advertiser-name">
                      Advertiser / Sponsor / Organization{" "}
                      {formContentType === "ADVERTISEMENT" && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="advertiser-name"
                      value={formAdvertiserName}
                      onChange={(e) => setFormAdvertiserName(e.target.value)}
                      placeholder="e.g. AP Tourism / Godavari Riverfront Resort"
                      required={formContentType === "ADVERTISEMENT"}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="item-location">Location / Address</Label>
                    <Input
                      id="item-location"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="e.g. Kotilingala Ghat, Rajahmundry"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone">Contact Phone</Label>
                    <Input
                      id="contact-phone"
                      value={formContactPhone}
                      onChange={(e) => setFormContactPhone(e.target.value)}
                      placeholder="e.g. +91 883 246 1234"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Contact Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={formContactEmail}
                      onChange={(e) => setFormContactEmail(e.target.value)}
                      placeholder="e.g. contact@godavari-tourism.org"
                    />
                  </div>
                </div>
              </div>

              {/* Destination & Action Behavior */}
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Compass className="size-3.5 text-primary" />
                  Destination Selection & Call to Action (CTA)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dest-type">Destination Type</Label>
                    <Select value={formDestinationType} onValueChange={setFormDestinationType}>
                      <SelectTrigger id="dest-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DESTINATION_TYPES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cta-label">Call-to-Action (CTA) Button Label</Label>
                    <Input
                      id="cta-label"
                      value={formCtaLabel}
                      onChange={(e) => setFormCtaLabel(e.target.value)}
                      placeholder="e.g. Learn More, Book Now, Contact Us, Explore Ghat"
                    />
                  </div>
                </div>

                {/* Conditional Destination Target Fields */}
                {formDestinationType === "DIRECTORY_LISTING" && (
                  <div className="space-y-1.5 p-3 rounded-xl border bg-muted/30">
                    <Label htmlFor="listing-select">
                      Select Linked Directory Listing <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formListingId} onValueChange={setFormListingId}>
                      <SelectTrigger id="listing-select">
                        <SelectValue placeholder="Choose an existing directory listing..." />
                      </SelectTrigger>
                      <SelectContent>
                        {listings.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            [{l.category}] {l.title} — {l.location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      The detail page will embed this verified directory listing directly with full booking and navigation capabilities.
                    </p>
                  </div>
                )}

                {formDestinationType === "NRI_SECTION" && (
                  <div className="p-3 rounded-xl border bg-primary/5 text-xs text-primary space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <Sparkles className="size-3.5" /> Directs to NRI Access Portal
                    </p>
                    <p className="opacity-90">
                      Destination will automatically route to <code>/nri-access</code> with back-to-home navigation.
                    </p>
                  </div>
                )}

                {formDestinationType === "EXTERNAL_URL" && (
                  <div className="space-y-1.5 p-3 rounded-xl border bg-muted/30">
                    <Label htmlFor="external-url">
                      External Website URL <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="external-url"
                      value={formWebsiteUrl || formDestinationUrl}
                      onChange={(e) => {
                        setFormWebsiteUrl(e.target.value);
                        setFormDestinationUrl(e.target.value);
                      }}
                      placeholder="https://example.com/special-package"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Must start with http:// or https://. Will open safely in a new tab with rel=&ldquo;noopener noreferrer&rdquo;.
                    </p>
                  </div>
                )}

                {formDestinationType === "INTERNAL_PAGE" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="banner-dest">Internal Application Route</Label>
                    <Input
                      id="banner-dest"
                      value={formDestinationUrl}
                      onChange={(e) => setFormDestinationUrl(e.target.value)}
                      placeholder="e.g. /directory?category=GHAT"
                    />
                    {/* Shortcut pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[11px] text-muted-foreground self-center mr-1">Quick internal:</span>
                      {[
                        { label: "Home", url: "/" },
                        { label: "Ghats", url: "/directory?category=GHAT" },
                        { label: "Hotels", url: "/directory?category=HOTEL" },
                        { label: "Dining", url: "/directory?category=RESTAURANT" },
                        { label: "Spots", url: "/directory?category=TOURIST_SPOT" },
                        { label: "NRI Access", url: "/nri-access" },
                      ].map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => setFormDestinationUrl(s.url)}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors border"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Display Order & Scheduling */}
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Clock className="size-3.5 text-primary" />
                  Display Order & IST Publication Dates
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="banner-order">Display Order Index</Label>
                    <Input
                      id="banner-order"
                      type="number"
                      min={0}
                      value={formOrderIdx}
                      onChange={(e) => setFormOrderIdx(parseInt(e.target.value, 10) || 0)}
                    />
                    <p className="text-[10px] text-muted-foreground">Lower numbers slide first.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="banner-start" className="text-xs">
                      Start Date & Time (IST)
                    </Label>
                    <Input
                      id="banner-start"
                      type="datetime-local"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Blank = show immediately</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="banner-end" className="text-xs">
                      End Date & Time (IST)
                    </Label>
                    <Input
                      id="banner-end"
                      type="datetime-local"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Blank = indefinite</p>
                  </div>
                </div>
              </div>

              {/* Enable / Disable Switch */}
              <div className="flex items-center justify-between border-t pt-3">
                <div className="space-y-0.5">
                  <Label htmlFor="banner-enabled">Enable Item</Label>
                  <p className="text-xs text-muted-foreground">
                    When disabled, this item is hidden from visitors regardless of publication status or dates.
                  </p>
                </div>
                <Switch
                  id="banner-enabled"
                  checked={formIsEnabled}
                  onCheckedChange={setFormIsEnabled}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || uploading} className="shadow-xs">
                {saving ? "Saving..." : editingBanner ? "Save Changes" : "Create Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" /> Delete Carousel Item
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone and will remove it from the homepage.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
              <img
                src={deleteTarget.imageUrl}
                alt=""
                className="size-14 rounded-md object-cover border"
              />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{deleteTarget.title}</p>
                <p className="text-xs text-muted-foreground truncate">{deleteTarget.contentType || "General"}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2 overflow-hidden bg-black/90 border-black">
          {previewImage && (
            <div className="relative w-full aspect-[16/9] flex items-center justify-center">
              <img
                src={previewImage}
                alt="Full banner preview"
                className="max-h-full max-w-full object-contain rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Interactive Carousel & Detail Page Live Preview Modal */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto nice-scroll p-6">
          <DialogHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-primary" /> Live Carousel & Detail Page Preview
              </DialogTitle>
              <DialogDescription>
                Inspect how visitors experience both the sliding homepage card and the dedicated full-screen detail page.
              </DialogDescription>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                <Button
                  variant={previewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewMode("card")}
                  className="gap-1 h-7 text-xs"
                >
                  <Images className="size-3.5" /> Homepage Slider
                </Button>
                <Button
                  variant={previewMode === "detail" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPreviewMode("detail")}
                  className="gap-1 h-7 text-xs"
                >
                  <FileText className="size-3.5" /> Detail Page
                </Button>
              </div>

              {previewMode === "card" && (
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                  <Button
                    variant={previewDevice === "desktop" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPreviewDevice("desktop")}
                    className="gap-1 h-7 text-xs"
                  >
                    <Monitor className="size-3" /> Desktop
                  </Button>
                  <Button
                    variant={previewDevice === "mobile" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPreviewDevice("mobile")}
                    className="gap-1 h-7 text-xs"
                  >
                    <Smartphone className="size-3" /> Mobile
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {previewMode === "card" ? (
            /* Card / Slider Preview */
            <div className="py-6 flex justify-center bg-slate-900/5 rounded-2xl border min-h-[360px] overflow-hidden">
              <div
                className={`transition-all duration-300 bg-background rounded-xl overflow-hidden shadow-md border ${
                  previewDevice === "mobile" ? "w-[375px] max-w-full" : "w-full"
                }`}
              >
                {activePublished === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <p className="font-semibold text-foreground">No items are currently live</p>
                    <p className="text-xs mt-1">Publish and enable items to preview them in the slider.</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                        Live Homepage Slider
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{activePublished} banners active</span>
                    </div>

                    <div className="flex gap-3 overflow-x-auto nice-scroll pb-2">
                      {banners
                        .filter((b) => b.isPubliclyVisible)
                        .map((b) => (
                          <div
                            key={b.id}
                            className="relative shrink-0 rounded-xl overflow-hidden border shadow-xs aspect-[16/9] w-[260px] sm:w-[320px] bg-muted group cursor-pointer"
                            onClick={() => {
                              setPreviewBannerTarget(b);
                              setPreviewMode("detail");
                            }}
                          >
                            <img
                              src={b.imageUrl}
                              alt={b.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                            <div className="absolute bottom-0 inset-x-0 p-3 text-white">
                              {b.subtitle && (
                                <p className="text-[10px] text-white/80 line-clamp-1">{b.subtitle}</p>
                              )}
                              <p className="font-bold text-sm leading-tight line-clamp-1">{b.title}</p>
                              <div className="mt-1 flex items-center justify-between text-[11px] text-white/90">
                                <span>{b.ctaLabel || "Learn More"} →</span>
                                <Badge variant="secondary" className="text-[9px] py-0 px-1 bg-white/20 text-white">
                                  Click for details
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Detail Page Preview */
            <div className="py-4 space-y-4">
              {/* Target Banner Selector if multiple available */}
              {banners.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Previewing details for:</Label>
                  <Select
                    value={previewBannerTarget?.id || banners[0]?.id}
                    onValueChange={(id) => {
                      const found = banners.find((b) => b.id === id);
                      if (found) setPreviewBannerTarget(found);
                    }}
                  >
                    <SelectTrigger className="w-[300px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {banners.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {previewBannerTarget ? (
                <div className="border rounded-2xl bg-card overflow-hidden shadow-xs p-6 space-y-6">
                  {/* Banner Image */}
                  <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full rounded-xl overflow-hidden border bg-muted">
                    <img
                      src={previewBannerTarget.imageUrl}
                      alt={previewBannerTarget.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4 flex gap-2">
                      <Badge className="bg-primary text-primary-foreground shadow-sm">
                        {previewBannerTarget.contentType?.replace("_", " ") || "FEATURED"}
                      </Badge>
                      <Badge variant="secondary" className="backdrop-blur-md bg-background/80">
                        {previewBannerTarget.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Header Titles */}
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      {previewBannerTarget.title}
                    </h1>
                    {previewBannerTarget.subtitle && (
                      <p className="text-base text-muted-foreground font-medium">
                        {previewBannerTarget.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Details Card Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-4">
                      <Card className="p-5">
                        <h3 className="font-semibold text-sm mb-2 text-foreground">About This Information</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          {previewBannerTarget.description || "No full description provided."}
                        </p>
                      </Card>

                      {previewBannerTarget.listing && (
                        <Card className="p-4 border-primary/20 bg-primary/5">
                          <p className="text-xs font-semibold text-primary mb-1">Linked Directory Listing</p>
                          <div className="flex items-center gap-3">
                            {previewBannerTarget.listing.imageUrl && (
                              <img
                                src={previewBannerTarget.listing.imageUrl}
                                alt=""
                                className="size-12 rounded-lg object-cover"
                              />
                            )}
                            <div>
                              <p className="font-bold text-sm">{previewBannerTarget.listing.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {previewBannerTarget.listing.category} • {previewBannerTarget.listing.location}
                              </p>
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>

                    {/* Sidebar Information */}
                    <div className="space-y-4">
                      <Card className="p-5 space-y-3">
                        <h3 className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
                          Campaign & Contact
                        </h3>

                        {previewBannerTarget.advertiserName && (
                          <div className="text-xs space-y-0.5">
                            <span className="text-muted-foreground">Organized by:</span>
                            <p className="font-semibold text-foreground">{previewBannerTarget.advertiserName}</p>
                          </div>
                        )}

                        {previewBannerTarget.location && (
                          <div className="text-xs space-y-0.5">
                            <span className="text-muted-foreground">Location:</span>
                            <p className="font-semibold text-foreground flex items-center gap-1">
                              <MapPin className="size-3 text-primary" /> {previewBannerTarget.location}
                            </p>
                          </div>
                        )}

                        {previewBannerTarget.contactPhone && (
                          <div className="text-xs space-y-0.5">
                            <span className="text-muted-foreground">Helpline:</span>
                            <p className="font-semibold text-foreground flex items-center gap-1">
                              <Phone className="size-3 text-primary" /> {previewBannerTarget.contactPhone}
                            </p>
                          </div>
                        )}

                        {previewBannerTarget.contactEmail && (
                          <div className="text-xs space-y-0.5">
                            <span className="text-muted-foreground">Email:</span>
                            <p className="font-semibold text-foreground flex items-center gap-1">
                              <Mail className="size-3 text-primary" /> {previewBannerTarget.contactEmail}
                            </p>
                          </div>
                        )}

                        {/* CTA button */}
                        <div className="pt-2">
                          <Button className="w-full gap-1.5 shadow-xs" size="sm">
                            {previewBannerTarget.ctaLabel || "Learn More"} <ExternalLink className="size-3.5" />
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">No banner selected for detail preview.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

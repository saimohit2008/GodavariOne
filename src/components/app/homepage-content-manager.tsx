"use client";

import { useState, useRef, useEffect } from "react";
import { useApp } from "@/lib/store";
import { useApi } from "./use-api";
import { api, ApiError } from "@/lib/api-client";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  LayoutDashboard,
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
  Layers,
  Image as ImageIcon,
  Megaphone,
  Grid,
  Building2,
  HeartHandshake,
  Waves,
  Accessibility,
  EyeOff,
  Sliders,
  Check,
  Search,
  Filter,
  Lock,
  ShieldAlert,
  Copy,
} from "lucide-react";
import { CarouselManager } from "./carousel-manager";

export interface HeroImageItem {
  url: string;
  filename: string;
  sizeBytes: number;
  mtime: string;
  status: "ACTIVE" | "SELECTED" | "UNPUBLISHED" | "UNUSED";
  isSelectedHero: boolean;
  isExplicitlyHidden: boolean;
  usages: Array<{ type: string; title: string; id?: string }>;
  isProtected: boolean;
  canDelete: boolean;
}

export interface HomepageSectionAdmin {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  orderIdx: number;
  settings: string | null;
  updatedAt: string;
}

export interface HomepageContentItemAdmin {
  id: string;
  section: string;
  title: string;
  description: string | null;
  buttonText: string | null;
  imageUrl: string | null;
  destinationUrl: string | null;
  listingId: string | null;
  badgeText: string | null;
  orderIdx: number;
  isEnabled: boolean;
  status: "PUBLISHED" | "DRAFT";
  startDate: string | null;
  endDate: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  timingState: "ACTIVE" | "SCHEDULED" | "EXPIRED";
  isPubliclyVisible: boolean;
  listing?: {
    id: string;
    name: string;
    category: string;
    town: string | null;
    district: string | null;
    publicationStatus: string;
    images?: { url: string }[];
  } | null;
  createdBy?: { id: string; name: string | null; phone: string } | null;
  lastEditedBy?: { id: string; name: string | null; phone: string } | null;
}

const SECTION_OPTIONS = [
  { id: "ANNOUNCEMENT", label: "Announcement & Notice Banner", icon: Megaphone, color: "text-amber-600 bg-amber-50" },
  { id: "PROMO_BANNER", label: "Promotional Banner Card", icon: Layers, color: "text-indigo-600 bg-indigo-50" },
  { id: "FEATURED_LISTING", label: "Featured Directory Listing", icon: Building2, color: "text-emerald-600 bg-emerald-50" },
  { id: "FREE_SERVICES", label: "Free Accommodation & Annadanam", icon: HeartHandshake, color: "text-rose-600 bg-rose-50" },
  { id: "HERO", label: "Hero Banner Content", icon: Sparkles, color: "text-sky-600 bg-sky-50" },
  { id: "CUSTOM", label: "Custom Section Content", icon: Grid, color: "text-purple-600 bg-purple-50" },
];

export function HomepageContentManager() {
  const { navigate } = useApp();
  const { data, loading, refetch } = useApi<{
    sections: HomepageSectionAdmin[];
    items: HomepageContentItemAdmin[];
    total: number;
  }>("/homepage-content?all=true");

  const { data: listingsData } = useApi<{ items: any[] }>("/listings?limit=100");
  const availableListings = listingsData?.items || [];

  const sections = data?.sections || [];
  const items = data?.items || [];

  // Active section tab
  const [activeTab, setActiveTab] = useState<string>("all");

  // Dialog & form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HomepageContentItemAdmin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HomepageContentItemAdmin | null>(null);
  const [previewItem, setPreviewItem] = useState<HomepageContentItemAdmin | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Item form fields
  const [formSection, setFormSection] = useState<string>("ANNOUNCEMENT");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formButtonText, setFormButtonText] = useState("");
  const [formBadgeText, setFormBadgeText] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDestinationType, setFormDestinationType] = useState<"url" | "listing">("url");
  const [formDestinationUrl, setFormDestinationUrl] = useState("");
  const [formListingId, setFormListingId] = useState("");
  const [formOrderIdx, setFormOrderIdx] = useState(0);
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [formStatus, setFormStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Hero section custom settings state
  const heroSection = sections.find((s) => s.id === "hero");
  let heroSettings: any = {};
  if (heroSection?.settings) {
    try {
      heroSettings = typeof heroSection.settings === "string" ? JSON.parse(heroSection.settings) : heroSection.settings;
    } catch {
      heroSettings = {};
    }
  }

  // Fetch local available images for one-click selection without re-uploading
  const { data: localUploadsData, refetch: refetchLocalUploads } = useApi<{ images: Array<{ url: string; name: string }> }>("/upload");
  const localImages = localUploadsData?.images || [];

  const [heroForm, setHeroForm] = useState({
    heroTitle: heroSettings.heroTitle || "Welcome to Godavari One",
    heroSubtitle: heroSettings.heroSubtitle || "Your complete guide to Godavari Pushkaralu 2027 — ghats, stay, food, transport and emergency services in one place.",
    tagline: heroSettings.tagline || "Godavari Pushkaralu 2027 · Digital Platform",
    showStatue: heroSettings.showStatue ?? true,
    statueImageUrl: heroSettings.statueImageUrl || "/images/godavari-devi.png",
    statueAlt: heroSettings.statueAlt || "Goddess Godavari Devi statue",
    statueGlow: heroSettings.statueGlow ?? true,
    statueAlignment: heroSettings.statueAlignment || "right",
    searchBarVisible: heroSettings.searchBarVisible ?? true,
  });

  // Keep heroForm in sync when backend settings load or change
  useEffect(() => {
    if (!heroSection?.settings) return;
    try {
      const parsed = typeof heroSection.settings === "string" ? JSON.parse(heroSection.settings) : heroSection.settings;
      if (parsed && typeof parsed === "object") {
        setHeroForm((prev) => ({
          ...prev,
          heroTitle: parsed.heroTitle ?? prev.heroTitle,
          heroSubtitle: parsed.heroSubtitle ?? prev.heroSubtitle,
          tagline: parsed.tagline ?? prev.tagline,
          showStatue: parsed.showStatue ?? prev.showStatue,
          statueImageUrl: parsed.statueImageUrl ?? prev.statueImageUrl,
          statueAlt: parsed.statueAlt ?? prev.statueAlt,
          statueGlow: parsed.statueGlow ?? prev.statueGlow,
          statueAlignment: parsed.statueAlignment ?? prev.statueAlignment,
          searchBarVisible: parsed.searchBarVisible ?? prev.searchBarVisible,
        }));
      }
    } catch (e) {
      console.error("Failed to parse hero settings:", e);
    }
  }, [heroSection?.settings]);

  const [savingHero, setSavingHero] = useState(false);
  const [heroStatueUploading, setHeroStatueUploading] = useState(false);

  // Hero Image Library Hook & State
  const {
    data: heroImagesData,
    loading: heroImagesLoading,
    refetch: refetchHeroImages,
  } = useApi<{
    images: HeroImageItem[];
    activeStatueUrl: string;
    isHeroStatueVisible: boolean;
    totalImages: number;
  }>("/homepage-content/hero-images");

  const heroLibraryImages = heroImagesData?.images || [];

  // Filter & Search state for hero image library
  const [heroSearch, setHeroSearch] = useState("");
  const [heroStatusFilter, setHeroStatusFilter] = useState<string>("ALL");
  const [previewHeroImage, setPreviewHeroImage] = useState<HeroImageItem | null>(null);
  const [deleteHeroImageTarget, setDeleteHeroImageTarget] = useState<HeroImageItem | null>(null);
  const [replacingHeroTarget, setReplacingHeroTarget] = useState<HeroImageItem | null>(null);
  const [libraryActionLoading, setLibraryActionLoading] = useState<string | null>(null);
  const [isDeletingHeroImage, setIsDeletingHeroImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroStatueInputRef = useRef<HTMLInputElement>(null);
  const heroLibraryUploadRef = useRef<HTMLInputElement>(null);
  const heroLibraryReplaceRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 KB";
    const k = 1024;
    if (bytes < k) return `${bytes} B`;
    if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
    return `${(bytes / (k * k)).toFixed(2)} MB`;
  };

  const handleSetAsHero = async (img: HeroImageItem) => {
    setLibraryActionLoading(img.url);
    try {
      const res = await fetch("/api/v1/homepage-content/hero-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", imageUrl: img.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to set hero statue image");

      setHeroForm((prev) => ({
        ...prev,
        statueImageUrl: img.url,
        showStatue: true,
      }));
      toast({
        title: "Hero Statue Updated",
        description: `"${img.filename}" is now set as the active Goddess Godavari Devi statue.`,
      });
      refetchHeroImages();
      refetch();
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLibraryActionLoading(null);
    }
  };

  const handleTogglePublishHeroImage = async (img: HeroImageItem, hide: boolean) => {
    setLibraryActionLoading(img.url);
    try {
      const res = await fetch("/api/v1/homepage-content/hero-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: hide ? "unpublish" : "publish", imageUrl: img.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update image visibility");

      if (img.isSelectedHero) {
        setHeroForm((prev) => ({ ...prev, showStatue: !hide }));
      }
      toast({
        title: hide ? "Image Hidden" : "Image Restored",
        description: hide
          ? `"${img.filename}" hidden from public display.`
          : `"${img.filename}" restored and published.`,
      });
      refetchHeroImages();
      refetch();
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLibraryActionLoading(null);
    }
  };

  const handleTriggerReplace = (img: HeroImageItem) => {
    setReplacingHeroTarget(img);
    setTimeout(() => {
      heroLibraryReplaceRef.current?.click();
    }, 50);
  };

  const handleHeroLibraryReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingHeroTarget) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, WebP)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum image size is 5MB", variant: "destructive" });
      return;
    }

    setLibraryActionLoading(replacingHeroTarget.url);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetImageUrl", replacingHeroTarget.url);

      const res = await fetch("/api/v1/homepage-content/hero-images", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned unexpected response (${res.status}): ${text.slice(0, 100)}`);
      }
      if (!res.ok) throw new Error(data?.error || "Failed to replace image");

      if (replacingHeroTarget.isSelectedHero && data.url) {
        setHeroForm((prev) => ({ ...prev, statueImageUrl: data.url }));
      }
      toast({
        title: "Image Replaced",
        description: data.message || `File replaced with "${data.filename}".`,
      });
      refetchHeroImages();
      refetchLocalUploads();
      refetch();
    } catch (err: any) {
      toast({
        title: "Replace failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLibraryActionLoading(null);
      setReplacingHeroTarget(null);
      if (heroLibraryReplaceRef.current) heroLibraryReplaceRef.current.value = "";
    }
  };

  const handleHeroLibraryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, WebP)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum image size is 5MB", variant: "destructive" });
      return;
    }

    setLibraryActionLoading("upload-new");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/homepage-content/hero-images", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned unexpected response (${res.status}): ${text.slice(0, 100)}`);
      }
      if (!res.ok) throw new Error(data?.error || "Failed to upload image");

      toast({
        title: "Image Added to Library",
        description: `"${data.filename}" is now stored and ready to use.`,
      });
      refetchHeroImages();
      refetchLocalUploads();
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLibraryActionLoading(null);
      if (heroLibraryUploadRef.current) heroLibraryUploadRef.current.value = "";
    }
  };

  const handlePermanentDeleteHeroImage = async () => {
    if (!deleteHeroImageTarget) return;

    setIsDeletingHeroImage(true);
    try {
      const res = await fetch(
        `/api/v1/homepage-content/hero-images?imageUrl=${encodeURIComponent(deleteHeroImageTarget.url)}`,
        { method: "DELETE" }
      );
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned unexpected response (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Deletion failed with status ${res.status}`);
      }

      toast({
        title: "Image Permanently Deleted",
        description: `"${deleteHeroImageTarget.filename}" was permanently removed from storage and image library.`,
      });

      setDeleteHeroImageTarget(null);
      refetchHeroImages();
      refetchLocalUploads();
    } catch (err: any) {
      toast({
        title: "Deletion Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsDeletingHeroImage(false);
    }
  };

  const filteredHeroImages = heroLibraryImages.filter((img) => {
    const term = heroSearch.toLowerCase().trim();
    const matchesSearch = !term || img.filename.toLowerCase().includes(term) || img.url.toLowerCase().includes(term);
    if (!matchesSearch) return false;

    if (heroStatusFilter === "ALL") return true;
    if (heroStatusFilter === "ACTIVE") return img.status === "ACTIVE";
    if (heroStatusFilter === "SELECTED") return img.status === "SELECTED";
    if (heroStatusFilter === "UNPUBLISHED") return img.status === "UNPUBLISHED";
    if (heroStatusFilter === "UNUSED") return img.status === "UNUSED";
    return true;
  });

  // Helper date formatter
  const formatIst = (dateStr?: string | null) => {
    if (!dateStr) return "Always Active";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Toggle Section isEnabled
  const handleToggleSection = async (sectionId: string, currentEnabled: boolean) => {
    try {
      await api.patch(`/homepage-content/sections/${sectionId}`, {
        isEnabled: !currentEnabled,
      });
      toast({
        title: "Section updated",
        description: `Section "${sectionId}" is now ${!currentEnabled ? "enabled" : "hidden"} on the homepage.`,
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message || "Could not update section status",
        variant: "destructive",
      });
    }
  };

  // Save Hero settings
  const handleSaveHeroSettings = async () => {
    setSavingHero(true);
    try {
      await api.patch(`/homepage-content/sections/hero`, {
        settings: heroForm,
      });
      toast({
        title: "Hero section saved",
        description: "Goddess Godavari Devi statue and hero section settings updated successfully.",
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Error saving hero settings",
        description: err.message || "Failed to update hero settings",
        variant: "destructive",
      });
    } finally {
      setSavingHero(false);
    }
  };

  // Upload statue image for Hero with robust error handling
  const handleHeroStatueUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, WebP)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum image size is 5MB", variant: "destructive" });
      return;
    }
    setHeroStatueUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned unexpected response (status ${res.status}): ${text.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(data?.error || `Upload failed with status ${res.status}`);
      if (!data?.url) throw new Error("Upload did not return an image URL");
      setHeroForm((prev) => ({ ...prev, statueImageUrl: data.url }));
      refetchLocalUploads();
      toast({ title: "Statue image uploaded", description: "Image uploaded successfully! Remember to click 'Save Hero & Statue Settings'." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Could not upload image", variant: "destructive" });
    } finally {
      setHeroStatueUploading(false);
      if (heroStatueInputRef.current) heroStatueInputRef.current.value = "";
    }
  };

  // Open Form Dialog (Create)
  const openCreateDialog = (defaultSection?: string) => {
    setEditingItem(null);
    setFormSection(defaultSection || (activeTab !== "all" && activeTab !== "hero" && activeTab !== "carousel" ? activeTab.toUpperCase() : "ANNOUNCEMENT"));
    setFormTitle("");
    setFormDescription("");
    setFormButtonText("");
    setFormBadgeText("");
    setFormImageUrl("");
    setFormDestinationType("url");
    setFormDestinationUrl("");
    setFormListingId("");
    setFormOrderIdx(items.length);
    setFormIsEnabled(true);
    setFormStatus("PUBLISHED");
    setFormStartDate("");
    setFormEndDate("");
    setIsFormOpen(true);
  };

  // Open Form Dialog (Edit)
  const openEditDialog = (item: HomepageContentItemAdmin) => {
    setEditingItem(item);
    setFormSection(item.section);
    setFormTitle(item.title);
    setFormDescription(item.description || "");
    setFormButtonText(item.buttonText || "");
    setFormBadgeText(item.badgeText || "");
    setFormImageUrl(item.imageUrl || "");
    setFormDestinationType(item.listingId ? "listing" : "url");
    setFormDestinationUrl(item.destinationUrl || "");
    setFormListingId(item.listingId || "");
    setFormOrderIdx(item.orderIdx);
    setFormIsEnabled(item.isEnabled);
    setFormStatus(item.status);
    setFormStartDate(item.startDate ? item.startDate.slice(0, 16) : "");
    setFormEndDate(item.endDate ? item.endDate.slice(0, 16) : "");
    setIsFormOpen(true);
  };

  // Image Upload handler for content items
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, WebP)", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum image size is 5MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned unexpected response (status ${res.status}): ${text.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(data?.error || `Upload failed with status ${res.status}`);
      if (!data?.url) throw new Error("Upload did not return an image URL");
      setFormImageUrl(data.url);
      refetchLocalUploads();
      toast({ title: "Image uploaded successfully", description: "Image attached to this homepage item." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Could not upload image", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save Content Item (Create or Update)
  const handleSaveItem = async () => {
    if (!formTitle.trim()) {
      toast({ title: "Validation error", description: "Title is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        section: formSection,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        buttonText: formButtonText.trim() || null,
        badgeText: formBadgeText.trim() || null,
        imageUrl: formImageUrl.trim() || null,
        destinationUrl: formDestinationType === "url" ? formDestinationUrl.trim() || null : null,
        listingId: formDestinationType === "listing" ? formListingId || null : null,
        orderIdx: formOrderIdx,
        isEnabled: formIsEnabled,
        status: formStatus,
        startDate: formStartDate ? new Date(formStartDate).toISOString() : null,
        endDate: formEndDate ? new Date(formEndDate).toISOString() : null,
      };

      if (editingItem) {
        await api.patch(`/homepage-content/${editingItem.id}`, payload);
        toast({ title: "Item updated", description: `"${formTitle}" saved successfully.` });
      } else {
        await api.post("/homepage-content", payload);
        toast({ title: "Item created", description: `"${formTitle}" added to homepage.` });
      }

      setIsFormOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err.message || "Failed to save homepage item",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle item isEnabled
  const handleToggleItemEnabled = async (item: HomepageContentItemAdmin) => {
    try {
      await api.patch(`/homepage-content/${item.id}`, {
        isEnabled: !item.isEnabled,
      });
      toast({
        title: !item.isEnabled ? "Item enabled" : "Item disabled",
        description: `"${item.title}" is now ${!item.isEnabled ? "visible" : "hidden"} on the homepage.`,
      });
      refetch();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  // Toggle item status (PUBLISHED <-> DRAFT)
  const handleToggleItemStatus = async (item: HomepageContentItemAdmin) => {
    const nextStatus = item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await api.patch(`/homepage-content/${item.id}`, {
        status: nextStatus,
      });
      toast({
        title: nextStatus === "PUBLISHED" ? "Republished successfully" : "Unpublished item",
        description: `"${item.title}" is now ${nextStatus.toLowerCase()}.`,
      });
      refetch();
    } catch (err: any) {
      toast({ title: "Status change failed", description: err.message, variant: "destructive" });
    }
  };

  // Delete Content Item
  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/homepage-content/${deleteTarget.id}`);
      toast({
        title: "Content deleted",
        description: `"${deleteTarget.title}" was permanently removed from homepage. (Directory listing was preserved).`,
      });
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  // Reorder Item (Up/Down)
  const handleMoveOrder = async (item: HomepageContentItemAdmin, direction: "up" | "down") => {
    const sectionItems = items.filter((i) => i.section === item.section).sort((a, b) => a.orderIdx - b.orderIdx);
    const currentIndex = sectionItems.findIndex((i) => i.id === item.id);
    if (currentIndex < 0) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === sectionItems.length - 1) return;

    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const swapItem = sectionItems[swapIndex];

    setReordering(true);
    try {
      await api.post("/homepage-content/reorder", {
        items: [
          { id: item.id, orderIdx: swapItem.orderIdx },
          { id: swapItem.id, orderIdx: item.orderIdx },
        ],
      });
      toast({ title: "Order updated", description: `Moved "${item.title}" ${direction}.` });
      refetch();
    } catch (err: any) {
      toast({ title: "Reorder failed", description: err.message, variant: "destructive" });
    } finally {
      setReordering(false);
    }
  };

  // Filter items for display
  const filteredItems = items.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "hero") return item.section === "HERO";
    if (activeTab === "announcements") return item.section === "ANNOUNCEMENT" || item.section === "PROMO_BANNER";
    if (activeTab === "featured_listings") return item.section === "FEATURED_LISTING";
    if (activeTab === "free_services") return item.section === "FREE_SERVICES";
    return item.section.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-teal-50 via-sky-50 to-amber-50 border border-teal-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="size-8 rounded-lg bg-teal-600 text-white grid place-items-center shadow-xs">
              <Layers className="size-4" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Homepage Content Management</h2>
            <Badge variant="secondary" className="bg-teal-100 text-teal-800 border-teal-200 text-xs">
              Live Control Center
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Super Admin complete control over homepage sections, hero goddess statue, announcements, category shortcuts, and featured highlights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading} className="shadow-xs">
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate({ name: "home" })} className="shadow-xs">
            <Eye className="size-3.5 mr-1.5" />
            View Live Homepage
          </Button>
          <Button size="sm" onClick={() => openCreateDialog()} className="shadow-xs bg-teal-700 hover:bg-teal-800 text-white">
            <Plus className="size-4 mr-1.5" />
            Add New Content
          </Button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="size-10 rounded-xl bg-teal-100 text-teal-700 grid place-items-center">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="text-xl font-bold leading-none">{items.filter((i) => i.isPubliclyVisible).length}</p>
              <p className="text-xs text-muted-foreground mt-1">Live Active Items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="size-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
              <Clock className="size-5" />
            </span>
            <div>
              <p className="text-xl font-bold leading-none">{items.filter((i) => i.timingState === "SCHEDULED").length}</p>
              <p className="text-xs text-muted-foreground mt-1">Scheduled Items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="size-10 rounded-xl bg-sky-100 text-sky-700 grid place-items-center">
              <Sliders className="size-5" />
            </span>
            <div>
              <p className="text-xl font-bold leading-none">{sections.filter((s) => s.isEnabled).length} / {sections.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Enabled Sections</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="size-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight truncate">
                {heroForm.showStatue ? "Statue Enabled" : "Statue Hidden"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Hero Godavari Devi</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Section Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1.5 rounded-xl">
          <TabsTrigger value="all" className="text-xs py-2 px-3">
            <Layers className="size-3.5 mr-1.5" /> All Content ({items.length})
          </TabsTrigger>
          <TabsTrigger value="hero" className="text-xs py-2 px-3">
            <Sparkles className="size-3.5 mr-1.5" /> Hero & Godavari Statue
          </TabsTrigger>
          <TabsTrigger value="carousel" className="text-xs py-2 px-3">
            <ImageIcon className="size-3.5 mr-1.5" /> Sliding Carousel
          </TabsTrigger>
          <TabsTrigger value="announcements" className="text-xs py-2 px-3">
            <Megaphone className="size-3.5 mr-1.5" /> Banners & Announcements ({items.filter(i => i.section === "ANNOUNCEMENT" || i.section === "PROMO_BANNER").length})
          </TabsTrigger>
          <TabsTrigger value="featured_listings" className="text-xs py-2 px-3">
            <Building2 className="size-3.5 mr-1.5" /> Featured Listings ({items.filter(i => i.section === "FEATURED_LISTING").length})
          </TabsTrigger>
          <TabsTrigger value="free_services" className="text-xs py-2 px-3">
            <HeartHandshake className="size-3.5 mr-1.5" /> Free Seva Highlights ({items.filter(i => i.section === "FREE_SERVICES").length})
          </TabsTrigger>
          <TabsTrigger value="sections" className="text-xs py-2 px-3">
            <Grid className="size-3.5 mr-1.5" /> All Sections Toggle ({sections.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ALL CONTENT ITEMS */}
        <TabsContent value="all" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">All Managed Homepage Content Items</h3>
            <Button size="sm" onClick={() => openCreateDialog()} className="shadow-xs">
              <Plus className="size-3.5 mr-1.5" /> Add Content Item
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <AlertCircle className="size-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No content items found</p>
              <p className="text-xs mt-1">Click "Add New Content" above to create an announcement, banner, or featured listing.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <ContentItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => openEditDialog(item)}
                  onDelete={() => setDeleteTarget(item)}
                  onToggleEnabled={() => handleToggleItemEnabled(item)}
                  onToggleStatus={() => handleToggleItemStatus(item)}
                  onMoveUp={() => handleMoveOrder(item, "up")}
                  onMoveDown={() => handleMoveOrder(item, "down")}
                  onPreview={() => {
                    setPreviewItem(item);
                  }}
                  formatIst={formatIst}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: HERO & GODDESS STATUE SETTINGS */}
        <TabsContent value="hero" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="size-5 text-amber-500" />
                    Homepage Hero Section & Goddess Godavari Devi Statue
                  </CardTitle>
                  <CardDescription>
                    Configure the hero title, subtitle, search field, and the Goddess Godavari Devi black stone statue image displayed on the right.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="hero-enabled" className="text-xs font-medium cursor-pointer">
                    Hero Section Active
                  </Label>
                  <Switch
                    id="hero-enabled"
                    checked={heroSection?.isEnabled ?? true}
                    onCheckedChange={() => heroSection && handleToggleSection("hero", heroSection.isEnabled)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Text & Search options */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold">Hero Heading</Label>
                    <Input
                      value={heroForm.heroTitle}
                      onChange={(e) => setHeroForm((p) => ({ ...p, heroTitle: e.target.value }))}
                      placeholder="Welcome to Godavari One"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Hero Subtitle</Label>
                    <Textarea
                      rows={3}
                      value={heroForm.heroSubtitle}
                      onChange={(e) => setHeroForm((p) => ({ ...p, heroSubtitle: e.target.value }))}
                      placeholder="Your complete guide to Godavari Pushkaralu 2027..."
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Top Tagline / Badge</Label>
                    <Input
                      value={heroForm.tagline}
                      onChange={(e) => setHeroForm((p) => ({ ...p, tagline: e.target.value }))}
                      placeholder="Godavari Pushkaralu 2027 · Digital Platform"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">Search Bar</p>
                      <p className="text-xs text-muted-foreground">Show directory search input inside hero</p>
                    </div>
                    <Switch
                      checked={heroForm.searchBarVisible}
                      onCheckedChange={(checked) => setHeroForm((p) => ({ ...p, searchBarVisible: checked }))}
                    />
                  </div>
                </div>

                {/* Right: Goddess Godavari Devi Statue Configuration */}
                <div className="space-y-4 p-5 rounded-2xl border bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                    <div>
                      <p className="font-bold text-sm text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                        <Sparkles className="size-4 text-amber-600" />
                        Goddess Godavari Devi Statue Image
                      </p>
                      <p className="text-xs text-muted-foreground">Placement on empty right-hand side of hero</p>
                    </div>
                    <Switch
                      checked={heroForm.showStatue}
                      onCheckedChange={(checked) => setHeroForm((p) => ({ ...p, showStatue: checked }))}
                    />
                  </div>

                  {heroForm.showStatue && (
                    <div className="space-y-4">
                      {/* Image Preview & Upload */}
                      <div className="flex items-center gap-4">
                        <div className="relative size-28 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-teal-950/10 dark:bg-slate-900 grid place-items-center overflow-hidden shrink-0 shadow-xs">
                          {heroForm.statueGlow && (
                            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/30 via-amber-300/30 to-yellow-200/20 rounded-full blur-md transform scale-90 pointer-events-none" />
                          )}
                          {heroForm.statueImageUrl ? (
                            <img
                              src={heroForm.statueImageUrl}
                              alt={heroForm.statueAlt}
                              className="size-full object-contain p-1 relative z-10 drop-shadow-sm"
                              onError={(e) => {
                                (e.currentTarget as any).src = "/logo.svg";
                              }}
                            />
                          ) : (
                            <ImageIcon className="size-8 text-amber-400" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <input
                            ref={heroStatueInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleHeroStatueUpload}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={heroStatueUploading}
                            onClick={() => heroStatueInputRef.current?.click()}
                            className="w-full text-xs shadow-xs"
                          >
                            <UploadCloud className="size-3.5 mr-1.5 text-amber-600" />
                            {heroStatueUploading ? "Uploading..." : "Upload New Statue Image"}
                          </Button>
                          <Input
                            value={heroForm.statueImageUrl}
                            onChange={(e) => setHeroForm((p) => ({ ...p, statueImageUrl: e.target.value }))}
                            placeholder="/images/godavari-devi.png"
                            className="text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* Quick Presets for Locally Stored Images */}
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                          Select from Locally Stored Images (No Upload Needed):
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setHeroForm((p) => ({
                                ...p,
                                statueImageUrl: "/images/godavari-devi.jpg",
                                statueAlt: "Goddess Godavari Devi statue",
                              }))
                            }
                            className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                              heroForm.statueImageUrl === "/images/godavari-devi.jpg"
                                ? "bg-amber-600 text-white border-amber-600 font-semibold shadow-xs"
                                : "bg-white/90 dark:bg-slate-900 text-amber-950 dark:text-amber-100 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950"
                            }`}
                          >
                            Goddess Statue (JPG)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setHeroForm((p) => ({
                                ...p,
                                statueImageUrl: "/images/godavari-devi.png",
                                statueAlt: "Goddess Godavari Devi statue",
                              }))
                            }
                            className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                              heroForm.statueImageUrl === "/images/godavari-devi.png"
                                ? "bg-amber-600 text-white border-amber-600 font-semibold shadow-xs"
                                : "bg-white/90 dark:bg-slate-900 text-amber-950 dark:text-amber-100 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950"
                            }`}
                          >
                            Goddess Devi (PNG)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setHeroForm((p) => ({
                                ...p,
                                statueImageUrl: "/uploads/godavari_matha_statue.jpg",
                                statueAlt: "Godavari Matha statue",
                              }))
                            }
                            className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                              heroForm.statueImageUrl === "/uploads/godavari_matha_statue.jpg"
                                ? "bg-amber-600 text-white border-amber-600 font-semibold shadow-xs"
                                : "bg-white/90 dark:bg-slate-900 text-amber-950 dark:text-amber-100 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950"
                            }`}
                          >
                            Godavari Matha (Uploads)
                          </button>
                        </div>
                      </div>

                      {/* Dropdown for All Local / Previously Uploaded Images */}
                      {localImages.length > 0 && (
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">
                            Browse All Stored / Uploaded Images ({localImages.length})
                          </Label>
                          <Select
                            value={heroForm.statueImageUrl}
                            onValueChange={(val) => setHeroForm((p) => ({ ...p, statueImageUrl: val }))}
                          >
                            <SelectTrigger className="text-xs h-9 mt-1 bg-white dark:bg-slate-900">
                              <SelectValue placeholder="Choose an existing image..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-56">
                              <SelectItem value="/images/godavari-devi.jpg">
                                /images/godavari-devi.jpg (Goddess Godavari Devi Statue)
                              </SelectItem>
                              <SelectItem value="/images/godavari-devi.png">
                                /images/godavari-devi.png (Goddess Godavari Devi Graphic)
                              </SelectItem>
                              <SelectItem value="/uploads/godavari_matha_statue.jpg">
                                /uploads/godavari_matha_statue.jpg (Statue Photo)
                              </SelectItem>
                              {localImages
                                .filter(
                                  (img) =>
                                    img.url !== "/images/godavari-devi.jpg" &&
                                    img.url !== "/images/godavari-devi.png" &&
                                    img.url !== "/uploads/godavari_matha_statue.jpg"
                                )
                                .slice(0, 30)
                                .map((img) => (
                                  <SelectItem key={img.url} value={img.url} className="text-xs">
                                    {img.url} ({img.name})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs font-semibold">Image Alt Text</Label>
                        <Input
                          value={heroForm.statueAlt}
                          onChange={(e) => setHeroForm((p) => ({ ...p, statueAlt: e.target.value }))}
                          placeholder="Goddess Godavari Devi statue"
                          className="mt-1 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-white/70 dark:bg-slate-900/70">
                          <div>
                            <p className="text-xs font-medium">Golden Glow</p>
                            <p className="text-[10px] text-muted-foreground">Soft halo backdrop</p>
                          </div>
                          <Switch
                            checked={heroForm.statueGlow}
                            onCheckedChange={(checked) => setHeroForm((p) => ({ ...p, statueGlow: checked }))}
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Placement</Label>
                          <Select
                            value={heroForm.statueAlignment}
                            onValueChange={(val) => setHeroForm((p) => ({ ...p, statueAlignment: val }))}
                          >
                            <SelectTrigger className="text-xs h-9 mt-1">
                              <SelectValue placeholder="Position" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="right">Right Side (Standard)</SelectItem>
                              <SelectItem value="center">Center</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleSaveHeroSettings}
                  disabled={savingHero}
                  className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                >
                  {savingHero ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Check className="size-4 mr-1.5" />}
                  Save Hero & Statue Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2: HERO & GODDESS STATUE IMAGE LIBRARY */}
          <Card className="shadow-sm border-amber-200/80 dark:border-amber-900/60 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="size-5 text-amber-500" />
                    Hero & Goddess Statue Image Library
                  </CardTitle>
                  <CardDescription>
                    Super Admin unrestricted control over all existing and newly uploaded images for the Goddess Godavari Devi statue and hero section.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs shadow-xs"
                    onClick={() => {
                      refetchHeroImages();
                      refetchLocalUploads();
                      toast({ title: "Library refreshed", description: "Image library synchronised with storage." });
                    }}
                  >
                    <RefreshCw className="size-3.5 mr-1.5" />
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs shadow-xs"
                    disabled={libraryActionLoading === "upload-new"}
                    onClick={() => heroLibraryUploadRef.current?.click()}
                  >
                    {libraryActionLoading === "upload-new" ? (
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <UploadCloud className="size-3.5 mr-1.5" />
                    )}
                    Upload New Image
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {/* Active Hero Statue Status Highlight Banner */}
              <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-lg overflow-hidden bg-white dark:bg-slate-900 border shrink-0 grid place-items-center">
                    <img
                      src={heroImagesData?.activeStatueUrl || heroForm.statueImageUrl}
                      alt="Active Statue"
                      className="size-full object-contain p-0.5"
                      onError={(e) => { (e.currentTarget as any).src = "/logo.svg"; }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-1.5 truncate">
                      <Sparkles className="size-3.5 text-amber-600 shrink-0" />
                      Active Goddess Statue:{" "}
                      <span className="font-mono text-xs">{heroImagesData?.activeStatueUrl || heroForm.statueImageUrl}</span>
                    </p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Display state:{" "}
                      <strong className={heroForm.showStatue ? "text-emerald-600" : "text-amber-600"}>
                        {heroForm.showStatue ? "Active & Publicly Visible" : "Unpublished / Hidden"}
                      </strong>{" "}
                      · Protected against accidental deletion
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[11px] bg-white dark:bg-slate-900 border-amber-300">
                    Total in Library: {heroLibraryImages.length}
                  </Badge>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    placeholder="Search by filename or path..."
                    className="pl-8 text-xs h-9 bg-white dark:bg-slate-900"
                  />
                  {heroSearch && (
                    <button
                      type="button"
                      onClick={() => setHeroSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setHeroStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      heroStatusFilter === "ALL"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    All ({heroLibraryImages.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroStatusFilter("ACTIVE")}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      heroStatusFilter === "ACTIVE"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    Active Hero ({heroLibraryImages.filter((i) => i.status === "ACTIVE").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroStatusFilter("SELECTED")}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      heroStatusFilter === "SELECTED"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    In Use ({heroLibraryImages.filter((i) => i.status === "SELECTED").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroStatusFilter("UNPUBLISHED")}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      heroStatusFilter === "UNPUBLISHED"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    Unpublished ({heroLibraryImages.filter((i) => i.status === "UNPUBLISHED").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroStatusFilter("UNUSED")}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      heroStatusFilter === "UNUSED"
                        ? "bg-slate-700 text-white border-slate-700 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    Unused ({heroLibraryImages.filter((i) => i.status === "UNUSED").length})
                  </button>
                </div>
              </div>

              {/* Image Grid */}
              {heroImagesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                  ))}
                </div>
              ) : filteredHeroImages.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/10 space-y-2">
                  <ImageIcon className="size-8 mx-auto text-muted-foreground/50" />
                  <p className="font-semibold text-sm">No images found matching your filter</p>
                  <p className="text-xs text-muted-foreground">
                    Try clearing the search query or status filter to see available images.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => {
                      setHeroSearch("");
                      setHeroStatusFilter("ALL");
                    }}
                  >
                    Reset Filter
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredHeroImages.map((img) => {
                    const isProcessing = libraryActionLoading === img.url;

                    return (
                      <Card
                        key={img.url}
                        className={`overflow-hidden transition-all duration-200 shadow-xs hover:shadow-md ${
                          img.isSelectedHero
                            ? "border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20"
                            : "border-border hover:border-amber-300"
                        }`}
                      >
                        {/* Thumbnail Container */}
                        <div className="relative h-44 bg-gradient-to-b from-slate-900/5 to-slate-900/10 dark:from-slate-950/40 dark:to-slate-950/60 border-b grid place-items-center p-3 overflow-hidden group">
                          {img.isSelectedHero && (
                            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 via-yellow-300/10 to-transparent pointer-events-none" />
                          )}

                          <img
                            src={img.url}
                            alt={img.filename}
                            className="size-full object-contain relative z-10 transition-transform duration-200 group-hover:scale-105 drop-shadow-sm"
                            onError={(e) => { (e.currentTarget as any).src = "/logo.svg"; }}
                          />

                          {/* Status Badge overlay */}
                          <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start">
                            {img.status === "ACTIVE" ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-2 py-0.5 shadow-sm font-semibold flex items-center gap-1">
                                <Sparkles className="size-2.5" /> Active Hero
                              </Badge>
                            ) : img.status === "SELECTED" ? (
                              <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] px-2 py-0.5 shadow-sm font-medium flex items-center gap-1">
                                <CheckCircle2 className="size-2.5" /> In Use ({img.usages.length})
                              </Badge>
                            ) : img.status === "UNPUBLISHED" ? (
                              <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[10px] px-2 py-0.5 shadow-sm font-medium flex items-center gap-1">
                                <EyeOff className="size-2.5" /> Unpublished
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-normal">
                                Unused
                              </Badge>
                            )}
                          </div>

                          {/* Quick Preview Hover Button */}
                          <button
                            type="button"
                            onClick={() => setPreviewHeroImage(img)}
                            className="absolute top-2 right-2 z-20 size-7 rounded-lg bg-black/60 hover:bg-black/80 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="Preview image"
                          >
                            <Eye className="size-3.5" />
                          </button>
                        </div>

                        {/* Card Content & Details */}
                        <CardContent className="p-3.5 space-y-2.5">
                          <div>
                            <p className="font-semibold text-xs truncate" title={img.filename}>
                              {img.filename}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground truncate" title={img.url}>
                              {img.url}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                            <span>{formatBytes(img.sizeBytes)}</span>
                            <span>{formatIst(img.mtime)}</span>
                          </div>

                          {img.usages.length > 0 && (
                            <div className="text-[10px] bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 p-1.5 rounded-md truncate">
                              <strong>Used in:</strong> {img.usages.map((u) => u.title).join(", ")}
                            </div>
                          )}

                          {/* Action Toolbar */}
                          <div className="pt-2 border-t flex items-center justify-between gap-1">
                            {/* Primary Action: Set as Hero Statue */}
                            {img.isSelectedHero ? (
                              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1 py-1">
                                <Check className="size-3.5 text-amber-600" /> Current Hero
                              </span>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => handleSetAsHero(img)}
                                className="text-[11px] h-7 px-2 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200"
                              >
                                {isProcessing ? (
                                  <Loader2 className="size-3 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="size-3 mr-1 text-amber-600" />
                                )}
                                Set as Hero
                              </Button>
                            )}

                            {/* Secondary Action Buttons */}
                            <div className="flex items-center gap-0.5">
                              {/* Preview */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title="Preview full image"
                                onClick={() => setPreviewHeroImage(img)}
                              >
                                <Eye className="size-3.5" />
                              </Button>

                              {/* Replace File */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                title="Upload replacement file"
                                disabled={isProcessing}
                                onClick={() => handleTriggerReplace(img)}
                              >
                                <UploadCloud className="size-3.5" />
                              </Button>

                              {/* Unpublish / Publish */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={`size-7 ${
                                  img.status === "UNPUBLISHED"
                                    ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                }`}
                                title={img.status === "UNPUBLISHED" ? "Restore / Publish" : "Hide / Unpublish from public"}
                                disabled={isProcessing}
                                onClick={() => handleTogglePublishHeroImage(img, img.status !== "UNPUBLISHED")}
                              >
                                {img.status === "UNPUBLISHED" ? (
                                  <Eye className="size-3.5" />
                                ) : (
                                  <EyeOff className="size-3.5" />
                                )}
                              </Button>

                              {/* Delete Permanently */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title={
                                  img.canDelete
                                    ? "Delete permanently from disk"
                                    : "Protected / In Use (Cannot Delete)"
                                }
                                onClick={() => setDeleteHeroImageTarget(img)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SLIDING CAROUSEL */}
        <TabsContent value="carousel" className="space-y-4">
          <div className="p-4 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Featured Highlights Carousel Section</p>
              <p className="text-xs text-muted-foreground">Manage the sliding banner carousel on the homepage.</p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="carousel-enabled" className="text-xs font-medium cursor-pointer">
                Carousel Active
              </Label>
              <Switch
                id="carousel-enabled"
                checked={sections.find((s) => s.id === "carousel")?.isEnabled ?? true}
                onCheckedChange={() => {
                  const s = sections.find((x) => x.id === "carousel");
                  if (s) handleToggleSection("carousel", s.isEnabled);
                }}
              />
            </div>
          </div>
          {/* Reuses the full CarouselManager component */}
          <CarouselManager />
        </TabsContent>

        {/* TAB 4: ANNOUNCEMENTS & BANNERS */}
        <TabsContent value="announcements" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Promotional Banners & Announcements</h3>
              <p className="text-xs text-muted-foreground">Alert banners, official notices, and promo highlights displayed on the homepage.</p>
            </div>
            <Button size="sm" onClick={() => openCreateDialog("ANNOUNCEMENT")} className="shadow-xs">
              <Plus className="size-3.5 mr-1.5" /> Add Announcement
            </Button>
          </div>

          <div className="space-y-3">
            {filteredItems.map((item) => (
              <ContentItemCard
                key={item.id}
                item={item}
                onEdit={() => openEditDialog(item)}
                onDelete={() => setDeleteTarget(item)}
                onToggleEnabled={() => handleToggleItemEnabled(item)}
                onToggleStatus={() => handleToggleItemStatus(item)}
                onMoveUp={() => handleMoveOrder(item, "up")}
                onMoveDown={() => handleMoveOrder(item, "down")}
                onPreview={() => setPreviewItem(item)}
                formatIst={formatIst}
              />
            ))}
          </div>
        </TabsContent>

        {/* TAB 5: FEATURED LISTINGS */}
        <TabsContent value="featured_listings" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Featured Directory Listings</h3>
              <p className="text-xs text-muted-foreground">Hand-pick and spotlight restaurants, hotels, ghats, or tourist spots on the homepage.</p>
            </div>
            <Button size="sm" onClick={() => openCreateDialog("FEATURED_LISTING")} className="shadow-xs">
              <Plus className="size-3.5 mr-1.5" /> Feature a Listing
            </Button>
          </div>

          <div className="space-y-3">
            {filteredItems.map((item) => (
              <ContentItemCard
                key={item.id}
                item={item}
                onEdit={() => openEditDialog(item)}
                onDelete={() => setDeleteTarget(item)}
                onToggleEnabled={() => handleToggleItemEnabled(item)}
                onToggleStatus={() => handleToggleItemStatus(item)}
                onMoveUp={() => handleMoveOrder(item, "up")}
                onMoveDown={() => handleMoveOrder(item, "down")}
                onPreview={() => setPreviewItem(item)}
                formatIst={formatIst}
              />
            ))}
          </div>
        </TabsContent>

        {/* TAB 6: FREE SEVA HIGHLIGHTS */}
        <TabsContent value="free_services" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Free Accommodation & Annadanam Highlights</h3>
              <p className="text-xs text-muted-foreground">Highlight verified free pilgrim shelter and Annadanam prasadam centres on the front page.</p>
            </div>
            <Button size="sm" onClick={() => openCreateDialog("FREE_SERVICES")} className="shadow-xs">
              <Plus className="size-3.5 mr-1.5" /> Add Seva Highlight
            </Button>
          </div>

          <div className="space-y-3">
            {filteredItems.map((item) => (
              <ContentItemCard
                key={item.id}
                item={item}
                onEdit={() => openEditDialog(item)}
                onDelete={() => setDeleteTarget(item)}
                onToggleEnabled={() => handleToggleItemEnabled(item)}
                onToggleStatus={() => handleToggleItemStatus(item)}
                onMoveUp={() => handleMoveOrder(item, "up")}
                onMoveDown={() => handleMoveOrder(item, "down")}
                onPreview={() => setPreviewItem(item)}
                formatIst={formatIst}
              />
            ))}
          </div>
        </TabsContent>

        {/* TAB 7: ALL SECTIONS TOGGLE */}
        <TabsContent value="sections" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {sections.map((sec) => (
              <Card key={sec.id} className="shadow-xs">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{sec.name}</p>
                      <Badge variant={sec.isEnabled ? "default" : "secondary"} className="text-[10px]">
                        {sec.isEnabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{sec.description}</p>
                  </div>
                  <Switch
                    checked={sec.isEnabled}
                    onCheckedChange={() => handleToggleSection(sec.id, sec.isEnabled)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* CREATE / EDIT CONTENT ITEM DIALOG */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto nice-scroll">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Homepage Content Item" : "Add New Homepage Content"}
            </DialogTitle>
            <DialogDescription>
              Add or update content items to appear in selected homepage sections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Section Picker */}
            <div>
              <Label className="text-xs font-semibold">Homepage Section</Label>
              <Select value={formSection} onValueChange={setFormSection}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <Label className="text-xs font-semibold">Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Special Ghat VIP Timings Announced"
                className="mt-1"
                maxLength={160}
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs font-semibold">Description / Subtitle</Label>
              <Textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Provide informative details for visitors..."
                className="mt-1"
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Badge Tag (Optional)</Label>
                <Input
                  value={formBadgeText}
                  onChange={(e) => setFormBadgeText(e.target.value)}
                  placeholder="e.g. Official Notice, Free, New"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Button Text (Optional)</Label>
                <Input
                  value={formButtonText}
                  onChange={(e) => setFormButtonText(e.target.value)}
                  placeholder="e.g. View Details, Book Now"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Destination Link / Listing Picker */}
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
              <Label className="text-xs font-semibold">Destination Link</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="destType"
                    checked={formDestinationType === "url"}
                    onChange={() => setFormDestinationType("url")}
                  />
                  <span>Custom URL / Internal Route</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="destType"
                    checked={formDestinationType === "listing"}
                    onChange={() => setFormDestinationType("listing")}
                  />
                  <span>Link to Godavari One Listing</span>
                </label>
              </div>

              {formDestinationType === "url" ? (
                <Input
                  value={formDestinationUrl}
                  onChange={(e) => setFormDestinationUrl(e.target.value)}
                  placeholder="/directory?category=GHAT or https://..."
                  className="text-xs"
                />
              ) : (
                <Select value={formListingId} onValueChange={setFormListingId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select an existing directory listing..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableListings.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        [{l.category}] {l.name} {l.town ? `(${l.town})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Content Image (Optional)</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs shadow-xs"
                >
                  <UploadCloud className="size-3.5 mr-1.5" />
                  {uploading ? "Uploading..." : "Upload from Computer"}
                </Button>
                <span className="text-xs text-muted-foreground">or enter URL:</span>
              </div>
              <Input
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                placeholder="/uploads/... or https://..."
                className="text-xs font-mono"
              />
              {formImageUrl && (
                <div className="relative size-20 rounded-lg border overflow-hidden mt-2">
                  <img src={formImageUrl} alt="Preview" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("")}
                    className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Schedule Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Start Schedule (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">End Schedule (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {/* Publishing Status & Enabled */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <Label className="text-xs font-semibold">Publication Status</Label>
                <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLISHED">PUBLISHED (Visible to public)</SelectItem>
                    <SelectItem value="DRAFT">DRAFT (Hidden / Preview only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 mt-1">
                <div>
                  <p className="text-xs font-medium">Enabled</p>
                  <p className="text-[10px] text-muted-foreground">Toggle active state</p>
                </div>
                <Switch checked={formIsEnabled} onCheckedChange={setFormIsEnabled} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveItem} disabled={saving} className="bg-teal-700 hover:bg-teal-800 text-white">
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Check className="size-4 mr-1.5" />}
              {editingItem ? "Update Content" : "Publish Content"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" /> Delete Homepage Content
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>"{deleteTarget?.title}"</strong> from the homepage?
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="size-4 text-amber-600" />
              Directory Data Protection Notice
            </p>
            <p>
              This action only removes the homepage content item. Any linked directory listing (hotel, restaurant, ghat, or free accommodation) will <strong>NOT</strong> be deleted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteItem}>
              Yes, Delete Content Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW MODAL */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="size-5 text-teal-600" /> Preview Content Item
              </DialogTitle>
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`p-1.5 rounded text-xs ${previewDevice === "desktop" ? "bg-white shadow-xs" : "text-muted-foreground"}`}
                >
                  <Monitor className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`p-1.5 rounded text-xs ${previewDevice === "mobile" ? "bg-white shadow-xs" : "text-muted-foreground"}`}
                >
                  <Smartphone className="size-4" />
                </button>
              </div>
            </div>
          </DialogHeader>

          {previewItem && (
            <div className={`mx-auto p-4 transition-all ${previewDevice === "mobile" ? "max-w-xs border rounded-2xl bg-white shadow-md" : "w-full"}`}>
              <div className="rounded-xl border p-4 bg-card shadow-xs space-y-3">
                {previewItem.badgeText && (
                  <Badge variant="secondary" className="bg-teal-100 text-teal-800 border-teal-200">
                    {previewItem.badgeText}
                  </Badge>
                )}
                {previewItem.imageUrl && (
                  <img src={previewItem.imageUrl} alt={previewItem.title} className="w-full h-40 object-cover rounded-lg" />
                )}
                <h4 className="font-bold text-lg">{previewItem.title}</h4>
                {previewItem.description && (
                  <p className="text-sm text-muted-foreground">{previewItem.description}</p>
                )}
                {previewItem.buttonText && (
                  <Button size="sm" className="w-full mt-2">
                    {previewItem.buttonText}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden File Inputs for Hero Image Library */}
      <input
        ref={heroLibraryUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleHeroLibraryUpload}
      />
      <input
        ref={heroLibraryReplaceRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleHeroLibraryReplace}
      />

      {/* HERO IMAGE LIBRARY: FULL PREVIEW DIALOG */}
      <Dialog open={!!previewHeroImage} onOpenChange={(open) => !open && setPreviewHeroImage(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base truncate">
              <ImageIcon className="size-5 text-amber-500" />
              {previewHeroImage?.filename}
            </DialogTitle>
            <DialogDescription>
              Full resolution image preview and system reference status.
            </DialogDescription>
          </DialogHeader>

          {previewHeroImage && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-slate-950/10 dark:bg-slate-900 border grid place-items-center p-4 min-h-[260px] max-h-[400px]">
                <img
                  src={previewHeroImage.url}
                  alt={previewHeroImage.filename}
                  className="max-h-[360px] w-auto max-w-full object-contain drop-shadow-md"
                  onError={(e) => { (e.currentTarget as any).src = "/logo.svg"; }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border bg-muted/30">
                  <p className="text-muted-foreground text-[11px]">Storage Path</p>
                  <p className="font-mono font-medium truncate mt-0.5" title={previewHeroImage.url}>
                    {previewHeroImage.url}
                  </p>
                </div>
                <div className="p-3 rounded-xl border bg-muted/30">
                  <p className="text-muted-foreground text-[11px]">File Size</p>
                  <p className="font-medium mt-0.5">{formatBytes(previewHeroImage.sizeBytes)}</p>
                </div>
                <div className="p-3 rounded-xl border bg-muted/30">
                  <p className="text-muted-foreground text-[11px]">Upload / Modified Date</p>
                  <p className="font-medium mt-0.5">{formatIst(previewHeroImage.mtime)}</p>
                </div>
                <div className="p-3 rounded-xl border bg-muted/30">
                  <p className="text-muted-foreground text-[11px]">Library Status</p>
                  <p className="font-semibold mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`size-2 rounded-full ${
                        previewHeroImage.status === "ACTIVE"
                          ? "bg-emerald-500"
                          : previewHeroImage.status === "SELECTED"
                          ? "bg-blue-500"
                          : previewHeroImage.status === "UNPUBLISHED"
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`}
                    />
                    {previewHeroImage.status}
                    {previewHeroImage.isSelectedHero && " (Active Goddess Statue)"}
                  </p>
                </div>
              </div>

              {previewHeroImage.usages.length > 0 && (
                <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 dark:bg-sky-950/20 text-xs space-y-1.5">
                  <p className="font-semibold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-sky-600" />
                    Active Usages & References ({previewHeroImage.usages.length}):
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                    {previewHeroImage.usages.map((u, i) => (
                      <li key={i}>{u.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                <div className="flex items-center gap-2">
                  {!previewHeroImage.isSelectedHero && (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs text-xs"
                      onClick={() => {
                        const target = previewHeroImage;
                        setPreviewHeroImage(null);
                        handleSetAsHero(target);
                      }}
                    >
                      <Sparkles className="size-3.5 mr-1.5" />
                      Set as Hero Statue
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      const target = previewHeroImage;
                      setPreviewHeroImage(null);
                      handleTogglePublishHeroImage(target, target.status !== "UNPUBLISHED");
                    }}
                  >
                    {previewHeroImage.status === "UNPUBLISHED" ? (
                      <>
                        <Eye className="size-3.5 mr-1.5 text-emerald-600" />
                        Restore / Publish
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3.5 mr-1.5 text-amber-600" />
                        Hide / Unpublish
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      const target = previewHeroImage;
                      setPreviewHeroImage(null);
                      handleTriggerReplace(target);
                    }}
                  >
                    <UploadCloud className="size-3.5 mr-1.5" />
                    Replace File
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    disabled={!previewHeroImage.canDelete}
                    title={
                      previewHeroImage.canDelete
                        ? "Permanently delete image"
                        : "Cannot delete: image is active or in use"
                    }
                    onClick={() => {
                      const target = previewHeroImage;
                      setPreviewHeroImage(null);
                      setDeleteHeroImageTarget(target);
                    }}
                  >
                    <Trash2 className="size-3.5 mr-1.5" />
                    Delete Permanently
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* HERO IMAGE LIBRARY: PERMANENT DELETION CONFIRMATION DIALOG */}
      <Dialog open={!!deleteHeroImageTarget} onOpenChange={(open) => !open && setDeleteHeroImageTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="size-5" />
              Permanently Delete Stored Image
            </DialogTitle>
            <DialogDescription>
              Verify image status and confirm permanent removal from the server's disk storage.
            </DialogDescription>
          </DialogHeader>

          {deleteHeroImageTarget && (
            <div className="space-y-4 py-2">
              {/* Image preview & details */}
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                <div className="size-16 rounded-lg bg-slate-900/10 border grid place-items-center overflow-hidden shrink-0">
                  <img
                    src={deleteHeroImageTarget.url}
                    alt={deleteHeroImageTarget.filename}
                    className="size-full object-contain p-1"
                    onError={(e) => { (e.currentTarget as any).src = "/logo.svg"; }}
                  />
                </div>
                <div className="min-w-0 flex-1 text-xs space-y-1">
                  <p className="font-semibold truncate">{deleteHeroImageTarget.filename}</p>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">{deleteHeroImageTarget.url}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Size: {formatBytes(deleteHeroImageTarget.sizeBytes)} · Status: <strong>{deleteHeroImageTarget.status}</strong>
                  </p>
                </div>
              </div>

              {/* Protection / Conflict Checks */}
              {deleteHeroImageTarget.isSelectedHero ? (
                <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <Lock className="size-4" />
                    Cannot Delete: Active Goddess Godavari Hero Statue
                  </p>
                  <p>
                    This image is currently selected as the active Goddess Godavari Devi Hero Statue on the homepage. Permanent deletion is blocked to prevent breaking public display.
                  </p>
                  <p className="font-semibold text-rose-800 dark:text-rose-200">
                    Please select a replacement image as Hero before deleting this file.
                  </p>
                </div>
              ) : deleteHeroImageTarget.usages.length > 0 ? (
                <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                    <ShieldAlert className="size-4" />
                    Cannot Delete: Image is Actively Referenced
                  </p>
                  <p>
                    This image is currently used across {deleteHeroImageTarget.usages.length} platform section(s):
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 font-medium">
                    {deleteHeroImageTarget.usages.map((u, i) => (
                      <li key={i}>{u.title}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Please detach or replace these references before deleting the underlying image file.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 dark:bg-rose-950/30 text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <AlertCircle className="size-4" />
                    Irreversible Action Warning
                  </p>
                  <p>
                    Are you sure you want to permanently delete <strong>{deleteHeroImageTarget.filename}</strong>?
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    This file will be permanently removed from disk storage and from the image library. It cannot be recovered.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeletingHeroImage}
              onClick={() => setDeleteHeroImageTarget(null)}
            >
              Cancel
            </Button>
            {deleteHeroImageTarget?.canDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isDeletingHeroImage}
                onClick={handlePermanentDeleteHeroImage}
              >
                {isDeletingHeroImage ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5 mr-1.5" />
                )}
                Delete Permanently
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled
                title="Active or shared images cannot be deleted. Detach or replace references first."
              >
                <Lock className="size-3.5 mr-1.5" />
                Cannot Delete (In Use)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Subcomponent: Individual Content Item Card
function ContentItemCard({
  item,
  onEdit,
  onDelete,
  onToggleEnabled,
  onToggleStatus,
  onMoveUp,
  onMoveDown,
  onPreview,
  formatIst,
}: {
  item: HomepageContentItemAdmin;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onToggleStatus: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPreview: () => void;
  formatIst: (date?: string | null) => string;
}) {
  return (
    <Card className="hover:border-primary/40 transition-colors shadow-xs">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="size-16 rounded-xl object-cover shrink-0 border"
              onError={(e) => {
                (e.currentTarget as any).src = "/logo.svg";
              }}
            />
          ) : (
            <div className="size-16 rounded-xl bg-muted/60 grid place-items-center shrink-0 border">
              <Megaphone className="size-6 text-muted-foreground/60" />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                {item.section}
              </Badge>

              <Badge
                variant={item.status === "PUBLISHED" ? "default" : "secondary"}
                className={`text-[10px] ${item.status === "PUBLISHED" ? "bg-emerald-600 text-white" : ""}`}
              >
                {item.status}
              </Badge>

              <Badge
                variant="outline"
                className={`text-[10px] ${
                  item.timingState === "ACTIVE"
                    ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                    : item.timingState === "SCHEDULED"
                    ? "border-amber-300 text-amber-700 bg-amber-50"
                    : "border-slate-300 text-slate-600 bg-slate-50"
                }`}
              >
                {item.timingState === "ACTIVE" ? "Active Now" : item.timingState === "SCHEDULED" ? "Scheduled" : "Expired"}
              </Badge>

              {item.badgeText && (
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                  {item.badgeText}
                </Badge>
              )}
            </div>

            <h4 className="font-semibold text-sm truncate">{item.title}</h4>

            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
              {item.listing ? (
                <span className="flex items-center gap-1 text-primary">
                  <Building2 className="size-3" />
                  Linked: [{item.listing.category}] {item.listing.name}
                </span>
              ) : item.destinationUrl ? (
                <span className="flex items-center gap-1">
                  <LinkIcon className="size-3" />
                  {item.destinationUrl}
                </span>
              ) : null}

              {(item.startDate || item.endDate) && (
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatIst(item.startDate)} - {formatIst(item.endDate)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onMoveUp}
              title="Move Up"
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onMoveDown}
              title="Move Down"
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleStatus}
            className="text-xs h-8"
          >
            {item.status === "PUBLISHED" ? "Unpublish" : "Republish"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onPreview}
            title="Preview"
          >
            <Eye className="size-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={onEdit}
            title="Edit"
          >
            <Edit3 className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

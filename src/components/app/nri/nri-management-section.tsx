"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Settings,
  Layers,
  Plus,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Phone,
  Mail,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Plane,
  Building,
  Waves,
  Calendar,
  Shield,
  Save,
  ArrowUp,
  ArrowDown,
  BellRing,
  HelpCircle,
  Link as LinkIcon,
} from "lucide-react";

export function NriManagementSection() {
  const [activeSubTab, setActiveSubTab] = useState<"config" | "content">("config");

  // Config State
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);

  // Form states for config
  const [cfgIsEnabled, setCfgIsEnabled] = useState(true);
  const [cfgHeroTitle, setCfgHeroTitle] = useState("");
  const [cfgHeroDescription, setCfgHeroDescription] = useState("");
  const [cfgWelcomeMessage, setCfgWelcomeMessage] = useState("");
  const [cfgSupportPhone, setCfgSupportPhone] = useState("");
  const [cfgSupportEmail, setCfgSupportEmail] = useState("");
  const [cfgSupportInstructions, setCfgSupportInstructions] = useState("");
  const [cfgHelplineHours, setCfgHelplineHours] = useState("");
  const [cfgExternalGuideUrl, setCfgExternalGuideUrl] = useState("");

  // Visibility flags
  const [visShowHeaderLink, setVisShowHeaderLink] = useState(true);
  const [visShowHomepageBanner, setVisShowHomepageBanner] = useState(true);
  const [visShowPackagesTab, setVisShowPackagesTab] = useState(true);
  const [visShowTrackingTab, setVisShowTrackingTab] = useState(true);
  const [visShowServicesGrid, setVisShowServicesGrid] = useState(true);
  const [visShowNotices, setVisShowNotices] = useState(true);

  // Content Items State
  const [contentItems, setContentItems] = useState<any[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [contentFilter, setContentFilter] = useState<string>("ALL");

  // Content Item Modal State
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Content Item Form State
  const [itemType, setItemType] = useState<string>("CARD");
  const [itemTitle, setItemTitle] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemContent, setItemContent] = useState("");
  const [itemIcon, setItemIcon] = useState("Sparkles");
  const [itemBadgeText, setItemBadgeText] = useState("");
  const [itemLinkUrl, setItemLinkUrl] = useState("");
  const [itemLinkText, setItemLinkText] = useState("");
  const [itemStatus, setItemStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");
  const [itemIsEnabled, setItemIsEnabled] = useState(true);
  const [itemStartDate, setItemStartDate] = useState("");
  const [itemEndDate, setItemEndDate] = useState("");
  const [itemErrors, setItemErrors] = useState<string[]>([]);

  // Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);

  // Load config & content
  async function loadAll() {
    setConfigLoading(true);
    setContentLoading(true);
    try {
      const [cfgRes, cntRes] = await Promise.all([
        api.get<any>("/nri/config"),
        api.get<{ items: any[] }>("/nri/content?all=true"),
      ]);

      if (cfgRes) {
        setConfig(cfgRes);
        setCfgIsEnabled(cfgRes.isEnabled ?? true);
        setCfgHeroTitle(cfgRes.heroTitle || "");
        setCfgHeroDescription(cfgRes.heroDescription || "");
        setCfgWelcomeMessage(cfgRes.welcomeMessage || "");
        setCfgSupportPhone(cfgRes.supportPhone || "");
        setCfgSupportEmail(cfgRes.supportEmail || "");
        setCfgSupportInstructions(cfgRes.supportInstructions || "");
        setCfgHelplineHours(cfgRes.helplineHours || "");
        setCfgExternalGuideUrl(cfgRes.externalGuideUrl || "");

        if (cfgRes.visibilitySettings) {
          try {
            const vis = JSON.parse(cfgRes.visibilitySettings);
            setVisShowHeaderLink(vis.showHeaderLink !== false);
            setVisShowHomepageBanner(vis.showHomepageBanner !== false);
            setVisShowPackagesTab(vis.showPackagesTab !== false);
            setVisShowTrackingTab(vis.showTrackingTab !== false);
            setVisShowServicesGrid(vis.showServicesGrid !== false);
            setVisShowNotices(vis.showNotices !== false);
          } catch {
            // ignore JSON error
          }
        }
      }

      if (cntRes?.items) {
        setContentItems(cntRes.items);
      }
    } catch (err: any) {
      toast({
        title: "Load Failed",
        description: err instanceof ApiError ? err.message : "Failed to load NRI configuration",
        variant: "destructive",
      });
    } finally {
      setConfigLoading(false);
      setContentLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Save global config
  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!cfgHeroTitle.trim()) {
      toast({ title: "Validation Error", description: "Hero title cannot be empty.", variant: "destructive" });
      return;
    }

    setConfigSaving(true);
    try {
      const visibilitySettings = JSON.stringify({
        showHeaderLink: visShowHeaderLink,
        showHomepageBanner: visShowHomepageBanner,
        showPackagesTab: visShowPackagesTab,
        showTrackingTab: visShowTrackingTab,
        showServicesGrid: visShowServicesGrid,
        showNotices: visShowNotices,
      });

      const updated = await api.patch<any>("/nri/config", {
        isEnabled: cfgIsEnabled,
        heroTitle: cfgHeroTitle.trim(),
        heroDescription: cfgHeroDescription.trim() || null,
        welcomeMessage: cfgWelcomeMessage.trim() || null,
        supportPhone: cfgSupportPhone.trim() || null,
        supportEmail: cfgSupportEmail.trim() || null,
        supportInstructions: cfgSupportInstructions.trim() || null,
        helplineHours: cfgHelplineHours.trim() || null,
        externalGuideUrl: cfgExternalGuideUrl.trim() || null,
        visibilitySettings,
      });

      setConfig(updated);
      toast({ title: "NRI Configuration Saved", description: "Global NRI portal configuration and visibility settings updated." });
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err instanceof ApiError ? err.message : "Error saving NRI settings",
        variant: "destructive",
      });
    } finally {
      setConfigSaving(false);
    }
  }

  // Open item dialog
  function openCreateItemDialog() {
    setEditingItem(null);
    setItemType("CARD");
    setItemTitle("");
    setItemSubtitle("");
    setItemDescription("");
    setItemContent("");
    setItemIcon("Sparkles");
    setItemBadgeText("");
    setItemLinkUrl("/nri-access");
    setItemLinkText("Learn More");
    setItemStatus("PUBLISHED");
    setItemIsEnabled(true);
    setItemStartDate("");
    setItemEndDate("");
    setItemErrors([]);
    setItemDialogOpen(true);
  }

  function openEditItemDialog(item: any) {
    setEditingItem(item);
    setItemType(item.type || "CARD");
    setItemTitle(item.title || "");
    setItemSubtitle(item.subtitle || "");
    setItemDescription(item.description || "");
    setItemContent(item.content || "");
    setItemIcon(item.icon || "Sparkles");
    setItemBadgeText(item.badgeText || "");
    setItemLinkUrl(item.linkUrl || "");
    setItemLinkText(item.linkText || "");
    setItemStatus(item.status || "PUBLISHED");
    setItemIsEnabled(item.isEnabled ?? true);
    setItemStartDate(item.startDate ? item.startDate.slice(0, 16) : "");
    setItemEndDate(item.endDate ? item.endDate.slice(0, 16) : "");
    setItemErrors([]);
    setItemDialogOpen(true);
  }

  // Save content item
  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    const errors: string[] = [];
    if (!itemTitle.trim()) errors.push("Title is required");

    if (errors.length > 0) {
      setItemErrors(errors);
      return;
    }

    setItemSaving(true);
    try {
      const payload = {
        type: itemType,
        title: itemTitle.trim(),
        subtitle: itemSubtitle.trim() || null,
        description: itemDescription.trim() || null,
        content: itemContent.trim() || null,
        icon: itemIcon || null,
        badgeText: itemBadgeText.trim() || null,
        linkUrl: itemLinkUrl.trim() || null,
        linkText: itemLinkText.trim() || null,
        status: itemStatus,
        isEnabled: itemIsEnabled,
        startDate: itemStartDate ? new Date(itemStartDate).toISOString() : null,
        endDate: itemEndDate ? new Date(itemEndDate).toISOString() : null,
      };

      if (editingItem) {
        await api.patch(`/nri/content/${editingItem.id}`, payload);
        toast({ title: "Item Updated", description: `Updated "${itemTitle}" successfully.` });
      } else {
        await api.post("/nri/content", payload);
        toast({ title: "Item Created", description: `Added "${itemTitle}" successfully.` });
      }

      setItemDialogOpen(false);
      loadAll();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err instanceof ApiError ? err.message : "Failed to save content item",
        variant: "destructive",
      });
    } finally {
      setItemSaving(false);
    }
  }

  // Delete content item
  async function handleDeleteItem() {
    if (!deleteTarget) return;
    try {
      await api.del(`/nri/content/${deleteTarget.id}`);
      toast({ title: "Item Deleted", description: `Deleted "${deleteTarget.title}".` });
      setDeleteTarget(null);
      loadAll();
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err instanceof ApiError ? err.message : "Error deleting item",
        variant: "destructive",
      });
    }
  }

  // Reorder content items
  async function handleMoveItem(index: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= contentItems.length) return;

    const reordered = [...contentItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    setContentItems(reordered);

    try {
      await api.post("/nri/content/reorder", {
        orderedIds: reordered.map((item) => item.id),
      });
      toast({ title: "Order Updated", description: "Content display sequence saved." });
    } catch {
      loadAll(); // revert
    }
  }

  // Toggle publish status quickly
  async function handleTogglePublish(item: any) {
    const newStatus = item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await api.patch(`/nri/content/${item.id}`, { status: newStatus });
      toast({ title: "Status Updated", description: `"${item.title}" is now ${newStatus.toLowerCase()}.` });
      setContentItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i))
      );
    } catch (err: any) {
      toast({ title: "Update Failed", description: err instanceof ApiError ? err.message : "Error", variant: "destructive" });
    }
  }

  // Filter items
  const filteredItems = contentItems.filter((i) => {
    if (contentFilter === "ALL") return true;
    if (contentFilter === "DRAFT") return i.status === "DRAFT" || !i.isEnabled;
    return i.type === contentFilter;
  });

  const formatIst = (dateStr?: string | null) => {
    if (!dateStr) return "Never";
    try {
      return (
        new Date(dateStr).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
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

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Globe className="size-5 text-teal-600" /> NRI Portal Management
            </h2>
            <Badge
              variant={cfgIsEnabled ? "default" : "destructive"}
              className={`text-xs ${
                cfgIsEnabled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-destructive text-destructive-foreground"
              }`}
            >
              {cfgIsEnabled ? "PORTAL LIVE" : "PORTAL DISABLED"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure global NRI landing page, welcome messages, advisories, services, support helplines, and section visibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            className="text-xs gap-1.5 shadow-xs"
            id="nri-preview-button"
          >
            <Eye className="size-3.5 text-teal-600" /> Preview Landing Page
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadAll}
            disabled={configLoading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${configLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Sub Tabs: Configuration vs Content Items */}
      <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="w-full">
        <TabsList className="bg-muted p-1 border">
          <TabsTrigger value="config" className="text-xs px-4 py-1.5 font-semibold gap-1.5">
            <Settings className="size-3.5" /> Global Portal Settings
          </TabsTrigger>
          <TabsTrigger value="content" className="text-xs px-4 py-1.5 font-semibold gap-1.5">
            <Layers className="size-3.5" /> Managed Content Items ({contentItems.length})
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* SUBTAB 1: GLOBAL CONFIGURATION */}
        {/* ============================================================== */}
        <TabsContent value="config" className="pt-4 space-y-6">
          <form onSubmit={handleSaveConfig} className="space-y-6">
            {/* Master Switch & Status Info */}
            <Card className="border-teal-200 dark:border-teal-900 bg-teal-50/20 dark:bg-teal-950/10">
              <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="master-nri-enable" className="font-bold text-base cursor-pointer">
                      Enable NRI & International Pilgrims Section
                    </Label>
                    <Badge variant={cfgIsEnabled ? "default" : "secondary"} className="text-[10px]">
                      {cfgIsEnabled ? "Enabled for Visitors" : "Offline / Disabled"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When disabled, the public NRI portal displays a maintenance notice with direct helpline contacts and safe navigation back to the homepage.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="master-nri-enable"
                    checked={cfgIsEnabled}
                    onCheckedChange={setCfgIsEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Landing Page Content Configuration */}
            <Card className="shadow-xs border-border/80">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="size-4 text-teal-600" /> Hero & Welcome Message Configuration
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize the headline, description, and welcome notice shown at the top of the NRI portal.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Portal Headline / Hero Title *</Label>
                  <Input
                    required
                    value={cfgHeroTitle}
                    onChange={(e) => setCfgHeroTitle(e.target.value)}
                    placeholder="e.g. Curated All-Inclusive Pilgrimage Packages for Godavari Pushkaralu 2027"
                    className="bg-card font-semibold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Hero Description / Summary</Label>
                  <Textarea
                    rows={3}
                    value={cfgHeroDescription}
                    onChange={(e) => setCfgHeroDescription(e.target.value)}
                    placeholder="Detailed explanation of the all-inclusive packages, VIP passes, and verified services..."
                    className="bg-card text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Welcome / Important Message</Label>
                  <Textarea
                    rows={2}
                    value={cfgWelcomeMessage}
                    onChange={(e) => setCfgWelcomeMessage(e.target.value)}
                    placeholder="Optional message from the administration or guidance for overseas pilgrims..."
                    className="bg-card text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Contact & Support Desk Settings */}
            <Card className="shadow-xs border-border/80">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="size-4 text-teal-600" /> Support Desk & Contact Information
                </CardTitle>
                <CardDescription className="text-xs">
                  Administrative helplines and instructions presented to international travelers.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                      <Phone className="size-3.5 text-teal-600" /> NRI Support Phone & WhatsApp
                    </Label>
                    <Input
                      value={cfgSupportPhone}
                      onChange={(e) => setCfgSupportPhone(e.target.value)}
                      placeholder="+91 883 2450000 / 14500"
                      className="bg-card font-mono text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                      <Mail className="size-3.5 text-teal-600" /> Dedicated NRI Support Email
                    </Label>
                    <Input
                      type="email"
                      value={cfgSupportEmail}
                      onChange={(e) => setCfgSupportEmail(e.target.value)}
                      placeholder="nri-desk@godavarione.ap.gov.in"
                      className="bg-card text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                      <Clock className="size-3.5 text-teal-600" /> Helpline Operating Hours
                    </Label>
                    <Input
                      value={cfgHelplineHours}
                      onChange={(e) => setCfgHelplineHours(e.target.value)}
                      placeholder="e.g. 24x7 Dedicated Pushkara Desk"
                      className="bg-card text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                      <ExternalLink className="size-3.5 text-teal-600" /> External Government / AP Tourism Guide URL
                    </Label>
                    <Input
                      value={cfgExternalGuideUrl}
                      onChange={(e) => setCfgExternalGuideUrl(e.target.value)}
                      placeholder="https://tourism.ap.gov.in"
                      className="bg-card text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Support Instructions / Operational Notes</Label>
                  <Textarea
                    rows={2}
                    value={cfgSupportInstructions}
                    onChange={(e) => setCfgSupportInstructions(e.target.value)}
                    placeholder="Instructions regarding airport meeting points, VIP permits, or coordination protocols..."
                    className="bg-card text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Visibility Controls */}
            <Card className="shadow-xs border-border/80">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="size-4 text-teal-600" /> Section & Link Visibility Controls
                </CardTitle>
                <CardDescription className="text-xs">
                  Toggle individual sub-components and navigation links across Godavari One.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <span className="font-semibold text-foreground block">Main Header "NRI Access" Button</span>
                      <span className="text-muted-foreground text-[11px]">Show button in desktop and mobile header navigation</span>
                    </div>
                    <Switch checked={visShowHeaderLink} onCheckedChange={setVisShowHeaderLink} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <span className="font-semibold text-foreground block">Homepage NRI Banner Link</span>
                      <span className="text-muted-foreground text-[11px]">Display promotional banner on the main home view</span>
                    </div>
                    <Switch checked={visShowHomepageBanner} onCheckedChange={setVisShowHomepageBanner} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <span className="font-semibold text-foreground block">New Package Request Form Tab</span>
                      <span className="text-muted-foreground text-[11px]">Permit new travelers to submit quotation requests</span>
                    </div>
                    <Switch checked={visShowPackagesTab} onCheckedChange={setVisShowPackagesTab} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <span className="font-semibold text-foreground block">Request Tracking Tab</span>
                      <span className="text-muted-foreground text-[11px]">Allow looking up submitted reference numbers</span>
                    </div>
                    <Switch checked={visShowTrackingTab} onCheckedChange={setVisShowTrackingTab} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <span className="font-semibold text-foreground block">Exclusive Services Grid</span>
                      <span className="text-muted-foreground text-[11px]">Showcase service feature cards</span>
                    </div>
                    <Switch checked={visShowServicesGrid} onCheckedChange={setVisShowServicesGrid} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <span className="font-semibold text-foreground block">Important Notices & Advisories</span>
                      <span className="text-muted-foreground text-[11px]">Display active advisory banners</span>
                    </div>
                    <Switch checked={visShowNotices} onCheckedChange={setVisShowNotices} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border bg-card shadow-xs">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="size-3.5" />
                <span>Last Updated: {formatIst(config?.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Eye className="size-3.5" /> Preview First
                </Button>
                <Button
                  type="submit"
                  disabled={configSaving}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs gap-1.5 shadow-sm"
                  id="save-nri-config-button"
                >
                  <Save className="size-3.5" /> {configSaving ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* ============================================================== */}
        {/* SUBTAB 2: MANAGED CONTENT ITEMS */}
        {/* ============================================================== */}
        <TabsContent value="content" className="pt-4 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {["ALL", "SERVICE", "NOTICE", "ANNOUNCEMENT", "CARD", "DRAFT"].map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={contentFilter === f ? "default" : "outline"}
                  onClick={() => setContentFilter(f)}
                  className="text-xs h-7 px-3"
                >
                  {f === "ALL" ? "All Items" : f.replace(/_/g, " ")}
                </Button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={openCreateItemDialog}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs gap-1.5 shadow-xs"
              id="add-nri-content-button"
            >
              <Plus className="size-3.5" /> Add Content Item
            </Button>
          </div>

          {contentLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading managed NRI content...</div>
          ) : filteredItems.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-xs">
              No NRI content items found matching the selected filter.
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item, index) => (
                <Card
                  key={item.id}
                  className={`border shadow-xs transition-colors ${
                    !item.isEnabled || item.status === "DRAFT" ? "opacity-75 bg-muted/20" : "bg-card"
                  }`}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => handleMoveItem(index, "up")}
                          className="size-6 text-muted-foreground hover:text-foreground"
                          title="Move up in display order"
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <span className="text-[10px] font-mono font-bold text-muted-foreground">#{item.orderIdx}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === filteredItems.length - 1}
                          onClick={() => handleMoveItem(index, "down")}
                          className="size-6 text-muted-foreground hover:text-foreground"
                          title="Move down in display order"
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground truncate">{item.title}</h4>
                          <Badge variant="outline" className="text-[10px] font-semibold text-teal-700 border-teal-300">
                            {item.type}
                          </Badge>
                          {item.badgeText && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.badgeText}
                            </Badge>
                          )}
                          <Badge
                            variant={item.status === "PUBLISHED" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {item.status}
                          </Badge>
                          {!item.isEnabled && (
                            <Badge variant="destructive" className="text-[10px]">
                              DISABLED
                            </Badge>
                          )}
                        </div>

                        {item.subtitle && <p className="text-xs text-teal-700 font-medium truncate">{item.subtitle}</p>}
                        {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                        {item.linkUrl && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                            <LinkIcon className="size-3 text-teal-600" /> {item.linkUrl} {item.linkText ? `("${item.linkText}")` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTogglePublish(item)}
                        className="text-xs h-8 px-2"
                        title={item.status === "PUBLISHED" ? "Unpublish item to draft" : "Publish item"}
                      >
                        {item.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditItemDialog(item)}
                        className="text-xs h-8 px-2.5 gap-1"
                      >
                        <Edit3 className="size-3" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(item)}
                        className="text-xs h-8 px-2 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Item Create / Edit Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto nice-scroll">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="size-4 text-teal-600" />
              {editingItem ? "Edit NRI Content Item" : "Create NRI Content Item"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide headline, content type, descriptions, icon, and destination link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-4 pt-2">
            {itemErrors.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
                {itemErrors.map((err, idx) => (
                  <p key={idx}>• {err}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Content Type *</Label>
                <Select value={itemType} onValueChange={setItemType}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICE">Service (Chauffeured, Stays, VIP Snanam)</SelectItem>
                    <SelectItem value="CARD">Information Card</SelectItem>
                    <SelectItem value="NOTICE">Official Advisory Notice</SelectItem>
                    <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                    <SelectItem value="FAQ">FAQ / Assistance Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Icon Symbol</Label>
                <Select value={itemIcon} onValueChange={setItemIcon}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sparkles">Sparkles (Spiritual / Priority)</SelectItem>
                    <SelectItem value="Plane">Plane (Airport Transit)</SelectItem>
                    <SelectItem value="Building">Building (Riverside Resorts)</SelectItem>
                    <SelectItem value="Waves">Waves (VIP Ghat Snanam)</SelectItem>
                    <SelectItem value="Calendar">Calendar (Festival Dates)</SelectItem>
                    <SelectItem value="Shield">Shield (Official Guarantee)</SelectItem>
                    <SelectItem value="Phone">Phone (Helpline)</SelectItem>
                    <SelectItem value="Mail">Mail (Email Support)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Title / Headline *</Label>
              <Input
                required
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder="e.g. Chauffeured Airport Transit"
                className="text-xs h-8"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Short Subtitle</Label>
              <Input
                value={itemSubtitle}
                onChange={(e) => setItemSubtitle(e.target.value)}
                placeholder="e.g. RJA, VGA, VTZ & HYD Connections"
                className="text-xs h-8"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Description / Summary</Label>
              <Textarea
                rows={2}
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Brief summary displayed on cards or announcement alerts..."
                className="text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Full Content / Inclusions (Optional)</Label>
              <Textarea
                rows={3}
                value={itemContent}
                onChange={(e) => setItemContent(e.target.value)}
                placeholder="Detailed explanations, guidelines, or package inclusions..."
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Badge Tag Text</Label>
                <Input
                  value={itemBadgeText}
                  onChange={(e) => setItemBadgeText(e.target.value)}
                  placeholder="e.g. All-Inclusive, Advisory"
                  className="text-xs h-8"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Publication Status</Label>
                <Select value={itemStatus} onValueChange={(v: any) => setItemStatus(v)}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLISHED">Published (Visible)</SelectItem>
                    <SelectItem value="DRAFT">Draft (Admin Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Action Link URL</Label>
                <Input
                  value={itemLinkUrl}
                  onChange={(e) => setItemLinkUrl(e.target.value)}
                  placeholder="e.g. /nri-access"
                  className="text-xs h-8 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Action Button Text</Label>
                <Input
                  value={itemLinkText}
                  onChange={(e) => setItemLinkText(e.target.value)}
                  placeholder="e.g. Learn More"
                  className="text-xs h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Start Date (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={itemStartDate}
                  onChange={(e) => setItemStartDate(e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">End Date (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={itemEndDate}
                  onChange={(e) => setItemEndDate(e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
              <div>
                <span className="font-semibold text-xs text-foreground block">Is Enabled</span>
                <span className="text-[11px] text-muted-foreground">Controls visibility when published</span>
              </div>
              <Switch checked={itemIsEnabled} onCheckedChange={setItemIsEnabled} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setItemDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={itemSaving} className="bg-teal-700 hover:bg-teal-800 text-white font-semibold">
                {itemSaving ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="size-4" /> Confirm Content Deletion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete <strong>{deleteTarget?.title}</strong>? This action will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteItem}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto nice-scroll">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="size-4 text-teal-600" /> Public NRI Portal Live Preview
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preview of what pilgrims see based on the currently configured settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Disabled notification banner if portal is offline */}
            {!cfgIsEnabled && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2 font-semibold">
                <AlertCircle className="size-4 shrink-0" />
                <span>Notice: NRI Portal is currently marked DISABLED. Visitors will see the maintenance state.</span>
              </div>
            )}

            {/* Simulated Hero Banner */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-teal-800 via-teal-900 to-cyan-900 text-white p-6 md:p-8 shadow-md">
              <div className="space-y-2 max-w-2xl">
                <Badge className="bg-amber-400 text-amber-950 font-bold border-none text-[10px]">
                  <Globe className="size-3 mr-1" /> NRI & Global Pilgrims Exclusive Portal
                </Badge>
                <h3 className="text-xl md:text-2xl font-extrabold text-white leading-tight">
                  {cfgHeroTitle || "Portal Headline"}
                </h3>
                <p className="text-xs text-teal-100 leading-relaxed">
                  {cfgHeroDescription || "Hero description text..."}
                </p>
                {cfgWelcomeMessage && (
                  <p className="text-xs text-teal-200/80 italic pt-1 border-t border-teal-700/50">
                    {cfgWelcomeMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Simulated Services */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">Active Services Preview</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {contentItems
                  .filter((i) => i.isEnabled && i.status === "PUBLISHED" && (i.type === "SERVICE" || i.type === "CARD"))
                  .slice(0, 4)
                  .map((s) => (
                    <div key={s.id} className="p-3 rounded-lg border bg-card">
                      <span className="font-semibold block text-xs">{s.title}</span>
                      <span className="text-muted-foreground text-[10px] block line-clamp-2 mt-0.5">{s.description}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Simulated Helpline info */}
            <div className="p-4 rounded-xl border bg-muted/40 text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold block">Helpline: {cfgSupportPhone || "None"}</span>
                <span className="text-muted-foreground">{cfgSupportEmail || "None"} · {cfgHelplineHours || "24x7"}</span>
              </div>
              {cfgExternalGuideUrl && (
                <span className="text-[11px] text-teal-600 font-mono underline">
                  {cfgExternalGuideUrl}
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button size="sm" onClick={() => setPreviewOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

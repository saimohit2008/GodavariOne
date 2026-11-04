"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import {
  Menu,
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  Globe,
  Waves,
  LayoutDashboard,
  Heart,
  CalendarCheck,
  Shield,
  KeyRound,
  Plus,
  ChevronDown,
} from "lucide-react";
import type { View } from "@/lib/store";

export function Header() {
  const { lang, setLang, user, navigate, view, searchQuery, setSearchQuery } = useApp();
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // poll notifications for logged-in users
  useEffect(() => {
    async function load() {
      if (!user) { setUnread(0); return; }
      try {
        const res = await api.get<{ items: any[]; unread: number }>("/notifications");
        setUnread(res.unread);
        setNotifications(res.items.slice(0, 8));
      } catch { /* ignore */ }
    }
    load();
    pollRef.current = setInterval(load, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user]);

  async function handleLogout() {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    useApp.getState().setUser(null);
    toast({ title: "Logged out" });
    navigate({ name: "home" });
  }

  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ name: "directory", q: searchQuery });
  }

  const isActive = (name: View["name"]) => view.name === name;

  const navLinks: { label: string; view: View }[] = [
    { label: t(lang, "home"), view: { name: "home" } },
    { label: t(lang, "directory"), view: { name: "directory" } },
    { label: t(lang, "ghats"), view: { name: "directory", category: "GHAT" } },
    { label: lang === "te" ? "పూజా పోర్టల్" : "Ceremony Portal", view: { name: "directory", category: "CEREMONY" } },
    { label: lang === "te" ? "AI గైడ్" : "AI Assistant", view: { name: "ai-assistant" } },
  ];

  const dashboardLink = user && user.role !== "VISITOR"
    ? dashboardForRole(user.role)
    : user?.role === "VISITOR"
      ? { name: "visitor-dashboard" as const }
      : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto max-w-7xl px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Waves className="size-5 text-primary" />
                {t(lang, "brand")}
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1 px-2">
              {navLinks.map((l) => (
                <Button
                  key={l.label}
                  variant={isActive(l.view.name) ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => { navigate(l.view); setMobileOpen(false); }}
                >
                  {l.label}
                </Button>
              ))}
              <Link href="/nri-access" onClick={() => setMobileOpen(false)}>
                <Button
                  variant="default"
                  className="w-full justify-start bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 text-white font-medium gap-2 my-1"
                >
                  <Globe className="size-4" /> NRI Access
                </Button>
              </Link>
              {user && (
                <>
                  <Button variant="ghost" className="justify-start" onClick={() => { navigate({ name: "bookings" }); setMobileOpen(false); }}>
                    <CalendarCheck className="size-4 mr-2" /> {t(lang, "bookings")}
                  </Button>
                  <Button variant="ghost" className="justify-start" onClick={() => { navigate({ name: "favorites" }); setMobileOpen(false); }}>
                    <Heart className="size-4 mr-2" /> {t(lang, "favorites")}
                  </Button>
                  {dashboardLink && (
                    <Button variant="ghost" className="justify-start" onClick={() => { navigate(dashboardLink); setMobileOpen(false); }}>
                      <LayoutDashboard className="size-4 mr-2" /> {t(lang, "dashboard")}
                    </Button>
                  )}
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link
          href="/"
          onClick={(e) => {
            if (typeof window !== "undefined" && window.location.pathname === "/") {
              e.preventDefault();
              navigate({ name: "home" });
            }
          }}
          className="flex items-center gap-2 shrink-0 focus-visible:outline-hidden"
          aria-label="Return to Godavari One Homepage"
          id="header-brand-logo"
        >
          <span className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <Waves className="size-5" />
          </span>
          <div className="hidden sm:flex flex-col leading-none text-left">
            <span className="font-bold text-base">{t(lang, "brand")}</span>
            <span className="text-[10px] text-muted-foreground">Pushkaralu 2027</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 ml-2">
          {navLinks.map((l) => (
            <Button
              key={l.label}
              variant={isActive(l.view.name) ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate(l.view)}
            >
              {l.label}
            </Button>
          ))}
        </nav>

        {/* Search */}
        <form onSubmit={doSearch} className="flex-1 max-w-xs xl:max-w-sm hidden xl:block ml-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(lang, "searchPlaceholder")}
              className="pl-9 h-9 bg-muted/50"
            />
          </div>
        </form>

        {/* NRI Access Button in header */}
        <div className="hidden lg:flex items-center ml-2">
          <Link href="/nri-access">
            <Button
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white font-medium shadow-xs border border-teal-500/30 gap-1.5 h-9 px-3.5 transition-all hover:shadow-md"
            >
              <Globe className="size-4 text-teal-100" />
              <span>NRI Access</span>
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {/* Language switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Globe className="size-4" />
                <span className="hidden sm:inline">{lang === "en" ? "EN" : "తె"}</span>
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLang("en")}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang("te")}>తెలుగు (Telugu)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              {/* Notifications */}
              <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                    <Bell className="size-5" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-destructive text-white text-[9px] grid place-items-center font-bold">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>{t(lang, "notifications")}</span>
                    {unread > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={async () => {
                          await api.patch("/notifications", { all: true });
                          setUnread(0);
                          setNotifications((n) => n.map((x) => ({ ...x, read: true })));
                        }}
                      >
                        {t(lang, "markAllRead")}
                      </Button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {t(lang, "noNotifications")}
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto nice-scroll">
                      {notifications.map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          className="flex flex-col items-start gap-0.5 py-2"
                          onClick={() => { navigate({ name: "notifications" }); setNotifOpen(false); }}
                        >
                          <span className={`text-sm font-medium ${n.read ? "text-muted-foreground" : ""}`}>{n.title}</span>
                          <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <span className="size-7 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-semibold">
                      {(user.name || user.phone).slice(0, 2).toUpperCase()}
                    </span>
                    <span className="hidden sm:inline max-w-[100px] truncate">{user.name || user.phone}</span>
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate">{user.name || "User"}</span>
                      <span className="text-xs text-muted-foreground">{user.phone}</span>
                      <Badge variant="secondary" className="mt-1 w-fit text-[10px]">{user.role.replace(/_/g, " ")}</Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ name: "bookings" })}>
                    <CalendarCheck className="size-4 mr-2" /> {t(lang, "bookings")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ name: "favorites" })}>
                    <Heart className="size-4 mr-2" /> {t(lang, "favorites")}
                  </DropdownMenuItem>
                  {dashboardLink && (
                    <DropdownMenuItem onClick={() => navigate(dashboardLink)}>
                      <LayoutDashboard className="size-4 mr-2" /> {t(lang, "dashboard")}
                    </DropdownMenuItem>
                  )}
                  {user.role === "SUPER_ADMIN" && (
                    <>
                      <DropdownMenuItem onClick={() => navigate({ name: "admin", tab: "overview" })}>
                        <Shield className="size-4 mr-2" /> {t(lang, "admin")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate({ name: "admin", tab: "settings" })}>
                        <KeyRound className="size-4 mr-2" /> Account Settings
                      </DropdownMenuItem>
                    </>
                  )}
                  {(user.role === "SUPER_ADMIN" || user.role === "BUSINESS_OWNER") && (
                    <DropdownMenuItem onClick={() => navigate({ name: "listing-form" })}>
                      <Plus className="size-4 mr-2" /> {t(lang, "createListing")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="size-4 mr-2" /> {t(lang, "logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate({ name: "login" })}>
                {t(lang, "login")}
              </Button>
              <Button size="sm" className="hidden sm:inline-flex" onClick={() => navigate({ name: "register" })}>
                {t(lang, "register")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate({ name: "admin-login" })} title={t(lang, "adminLogin")}>
                <Shield className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">{t(lang, "admin")}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function dashboardForRole(role: string): View {
  switch (role) {
    case "SUPER_ADMIN": return { name: "admin", tab: "overview" };
    case "NRI_SERVICE_MANAGER": return { name: "nri-service-manager" };
    case "PUROHIT": return { name: "purohit-dashboard" };
    case "GHAT_SUPERVISOR": return { name: "ghat-supervisor" };
    case "BOOKING_REVIEWER": return { name: "reviewer-dashboard" };
    case "BUSINESS_OWNER": return { name: "owner-dashboard" };
    default: return { name: "visitor-dashboard" };
  }
}

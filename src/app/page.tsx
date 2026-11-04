"use client";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api-client";
import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { HomeView } from "@/components/app/views/home-view";
import { DirectoryView } from "@/components/app/views/directory-view";
import { ListingDetailView } from "@/components/app/views/listing-detail-view";
import { ListingFormView } from "@/components/app/views/listing-form-view";
import { LoginView } from "@/components/app/views/login-view";
import { RegisterView } from "@/components/app/views/register-view";
import { AdminLoginView } from "@/components/app/views/admin-login-view";
import { AdminDashboard } from "@/components/app/views/admin-dashboard";
import { OwnerDashboard, GhatReporterView, GhatSupervisorView, ReviewerDashboard, EditorDashboard, VisitorDashboard } from "@/components/app/views/role-dashboards";
import { BookingsView, FavoritesView, NotificationsView } from "@/components/app/views/bookings-favorites-notifications";
import { NriPackageRequestForm } from "@/components/app/nri/nri-package-request-form";
import { CarouselDetailView } from "@/components/app/views/carousel-detail-view";
import { NriServiceManagerDashboard } from "@/components/app/views/nri-service-manager-dashboard";
import { PurohitDashboard } from "@/components/app/views/purohit-dashboard";
import { CeremonyDirectoryView } from "@/components/app/views/ceremony-directory-view";
import { BookingAuthModal } from "@/components/app/booking-auth-modal";
import { AiAssistantWidget } from "@/components/app/ai-assistant-widget";
import { AiAssistantView } from "@/components/app/views/ai-assistant-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { view, user, authLoading, setUser, setAuthLoading, navigate } = useApp();

  // restore pending view from cross-page navigation if any
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("godavari_pending_view");
      if (pending) {
        sessionStorage.removeItem("godavari_pending_view");
        const parsed = JSON.parse(pending);
        if (parsed && typeof parsed === "object" && parsed.name) {
          navigate(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  // bootstrap session on mount
  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      try {
        const res = await api.get<{ user: any }>("/auth/me");
        setUser(res.user);
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    })();
     
  }, []);

  // Guard: auth-required views redirect to login when unauthenticated
  const authViews = [
    "bookings", "favorites", "notifications", "admin", "visitor-dashboard",
    "owner-dashboard", "ghat-reporter", "ghat-supervisor", "reviewer-dashboard",
    "editor-dashboard", "listing-form", "nri-service-manager", "purohit-dashboard"
  ];
  useEffect(() => {
    if (!authLoading && !user && authViews.includes(view.name)) {
      navigate({ name: "login" });
    }
     
  }, [authLoading, user, view.name]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col">
        {authLoading ? <BootSkeleton /> : renderView(view, user)}
      </main>
      <Footer />
      <BookingAuthModal />
      <AiAssistantWidget />
    </div>
  );
}

function renderView(view: ReturnType<typeof useApp.getState>["view"], user: ReturnType<typeof useApp.getState>["user"]) {
  switch (view.name) {
    case "home": return <HomeView />;
    case "directory": return <DirectoryView key={`${view.category || ""}-${view.q || ""}`} initialCategory={view.category} initialQ={view.q} />;
    case "listing": return <ListingDetailView id={view.id} />;
    case "listing-form": return <ListingFormView id={view.id} initialCategory={view.category} />;
    case "login": return <LoginView />;
    case "register": return <RegisterView />;
    case "admin-login": return <AdminLoginView />;
    case "admin": return <AdminDashboard tab={view.tab} />;
    case "bookings": return <BookingsView />;
    case "favorites": return <FavoritesView />;
    case "notifications": return <NotificationsView />;
    case "visitor-dashboard": return <VisitorDashboard />;
    case "owner-dashboard": return <OwnerDashboard />;
    case "ghat-reporter": return <GhatReporterView />;
    case "ghat-supervisor": return <GhatSupervisorView />;
    case "reviewer-dashboard": return <ReviewerDashboard />;
    case "editor-dashboard": return <EditorDashboard />;
    case "nri-service-manager": return <NriServiceManagerDashboard />;
    case "purohit-dashboard": return <PurohitDashboard />;
    case "ceremonies": return <CeremonyDirectoryView initialCategory={view.category} initialPurohitId={view.purohitId} />;
    case "nri-access": return (
      <div className="flex-1 container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <NriPackageRequestForm initialRef={view.ref} />
      </div>
    );
    case "carousel-detail": return <CarouselDetailView id={view.id} />;
    case "ai-assistant": return <AiAssistantView />;
    default: return <HomeView />;
  }
}

function BootSkeleton() {
  return (
    <div className="flex-1 container mx-auto max-w-7xl px-4 py-12 space-y-4">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  );
}

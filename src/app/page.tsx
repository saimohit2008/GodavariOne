"use client";
import { useEffect } from "react";
import { useApp, urlToView, viewToUrl } from "@/lib/store";
import { api } from "@/lib/api-client";
import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { HomeView } from "@/components/app/views/home-view";
import { DirectoryView } from "@/components/app/views/directory-view";
import { ListingDetailView } from "@/components/app/views/listing-detail-view";
import { ListingFormView } from "@/components/app/views/listing-form-view";
import { LoginView } from "@/components/app/views/login-view";
import { RegisterView } from "@/components/app/views/register-view";
import { ForgotPasswordView } from "@/components/app/views/forgot-password-view";
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

  // Handle initial URL / deep-linking and browser popstate (back-swipe navigation)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if there's a view encoded in URL search params
    const initialViewFromUrl = urlToView(window.location.search);

    // Check pending view from cross-page navigation if any
    let pendingView: any = null;
    try {
      const pendingStr = sessionStorage.getItem("godavari_pending_view");
      if (pendingStr) {
        sessionStorage.removeItem("godavari_pending_view");
        const parsed = JSON.parse(pendingStr);
        if (parsed && typeof parsed === "object" && parsed.name) {
          pendingView = parsed;
        }
      }
    } catch {
      // ignore
    }

    const targetInitialView = pendingView || initialViewFromUrl;

    if (targetInitialView && targetInitialView.name !== "home") {
      // Deep link entry: replace base history with Home (depth 0) and push the target deep view (depth 1)
      // This ensures that when the user back-swipes from a direct link, they land on Home
      // instead of exiting Godavari One.
      window.history.replaceState({ view: { name: "home" }, godavariDepth: 0 }, "", "/");
      window.history.pushState(
        { view: targetInitialView, godavariDepth: 1 },
        "",
        viewToUrl(targetInitialView)
      );
      try {
        sessionStorage.setItem("godavari_nav_depth", "1");
      } catch {
        // ignore
      }
      navigate(targetInitialView, { skipHistory: true });
    } else {
      // Direct visit to home: ensure base state exists in history
      const currentState = window.history.state;
      if (!currentState || !currentState.view) {
        window.history.replaceState({ view: { name: "home" }, godavariDepth: 0 }, "", "/");
        try {
          sessionStorage.setItem("godavari_nav_depth", "0");
        } catch {
          // ignore
        }
      }
    }

    // Listen to browser Back / Forward gestures and buttons
    const handlePopState = (event: PopStateEvent) => {
      const stateView = event.state?.view;
      if (stateView && typeof stateView === "object" && stateView.name) {
        navigate(stateView, { skipHistory: true });
      } else {
        const fallbackView = urlToView(window.location.search) || { name: "home" };
        navigate(fallbackView, { skipHistory: true });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
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
    case "forgot-password": return <ForgotPasswordView initialEmail={view.email} />;
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

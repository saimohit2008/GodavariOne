"use client";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "../use-api";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, Heart, Bell, ArrowRight, X, Home } from "lucide-react";
import { NriVisitorSection } from "../nri/nri-visitor-section";
import { CeremonyBookingsSection } from "../ceremonies/ceremony-bookings-section";
import { UserPriorityBookingsTab } from "../priority-booking/user-priority-bookings-tab";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CONFIRMED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-sky-100 text-sky-700 border-sky-200",
  NO_SHOW: "bg-orange-100 text-orange-700 border-orange-200",
};

export function BookingsView() {
  const { lang, navigate, user } = useApp();
  const [r, setR] = useState2(0);
  const { data: rest, loading: rL } = useApi<{ items: any[] }>("/bookings/restaurant", [r]);
  const { data: hot, loading: hL } = useApi<{ items: any[] }>("/bookings/hotel", [r]);
  const { data: acc, loading: aL } = useApi<{ items: any[] }>("/bookings/accommodation", [r]);

  if (!user) return <RequireLogin />;

  async function cancel(kind: string, id: string) {
    try {
      if (kind === "accommodation") {
        await api.patch("/bookings/accommodation", { bookingId: id, status: "CANCELLED" });
      } else {
        await api.patch(`/bookings/${kind}/${id}`, { status: "CANCELLED" });
      }
      toast({ title: "Cancelled" });
      setR((x: number) => x + 1);
    } catch (e) {
      toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" });
    }
  }

  return (
    <div className="flex-1 container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{t(lang, "bookings")}</h1>
      <div className="space-y-8">
        <section className="p-4 rounded-2xl bg-sky-50/40 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900">
          <UserPriorityBookingsTab />
        </section>
        <section className="p-4 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900">
          <NriVisitorSection />
        </section>
        <section className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
          <CeremonyBookingsSection onUpdated={() => setR((x: number) => x + 1)} />
        </section>
        <section>
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Home className="size-5 text-indigo-600" /> Free Accommodation Stays</h2>
          {aL ? <Skeleton className="h-32" /> : (
            <div className="space-y-3">
              {acc?.items?.length ? acc.items.map((b) => (
                <Card key={b.id} className="p-0 border-indigo-100 dark:border-indigo-900/40"><CardContent className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <button className="font-medium hover:text-primary" onClick={() => navigate({ name: "listing", id: b.listingId })}>{b.listing?.name}</button>
                    <p className="text-sm text-muted-foreground">{b.checkInDate} → {b.checkOutDate} · {b.peopleCount} {t(lang, "people")} ({b.groupType})</p>
                    {b.specialNotes && <p className="text-xs text-muted-foreground mt-1">“{b.specialNotes}”</p>}
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[b.status]}>{b.status}</Badge>
                  {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                    <Button size="sm" variant="outline" onClick={() => cancel("accommodation", b.id)}><X className="size-3.5" /> {t(lang, "cancel")}</Button>
                  )}
                </CardContent></Card>
              )) : <EmptyState text="No free accommodation registrations yet." />}
            </div>
          )}
        </section>
        <section>
          <h2 className="font-semibold mb-3 flex items-center gap-2"><CalendarCheck className="size-5" /> Restaurant Bookings</h2>
          {rL ? <Skeleton className="h-32" /> : (
            <div className="space-y-3">
              {rest?.items?.length ? rest.items.map((b) => (
                <Card key={b.id} className="p-0"><CardContent className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <button className="font-medium hover:text-primary" onClick={() => navigate({ name: "listing", id: b.listingId })}>{b.listing?.name}</button>
                    <p className="text-sm text-muted-foreground">{b.bookingDate} · {b.timeSlot} · {b.peopleCount} {t(lang, "people")}</p>
                    {b.specialRequest && <p className="text-xs text-muted-foreground mt-1">“{b.specialRequest}”</p>}
                    {b.rejectionReason && <p className="text-xs text-red-600 mt-1">Reason: {b.rejectionReason}</p>}
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[b.status]}>{t(lang, b.status as any) || b.status}</Badge>
                  {(b.status === "PENDING" || b.status === "APPROVED") && (
                    <Button size="sm" variant="outline" onClick={() => cancel("restaurant", b.id)}><X className="size-3.5" /> {t(lang, "cancel")}</Button>
                  )}
                </CardContent></Card>
              )) : <EmptyState text="No restaurant bookings yet." />}
            </div>
          )}
        </section>
        <section>
          <h2 className="font-semibold mb-3 flex items-center gap-2"><CalendarCheck className="size-5" /> Hotel Bookings</h2>
          {hL ? <Skeleton className="h-32" /> : (
            <div className="space-y-3">
              {hot?.items?.length ? hot.items.map((b) => (
                <Card key={b.id} className="p-0"><CardContent className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <button className="font-medium hover:text-primary" onClick={() => navigate({ name: "listing", id: b.listingId })}>{b.listing?.name}</button>
                    <p className="text-sm text-muted-foreground">{b.checkIn} → {b.checkOut} · {b.rooms} {t(lang, "rooms")} · {b.guests} {t(lang, "guests")}</p>
                    {b.specialRequest && <p className="text-xs text-muted-foreground mt-1">“{b.specialRequest}”</p>}
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[b.status]}>{t(lang, b.status as any) || b.status}</Badge>
                  {(b.status === "PENDING" || b.status === "APPROVED") && (
                    <Button size="sm" variant="outline" onClick={() => cancel("hotel", b.id)}><X className="size-3.5" /> {t(lang, "cancel")}</Button>
                  )}
                </CardContent></Card>
              )) : <EmptyState text="No hotel bookings yet." />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function FavoritesView() {
  const { lang, navigate, user } = useApp();
  const [r, setR] = useState2(0);
  const { data, loading } = useApi<{ items: any[] }>("/favorites", [r]);
  if (!user) return <RequireLogin />;

  async function remove(id: string) {
    try { await api.del(`/favorites?listingId=${id}`); toast({ title: "Removed" }); setR((x: number) => x + 1); }
    catch (e) { toast({ title: "Error", description: e instanceof ApiError ? e.message : "Failed", variant: "destructive" }); }
  }

  return (
    <div className="flex-1 container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Heart className="size-7 text-primary" /> {t(lang, "favorites")}</h1>
      {loading ? <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div> :
        data?.items?.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((l) => (
              <Card key={l.id} className="p-0 overflow-hidden">
                <div className="aspect-[4/3] bg-muted">
                  {l.primaryImage ? <img src={l.primaryImage} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <CardContent className="p-4">
                  <p className="font-medium truncate">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{[l.town, l.district].filter(Boolean).join(", ")}</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate({ name: "listing", id: l.id })}>{t(lang, "explore")} <ArrowRight className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(l.id)}><X className="size-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : <EmptyState text="No favorites yet. Tap the heart on a listing to save it." />}
    </div>
  );
}

export function NotificationsView() {
  const { lang } = useApp();
  const [r, setR] = useState2(0);
  const { data, loading } = useApi<{ items: any[] }>("/notifications", [r]);
  return (
    <div className="flex-1 container mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Bell className="size-7 text-primary" /> {t(lang, "notifications")}</h1>
        <Button variant="outline" size="sm" onClick={async () => { await api.patch("/notifications", { all: true }); setR((x: number) => x + 1); }}>
          {t(lang, "markAllRead")}
        </Button>
      </div>
      {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> :
        data?.items?.length ? (
          <div className="space-y-2">
            {data.items.map((n) => (
              <Card key={n.id} className={`p-0 ${n.read ? "opacity-70" : "border-primary/30"}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <span className={`size-2 rounded-full mt-2 ${n.read ? "bg-muted" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : <EmptyState text={t(lang, "noNotifications")} />}
    </div>
  );
}

function RequireLogin() {
  const { lang, navigate } = useApp();
  return (
    <div className="flex-1 container mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-muted-foreground mb-4">{t(lang, "login")} to continue.</p>
      <Button onClick={() => navigate({ name: "login" })}>{t(lang, "login")}</Button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="p-0"><CardContent className="p-10 text-center text-muted-foreground">
      <p className="text-sm">{text}</p>
    </CardContent></Card>
  );
}

// tiny local state helper to avoid extra import churn
import { useState as useState2React } from "react";
function useState2<T>(init: T): [T, (v: (x: T) => T) => void] {
  const [s, set] = useState2React<T>(init);
  const setter = (v: (x: T) => T) => set((prev) => v(prev));
  return [s, setter];
}

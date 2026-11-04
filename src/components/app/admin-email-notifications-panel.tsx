"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Send,
  XCircle,
  FileText,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface EmailNotificationRecord {
  id: string;
  eventType: string;
  userId: string | null;
  bookingId: string | null;
  bookingReference: string | null;
  bookingCategory: string | null;
  recipientEmail: string;
  recipientName: string | null;
  language: string;
  subject: string;
  payload: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";
  attemptCount: number;
  maxAttempts: number;
  providerMessageId: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  lastError: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StatsSummary {
  total: number;
  sent: number;
  pending: number;
  processing: number;
  failed: number;
  cancelled: number;
}

export function AdminEmailNotificationsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [runningCron, setRunningCron] = useState(false);

  // Data
  const [notifications, setNotifications] = useState<EmailNotificationRecord[]>([]);
  const [stats, setStats] = useState<StatsSummary>({
    total: 0,
    sent: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    cancelled: 0,
  });

  // Query filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [eventFilter, setEventFilter] = useState("ALL");

  // Detail Modal
  const [selectedNotification, setSelectedNotification] = useState<EmailNotificationRecord | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "15");
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (eventFilter !== "ALL") params.set("eventType", eventFilter);

      const res = await fetch(`/api/v1/admin/notifications?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load notifications: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.items || []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      console.error("[EmailNotificationsPanel] Error fetching:", err);
      toast({
        title: "Failed to load notifications",
        description: err.message || "Could not retrieve email notification records.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, eventFilter, toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRetry = async (notificationId: string) => {
    setRetryingId(notificationId);
    try {
      const res = await fetch(`/api/v1/admin/notifications/${notificationId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({
          title: "Retry Processed",
          description: data.result?.success
            ? "Notification delivered successfully."
            : `Attempt finished with status: ${data.notification?.status || "FAILED"}.`,
        });
        fetchNotifications();
        if (selectedNotification?.id === notificationId && data.notification) {
          setSelectedNotification(data.notification);
        }
      } else {
        throw new Error(data.error || "Retry attempt failed");
      }
    } catch (err: any) {
      toast({
        title: "Retry Failed",
        description: err.message || "An error occurred while retrying.",
        variant: "destructive",
      });
    } finally {
      setRetryingId(null);
    }
  };

  const handleRunCron = async () => {
    setRunningCron(true);
    try {
      const res = await fetch("/api/v1/notifications/cron", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({
          title: "Queue Worker Executed",
          description: `Processed ${data.result?.processed || 0} notifications (${data.result?.succeeded || 0} sent, ${data.result?.failed || 0} failed).`,
        });
        fetchNotifications();
      } else {
        throw new Error(data.error || "Failed to trigger worker");
      }
    } catch (err: any) {
      toast({
        title: "Worker Execution Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRunningCron(false);
    }
  };

  const getStatusBadge = (status: EmailNotificationRecord["status"]) => {
    switch (status) {
      case "SENT":
        return <Badge className="bg-emerald-600 text-white font-medium hover:bg-emerald-700">Delivered</Badge>;
      case "PENDING":
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 font-medium">Pending</Badge>;
      case "PROCESSING":
        return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 font-medium">Processing</Badge>;
      case "FAILED":
        return <Badge className="bg-red-600 text-white font-medium hover:bg-red-700">Failed</Badge>;
      case "CANCELLED":
        return <Badge variant="secondary" className="text-muted-foreground font-medium">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEventBadge = (eventType: string) => {
    const map: Record<string, { label: string; color: string }> = {
      BOOKING_SUCCESSFUL: { label: "Booking Confirmed", color: "bg-teal-100 text-teal-800 border-teal-200" },
      BOOKING_CANCELLED: { label: "Booking Cancelled", color: "bg-rose-100 text-rose-800 border-rose-200" },
      BOOKING_APPROVED: { label: "Booking Approved", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
      BOOKING_REJECTED: { label: "Booking Rejected", color: "bg-red-100 text-red-800 border-red-200" },
      BOOKING_RESCHEDULED: { label: "Rescheduled", color: "bg-purple-100 text-purple-800 border-purple-200" },
      BOOKING_REMINDER_24H: { label: "24h Reminder", color: "bg-sky-100 text-sky-800 border-sky-200" },
      BOOKING_REMINDER_2H: { label: "2h Reminder", color: "bg-amber-100 text-amber-800 border-amber-200" },
      GHAT_CLOSURE: { label: "Emergency Closure", color: "bg-orange-100 text-orange-900 border-orange-300 font-semibold" },
      GHAT_REOPENED: { label: "Ghat Reopened", color: "bg-blue-100 text-blue-800 border-blue-200" },
    };

    const item = map[eventType] || { label: eventType, color: "bg-muted text-foreground" };
    return <span className={`text-xs px-2 py-0.5 rounded-full border ${item.color}`}>{item.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="size-5 text-teal-600" />
            Automated Email Notifications Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor, audit, and manage transactional notifications sent via Resend for all bookings and ghat emergencies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchNotifications}
            disabled={loading}
            className="shadow-sm"
          >
            <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleRunCron}
            disabled={runningCron}
            className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
          >
            <Send className={`size-4 mr-1.5 ${runningCron ? "animate-spin" : ""}`} />
            Process Outbox
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
          <span className="size-10 rounded-lg bg-teal-50 text-teal-600 grid place-items-center shrink-0">
            <Mail className="size-5" />
          </span>
          <div>
            <div className="text-2xl font-bold tracking-tight">{stats.total}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Notifications</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
          <span className="size-10 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center shrink-0">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <div className="text-2xl font-bold tracking-tight text-emerald-700">{stats.sent}</div>
            <div className="text-xs text-muted-foreground font-medium">Delivered via Resend</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
          <span className="size-10 rounded-lg bg-amber-50 text-amber-600 grid place-items-center shrink-0">
            <Clock className="size-5" />
          </span>
          <div>
            <div className="text-2xl font-bold tracking-tight text-amber-700">
              {stats.pending + stats.processing}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Pending / Scheduled</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm flex items-center gap-3">
          <span className="size-10 rounded-lg bg-red-50 text-red-600 grid place-items-center shrink-0">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <div className="text-2xl font-bold tracking-tight text-red-700">{stats.failed}</div>
            <div className="text-xs text-muted-foreground font-medium">Failed Attempts</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient email, customer name, or booking reference..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-card shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-sm rounded-md border bg-card shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="SENT">Delivered</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-sm rounded-md border bg-card shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Event Types</option>
            <option value="BOOKING_SUCCESSFUL">Booking Confirmed</option>
            <option value="BOOKING_CANCELLED">Booking Cancelled</option>
            <option value="BOOKING_APPROVED">Booking Approved</option>
            <option value="BOOKING_REJECTED">Booking Rejected</option>
            <option value="BOOKING_RESCHEDULED">Booking Rescheduled</option>
            <option value="BOOKING_REMINDER_24H">24-Hour Reminder</option>
            <option value="BOOKING_REMINDER_2H">2-Hour Reminder</option>
            <option value="GHAT_CLOSURE">Emergency Ghat Closure</option>
            <option value="GHAT_REOPENED">Ghat Reopened</option>
          </select>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground border-b text-left">
              <tr>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Event Type</th>
                <th className="py-3 px-4 font-medium">Recipient</th>
                <th className="py-3 px-4 font-medium">Booking Ref</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Attempts</th>
                <th className="py-3 px-4 font-medium">Created (IST)</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && notifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-teal-600" />
                    Loading notifications...
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No email notifications match the selected criteria.
                  </td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(n.status)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getEventBadge(n.eventType)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{n.recipientName || "Guest"}</div>
                      <div className="text-xs text-muted-foreground">{n.recipientEmail}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {n.bookingReference ? (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60">
                          {n.bookingReference}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-muted-foreground">
                      {n.bookingCategory || "General"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <span className={n.attemptCount >= n.maxAttempts ? "text-red-600 font-semibold" : ""}>
                        {n.attemptCount} / {n.maxAttempts}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedNotification(n)}
                          className="h-8 px-2 text-xs"
                        >
                          <Eye className="size-3.5 mr-1" />
                          Details
                        </Button>

                        {(n.status === "FAILED" || n.status === "PENDING") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(n.id)}
                            disabled={retryingId === n.id}
                            className="h-8 px-2 text-xs text-teal-700 hover:text-teal-800 border-teal-200 bg-teal-50 hover:bg-teal-100"
                          >
                            <RefreshCw className={`size-3 mr-1 ${retryingId === n.id ? "animate-spin" : ""}`} />
                            Retry
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10 text-xs text-muted-foreground">
          <div>
            Showing page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2.5"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2.5"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Notification Detail Dialog */}
      {selectedNotification && (
        <Dialog open={Boolean(selectedNotification)} onOpenChange={(open) => !open && setSelectedNotification(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileText className="size-5 text-teal-600" />
                Notification Audit Details
              </DialogTitle>
              <DialogDescription>
                System delivery record and audit trail for ID:{" "}
                <span className="font-mono text-xs">{selectedNotification.id}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground">Event Type:</span>
                  <div className="mt-0.5">{getEventBadge(selectedNotification.eventType)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedNotification.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipient:</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {selectedNotification.recipientName} ({selectedNotification.recipientEmail})
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Language:</span>
                  <div className="font-medium text-foreground mt-0.5 uppercase">
                    {selectedNotification.language}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Booking Reference:</span>
                  <div className="font-mono font-medium text-foreground mt-0.5">
                    {selectedNotification.bookingReference || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {selectedNotification.bookingCategory || "General"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Provider Message ID:</span>
                  <div className="font-mono text-xs text-foreground mt-0.5 truncate">
                    {selectedNotification.providerMessageId || "None (Not accepted by provider yet)"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Attempts:</span>
                  <div className="font-medium text-foreground mt-0.5">
                    {selectedNotification.attemptCount} / {selectedNotification.maxAttempts}
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Subject Line
                </span>
                <p className="mt-1 font-medium text-foreground p-2 bg-muted/20 border rounded-md">
                  {selectedNotification.subject}
                </p>
              </div>

              {/* Error block if present */}
              {selectedNotification.lastError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <XCircle className="size-4" />
                    Delivery Error Information
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px]">
                    {selectedNotification.lastError}
                  </pre>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-3 gap-2 text-xs border rounded-lg p-2.5 bg-muted/10">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <div className="font-medium mt-0.5">
                    {new Date(selectedNotification.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Scheduled For:</span>
                  <div className="font-medium mt-0.5">
                    {selectedNotification.scheduledFor
                      ? new Date(selectedNotification.scheduledFor).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                      : "Immediate"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Delivered At:</span>
                  <div className="font-medium mt-0.5">
                    {selectedNotification.sentAt
                      ? new Date(selectedNotification.sentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                      : "Pending"}
                  </div>
                </div>
              </div>

              {/* Payload Data View */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Notification Payload (Render Data)
                </span>
                <pre className="mt-1.5 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-48">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedNotification.payload), null, 2);
                    } catch {
                      return selectedNotification.payload;
                    }
                  })()}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-3 mt-2">
              <span className="text-xs text-muted-foreground font-mono">
                Idempotency Key: {selectedNotification.idempotencyKey || "N/A"}
              </span>
              <div className="flex items-center gap-2">
                {(selectedNotification.status === "FAILED" || selectedNotification.status === "PENDING") && (
                  <Button
                    size="sm"
                    onClick={() => handleRetry(selectedNotification.id)}
                    disabled={retryingId === selectedNotification.id}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    <RefreshCw className={`size-3.5 mr-1.5 ${retryingId === selectedNotification.id ? "animate-spin" : ""}`} />
                    Dispatch Now
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setSelectedNotification(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { useApi } from "./use-api";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Star,
  Eye, RefreshCw, Filter, ShieldCheck, Flag, ArrowRight, CornerDownRight,
} from "lucide-react";
import { ISSUE_CATEGORY_LABELS, MODERATION_REASON_LABELS } from "@/lib/reviews";

interface ReviewsModerationPanelProps {
  title?: string;
  subtitle?: string;
  allowedRole?: string;
}

export function ReviewsModerationPanel({
  title = "Reviews Moderation & Dispute Resolution",
  subtitle = "Audit user reviews, resolve reported content, and uphold platform policy",
}: ReviewsModerationPanelProps) {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<"flagged" | "reports" | "all">("flagged");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [refreshKey, setRefreshKey] = useState(0);

  // Moderate modal state
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [modAction, setModAction] = useState<"REMOVE" | "HIDE" | "PUBLISH">("REMOVE");
  const [modReason, setModReason] = useState<string>("ABUSIVE_LANGUAGE");
  const [modNotes, setModNotes] = useState<string>("");
  const [modSubmitting, setModSubmitting] = useState(false);

  // Resolve report modal state
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [reportAction, setReportAction] = useState<"RESOLVE_REMOVE" | "RESOLVE_KEEP">("RESOLVE_REMOVE");
  const [reportNotes, setReportNotes] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Fetch reviews queue
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "15",
  });
  if (statusFilter !== "ALL") {
    queryParams.set("status", statusFilter);
  } else if (activeTab === "flagged") {
    queryParams.set("status", "FLAGGED");
  }

  const { data, loading, refetch } = useApi<{
    reviews: any[];
    reports: any[];
    totalReviews: number;
    totalReports: number;
    totalPages: number;
  }>(`/admin/reviews?${queryParams.toString()}`, [refreshKey, activeTab, statusFilter, page]);

  async function handleModerateSubmit() {
    if (!selectedReview) return;
    setModSubmitting(true);
    try {
      const nextStatus = modAction === "PUBLISH" ? "PUBLISHED" : modAction === "HIDE" ? "HIDDEN" : "REMOVED";
      await api.patch(`/reviews/${selectedReview.id}`, {
        status: nextStatus,
        moderationReason: nextStatus === "PUBLISHED" ? undefined : modReason,
        moderatorNotes: modNotes || undefined,
      });
      toast({
        title: "Moderation Applied",
        description: `Review is now marked as ${nextStatus}.`,
      });
      setSelectedReview(null);
      setModNotes("");
      refetch();
    } catch (err) {
      toast({
        title: "Action Failed",
        description: err instanceof ApiError ? err.message : "Unable to apply moderation.",
        variant: "destructive",
      });
    } finally {
      setModSubmitting(false);
    }
  }

  async function handleResolveReportSubmit() {
    if (!selectedReport) return;
    setReportSubmitting(true);
    try {
      await api.post(`/admin/reviews/reports/${selectedReport.id}`, {
        action: reportAction,
        moderatorNotes: reportNotes || undefined,
      });
      toast({
        title: "Report Resolved",
        description: reportAction === "RESOLVE_REMOVE"
          ? "Report resolved and review marked as REMOVED."
          : "Report dismissed and review remains visible.",
      });
      setSelectedReport(null);
      setReportNotes("");
      refetch();
    } catch (err) {
      toast({
        title: "Resolution Failed",
        description: err instanceof ApiError ? err.message : "Unable to resolve report.",
        variant: "destructive",
      });
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" />
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { refetch(); setRefreshKey(k => k + 1); }}>
            <RefreshCw className="size-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={activeTab === "flagged" ? "default" : "ghost"}
          onClick={() => { setActiveTab("flagged"); setStatusFilter("ALL"); setPage(1); }}
          className="text-xs h-8"
        >
          <AlertTriangle className="size-3.5 mr-1 text-amber-500" />
          Flagged / Pending Review ({data?.totalReviews || 0})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "reports" ? "default" : "ghost"}
          onClick={() => { setActiveTab("reports"); setPage(1); }}
          className="text-xs h-8"
        >
          <Flag className="size-3.5 mr-1 text-rose-500" />
          User Reports Queue ({data?.totalReports || 0})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "all" ? "default" : "ghost"}
          onClick={() => { setActiveTab("all"); setStatusFilter("ALL"); setPage(1); }}
          className="text-xs h-8"
        >
          <MessageSquare className="size-3.5 mr-1" />
          All Reviews
        </Button>
      </div>

      {/* Filter bar for All Reviews */}
      {activeTab === "all" && (
        <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
          <span className="font-semibold flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" /> Filter Status:
          </span>
          {["ALL", "PUBLISHED", "FLAGGED", "HIDDEN", "REMOVED"].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={statusFilter === st ? "secondary" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => { setStatusFilter(st); setPage(1); }}
            >
              {st}
            </Button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : activeTab === "reports" ? (
        /* REPORTS QUEUE */
        <div className="space-y-3">
          {(!data?.reports || data.reports.length === 0) ? (
            <Card className="p-8 text-center border-dashed">
              <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-sm">No Pending Reports</p>
              <p className="text-xs text-muted-foreground mt-1">
                There are no open visitor reports awaiting moderation at this time.
              </p>
            </Card>
          ) : (
            data.reports.map((report: any) => (
              <Card key={report.id} className="p-0 overflow-hidden border shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-800 text-[11px]">
                          Report: {MODERATION_REASON_LABELS[report.reason as keyof typeof MODERATION_REASON_LABELS] || report.reason}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Target: {report.review?.listing?.name || "Listing"} ({report.review?.listing?.category || ""})
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Reported by <span className="font-medium text-foreground">{report.reporter?.name || "Visitor"}</span> on{" "}
                        {new Date(report.createdAt).toLocaleString()}
                      </p>
                      {report.details && (
                        <p className="text-xs italic bg-muted/50 p-2 rounded border">
                          "{report.details}"
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-xs h-8"
                      onClick={() => {
                        setSelectedReport(report);
                        setReportAction("RESOLVE_REMOVE");
                        setReportNotes("");
                      }}
                    >
                      Resolve Report
                    </Button>
                  </div>

                  {/* Quoted Review */}
                  <div className="bg-muted/30 p-3 rounded-lg border-l-4 border-l-amber-500 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Review by {report.review?.reviewer?.name || "Author"} (★ {report.review?.rating}/5)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Status: <strong className="text-foreground">{report.review?.status}</strong>
                      </span>
                    </div>
                    {report.review?.title && <p className="font-medium">{report.review.title}</p>}
                    <p className="text-muted-foreground line-clamp-3">{report.review?.content}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* REVIEWS LIST (FLAGGED OR ALL) */
        <div className="space-y-3">
          {(!data?.reviews || data.reviews.length === 0) ? (
            <Card className="p-8 text-center border-dashed">
              <ShieldCheck className="size-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-sm">
                {activeTab === "flagged" ? "No Flagged Reviews" : "No Reviews Found"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeTab === "flagged"
                  ? "All reviews comply with automated platform safety checks."
                  : "No reviews match the selected filter criteria."}
              </p>
            </Card>
          ) : (
            data.reviews.map((rev: any) => (
              <Card key={rev.id} className="p-0 overflow-hidden border shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge
                          variant="outline"
                          className={
                            rev.status === "PUBLISHED"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : rev.status === "FLAGGED"
                              ? "border-amber-300 bg-amber-50 text-amber-800 animate-pulse"
                              : rev.status === "HIDDEN"
                              ? "border-purple-300 bg-purple-50 text-purple-800"
                              : "border-rose-300 bg-rose-50 text-rose-800"
                          }
                        >
                          {rev.status}
                        </Badge>
                        <span className="text-xs font-semibold text-primary">
                          {rev.listing?.name} ({rev.listing?.category})
                        </span>
                        {rev.issueCategory && (
                          <Badge variant="secondary" className="text-[10px]">
                            {ISSUE_CATEGORY_LABELS[rev.issueCategory as keyof typeof ISSUE_CATEGORY_LABELS]?.label || rev.issueCategory}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-amber-500">★ {rev.rating}</span>
                        <span>·</span>
                        <span>By {rev.reviewer?.name || "Visitor"}</span>
                        <span>·</span>
                        <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
                        {rev.reports?.length > 0 && (
                          <Badge variant="destructive" className="text-[10px] ml-1">
                            {rev.reports.length} {rev.reports.length === 1 ? "report" : "reports"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          setSelectedReview(rev);
                          setModAction(rev.status === "PUBLISHED" ? "REMOVE" : "PUBLISH");
                          setModReason(rev.moderationReason || "ABUSIVE_LANGUAGE");
                          setModNotes(rev.moderatorNotes || "");
                        }}
                      >
                        Moderate
                      </Button>
                    </div>
                  </div>

                  {/* Title & Content */}
                  <div>
                    {rev.title && <p className="font-semibold text-sm">{rev.title}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{rev.content}</p>
                  </div>

                  {/* Photos */}
                  {rev.photos && rev.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pt-1">
                      {rev.photos.map((url: string, idx: number) => (
                        <img
                          key={idx}
                          src={url}
                          alt="Review attachment"
                          className="size-14 rounded-lg object-cover border"
                        />
                      ))}
                    </div>
                  )}

                  {/* Moderation audit info */}
                  {rev.moderationReason && (
                    <div className="bg-muted/40 p-2 rounded text-[11px] text-muted-foreground flex items-center justify-between border">
                      <span>
                        Reason: <strong>{MODERATION_REASON_LABELS[rev.moderationReason as keyof typeof MODERATION_REASON_LABELS] || rev.moderationReason}</strong>
                      </span>
                      {rev.moderator && <span>Moderated by {rev.moderator.name}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
          <span>Page {page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* MODERATE REVIEW DIALOG */}
      {selectedReview && (
        <Dialog open onOpenChange={(o) => !o && !modSubmitting && setSelectedReview(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-primary" />
                Moderate Review
              </DialogTitle>
              <DialogDescription>
                Target listing: <strong>{selectedReview.listing?.name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1 border">
                <p className="font-semibold text-foreground">★ {selectedReview.rating} — {selectedReview.title || "No Title"}</p>
                <p className="text-muted-foreground line-clamp-3">"{selectedReview.content}"</p>
              </div>

              <div>
                <Label className="text-xs font-semibold">Action</Label>
                <Select value={modAction} onValueChange={(v: any) => setModAction(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REMOVE">Remove (Policy Violation)</SelectItem>
                    <SelectItem value="HIDE">Hide Temporarily</SelectItem>
                    <SelectItem value="PUBLISH">Publish / Restore to Public View</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {modAction !== "PUBLISH" && (
                <div>
                  <Label className="text-xs font-semibold">Policy Violation Reason</Label>
                  <Select value={modReason} onValueChange={setModReason}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MODERATION_REASON_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    *Platform Policy: Legitimate criticism and negative feedback must remain visible unless a violation exists.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold">Moderator Notes (Audit Log)</Label>
                <Textarea
                  value={modNotes}
                  onChange={(e) => setModNotes(e.target.value)}
                  placeholder="State the rationale for audit compliance..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelectedReview(null)} disabled={modSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={handleModerateSubmit}
                disabled={modSubmitting}
                className={modAction === "REMOVE" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
              >
                {modSubmitting ? "Applying..." : "Confirm Moderation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* RESOLVE REPORT DIALOG */}
      {selectedReport && (
        <Dialog open onOpenChange={(o) => !o && !reportSubmitting && setSelectedReport(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="size-5 text-rose-600" />
                Resolve User Report
              </DialogTitle>
              <DialogDescription>
                Report reason: <strong>{MODERATION_REASON_LABELS[selectedReport.reason as keyof typeof MODERATION_REASON_LABELS] || selectedReport.reason}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1 border">
                <p className="font-semibold text-foreground">Reported Review:</p>
                <p className="text-muted-foreground line-clamp-3">"{selectedReport.review?.content}"</p>
              </div>

              <div>
                <Label className="text-xs font-semibold">Decision</Label>
                <Select value={reportAction} onValueChange={(v: any) => setReportAction(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESOLVE_REMOVE">Uphold Report & Remove Review (Policy Violation)</SelectItem>
                    <SelectItem value="RESOLVE_KEEP">Dismiss Report & Keep Review Published (Legitimate Feedback)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Resolution Notes</Label>
                <Textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Document resolution findings for audit log..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelectedReport(null)} disabled={reportSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={handleResolveReportSubmit}
                disabled={reportSubmitting}
                className={reportAction === "RESOLVE_REMOVE" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
              >
                {reportSubmitting ? "Resolving..." : "Submit Decision"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

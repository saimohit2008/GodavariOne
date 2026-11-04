"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useApi } from "./use-api";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Star, MessageSquare, Plus, ThumbsUp, Flag, Trash2, Edit2, ShieldAlert,
  AlertTriangle, CheckCircle2, MoreVertical, ShieldCheck, Eye, EyeOff, RefreshCw,
  Camera, Image as ImageIcon,
} from "lucide-react";
import {
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_LABELS,
  MODERATION_REASONS,
  MODERATION_REASON_LABELS,
  type IssueCategory,
  type ModerationReason,
} from "@/lib/reviews";

interface ReviewItem {
  id: string;
  listingId: string;
  rating: number;
  title?: string | null;
  content: string;
  issueCategory?: string | null;
  photos: string[];
  status: string;
  isFlagged: boolean;
  flagReason?: string;
  moderationReason?: string;
  reviewerName: string;
  isAuthor: boolean;
  reportsCount?: number;
  createdAt: string;
  updatedAt?: string;
}

interface ReviewsApiResponse {
  listingId: string;
  listingName: string;
  category: string;
  summary: {
    averageRating: number;
    totalReviews: number;
    ratingCounts: Record<number, number>;
    issueCounts: Record<string, number>;
  };
  items: ReviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  userReview?: {
    id: string;
    rating: number;
    title?: string | null;
    content: string;
    issueCategory?: string | null;
    photos: string[];
    status: string;
    createdAt: string;
  } | null;
}

export function ReviewsSection({
  listingId,
  listingName,
  category,
}: {
  listingId: string;
  listingName: string;
  category: string;
}) {
  const { lang, user, navigate } = useApp();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal dialog states
  const [writeDialogOpen, setWriteDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);
  const [reportTarget, setReportTarget] = useState<ReviewItem | null>(null);
  const [moderateTarget, setModerateTarget] = useState<ReviewItem | null>(null);

  const queryUrl = `/listings/${listingId}/reviews?page=${page}&limit=10&sort=${sort}${
    categoryFilter !== "ALL" ? `&issueCategory=${categoryFilter}` : ""
  }`;

  const { data, loading, refetch } = useApi<ReviewsApiResponse>(queryUrl, [page, sort, categoryFilter, refreshKey]);

  const canModerate = Boolean(
    user && (
      user.role === "SUPER_ADMIN" ||
      user.role === "BUSINESS_OWNER" ||
      user.role === "GHAT_SUPERVISOR"
    )
  );

  async function handleDeleteOwnReview(reviewId: string) {
    if (!confirm("Are you sure you want to delete your review?")) return;
    try {
      await api.del(`/reviews/${reviewId}`);
      toast({ title: "Review Deleted", description: "Your review was successfully removed." });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "Error deleting review", variant: "destructive" });
    }
  }

  return (
    <Card className="p-0 border-border shadow-sm overflow-hidden" id="reviews-section">
      <CardHeader className="p-6 bg-muted/20 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <CardTitle className="text-xl font-bold">
              {category === "GHAT" ? "Ghat Pilgrim Reviews & Safety Feedback" : "Visitor Reviews & Community Feedback"}
            </CardTitle>
          </div>
          <CardDescription className="mt-1">
            Authentic experiences, hygiene feedback, and crowd updates shared by pilgrims and visitors.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              if (!user) {
                navigate({ name: "login" });
              } else {
                setEditingReview(data?.userReview || null);
                setWriteDialogOpen(true);
              }
            }}
          >
            <Plus className="size-4 mr-1.5" />
            {data?.userReview ? "Edit Your Review" : "Write a Review"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Rating Breakdown & Summary Metrics */}
        {data?.summary && (
          <div className="grid md:grid-cols-3 gap-6 p-5 bg-card border rounded-xl shadow-xs">
            {/* Big Star & Avg Score */}
            <div className="flex flex-col items-center justify-center text-center p-3 border-b md:border-b-0 md:border-r border-border/80">
              <span className="text-4xl font-extrabold text-foreground tracking-tight">
                {data.summary.totalReviews > 0 ? data.summary.averageRating.toFixed(1) : "—"}
              </span>
              <div className="flex items-center gap-1 my-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`size-4 ${
                      data.summary.averageRating >= star
                        ? "fill-amber-400 text-amber-400"
                        : data.summary.averageRating >= star - 0.5
                        ? "fill-amber-400/50 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Based on {data.summary.totalReviews} verified {data.summary.totalReviews === 1 ? "review" : "reviews"}
              </p>
            </div>

            {/* 1-5 Star Progress Bars */}
            <div className="space-y-1.5 text-xs md:col-span-2 flex flex-col justify-center">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = data.summary.ratingCounts[stars] || 0;
                const percent = data.summary.totalReviews > 0 ? (count / data.summary.totalReviews) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="w-12 font-medium flex items-center gap-1 text-muted-foreground">
                      {stars} <Star className="size-3 fill-amber-400 text-amber-400" />
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-muted-foreground font-mono">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Issue Category Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={categoryFilter === "ALL" ? "default" : "outline"}
              className="h-7 text-xs rounded-full px-3"
              onClick={() => { setCategoryFilter("ALL"); setPage(1); }}
            >
              All Feedback
            </Button>
            {ISSUE_CATEGORIES.map((cat) => {
              const count = data?.summary.issueCounts?.[cat] || 0;
              const meta = ISSUE_CATEGORY_LABELS[cat];
              return (
                <Button
                  key={cat}
                  size="sm"
                  variant={categoryFilter === cat ? "default" : "outline"}
                  className="h-7 text-xs rounded-full px-3"
                  onClick={() => { setCategoryFilter(cat); setPage(1); }}
                >
                  {lang === "te" ? meta.teLabel : meta.label} {count > 0 && `(${count})`}
                </Button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-xs text-muted-foreground">Sort:</Label>
            <Select value={sort} onValueChange={(s) => { setSort(s); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest_rating">Highest Rated</SelectItem>
                <SelectItem value="lowest_rating">Lowest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User's existing review banner if applicable */}
        {data?.userReview && (
          <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-sky-100 text-sky-800 text-[11px] font-semibold">Your Review</Badge>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`size-3.5 ${s <= data.userReview!.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
              </div>
              {data.userReview.title && <p className="font-semibold text-sm mt-1">{data.userReview.title}</p>}
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{data.userReview.content}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setEditingReview(data.userReview);
                  setWriteDialogOpen(true);
                }}
              >
                <Edit2 className="size-3 mr-1" /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => handleDeleteOwnReview(data.userReview!.id)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Reviews List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : data?.items?.length ? (
          <div className="space-y-4">
            {data.items.map((rev) => {
              const issueMeta = rev.issueCategory ? ISSUE_CATEGORY_LABELS[rev.issueCategory as IssueCategory] : null;

              return (
                <div
                  key={rev.id}
                  className={`border rounded-xl p-4.5 bg-card transition-colors shadow-2xs space-y-3 ${
                    rev.status === "HIDDEN" || rev.status === "REMOVED"
                      ? "opacity-75 border-dashed border-amber-300 bg-amber-50/20"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 text-primary font-bold grid place-items-center text-sm shrink-0">
                        {rev.reviewerName[0]?.toUpperCase() || "V"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground">{rev.reviewerName}</p>
                          {rev.isAuthor && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4 text-primary border-primary/30">
                              You
                            </Badge>
                          )}
                          {rev.status !== "PUBLISHED" && (
                            <Badge variant="destructive" className="text-[10px] py-0 h-4">
                              {rev.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`size-3.5 ${
                                  s <= rev.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(rev.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {issueMeta && (
                        <Badge variant="secondary" className="text-[11px] font-normal hidden sm:inline-flex">
                          {lang === "te" ? issueMeta.teLabel : issueMeta.label}
                        </Badge>
                      )}
                      {user && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setReportTarget(rev)}
                            title="Report Review"
                          >
                            <Flag className="size-3.5 mr-1" /> Report
                          </Button>
                          {canModerate && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs text-amber-700 hover:text-amber-800"
                              onClick={() => setModerateTarget(rev)}
                              title="Moderation Controls"
                            >
                              <ShieldCheck className="size-3.5 mr-1" /> Moderate
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {rev.title && <h4 className="font-semibold text-sm text-foreground">{rev.title}</h4>}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{rev.content}</p>

                  {/* Attached Photographs Gallery */}
                  {rev.photos && rev.photos.length > 0 && (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {rev.photos.map((p, idx) => (
                        <a
                          key={idx}
                          href={p}
                          target="_blank"
                          rel="noreferrer"
                          className="size-16 rounded-lg overflow-hidden border bg-muted block hover:opacity-85 transition-opacity"
                        >
                          <img src={p} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Moderator banner if flagged / removed */}
                  {(rev.isFlagged || rev.status !== "PUBLISHED") && (rev.flagReason || rev.moderationReason) && (
                    <div className="text-[11px] p-2 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded text-amber-800 dark:text-amber-300">
                      {rev.isFlagged && <p>⚠️ Flagged for moderation: {rev.flagReason}</p>}
                      {rev.moderationReason && <p>🛡️ Moderation reason: {rev.moderationReason}</p>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-xs text-muted-foreground">
                  Page {data.page} of {data.totalPages} ({data.total} reviews)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-10 border border-dashed rounded-xl text-center space-y-2">
            <MessageSquare className="size-8 mx-auto text-muted-foreground/40" />
            <p className="font-medium text-sm text-foreground">No reviews yet.</p>
            <p className="text-xs text-muted-foreground">
              Be the first to share your experience, helpful tips, or facility feedback!
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                if (!user) navigate({ name: "login" });
                else setWriteDialogOpen(true);
              }}
            >
              Write First Review
            </Button>
          </div>
        )}
      </CardContent>

      {/* Write / Edit Review Modal */}
      {writeDialogOpen && (
        <WriteReviewDialog
          listingId={listingId}
          listingName={listingName}
          category={category}
          initialReview={editingReview}
          onClose={() => { setWriteDialogOpen(false); setEditingReview(null); }}
          onSuccess={() => {
            setWriteDialogOpen(false);
            setEditingReview(null);
            setRefreshKey((k) => k + 1);
            refetch();
          }}
        />
      )}

      {/* Report Review Modal */}
      {reportTarget && (
        <ReportReviewDialog
          review={reportTarget}
          onClose={() => setReportTarget(null)}
          onSuccess={() => {
            setReportTarget(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* Moderate Review Modal */}
      {moderateTarget && (
        <ModerateReviewDialog
          review={moderateTarget}
          onClose={() => setModerateTarget(null)}
          onSuccess={() => {
            setModerateTarget(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 1. Write / Edit Review Dialog
// ---------------------------------------------------------------------------
function WriteReviewDialog({
  listingId,
  listingName,
  category,
  initialReview,
  onClose,
  onSuccess,
}: {
  listingId: string;
  listingName: string;
  category: string;
  initialReview?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState<number>(initialReview?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [title, setTitle] = useState<string>(initialReview?.title || "");
  const [content, setContent] = useState<string>(initialReview?.content || "");
  const [issueCategory, setIssueCategory] = useState<string>(initialReview?.issueCategory || "GENERAL");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>(initialReview?.photos || []);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function addPhoto() {
    if (!photoUrl.trim()) return;
    if (photos.length >= 6) {
      toast({ title: "Limit reached", description: "You can attach at most 6 photographs.", variant: "destructive" });
      return;
    }
    setPhotos([...photos, photoUrl.trim()]);
    setPhotoUrl("");
  }

  function removePhoto(idx: number) {
    setPhotos(photos.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setErrorMsg("");
    if (!rating || rating < 1 || rating > 5) {
      setErrorMsg("Please select a star rating from 1 to 5.");
      return;
    }
    if (content.trim().length < 10) {
      setErrorMsg("Please write at least 10 characters describing your experience.");
      return;
    }

    setSubmitting(true);
    try {
      if (initialReview?.id) {
        // Edit existing review
        await api.patch(`/reviews/${initialReview.id}`, {
          rating,
          title: title.trim() || null,
          content: content.trim(),
          issueCategory: issueCategory || null,
          photos,
        });
        toast({ title: "Review Updated", description: "Your changes have been saved." });
      } else {
        // Submit new review
        const res = await api.post<any>(`/listings/${listingId}/reviews`, {
          rating,
          title: title.trim() || null,
          content: content.trim(),
          issueCategory: issueCategory || null,
          photos,
        });
        toast({ title: "Review Submitted", description: res.message || "Thank you for sharing your feedback!" });
      }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-5 text-amber-500 fill-amber-400" />
            {initialReview ? "Edit Your Review" : `Review ${listingName}`}
          </DialogTitle>
          <DialogDescription>
            {category === "GHAT"
              ? "Share your feedback regarding cleanliness, bathing safety, overcrowding, and amenities at this ghat."
              : "Share your rating, cleanliness comments, service quality, and photos with fellow visitors."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
              {errorMsg}
            </div>
          )}

          {/* Star Rating Selector */}
          <div>
            <Label className="text-xs font-semibold">Overall Rating *</Label>
            <div className="flex items-center gap-1.5 mt-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 hover:scale-115 transition-transform"
                >
                  <Star
                    className={`size-7 ${
                      (hoverRating || rating) >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-semibold ml-2 text-muted-foreground">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </span>
            </div>
          </div>

          {/* Feedback Topic / Issue Category */}
          <div>
            <Label className="text-xs font-semibold">Primary Experience or Issue Category</Label>
            <Select value={issueCategory} onValueChange={setIssueCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {ISSUE_CATEGORY_LABELS[cat].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div>
            <Label className="text-xs font-semibold">Review Title (Optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Great morning bathing experience, well managed"
              maxLength={120}
              className="mt-1"
            />
          </div>

          {/* Detailed Feedback Text */}
          <div>
            <Label className="text-xs font-semibold">Your Detailed Feedback *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your visit, hygiene, safety, crowd levels, staff behaviour, or any problems encountered..."
              rows={4}
              maxLength={2000}
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground text-right mt-0.5">
              {content.length}/2000 characters (min 10)
            </p>
          </div>

          {/* Photographs attachment */}
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Camera className="size-3.5 text-primary" /> Optional Photographs (Max 6)
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="Paste image URL or /uploads/..."
                className="text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={addPhoto}>
                Add
              </Button>
            </div>
            {photos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative size-14 rounded-md overflow-hidden border bg-muted group">
                    <img src={p} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="size-4 text-rose-300" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : initialReview ? "Save Changes" : "Publish Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 2. Report Review Dialog
// ---------------------------------------------------------------------------
function ReportReviewDialog({
  review,
  onClose,
  onSuccess,
}: {
  review: ReviewItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState<ModerationReason>("ABUSIVE_LANGUAGE");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleReport() {
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await api.post<any>(`/reviews/${review.id}/report`, {
        reason,
        details: details.trim() || null,
      });
      toast({
        title: "Report Submitted",
        description: res.message || "Thank you. Our moderation team has been notified.",
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to report review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Flag className="size-5" /> Report Inappropriate Review
          </DialogTitle>
          <DialogDescription>
            Flag reviews containing abusive language, harassment, spam, or personal sensitive information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1 border">
            <span className="font-semibold text-foreground">Reported Review:</span>
            <p className="text-muted-foreground italic line-clamp-3">"{review.content}"</p>
          </div>

          <div>
            <Label className="text-xs font-semibold">Violation Category *</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ModerationReason)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODERATION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {MODERATION_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">Additional Details (Optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain why this review violates community safety guidelines..."
              rows={3}
              maxLength={500}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReport} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 3. Moderate Review Dialog (Super Admin / Authorized Staff / Business Owner)
// ---------------------------------------------------------------------------
function ModerateReviewDialog({
  review,
  onClose,
  onSuccess,
}: {
  review: ReviewItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<"PUBLISHED" | "HIDDEN" | "REMOVED">(
    review.status === "PUBLISHED" ? "REMOVED" : "PUBLISHED"
  );
  const [moderationReason, setModerationReason] = useState<ModerationReason>("ABUSIVE_LANGUAGE");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleModerate() {
    setErrorMsg("");
    setSubmitting(true);
    try {
      await api.patch(`/reviews/${review.id}`, {
        status,
        moderationReason: status !== "PUBLISHED" ? moderationReason : null,
      });
      toast({
        title: "Review Moderated",
        description: `Review status changed to ${status}.`,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to moderate review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-amber-600" /> Review Moderation Controls
          </DialogTitle>
          <DialogDescription>
            Authorized staff and business owners may hide or remove policy-violating reviews. Note: legitimate customer criticism cannot be suppressed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1 border">
            <span className="font-semibold text-foreground">Review:</span>
            <p className="text-muted-foreground line-clamp-3">"{review.content}"</p>
          </div>

          <div>
            <Label className="text-xs font-semibold">Moderation Action</Label>
            <Select value={status} onValueChange={(s: any) => setStatus(s)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REMOVED">Remove from Public View (Violation)</SelectItem>
                <SelectItem value="HIDDEN">Temporarily Hide (Under Investigation)</SelectItem>
                <SelectItem value="PUBLISHED">Restore to Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status !== "PUBLISHED" && (
            <div>
              <Label className="text-xs font-semibold">Policy Violation Reason *</Label>
              <Select value={moderationReason} onValueChange={(r: any) => setModerationReason(r)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODERATION_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {MODERATION_REASON_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleModerate} disabled={submitting}>
            {submitting ? "Saving..." : "Apply Moderation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

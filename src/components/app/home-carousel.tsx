"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/lib/store";
import { useApi } from "./use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Pause,
  Play,
} from "lucide-react";

export interface CarouselBannerItem {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl: string;
  destinationUrl?: string | null;
  orderIdx: number;
  contentType?: string;
  ctaLabel?: string | null;
}

export function HomeCarousel() {
  const { lang, navigate } = useApp();
  const { data, loading } = useApi<{ items: CarouselBannerItem[] }>("/carousel");

  const banners = data?.items || [];
  const count = banners.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasReducedMotion, setHasReducedMotion] = useState(false);

  // Position offset state for smooth continuous glide + manual controls
  const offsetRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setHasReducedMotion(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setHasReducedMotion(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  // When count changes or mounted
  useEffect(() => {
    if (count <= 1) return;

    let lastTime = performance.now();
    const speed = 0.045; // pixels per ms (~45px per sec) for smooth gliding

    const loop = (currentTime: number) => {
      const delta = currentTime - lastTime;
      lastTime = currentTime;

      const track = trackRef.current;
      if (track && !isPaused && !userPaused && !isDragging && !hasReducedMotion) {
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0) {
          offsetRef.current += speed * delta;
          if (offsetRef.current >= halfWidth) {
            offsetRef.current -= halfWidth;
          }
          track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;

          // Compute active original banner index for indicators
          const cardWidth = track.firstElementChild?.clientWidth || 400;
          const gap = 16;
          const totalCardSpan = cardWidth + gap;
          const currentCard = Math.floor(offsetRef.current / totalCardSpan) % count;
          setActiveIndex(currentCard);
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [count, isPaused, userPaused, isDragging, hasReducedMotion]);

  // Handle manual navigation forward / backward
  const handleShift = useCallback(
    (direction: "next" | "prev") => {
      const track = trackRef.current;
      if (!track || count <= 1) return;

      const cardWidth = (track.firstElementChild as HTMLElement)?.offsetWidth || 420;
      const gap = 16;
      const step = cardWidth + gap;
      const halfWidth = track.scrollWidth / 2;

      if (direction === "next") {
        offsetRef.current += step;
        if (offsetRef.current >= halfWidth) {
          offsetRef.current -= halfWidth;
        }
      } else {
        offsetRef.current -= step;
        if (offsetRef.current < 0) {
          offsetRef.current += halfWidth;
        }
      }

      track.style.transition = "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)";
      track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;

      setTimeout(() => {
        if (trackRef.current) {
          trackRef.current.style.transition = "none";
        }
      }, 460);

      const nextIdx =
        direction === "next" ? (activeIndex + 1) % count : (activeIndex - 1 + count) % count;
      setActiveIndex(nextIdx);
    },
    [count, activeIndex]
  );

  // Jump to specific indicator
  const handleJumpToIndex = (idx: number) => {
    const track = trackRef.current;
    if (!track || count <= 1) return;
    const cardWidth = (track.firstElementChild as HTMLElement)?.offsetWidth || 420;
    const gap = 16;
    const targetOffset = idx * (cardWidth + gap);
    offsetRef.current = targetOffset;
    track.style.transition = "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)";
    track.style.transform = `translate3d(-${offsetRef.current}px, 0, 0)`;
    setTimeout(() => {
      if (trackRef.current) trackRef.current.style.transition = "none";
    }, 460);
    setActiveIndex(idx);
  };

  // Touch / Pointer gesture handlers for mobile & desktop drag
  const onPointerDown = (e: React.PointerEvent) => {
    if (count <= 1) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = offsetRef.current;
    if (trackRef.current) trackRef.current.style.transition = "none";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !trackRef.current) return;
    const diff = dragStartXRef.current - e.clientX;
    if (Math.abs(diff) > 5) {
      hasDraggedRef.current = true;
    }
    const track = trackRef.current;
    const halfWidth = track.scrollWidth / 2;
    let newOffset = dragStartOffsetRef.current + diff;
    if (newOffset < 0) newOffset += halfWidth;
    if (newOffset >= halfWidth) newOffset -= halfWidth;
    offsetRef.current = newOffset;
    track.style.transform = `translate3d(-${newOffset}px, 0, 0)`;
  };

  const onPointerUp = () => {
    setIsDragging(false);
  };

  const handleBannerClick = (banner: CarouselBannerItem) => {
    if (hasDraggedRef.current) return; // Ignore clicks if user was dragging
    navigate({ name: "carousel-detail", id: banner.id });
  };

  // If no banners exist and not loading, render null to prevent layout shifts
  if (!loading && count === 0) {
    return null;
  }

  // Multiply banners to ensure seamless loop width
  const renderBanners =
    count === 1
      ? banners
      : count < 4
      ? [...banners, ...banners, ...banners, ...banners] // Clone multiple times for narrow sets
      : [...banners, ...banners]; // Two sets for >=4

  return (
    <section
      aria-label="Homepage Highlight Banners Carousel"
      className="relative w-full max-w-full py-6 sm:py-8 overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background"
    >
      <div className="container mx-auto max-w-7xl px-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 px-2.5 py-1 text-xs font-semibold gap-1.5"
          >
            <Sparkles className="size-3.5 text-primary animate-pulse" />
            {lang === "te" ? "ప్రత్యేక ముఖ్యాంశాలు" : "Featured Highlights"}
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {lang === "te"
              ? "గోదావరి పుష్కరాలు 2027 అప్‌డేట్లు"
              : "Godavari Pushkaralu 2027 Official Updates"}
          </span>
        </div>

        {/* Carousel controls header */}
        {count > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full shadow-xs hover:bg-primary/10"
              onClick={() => setUserPaused(!userPaused)}
              title={userPaused ? "Play sliding animation" : "Pause sliding animation"}
              aria-label={userPaused ? "Play animation" : "Pause animation"}
            >
              {userPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full shadow-xs hover:bg-primary/10"
              onClick={() => handleShift("prev")}
              title="Previous banner"
              aria-label="Previous banner"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full shadow-xs hover:bg-primary/10"
              onClick={() => handleShift("next")}
              title="Next banner"
              aria-label="Next banner"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Main Track Viewport */}
      <div
        ref={containerRef}
        className="w-full max-w-full relative overflow-hidden select-none cursor-grab active:cursor-grabbing px-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => {
          setIsPaused(false);
          setIsDragging(false);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={trackRef}
          className="flex gap-4 w-max items-stretch py-2"
          style={{ willChange: "transform" }}
        >
          {renderBanners.map((banner, index) => {
            const hasLink = Boolean(banner.destinationUrl);
            return (
              <div
                key={`${banner.id}-${index}`}
                onClick={() => handleBannerClick(banner)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBannerClick(banner);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View full details for ${banner.title}`}
                className="group relative shrink-0 rounded-2xl overflow-hidden border border-border/80 bg-card shadow-sm hover:shadow-xl transition-all duration-300 w-[280px] sm:w-[380px] md:w-[460px] lg:w-[500px] flex flex-col cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
              >
                {/* Image Container with high quality aspect ratio */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    loading={index < 3 ? "eager" : "lazy"}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                    onError={(e) => {
                      // Fallback image if broken
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1000&auto=format&fit=crop&q=80";
                    }}
                  />

                  {/* Gradient overlays for high contrast text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

                  {/* Top Badge */}
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/50 backdrop-blur-md text-white border border-white/20">
                      <Sparkles className="size-3 text-amber-300" />
                      Pushkaralu 2027
                    </span>
                  </div>

                  {/* Bottom Text Details */}
                  <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white flex flex-col justify-end">
                    <h3 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white drop-shadow-sm group-hover:text-primary-foreground transition-colors line-clamp-1">
                      {banner.title}
                    </h3>
                    {banner.subtitle && (
                      <p className="text-xs sm:text-sm text-teal-200 line-clamp-1 font-medium mt-0.5 drop-shadow-xs">
                        {banner.subtitle}
                      </p>
                    )}
                    {banner.description && (
                      <p className="text-xs sm:text-sm text-white/80 line-clamp-2 mt-1 drop-shadow-xs font-normal">
                        {banner.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-white/90 group-hover:text-white">
                      <span>{banner.ctaLabel || (lang === "te" ? "మరింత చూడండి" : "View Details")}</span>
                      <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Dot Indicators */}
      {count > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-4">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleJumpToIndex(idx)}
              className={`transition-all duration-300 rounded-full ${
                activeIndex === idx
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
              aria-label={`Go to banner ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

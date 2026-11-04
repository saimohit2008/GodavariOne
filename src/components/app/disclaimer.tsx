"use client";

import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { AlertTriangle, ExternalLink } from "lucide-react";

export function Disclaimer() {
  const { lang } = useApp();

  return (
    <section
      aria-labelledby="site-disclaimer-heading"
      className="w-full my-8 pt-6 border-t"
    >
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] dark:bg-amber-950/20 dark:border-amber-500/20 p-4 sm:p-6 transition-colors shadow-xs">
        <div className="flex items-start gap-3 sm:gap-3.5">
          <span
            className="size-8 sm:size-9 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 grid place-items-center shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <AlertTriangle className="size-4 sm:size-5" />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3
                id="site-disclaimer-heading"
                className="font-bold text-sm sm:text-base text-foreground tracking-tight"
              >
                {t(lang, "disclaimerTitle")}
              </h3>
              <span className="inline-flex items-center text-[10px] sm:text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30">
                {t(lang, "disclaimerBadge")}
              </span>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p>{t(lang, "disclaimerP1")}</p>
              <p>{t(lang, "disclaimerP2")}</p>
              <p className="font-medium text-foreground/80 dark:text-foreground/90">
                {t(lang, "disclaimerP3")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

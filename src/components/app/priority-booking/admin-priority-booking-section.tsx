"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { useApi } from "../use-api";
import { SupervisorPriorityBookingSection } from "./supervisor-priority-booking-section";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminPriorityBookingSection() {
  const { data: ghatsData, loading } = useApi<{ items: any[] }>("/listings?category=GHAT&limit=100");

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const allGhats = ghatsData?.items || [];

  return (
    <div className="space-y-6">
      <SupervisorPriorityBookingSection
        assignedGhats={allGhats}
        isSuperAdmin={true}
      />
    </div>
  );
}

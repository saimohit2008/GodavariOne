"use client";

import { use } from "react";
import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { CarouselDetailView } from "@/components/app/views/carousel-detail-view";

export default function CarouselDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col">
        <CarouselDetailView id={resolvedParams.id} />
      </main>
      <Footer />
    </div>
  );
}

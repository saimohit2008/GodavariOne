import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE_URL = "https://godavari-one.vercel.app";

// Revalidate sitemap dynamically every hour
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/nri-access`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  try {
    // Fetch active, published carousel highlights and festival features
    const publishedCarousels = await db.carouselBanner.findMany({
      where: {
        isEnabled: true,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: {
        orderIdx: "asc",
      },
    });

    for (const banner of publishedCarousels) {
      routes.push({
        url: `${BASE_URL}/carousel/${banner.id}`,
        lastModified: banner.updatedAt ? new Date(banner.updatedAt) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.warn("[sitemap] Failed to query dynamic carousel items:", error);
  }

  return routes;
}


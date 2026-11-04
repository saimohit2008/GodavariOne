import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler } from "@/lib/validation";

// GET /api/v1/nri/providers
export const GET = handler(async (req: NextRequest) => {
  const providers = await db.user.findMany({
    where: {
      role: "BUSINESS_OWNER",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      listingsOwned: {
        where: { publicationStatus: "PUBLISHED" },
        select: {
          id: true,
          name: true,
          category: true,
          address: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ok({
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name || p.phone,
      phone: p.phone,
      email: p.email,
      businessCount: p.listingsOwned.length,
      categories: [...new Set(p.listingsOwned.map((l) => l.category))],
      listings: p.listingsOwned.map((l) => ({ id: l.id, name: l.name, category: l.category })),
    })),
  });
});

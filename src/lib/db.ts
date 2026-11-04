import { PrismaClient as SqlitePrismaClient } from '@prisma/client'
import { PrismaClient as PgPrismaClient } from '@prisma/client-pg'

import path from 'node:path'
import fs from 'node:fs'

type AppPrismaClient = SqlitePrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: AppPrismaClient | undefined;
  prismaUrl: string | undefined;
};

export function isPostgresDatabase(): boolean {
  const url = process.env.DATABASE_URL || "";
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

/**
 * Cross-database case-insensitive search filter helper.
 * On PostgreSQL, Prisma requires `{ contains: query, mode: "insensitive" }` for case-insensitivity.
 * On SQLite, Prisma throws an error if `mode` is passed because SQLite LIKE is case-insensitive by default.
 * This helper returns the correct filter structure based on the active database runtime.
 */
export function containsInsensitive(query: string): any {
  if (isPostgresDatabase()) {
    return { contains: query, mode: "insensitive" };
  }
  return { contains: query };
}

function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) {
    if (envUrl.startsWith("file:")) {
      const rawPath = envUrl.slice(5);
      if (!path.isAbsolute(rawPath)) {
        const fromPrisma = path.resolve(process.cwd(), "prisma", rawPath);
        if (fs.existsSync(fromPrisma)) {
          return "file:" + fromPrisma.replace(/\\/g, "/");
        }
        const fromCwd = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath);
        return "file:" + fromCwd.replace(/\\/g, "/");
      }
      return "file:" + rawPath.replace(/\\/g, "/");
    }

    // PostgreSQL connection string optimization for Supabase pooler stability
    if (envUrl.startsWith("postgres://") || envUrl.startsWith("postgresql://")) {
      try {
        const parsed = new URL(envUrl);
        if (parsed.port === "6543" && !parsed.searchParams.has("pgbouncer")) {
          parsed.searchParams.set("pgbouncer", "true");
        } else if (parsed.port === "5432" && parsed.searchParams.has("pgbouncer")) {
          parsed.searchParams.delete("pgbouncer");
        }
        if (!parsed.searchParams.has("connection_limit")) {
          parsed.searchParams.set("connection_limit", "10");
        }
        if (!parsed.searchParams.has("connect_timeout")) {
          parsed.searchParams.set("connect_timeout", "30");
        }
        if (!parsed.searchParams.has("pool_timeout")) {
          parsed.searchParams.set("pool_timeout", "30");
        }
        return parsed.toString();
      } catch {
        return envUrl;
      }
    }
    return envUrl;
  }
  return "file:" + path.resolve(process.cwd(), "db/custom.db").replace(/\\/g, "/");
}

// Auto-recreate client if model is missing after schema updates or URL changes
function getClient(): AppPrismaClient {
  const desiredUrl = getDatabaseUrl();
  let client = globalForPrisma.prisma;
  const currentUrl = globalForPrisma.prismaUrl;

  if (!client || currentUrl !== desiredUrl || !("homepageContentItem" in (client as any))) {
    const isPg = isPostgresDatabase();
    if (isPg) {
      client = new PgPrismaClient({
        datasources: { db: { url: desiredUrl } },
      }) as unknown as AppPrismaClient;
    } else {
      client = new SqlitePrismaClient({
        datasources: { db: { url: desiredUrl } },
      });
    }
    globalForPrisma.prisma = client;
    globalForPrisma.prismaUrl = desiredUrl;
  }
  return client!;
}

export const db: AppPrismaClient = new Proxy({} as AppPrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});
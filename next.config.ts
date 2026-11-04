import type { NextConfig } from "next";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "godavari-uploads";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/@prisma/client/**/*",
      "./node_modules/@prisma/client-pg/**/*",
      "./node_modules/.prisma/**/*",
    ],
  },
  reactStrictMode: false,

  // Remote image patterns for Next.js Image Optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  // Rewrites: transparently proxy /uploads/:path* to Supabase Storage in production
  // when local files do not exist in public/uploads.
  async rewrites() {
    if (supabaseUrl && process.env.OBJECT_STORAGE_PROVIDER === "supabase") {
      return [
        {
          source: "/uploads/:path*",
          destination: `${supabaseUrl}/storage/v1/object/public/${bucketName}/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;

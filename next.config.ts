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

  // Security Headers for Production Deployment Hardening
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Client-Platform, X-Godavari-Client",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

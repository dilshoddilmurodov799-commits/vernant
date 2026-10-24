import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Profile photo uploads (8 MB max, checked again in the action) go through a server action.
    serverActions: { bodySizeLimit: "9mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Demo imagery only (seeded stock photos). Real user media will be served
    // from Supabase Storage via short-lived signed URLs — see docs/ARCHITECTURE.md.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;

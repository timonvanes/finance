import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep visited/prefetched pages in the client for a minute so switching
    // tabs back and forth doesn't wait on the server each time. Mutations
    // call router.refresh(), which clears this cache.
    staleTimes: { dynamic: 60, static: 60 },
    // Default is 1MB — a raw phone camera photo blows past that instantly.
    // The receipt scanner compresses client-side before upload, but this is
    // headroom for anything that doesn't (e.g. a very large PDF/photo).
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;

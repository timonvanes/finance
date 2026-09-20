import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep visited/prefetched pages in the client for a minute so switching
    // tabs back and forth doesn't wait on the server each time. Mutations
    // call router.refresh(), which clears this cache.
    staleTimes: { dynamic: 60, static: 60 },
  },
};

export default nextConfig;

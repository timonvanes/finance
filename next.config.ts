import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The camera is used to scan receipts, nothing else is needed.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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

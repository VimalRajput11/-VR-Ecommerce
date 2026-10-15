import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the project root (a stray lockfile in a parent folder otherwise confuses tracing).
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      // Gallery/service uploads stored in Vercel Blob
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The previous VR Nails store pages now point to their salon equivalents.
  async redirects() {
    return [
      { source: "/shop", destination: "/services", permanent: true },
      { source: "/collections/:path*", destination: "/services", permanent: true },
      { source: "/product/:id", destination: "/services", permanent: true },
      { source: "/cart", destination: "/book", permanent: true },
      { source: "/checkout", destination: "/book", permanent: true },
      { source: "/order-success", destination: "/account", permanent: true },
      { source: "/wishlist", destination: "/services", permanent: true },
      { source: "/custom-order", destination: "/contact", permanent: true },
      { source: "/shipping", destination: "/policies", permanent: true },
      { source: "/size-guide", destination: "/faq", permanent: true },
    ];
  },
};

export default nextConfig;

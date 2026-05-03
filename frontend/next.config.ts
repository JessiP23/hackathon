import type { NextConfig } from "next";

/** Proxy Stripe Connect return/refresh to the API (links embed these URLs at creation time). */
const apiBase = (
  process.env.BACKEND_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
)
  .trim()
  .replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiBase) return [];
    return [
      {
        source: "/stripe/connect/:path*",
        destination: `${apiBase}/stripe/connect/:path*`,
      },
    ];
  },
};

export default nextConfig;

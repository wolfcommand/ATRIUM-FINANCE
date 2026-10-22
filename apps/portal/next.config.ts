import type { NextConfig } from "next";

const API_ORIGIN = process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${API_ORIGIN}/v1/:path*`,
      },
      {
        source: "/health-api",
        destination: `${API_ORIGIN}/health`,
      },
    ];
  },
};

export default nextConfig;

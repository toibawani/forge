import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers will be expanded in production
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;

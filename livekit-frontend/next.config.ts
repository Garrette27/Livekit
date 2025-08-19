import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false, // Enable ESLint during builds
  },
  typescript: {
    ignoreBuildErrors: false, // Enable TypeScript checking during builds
  },
  // Keep config minimal and valid for Next 15
  experimental: {
    forceSwcTransforms: true,
  },
  compiler: {
    removeConsole: false,
  },
  webpack: (config) => config,
  poweredByHeader: false,
  generateEtags: false,
};

export default nextConfig;

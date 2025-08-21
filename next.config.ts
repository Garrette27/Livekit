import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Ignore ESLint during builds to prevent console statement warnings from failing the build
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

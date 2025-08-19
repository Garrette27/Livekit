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
  // Disable static generation to prevent Firebase build-time errors
  output: 'standalone',
  trailingSlash: false,
  // Force all pages to be dynamic
  generateStaticParams: async () => [],
};

export default nextConfig;

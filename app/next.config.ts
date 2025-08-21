import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    position: 'bottom-right',
  },
  output: 'standalone',
  images: {
    domains: ['trjkxgkbkyzthrgkbwfe.supabase.co', 'ihzcmpngyjxraxzmckiv.supabase.co', 'images.unsplash.com', 'replicate.delivery'],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['friendly-space-spork-9769rx65q5gjh74-3000.app.github.dev', 'localhost:3000'],
    },
  },
  webpack: (config: any) => {
    // Handle pdf-parse module properly
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    
    // Ignore node-specific modules on client side
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    
    return config;
  },
  eslint: {
    // Disable ESLint during builds for deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Enable builds even with TypeScript errors (for deployment)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

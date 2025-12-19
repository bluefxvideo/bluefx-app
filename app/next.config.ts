import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    position: 'bottom-right',
  },
  output: 'standalone',
  images: {
    domains: ['trjkxgkbkyzthrgkbwfe.supabase.co', 'ihzcmpngyjxraxzmckiv.supabase.co', 'images.unsplash.com', 'replicate.delivery', 'oaidalleapiprodscus.blob.core.windows.net'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
    minimumCacheTTL: 86400, // 24 hours cache
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'friendly-space-spork-9769rx65q5gjh74-3000.app.github.dev',
        'localhost:3000',
        'app.bluefx.net',
        'bluefx.net',
        'www.bluefx.net'
      ],
      bodySizeLimit: '500mb', // Increased to handle video/audio uploads for transcription
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

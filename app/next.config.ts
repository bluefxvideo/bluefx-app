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
    middlewareClientMaxBodySize: '500mb',
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
    // Builds FAIL on TypeScript errors. This was true (ignored) for a long time
    // and let genuinely broken code ship to production (e.g. unterminated strings
    // rendering broken UI). The codebase was brought to 0 errors on 2026-06 —
    // keep it that way; do not flip this back to true.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

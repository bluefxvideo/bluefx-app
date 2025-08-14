import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    position: 'bottom-right',
  },
  output: 'standalone',
  images: {
    domains: ['trjkxgkbkyzthrgkbwfe.supabase.co', 'ihzcmpngyjxraxzmckiv.supabase.co', 'images.unsplash.com'],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['friendly-space-spork-9769rx65q5gjh74-3000.app.github.dev', 'localhost:3000'],
    },
  },
};

export default nextConfig;

# Multi-stage build for BlueFx Next.js app
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy package files
COPY app/package*.json ./
COPY app/yarn.lock* ./

# Install dependencies - use npm install to get correct platform binaries
RUN npm install --legacy-peer-deps --omit=dev

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY app/package*.json ./
COPY app/yarn.lock* ./
# Use npm install instead of npm ci to resolve correct platform-specific binaries
RUN npm install --legacy-peer-deps

COPY app/ .

# Set build-time environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_VIDEO_EDITOR_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG PERPLEXITY_API_KEY
ARG PEXELS_API_KEY
ARG OPENAI_API_KEY
ARG REPLICATE_API_TOKEN
ARG HEDRA_API_KEY
ARG YOUTUBE_API_KEY
ARG SIEVE_API_KEY
ARG SHOTSTACK_API_KEY
ARG RAPIDAPI_KEY
ARG ENABLE_AI_FEATURES
ARG ZAPIER_WEBHOOK_SECRET
ARG CLICKBANK_PRODUCT_ID
ARG GOOGLE_GEMENI_API_KEY
ARG GOOGLE_GENERATIVE_AI_API_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_VIDEO_EDITOR_URL=$NEXT_PUBLIC_VIDEO_EDITOR_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY
ENV PEXELS_API_KEY=$PEXELS_API_KEY
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV REPLICATE_API_TOKEN=$REPLICATE_API_TOKEN
ENV HEDRA_API_KEY=$HEDRA_API_KEY
ENV YOUTUBE_API_KEY=$YOUTUBE_API_KEY
ENV SIEVE_API_KEY=$SIEVE_API_KEY
ENV SHOTSTACK_API_KEY=$SHOTSTACK_API_KEY
ENV RAPIDAPI_KEY=$RAPIDAPI_KEY
ENV ENABLE_AI_FEATURES=$ENABLE_AI_FEATURES
ENV ZAPIER_WEBHOOK_SECRET=$ZAPIER_WEBHOOK_SECRET
ENV CLICKBANK_PRODUCT_ID=$CLICKBANK_PRODUCT_ID
ENV GOOGLE_GEMENI_API_KEY=$GOOGLE_GEMENI_API_KEY
ENV GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Runtime environment variables (these will be overridden by Coolify's env vars)
# Coolify prefixes env vars with APP_ so we support both naming conventions
ENV RAPIDAPI_KEY=""
ENV APP_RAPIDAPI_KEY=""

# Install yt-dlp and its dependencies for YouTube transcript fetching
# Deno is optional for yt-dlp (only needed for some JS challenges) - skip if install fails
RUN apk add --no-cache python3 py3-pip ffmpeg curl \
    && pip3 install --break-system-packages yt-dlp \
    && (curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh || echo "Deno install failed, continuing without it")

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create temp directory with proper permissions for yt-dlp
RUN mkdir -p /tmp/yt-dlp && chmod 777 /tmp/yt-dlp

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
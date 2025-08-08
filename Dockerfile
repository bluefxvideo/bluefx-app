# Multi-stage build for BlueFx Next.js app
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/bluefx

# Copy package files
COPY bluefx/package*.json ./
COPY bluefx/yarn.lock* ./

# Install dependencies
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app/bluefx

COPY bluefx/package*.json ./
COPY bluefx/yarn.lock* ./
RUN npm ci

COPY bluefx/ .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/bluefx/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/bluefx/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/bluefx/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
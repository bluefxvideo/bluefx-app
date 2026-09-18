FROM node:22-alpine

# ffmpeg is still needed for silence detection on the uploaded MP3
# (the browser handles video → audio extraction; the worker only silencedetects)
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx typescript

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --spider -q http://localhost:3003/health || exit 1

CMD ["npx", "tsx", "src/server.ts"]

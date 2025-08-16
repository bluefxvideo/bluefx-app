FROM node:22-bookworm-slim

# Install Chrome dependencies and other required packages for Remotion
RUN apt-get update && apt-get install -y \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (include dev dependencies for CLI tools)
RUN npm install

# Copy source code
COPY . .

# Create output directories
RUN mkdir -p output output_local && \
    chmod -R 755 output output_local

# Create volume mount points
VOLUME ["/app/output", "/app/output_local"]

# Expose port
EXPOSE 3001

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start server
CMD ["npm", "start"] 
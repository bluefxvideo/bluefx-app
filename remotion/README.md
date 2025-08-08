# Remotion Server-Side Rendering (SSR) Setup

This project demonstrates how to set up Remotion for server-side rendering on Node.js, enabling programmatic video generation through REST APIs.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 3. Test the API

Visit `http://localhost:3000` to see the API documentation, or test with curl:

```bash
# Render a video
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "compositionId": "MyVideo",
    "inputProps": {
      "titleText": "Hello from API!",
      "titleColor": "blue"
    },
    "codec": "h264",
    "quality": 80
  }'

# Render a still image
curl -X POST http://localhost:3000/render-still \
  -H "Content-Type: application/json" \
  -d '{
    "compositionId": "MyVideo",
    "inputProps": {
      "titleText": "Hello from API!",
      "titleColor": "red"
    },
    "frame": 30,
    "imageFormat": "png"
  }'
```

## 📁 Project Structure

```
remotion-ssr-project/
├── src/
│   ├── index.js          # Remotion root with compositions
│   └── MyVideo.js        # Sample video component
├── output/               # Generated videos and images
├── package.json          # Dependencies and scripts
├── server.js             # Express server with API endpoints
├── render.js             # Standalone render script
└── README.md            # This file
```

## 🔧 API Endpoints

### GET /compositions
List all available compositions

### POST /render
Render a video with the following payload:
```json
{
  "compositionId": "MyVideo",
  "inputProps": {
    "titleText": "Custom Title",
    "titleColor": "blue"
  },
  "codec": "h264",
  "quality": 80
}
```

### POST /render-still
Render a still image:
```json
{
  "compositionId": "MyVideo",
  "inputProps": {
    "titleText": "Custom Title",
    "titleColor": "blue"
  },
  "frame": 30,
  "imageFormat": "png"
}
```

### GET /health
Health check endpoint

## 🎬 Customizing Videos

### Adding New Compositions

1. Create a new React component in `src/`
2. Add it to the compositions in `src/index.js`:

```javascript
<Composition
  id="MyNewVideo"
  component={MyNewVideo}
  durationInFrames={300}
  fps={30}
  width={1920}
  height={1080}
  defaultProps={{
    // your default props
  }}
/>
```

### Using Input Props

Access dynamic props in your components:

```javascript
import { getInputProps } from 'remotion';

export const MyVideo = () => {
  const inputProps = getInputProps();
  
  return (
    <div style={{ color: inputProps.titleColor }}>
      {inputProps.titleText}
    </div>
  );
};
```

## 🐳 Docker Deployment

### Create Dockerfile

```dockerfile
FROM node:18-alpine

# Install dependencies for Remotion
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create output directory
RUN mkdir -p output

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
```

### Build and Run

```bash
docker build -t remotion-ssr .
docker run -p 3000:3000 remotion-ssr
```

## ☁️ Cloud Deployment

### Linux Dependencies

On Linux servers, install these dependencies:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y \
  chromium-browser \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils

# CentOS/RHEL
sudo yum install -y \
  chromium \
  liberation-fonts \
  libappindicator-gtk3 \
  alsa-lib \
  atk \
  gtk3 \
  libdrm \
  libXScrnSaver \
  libXtst \
  xorg-x11-utils
```

### Environment Variables

Set these environment variables for production:

```bash
export NODE_ENV=production
export PORT=3000
export REMOTION_CONCURRENCY=2  # Adjust based on server capacity
```

## 🔄 Alternative Deployment Options

### 1. AWS Lambda (Recommended)
Use `@remotion/lambda` for serverless deployment:

```bash
npm install @remotion/lambda
```

### 2. Google Cloud Run
Use `@remotion/cloudrun` for Cloud Run deployment:

```bash
npm install @remotion/cloudrun
```

### 3. Docker on VPS
Deploy using Docker on any VPS provider like DigitalOcean, Linode, etc.

## 🎯 Performance Tips

1. **Reuse Bundle**: The server caches the Webpack bundle to avoid re-bundling on each request
2. **Concurrency**: Adjust `concurrency` in render options based on your server's CPU
3. **Browser Reuse**: For high-volume rendering, implement browser instance reuse
4. **Resource Limits**: Set appropriate memory and CPU limits in production

## 🐛 Troubleshooting

### Common Issues

1. **Chrome/Chromium not found**: Install Chromium browser on your system
2. **Out of memory**: Reduce concurrency or increase server memory
3. **Slow rendering**: Check CPU usage and optimize your React components
4. **Permission denied**: Ensure proper file permissions for output directory

### Debug Mode

Run with debug logging:

```bash
DEBUG=remotion:* npm start
```

## 📚 Additional Resources

- [Remotion Documentation](https://remotion.dev/docs)
- [Server-Side Rendering Guide](https://remotion.dev/docs/ssr)
- [Remotion Lambda](https://remotion.dev/docs/lambda)
- [Docker Setup](https://remotion.dev/docs/docker)

## 🤝 Contributing

Feel free to submit issues and pull requests to improve this setup!

## 📄 License

This project is licensed under the MIT License. 
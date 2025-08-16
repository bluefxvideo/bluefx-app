import "dotenv/config";
import express from "express";
import cors from "cors";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
  getCompositions,
} from "@remotion/renderer";
import { ensureBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

// ===== PROGRESS TRACKING SYSTEM =====
// In-memory storage for render progress (keeping for backward compatibility)
const renderProgress = new Map();

// Webhook endpoint for real-time progress updates
const WEBHOOK_URL = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1/remotion-progress-webhook`
  : null;

// Send progress update to webhook endpoint
async function sendProgressUpdate(renderId, progressData, userId = null) {
  try {
    // Always store in memory for backward compatibility
    renderProgress.set(renderId, {
      ...progressData,
      lastUpdated: Date.now(),
    });

    // Send to webhook if configured
    if (WEBHOOK_URL) {
      const webhookPayload = {
        renderId,
        progress: progressData.progress,
        renderedFrames: progressData.renderedFrames,
        encodedFrames: progressData.encodedFrames,
        totalFrames: progressData.totalFrames,
        stitchStage: progressData.stage,
        status: progressData.status,
        error: progressData.error,
        videoUrl: progressData.downloadUrl,
        userId,
        timestamp: new Date().toISOString(),
      };

      console.log(`📡 Sending progress update to webhook:`, {
        renderId,
        progress: progressData.progress
          ? `${(progressData.progress * 100).toFixed(1)}%`
          : "N/A",
        status: progressData.status,
        stage: progressData.stage,
      });

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        console.warn(
          `⚠️ Webhook update failed:`,
          response.status,
          response.statusText
        );
      } else {
        console.log(`✅ Webhook progress update sent successfully`);
      }
    }

    // Clean up old progress entries (older than 30 minutes)
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    for (const [id, data] of renderProgress.entries()) {
      if (data.lastUpdated < thirtyMinutesAgo) {
        renderProgress.delete(id);
      }
    }
  } catch (error) {
    console.error("❌ Error sending progress update:", error);
    // Don't fail the render if webhook fails
  }
}

// Store progress for a render (now uses webhook)
function setRenderProgress(renderId, progressData, userId = null) {
  sendProgressUpdate(renderId, progressData, userId);
}

// Get progress for a render (backward compatibility)
function getRenderProgress(renderId) {
  return renderProgress.get(renderId) || null;
}

// Clear progress for a render
function clearRenderProgress(renderId) {
  renderProgress.delete(renderId);
}

// ===== END PROGRESS TRACKING SYSTEM =====

// Ensure browser is available on startup
async function initializeBrowser() {
  try {
    console.log("🌐 Ensuring browser is available...");
    await ensureBrowser();
    console.log("✅ Browser is ready!");
  } catch (error) {
    console.error("❌ Failed to ensure browser:", error);
    console.error("⚠️ Server will continue but rendering may fail");
  }
}

// Initialize browser when server starts
initializeBrowser();

// Middleware - Fixed CORS for multiple origins
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log("🌐 CORS: Allowing request with no origin");
        return callback(null, true);
      }

      // Parse allowed origins from environment variable
      const allowedOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
        : ["http://localhost:5173", "https://ai.bluefx.net"];

      console.log(
        `🌐 CORS check: origin=${origin}, allowed=${allowedOrigins.join(", ")}`
      );

      // Check if origin is allowed
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        console.log(`✅ CORS: Allowing origin: ${origin}`);
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked origin: ${origin}`);
        console.warn(`🔓 Allowed origins: ${allowedOrigins.join(", ")}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    exposedHeaders: ["Content-Length", "Content-Range", "Accept-Ranges"],
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Custom video streaming middleware with proper range request support
function videoStreamMiddleware(req, res, next) {
  const filePath = path.join(process.cwd(), "output", req.path);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Set common headers
  const isVideo = filePath.endsWith(".mp4") || filePath.endsWith(".webm");
  const isImage =
    filePath.endsWith(".png") ||
    filePath.endsWith(".jpg") ||
    filePath.endsWith(".jpeg");

  if (filePath.endsWith(".mp4")) {
    res.set("Content-Type", "video/mp4");
  } else if (filePath.endsWith(".webm")) {
    res.set("Content-Type", "video/webm");
  } else if (filePath.endsWith(".png")) {
    res.set("Content-Type", "image/png");
  } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    res.set("Content-Type", "image/jpeg");
  }

  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.set("Cache-Control", "public, max-age=3600");
  res.set("Accept-Ranges", "bytes");

  // Handle range requests for video streaming
  if (range && isVideo) {
    console.log(`📹 Video range request for ${req.path}: ${range}`);

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Validate range
    if (start >= fileSize || end >= fileSize) {
      res
        .status(416)
        .send("Requested range not satisfiable\n" + start + " >= " + fileSize);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.status(206);
    res.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.set("Content-Length", chunksize.toString());

    console.log(
      `✅ Streaming video chunk: ${start}-${end}/${fileSize} (${chunksize} bytes)`
    );
    file.pipe(res);
  } else {
    // Serve full file for non-range requests or non-video files
    console.log(`📁 Serving full file: ${req.path} (${fileSize} bytes)`);
    res.set("Content-Length", fileSize.toString());

    const file = fs.createReadStream(filePath);
    file.pipe(res);
  }
}

// Apply the custom video streaming middleware
app.use("/output", videoStreamMiddleware);

// Cache for the bundle to avoid re-bundling
let bundleCache = null;

async function getBundle() {
  if (bundleCache) {
    console.log("📦 Using cached bundle:", bundleCache);
    return bundleCache;
  }

  console.log("🔨 Creating bundle...");
  const startTime = Date.now();

  try {
    bundleCache = await bundle({
      entryPoint: path.resolve(__dirname, "./src/Root.jsx"),
      onProgress: (progress) => {
        if (progress % 20 === 0) {
          // Log every 20%
          console.log(`📦 Bundle progress: ${progress}%`);
        }
      },
    });

    const bundleTime = Date.now() - startTime;
    console.log(`✅ Bundle created at: ${bundleCache} (took ${bundleTime}ms)`);
    return bundleCache;
  } catch (error) {
    console.error("❌ Bundle creation failed:", error);
    throw error;
  }
}

// Function to check resource availability
async function checkResourceHealth(inputProps) {
  const issues = [];

  if (inputProps.imageUrls) {
    console.log("🔍 Checking image URLs...");
    for (const [key, url] of Object.entries(inputProps.imageUrls)) {
      if (url) {
        try {
          const response = await fetch(url, { method: "HEAD", timeout: 10000 });
          if (!response.ok) {
            issues.push(`Image ${key}: HTTP ${response.status} - ${url}`);
          } else {
            console.log(`✅ Image ${key} accessible: ${response.status}`);
          }
        } catch (error) {
          issues.push(`Image ${key}: ${error.message} - ${url}`);
        }
      }
    }
  }

  if (inputProps.audioUrl) {
    console.log("🔍 Checking audio URL...");
    try {
      const response = await fetch(inputProps.audioUrl, {
        method: "HEAD",
        timeout: 10000,
      });
      if (!response.ok) {
        issues.push(`Audio: HTTP ${response.status} - ${inputProps.audioUrl}`);
      } else {
        console.log(`✅ Audio accessible: ${response.status}`);
      }
    } catch (error) {
      issues.push(`Audio: ${error.message} - ${inputProps.audioUrl}`);
    }
  }

  if (issues.length > 0) {
    console.warn("⚠️ Resource issues detected:", issues);
  }

  return issues;
}

// Function to monitor memory usage
function logMemoryUsage(stage) {
  const usage = process.memoryUsage();
  console.log(`💾 Memory at ${stage}:`, {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
  });
}

// API Key authentication middleware
const authenticate = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const validApiKey = process.env.REMOTION_API_KEY;

  // Allow health check without API key
  if (req.path === "/health" || req.path === "/") {
    return next();
  }

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }

  next();
};

app.use(authenticate);

// Route to get all available compositions
app.get("/compositions", async (req, res) => {
  try {
    console.log("📋 Getting compositions...");
    logMemoryUsage("before compositions");

    const bundleLocation = await getBundle();
    const compositions = await getCompositions(bundleLocation);

    console.log(
      `✅ Found ${compositions.length} compositions:`,
      compositions.map((c) => c.id)
    );
    logMemoryUsage("after compositions");

    res.json(compositions);
  } catch (error) {
    console.error("❌ Error getting compositions:", error);
    res.status(500).json({ error: error.message });
  }
});

// Route to render a video
app.post("/render", async (req, res) => {
  const renderStartTime = Date.now();
  let timeoutId;

  try {
    const {
      compositionId = "MyVideo",
      inputProps = {},
      codec = "h264",
      quality = 80,
      userId = null, // Add userId from request
      async = false, // Add async mode support
    } = req.body;

    console.log("\n🎬 ===== RENDER REQUEST STARTED =====");
    console.log("📝 Request details:", {
      compositionId,
      codec,
      propsKeys: Object.keys(inputProps),
      timestamp: new Date().toISOString(),
    });

    logMemoryUsage("render start");

    // Set up timeout
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(`Render timeout after ${RENDER_TIMEOUT / 1000} seconds`)
        );
      }, RENDER_TIMEOUT);
    });

    // Check resource health for complex compositions
    if (inputProps.imageUrls || inputProps.audioUrl) {
      console.log("🩺 Running resource health check...");
      const resourceIssues = await checkResourceHealth(inputProps);
      if (resourceIssues.length > 0) {
        console.warn("⚠️ Continuing with resource issues:", resourceIssues);
      }
    }

    console.log("📦 Getting bundle...");
    const bundleLocation = await getBundle();

    logMemoryUsage("after bundle");

    console.log("🎯 Selecting composition...");
    const selectStartTime = Date.now();

    const composition = await Promise.race([
      selectComposition({
        serveUrl: bundleLocation,
        id: compositionId,
        inputProps,
        logLevel: "verbose",
      }),
      timeoutPromise,
    ]);

    const selectTime = Date.now() - selectStartTime;
    console.log(`✅ Composition selected: ${composition.id} (${selectTime}ms)`);
    console.log("📐 Composition details:", {
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
      durationInSeconds: composition.durationInFrames / composition.fps,
    });

    logMemoryUsage("after composition selection");

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${compositionId}_${timestamp}.mp4`;
    const outputLocation = path.join(process.cwd(), "output", filename);

    // Ensure output directory exists
    const outputDir = path.dirname(outputLocation);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log("📁 Created output directory:", outputDir);
    }

    console.log("🎬 Starting video render...");
    console.log("📁 Output location:", outputLocation);

    // Handle async mode - return immediately and render in background
    if (async) {
      console.log("🔄 Async mode: Starting background render");
      
      // Return immediately with render ID
      res.json({
        success: true,
        message: "Render started",
        renderId: filename,
        filename: filename,
        status: "started"
      });

      // Continue rendering in background (don't await)
      performBackgroundRender(
        composition,
        bundleLocation,
        codec,
        outputLocation,
        inputProps,
        quality,
        filename,
        userId,
        renderStartTime
      );
      
      return; // Exit early for async mode
    }

    // Initialize progress tracking
    setRenderProgress(
      filename,
      {
        status: "initializing",
        progress: 0,
        renderedFrames: 0,
        totalFrames: composition.durationInFrames,
        encodedFrames: 0,
        stage: "initializing",
        fps: 0,
        startTime: Date.now(),
      },
      userId
    );

    const renderStartTime2 = Date.now();
    let lastProgressTime = Date.now();
    let lastFrameRendered = 0;

    // Render the video with progress tracking
    const result = await Promise.race([
      renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec,
        outputLocation,
        inputProps,
        jpegQuality: quality,
        logLevel: "verbose",
        concurrency: 2, // Limit concurrency for debugging
        onProgress: ({
          renderedFrames,
          encodedFrames,
          renderedDoneIn,
          encodedDoneIn,
          stitchStage,
          progress,
        }) => {
          const now = Date.now();
          const timeSinceLastProgress = now - lastProgressTime;
          const framesRendered = renderedFrames - lastFrameRendered;
          const fps = framesRendered / (timeSinceLastProgress / 1000);

          console.log(
            `🎞️ Progress: ${(progress * 100).toFixed(
              1
            )}% | Rendered: ${renderedFrames}/${
              composition.durationInFrames
            } | Encoded: ${encodedFrames || 0} | Stage: ${
              stitchStage || "rendering"
            } | FPS: ${fps.toFixed(1)}`
          );

          // ===== STORE PROGRESS IN MEMORY =====
          setRenderProgress(
            filename,
            {
              status: "rendering",
              progress: progress, // 0.0 to 1.0
              renderedFrames: renderedFrames,
              totalFrames: composition.durationInFrames,
              encodedFrames: encodedFrames || 0,
              stage: stitchStage || "rendering",
              fps: fps,
              startTime: renderStartTime2,
              elapsedTime: now - renderStartTime2,
            },
            userId
          );

          if (renderedDoneIn !== null) {
            console.log(`✅ Frame rendering completed in ${renderedDoneIn}ms`);
          }
          if (encodedDoneIn !== null) {
            console.log(`✅ Video encoding completed in ${encodedDoneIn}ms`);
          }

          lastProgressTime = now;
          lastFrameRendered = renderedFrames;

          // Log memory every 10% progress
          if (
            Math.floor(progress * 10) !== Math.floor((progress - 0.01) * 10)
          ) {
            logMemoryUsage(`${Math.floor(progress * 100)}% progress`);
          }
        },
        onBrowserLog: (log) => {
          console.log(`🌐 Browser: ${log.text}`);
        },
        onDownload: (src) => {
          console.log(`⬇️ Downloading: ${src}`);
        },
      }),
      timeoutPromise,
    ]);

    clearTimeout(timeoutId);

    const totalRenderTime = Date.now() - renderStartTime2;
    const totalTime = Date.now() - renderStartTime;

    console.log(
      `🎉 RENDER COMPLETED! Total time: ${totalTime}ms (render: ${totalRenderTime}ms)`
    );

    logMemoryUsage("render complete");

    // Check if file was actually created
    if (!fs.existsSync(outputLocation)) {
      throw new Error("Output file was not created despite successful render");
    }

    const fileStats = fs.statSync(outputLocation);
    console.log(`📁 Output file: ${fileStats.size} bytes`);

    // Return the download URL
    const downloadUrl = `/output/${filename}`;

    // Mark render as completed
    setRenderProgress(
      filename,
      {
        status: "completed",
        progress: 1.0,
        renderedFrames: composition.durationInFrames,
        totalFrames: composition.durationInFrames,
        encodedFrames: composition.durationInFrames,
        stage: "completed",
        fps: 0,
        startTime: renderStartTime2,
        elapsedTime: totalRenderTime,
        fileSize: fileStats.size,
        downloadUrl: downloadUrl,
      },
      userId
    );

    const response = {
      success: true,
      message: "Video rendered successfully",
      downloadUrl,
      filename,
      fileSize: fileStats.size,
      renderTime: totalTime,
      composition: {
        id: composition.id,
        width: composition.width,
        height: composition.height,
        fps: composition.fps,
        durationInFrames: composition.durationInFrames,
      },
      performance: {
        totalTime,
        renderTime: totalRenderTime,
        bundleTime: selectTime,
      },
    };

    console.log("✅ Sending success response:", {
      filename,
      fileSize: fileStats.size,
      totalTime,
    });

    res.json(response);
  } catch (error) {
    clearTimeout(timeoutId);

    const totalTime = Date.now() - renderStartTime;
    console.error("\n❌ ===== RENDER FAILED =====");
    console.error("⏱️ Failed after:", totalTime, "ms");
    console.error("🚨 Error details:", error);
    console.error("📚 Stack trace:", error.stack);

    logMemoryUsage("render failed");

    // Mark render as failed (filename was generated earlier)
    if (typeof filename !== "undefined") {
      setRenderProgress(
        filename,
        {
          status: "failed",
          progress: 0,
          error: error.message,
          failedAfter: totalTime,
        },
        userId
      );
    }

    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      failedAfter: totalTime,
    });
  }
});

// Route to get render progress
app.get("/progress/:renderId", async (req, res) => {
  try {
    const { renderId } = req.params;

    console.log(`📊 Getting progress for render: ${renderId}`);

    const progress = getRenderProgress(renderId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: "Render not found or expired",
      });
    }

    console.log(
      `📊 Progress found: ${(progress.progress * 100).toFixed(1)}% (${
        progress.status
      })`
    );

    res.json({
      success: true,
      ...progress,
    });
  } catch (error) {
    console.error("❌ Error getting progress:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Route to render a still image
app.post("/render-still", async (req, res) => {
  const renderStartTime = Date.now();

  try {
    const {
      compositionId = "MyVideo",
      inputProps = {},
      frame = 0,
      imageFormat = "png",
    } = req.body;

    console.log("\n📸 ===== STILL RENDER REQUEST =====");
    console.log("📝 Request details:", { compositionId, inputProps, frame });

    logMemoryUsage("still render start");

    const bundleLocation = await getBundle();

    console.log("🎯 Selecting composition for still...");
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    console.log("✅ Composition selected for still render");

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${compositionId}_still_${timestamp}.${imageFormat}`;
    const outputLocation = path.join(process.cwd(), "output", filename);

    // Ensure output directory exists
    const outputDir = path.dirname(outputLocation);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log("📸 Rendering still image...");

    // Render the still
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outputLocation,
      inputProps,
      frame,
      imageFormat,
      logLevel: "verbose",
    });

    const totalTime = Date.now() - renderStartTime;
    console.log(`✅ Still image rendered in ${totalTime}ms`);

    logMemoryUsage("still render complete");

    // Check if file was created
    if (!fs.existsSync(outputLocation)) {
      throw new Error("Still image file was not created");
    }

    const fileStats = fs.statSync(outputLocation);

    // Return the download URL
    const downloadUrl = `/output/${filename}`;
    res.json({
      success: true,
      message: "Still image rendered successfully",
      downloadUrl,
      filename,
      frame,
      fileSize: fileStats.size,
      renderTime: totalTime,
    });
  } catch (error) {
    const totalTime = Date.now() - renderStartTime;
    console.error("❌ Still render failed after:", totalTime, "ms");
    console.error("🚨 Error:", error);

    logMemoryUsage("still render failed");

    res.status(500).json({
      success: false,
      error: error.message,
      failedAfter: totalTime,
    });
  }
});

// Route to serve video files with streaming support
app.get("/video/:filename", (req, res) => {
  const filename = req.params.filename;
  const videoPath = path.join(process.cwd(), "output", filename);

  // Check if file exists
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: "Video not found" });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Handle range requests for video streaming
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // Serve full file
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    };

    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    bundleCache: bundleCache ? "loaded" : "not loaded",
  });
});

// Basic documentation endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Remotion Server-Side Rendering API",
    endpoints: {
      "GET /": "This documentation",
      "GET /health": "Health check",
      "GET /compositions": "List available compositions",
      "POST /render": "Render a video",
      "POST /render-still": "Render a still image",
    },
    examples: {
      render: {
        url: "/render",
        method: "POST",
        body: {
          compositionId: "MyVideo",
          inputProps: {
            titleText: "Custom Title",
            titleColor: "blue",
          },
          codec: "h264",
          quality: 80,
        },
      },
      renderStill: {
        url: "/render-still",
        method: "POST",
        body: {
          compositionId: "MyVideo",
          inputProps: {
            titleText: "Custom Title",
            titleColor: "blue",
          },
          frame: 30,
          imageFormat: "png",
        },
      },
    },
  });
});

// Background render function for async mode
async function performBackgroundRender(
  composition,
  bundleLocation,
  codec,
  outputLocation,
  inputProps,
  quality,
  filename,
  userId,
  renderStartTime
) {
  try {
    console.log(`🎬 Background render started for: ${filename}`);
    
    // Initialize progress tracking
    setRenderProgress(
      filename,
      {
        status: "initializing",
        progress: 0,
        renderedFrames: 0,
        totalFrames: composition.durationInFrames,
        encodedFrames: 0,
        stage: "initializing",
        fps: 0,
        startTime: Date.now(),
      },
      userId
    );

    const renderStartTime2 = Date.now();
    let lastProgressTime = Date.now();
    let lastFrameRendered = 0;

    // Render the video with progress tracking
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec,
      outputLocation,
      inputProps,
      jpegQuality: quality,
      logLevel: "verbose",
      concurrency: 2,
      onProgress: ({
        renderedFrames,
        encodedFrames,
        renderedDoneIn,
        encodedDoneIn,
        stitchStage,
        progress,
      }) => {
        const now = Date.now();
        const timeSinceLastProgress = now - lastProgressTime;
        const framesRendered = renderedFrames - lastFrameRendered;
        const fps = framesRendered / (timeSinceLastProgress / 1000);

        console.log(
          `🎞️ Background Progress: ${(progress * 100).toFixed(
            1
          )}% | Rendered: ${renderedFrames}/${
            composition.durationInFrames
          } | Encoded: ${encodedFrames || 0} | Stage: ${
            stitchStage || "rendering"
          } | FPS: ${fps.toFixed(1)}`
        );

        // Store progress in memory
        setRenderProgress(
          filename,
          {
            status: "rendering",
            progress: progress,
            renderedFrames: renderedFrames,
            totalFrames: composition.durationInFrames,
            encodedFrames: encodedFrames || 0,
            stage: stitchStage || "rendering",
            fps: fps,
            startTime: renderStartTime2,
            elapsedTime: now - renderStartTime2,
          },
          userId
        );

        lastProgressTime = now;
        lastFrameRendered = renderedFrames;
      },
    });

    const totalRenderTime = Date.now() - renderStartTime2;
    console.log(`✅ Background render completed: ${filename} (${totalRenderTime}ms)`);

    // Check if file was created
    if (!fs.existsSync(outputLocation)) {
      throw new Error("Output file was not created despite successful render");
    }

    const fileStats = fs.statSync(outputLocation);
    const downloadUrl = `/output/${filename}`;

    // Mark render as completed
    setRenderProgress(
      filename,
      {
        status: "completed",
        progress: 1.0,
        renderedFrames: composition.durationInFrames,
        totalFrames: composition.durationInFrames,
        encodedFrames: composition.durationInFrames,
        stage: "completed",
        fps: 0,
        startTime: renderStartTime2,
        elapsedTime: totalRenderTime,
        fileSize: fileStats.size,
        downloadUrl: downloadUrl,
      },
      userId
    );

    console.log(`🎉 Background render success: ${filename}`);
  } catch (error) {
    console.error(`❌ Background render failed: ${filename}`, error);
    
    // Mark render as failed
    setRenderProgress(
      filename,
      {
        status: "failed",
        progress: 0,
        error: error.message,
        failedAfter: Date.now() - renderStartTime,
      },
      userId
    );
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Remotion SSR Server running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  process.exit(0);
});

import { IDesign, ITrackItem } from "@designcombo/types";

/**
 * Editor to FCP XML Converter
 * Converts IDesign (editor format) to Final Cut Pro XML (XMEML) format
 * Compatible with Adobe Premiere Pro, DaVinci Resolve, and Final Cut Pro
 */

interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: "video" | "audio" | "image";
  width?: number;
  height?: number;
  duration?: number; // in frames
}

/**
 * Extract a clean filename from a URL
 */
function urlToFilename(url: string, index: number, type: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = pathname.split(".").pop()?.split("?")[0] || "";

    // Try to get a meaningful name from the path
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "";

    // If it has a valid extension, use the filename
    if (ext && ["jpg", "jpeg", "png", "webp", "mp4", "webm", "mov", "mp3", "wav", "m4a", "ogg", "aac"].includes(ext.toLowerCase())) {
      // Clean up the filename
      const name = lastSegment.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (name.length > 5) return name;
    }

    // Fallback: generate a name based on type and index
    const extensions: Record<string, string> = {
      video: "mp4",
      audio: "mp3",
      image: "jpg",
    };
    return `${type}_${index + 1}.${extensions[type] || "bin"}`;
  } catch {
    return `${type}_${index + 1}.bin`;
  }
}

/**
 * Convert IDesign to FCP XML (XMEML v4) string
 */
export function convertToFCPXML(design: IDesign, projectName?: string): {
  xml: string;
  mediaFiles: MediaFile[];
} {
  const fps = design.fps || 30;
  const durationMs = design.duration || 30000;
  const totalFrames = Math.ceil((durationMs / 1000) * fps);
  const width = design.size?.width || 1920;
  const height = design.size?.height || 1080;
  const name = projectName || "BlueFX Project";

  const trackItems = Object.values(design.trackItemsMap || {});

  // Separate items by type
  const videoItems = trackItems.filter((i) => i.type === "video");
  const imageItems = trackItems.filter((i) => i.type === "image");
  const audioItems = trackItems.filter((i) => i.type === "audio");

  // Build media file registry (deduplicated by URL)
  const mediaFiles: MediaFile[] = [];
  const fileIdMap = new Map<string, string>(); // url -> file id
  let fileCounter = 0;

  function getOrCreateFileId(url: string, type: "video" | "audio" | "image", item: ITrackItem): string {
    if (fileIdMap.has(url)) return fileIdMap.get(url)!;

    fileCounter++;
    const id = `file-${fileCounter}`;
    const filename = urlToFilename(url, fileCounter - 1, type);

    mediaFiles.push({
      id,
      name: filename,
      url,
      type,
      width: item.details.width || width,
      height: item.details.height || height,
    });

    fileIdMap.set(url, id);
    return id;
  }

  // Register all media files
  for (const item of videoItems) {
    if (item.details.src) getOrCreateFileId(item.details.src, "video", item);
  }
  for (const item of imageItems) {
    if (item.details.src) getOrCreateFileId(item.details.src, "image", item);
  }
  for (const item of audioItems) {
    if (item.details.src) getOrCreateFileId(item.details.src, "audio", item);
  }

  // Helper: ms to frames
  const msToFrames = (ms: number) => Math.round((ms / 1000) * fps);

  // Build XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<!DOCTYPE xmeml>\n`;
  xml += `<xmeml version="4">\n`;
  xml += `  <sequence>\n`;
  xml += `    <name>${escapeXml(name)}</name>\n`;
  xml += `    <duration>${totalFrames}</duration>\n`;
  xml += `    <rate>\n`;
  xml += `      <timebase>${fps}</timebase>\n`;
  xml += `      <ntsc>FALSE</ntsc>\n`;
  xml += `    </rate>\n`;
  xml += `    <media>\n`;

  // ─── Video tracks ────────────────────────────────
  xml += `      <video>\n`;
  xml += `        <format>\n`;
  xml += `          <samplecharacteristics>\n`;
  xml += `            <width>${width}</width>\n`;
  xml += `            <height>${height}</height>\n`;
  xml += `            <pixelaspectratio>square</pixelaspectratio>\n`;
  xml += `          </samplecharacteristics>\n`;
  xml += `        </format>\n`;

  // Group visual items (images + videos) by track
  const visualItems = [...imageItems, ...videoItems].sort(
    (a, b) => a.display.from - b.display.from
  );

  // Simple approach: put all visual items on one track
  // (Premiere will handle overlaps)
  if (visualItems.length > 0) {
    xml += `        <track>\n`;
    for (const item of visualItems) {
      const src = item.details.src;
      if (!src) continue;

      const fileType = item.type === "video" ? "video" : "image";
      const fileId = fileIdMap.get(src)!;
      const file = mediaFiles.find((f) => f.id === fileId)!;

      const startFrame = msToFrames(item.display.from);
      const endFrame = msToFrames(item.display.to);
      const clipDuration = endFrame - startFrame;

      // Trim points (for video)
      const inPoint = item.trim ? msToFrames(item.trim.from) : 0;
      const outPoint = item.trim ? msToFrames(item.trim.to) : clipDuration;

      xml += `          <clipitem>\n`;
      xml += `            <name>${escapeXml(item.name || file.name)}</name>\n`;
      xml += `            <duration>${clipDuration}</duration>\n`;
      xml += `            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>\n`;
      xml += `            <start>${startFrame}</start>\n`;
      xml += `            <end>${endFrame}</end>\n`;
      xml += `            <in>${inPoint}</in>\n`;
      xml += `            <out>${outPoint}</out>\n`;
      xml += `            <file id="${fileId}">\n`;
      xml += `              <name>${escapeXml(file.name)}</name>\n`;
      xml += `              <pathurl>${escapeXml(file.name)}</pathurl>\n`;
      xml += `              <media>\n`;
      xml += `                <video>\n`;
      xml += `                  <samplecharacteristics>\n`;
      xml += `                    <width>${file.width || width}</width>\n`;
      xml += `                    <height>${file.height || height}</height>\n`;
      xml += `                  </samplecharacteristics>\n`;
      xml += `                </video>\n`;
      xml += `              </media>\n`;
      xml += `            </file>\n`;

      // Add opacity if not 100%
      const opacity = item.details.opacity ?? 100;
      if (opacity < 100) {
        xml += `            <filter>\n`;
        xml += `              <effect>\n`;
        xml += `                <name>Basic Motion</name>\n`;
        xml += `                <effectid>opacity</effectid>\n`;
        xml += `                <parameter>\n`;
        xml += `                  <name>opacity</name>\n`;
        xml += `                  <value>${opacity}</value>\n`;
        xml += `                </parameter>\n`;
        xml += `              </effect>\n`;
        xml += `            </filter>\n`;
      }

      xml += `          </clipitem>\n`;
    }
    xml += `        </track>\n`;
  }

  xml += `      </video>\n`;

  // ─── Audio tracks ────────────────────────────────
  xml += `      <audio>\n`;
  xml += `        <format>\n`;
  xml += `          <samplecharacteristics>\n`;
  xml += `            <samplerate>48000</samplerate>\n`;
  xml += `            <depth>16</depth>\n`;
  xml += `          </samplecharacteristics>\n`;
  xml += `        </format>\n`;

  // Also include audio from video items
  const allAudioSources = [
    ...audioItems,
    ...videoItems.filter((i) => (i.details.volume ?? 100) > 0),
  ];

  if (allAudioSources.length > 0) {
    xml += `        <track>\n`;
    for (const item of allAudioSources) {
      const src = item.details.src;
      if (!src) continue;

      const fileType = item.type === "audio" ? "audio" : "video";
      const fileId = fileIdMap.get(src)!;
      const file = mediaFiles.find((f) => f.id === fileId)!;

      const startFrame = msToFrames(item.display.from);
      const endFrame = msToFrames(item.display.to);
      const clipDuration = endFrame - startFrame;

      const inPoint = item.trim ? msToFrames(item.trim.from) : 0;
      const outPoint = item.trim ? msToFrames(item.trim.to) : clipDuration;

      const volume = (item.details.volume ?? 100) / 100;

      xml += `          <clipitem>\n`;
      xml += `            <name>${escapeXml(item.name || file.name)}</name>\n`;
      xml += `            <duration>${clipDuration}</duration>\n`;
      xml += `            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>\n`;
      xml += `            <start>${startFrame}</start>\n`;
      xml += `            <end>${endFrame}</end>\n`;
      xml += `            <in>${inPoint}</in>\n`;
      xml += `            <out>${outPoint}</out>\n`;
      xml += `            <file id="${fileId}"/>\n`;

      // Audio levels
      if (volume !== 1) {
        xml += `            <filter>\n`;
        xml += `              <effect>\n`;
        xml += `                <name>Audio Levels</name>\n`;
        xml += `                <effectid>audiolevels</effectid>\n`;
        xml += `                <parameter>\n`;
        xml += `                  <name>Level</name>\n`;
        xml += `                  <value>${volume}</value>\n`;
        xml += `                </parameter>\n`;
        xml += `              </effect>\n`;
        xml += `            </filter>\n`;
      }

      xml += `          </clipitem>\n`;
    }
    xml += `        </track>\n`;
  }

  xml += `      </audio>\n`;
  xml += `    </media>\n`;
  xml += `  </sequence>\n`;
  xml += `</xmeml>\n`;

  return { xml, mediaFiles };
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Download the XML file and trigger downloads for all media files
 */
export function downloadFCPXMLProject(design: IDesign, projectName?: string) {
  const { xml, mediaFiles } = convertToFCPXML(design, projectName);

  // 1. Download the XML file
  const xmlBlob = new Blob([xml], { type: "application/xml" });
  const xmlUrl = URL.createObjectURL(xmlBlob);
  const xmlLink = document.createElement("a");
  xmlLink.href = xmlUrl;
  xmlLink.download = `${projectName || "BlueFX_Project"}.xml`;
  document.body.appendChild(xmlLink);
  xmlLink.click();
  document.body.removeChild(xmlLink);
  URL.revokeObjectURL(xmlUrl);

  // 2. Download all media files with a small delay between each
  // to avoid overwhelming the browser
  mediaFiles.forEach((file, index) => {
    setTimeout(async () => {
      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        // Fallback: open in new tab
        console.warn(`Failed to download ${file.name}, opening in new tab:`, err);
        window.open(file.url, "_blank");
      }
    }, index * 500); // 500ms between each download
  });

  return { mediaFiles: mediaFiles.length };
}

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

  // Premiere Pro uses 29.97fps (NTSC drop-frame) — timebase 30, ntsc TRUE
  const TIMEBASE = 30;
  const NTSC = true;

  // Helper: ms to frames at 29.97fps
  const msToFrames = (ms: number) => Math.round((ms / 1000) * 29.97);

  // Build video clipitems
  const visualItems = [...imageItems, ...videoItems].sort(
    (a, b) => a.display.from - b.display.from
  );

  const videoClipItems = visualItems.map((item, i) => {
    const src = item.details.src;
    if (!src) return "";
    const fileId = fileIdMap.get(src)!;
    const file = mediaFiles.find((f) => f.id === fileId)!;
    const startFrame = msToFrames(item.display.from);
    const endFrame = msToFrames(item.display.to);
    const clipDuration = endFrame - startFrame;
    const inPoint = item.trim ? msToFrames(item.trim.from) : 0;
    const outPoint = item.trim ? msToFrames(item.trim.to) : clipDuration;

    return `          <clipitem id="clipitem-v1-${i}">
            <name>${escapeXml(item.name || file.name)}</name>
            <duration>${clipDuration}</duration>
            <rate>
              <timebase>${TIMEBASE}</timebase>
              <ntsc>${NTSC ? 'TRUE' : 'FALSE'}</ntsc>
            </rate>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inPoint}</in>
            <out>${outPoint}</out>
            <file id="${fileId}">
              <name>${escapeXml(file.name)}</name>
              <pathurl>file://localhost/${escapeXml(file.name.replace(/ /g, '%20'))}</pathurl>
              <duration>${clipDuration}</duration>
              <rate>
                <timebase>${TIMEBASE}</timebase>
                <ntsc>${NTSC ? 'TRUE' : 'FALSE'}</ntsc>
              </rate>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>${file.width || width}</width>
                    <height>${file.height || height}</height>
                  </samplecharacteristics>
                </video>
              </media>
            </file>
          </clipitem>`;
  }).filter(Boolean).join('\n');

  // Build audio clipitems
  const allAudioSources = [
    ...audioItems,
    ...videoItems.filter((i) => (i.details.volume ?? 100) > 0),
  ];

  const audioClipItems = allAudioSources.map((item, i) => {
    const src = item.details.src;
    if (!src) return "";
    const fileId = fileIdMap.get(src)!;
    const file = mediaFiles.find((f) => f.id === fileId)!;
    const startFrame = msToFrames(item.display.from);
    const endFrame = msToFrames(item.display.to);
    const clipDuration = endFrame - startFrame;
    const inPoint = item.trim ? msToFrames(item.trim.from) : 0;
    const outPoint = item.trim ? msToFrames(item.trim.to) : clipDuration;

    return `          <clipitem id="clipitem-a1-${i}">
            <name>${escapeXml(item.name || file.name)}</name>
            <duration>${clipDuration}</duration>
            <rate>
              <timebase>${TIMEBASE}</timebase>
              <ntsc>${NTSC ? 'TRUE' : 'FALSE'}</ntsc>
            </rate>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inPoint}</in>
            <out>${outPoint}</out>
            <file id="${fileId}-audio">
              <name>${escapeXml(file.name)}</name>
              <pathurl>file://localhost/${escapeXml(file.name.replace(/ /g, '%20'))}</pathurl>
              <duration>${clipDuration}</duration>
              <rate>
                <timebase>${TIMEBASE}</timebase>
                <ntsc>${NTSC ? 'TRUE' : 'FALSE'}</ntsc>
              </rate>
              <media>
                <audio>
                  <samplecharacteristics>
                    <depth>16</depth>
                    <samplerate>48000</samplerate>
                  </samplecharacteristics>
                </audio>
              </media>
            </file>
          </clipitem>`;
  }).filter(Boolean).join('\n');

  // Assemble full XML — matching proven working pattern from real-estate-video
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>${escapeXml(name)}</name>
    <duration>${totalFrames}</duration>
    <rate>
      <timebase>${TIMEBASE}</timebase>
      <ntsc>${NTSC ? 'TRUE' : 'FALSE'}</ntsc>
    </rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
            <rate>
              <timebase>${TIMEBASE}</timebase>
              <ntsc>${NTSC ? 'TRUE' : 'FALSE'}</ntsc>
            </rate>
          </samplecharacteristics>
        </format>
        <track>
${videoClipItems}
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
        <track>
${audioClipItems}
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>
      </audio>
    </media>
    <timecode>
      <rate>
        <timebase>${TIMEBASE}</timebase>
        <ntsc>${NTSC ? 'TRUE' : 'FALSE'}</ntsc>
      </rate>
      <string>00:00:00;00</string>
      <frame>0</frame>
      <displayformat>DF</displayformat>
    </timecode>
  </sequence>
</xmeml>`;

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
 * Download just the XML file (no media files)
 */
export function downloadFCPXMLOnly(design: IDesign, projectName?: string) {
  const { xml } = convertToFCPXML(design, projectName);
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${projectName || "BlueFX_Project"}.xml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download the XML file + all media files
 */
export function downloadFCPXMLProject(design: IDesign, projectName?: string) {
  const { xml, mediaFiles } = convertToFCPXML(design, projectName);

  // 1. Download the XML file
  downloadFCPXMLOnly(design, projectName);

  // 2. Download all media files with a small delay between each
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
        console.warn(`Failed to download ${file.name}, opening in new tab:`, err);
        window.open(file.url, "_blank");
      }
    }, (index + 1) * 500); // start after XML, 500ms apart
  });

  return { mediaFiles: mediaFiles.length };
}

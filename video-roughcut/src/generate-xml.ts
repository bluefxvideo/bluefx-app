import { secondsToFrames, resolveSequenceRate, type SequenceRate } from './timecode.js';
import type { VideoMetadata, EditDecision, KeepSegment } from './types.js';

/**
 * FCP 7 XML (xmeml) generator for Premiere Pro import.
 *
 * Frame math uses the sequence rate from resolveSequenceRate(): 30 fps sources are
 * written as 29.97 because that's what Premiere builds for them.
 *
 * The pathurl is intentionally path-free: it only carries the video's filename.
 * That triggers Premiere's "locate media" dialog, so the user points it at the
 * original video on their own disk. The server never sees the video itself.
 */
export function generateFCPXML(metadata: VideoMetadata, editDecision: EditDecision): string {
  const rate = resolveSequenceRate(metadata.frameRate);
  const pathUrl = `file://localhost/${encodeURIComponent(metadata.fileName)}`;
  const totalOutputFrames = secondsToFrames(editDecision.totalOutputDuration, rate.fps);
  const totalSourceFrames = secondsToFrames(metadata.duration, rate.fps);
  const rateXml = rateBlock(rate);

  const videoClips = editDecision.segments
    .map((seg, i) => clipItem(seg, 'v', metadata, rate, pathUrl, totalSourceFrames, i === 0))
    .join('\n');
  const audioClips = editDecision.segments
    .map((seg) => clipItem(seg, 'a', metadata, rate, pathUrl, totalSourceFrames, false))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>Rough Cut - ${escapeXml(metadata.fileName)}</name>
    <duration>${totalOutputFrames}</duration>
    ${rateXml}
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${metadata.width}</width>
            <height>${metadata.height}</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
            ${rateXml}
          </samplecharacteristics>
        </format>
        <track>
${videoClips}
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
${audioClips}
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>
      </audio>
    </media>
    <timecode>
      ${rateXml}
      <string>${rate.dropFrame ? '00:00:00;00' : '00:00:00:00'}</string>
      <frame>0</frame>
      <displayformat>${rate.dropFrame ? 'DF' : 'NDF'}</displayformat>
    </timecode>
  </sequence>
</xmeml>`;
}

function rateBlock(rate: SequenceRate): string {
  return `<rate>
      <timebase>${rate.timebase}</timebase>
      <ntsc>${rate.ntsc ? 'TRUE' : 'FALSE'}</ntsc>
    </rate>`;
}

function clipItem(
  seg: KeepSegment,
  track: 'v' | 'a',
  metadata: VideoMetadata,
  rate: SequenceRate,
  pathUrl: string,
  totalSourceFrames: number,
  includeFileDefinition: boolean,
): string {
  const inFrame = secondsToFrames(seg.sourceInPremiere, rate.fps);
  const outFrame = secondsToFrames(seg.sourceOut, rate.fps);
  const startFrame = secondsToFrames(seg.recordIn, rate.fps);
  // End = start + source length, so rounding never opens a 1-frame gap between clips.
  const endFrame = startFrame + (outFrame - inFrame);
  const rateXml = rateBlock(rate);

  const fileBlock = includeFileDefinition
    ? `            <file id="file-1">
              <name>${escapeXml(metadata.fileName)}</name>
              <pathurl>${escapeXml(pathUrl)}</pathurl>
              <duration>${totalSourceFrames}</duration>
              ${rateXml}
              <timecode>
                ${rateXml}
                <string>00:00:00:00</string>
                <frame>0</frame>
                <displayformat>${rate.dropFrame ? 'DF' : 'NDF'}</displayformat>
                <source>source</source>
              </timecode>
              <media>
                <video>
                  <samplecharacteristics>
                    <width>${metadata.width}</width>
                    <height>${metadata.height}</height>
                  </samplecharacteristics>
                </video>
                <audio>
                  <samplecharacteristics>
                    <depth>16</depth>
                    <samplerate>48000</samplerate>
                  </samplecharacteristics>
                </audio>
              </media>
            </file>`
    : `            <file id="file-1"/>`;

  return `          <clipitem id="clipitem-${track}-${seg.id}">
            <name>${escapeXml(metadata.fileName)}</name>
            <duration>${totalSourceFrames}</duration>
            ${rateXml}
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inFrame}</in>
            <out>${outFrame}</out>
${fileBlock}
          </clipitem>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

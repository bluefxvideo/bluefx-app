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
 *
 * Because the media is offline at import, Premiere builds its placeholder clip from
 * this XML alone, and later refuses to relink a file whose audio channels differ
 * ("has 2 audio channel(s) and the clip was created with 1"). So the file definition
 * carries the source's real channel count, and the audio tracks use the same
 * "exploded" layout Premiere writes itself: a linked pair of Stereo tracks for a
 * stereo source, one Mono track for a mono source.
 */
export function generateFCPXML(metadata: VideoMetadata, editDecision: EditDecision): string {
  const rate = resolveSequenceRate(metadata.frameRate);
  const pathUrl = `file://localhost/${encodeURIComponent(metadata.fileName)}`;
  const totalOutputFrames = secondsToFrames(editDecision.totalOutputDuration, rate.fps);
  const totalSourceFrames = secondsToFrames(metadata.duration, rate.fps);
  const rateXml = rateBlock(rate);

  const layout = audioLayout(metadata);
  const ctx: ClipContext = { metadata, rate, pathUrl, totalSourceFrames, layout };

  // The first clip in the file carries the full <file> definition; the rest refer to it.
  const videoClips = layout.hasVideo
    ? editDecision.segments.map((seg, i) => clipItem(seg, i, 'v', ctx, i === 0)).join('\n')
    : '';
  const audioTracks = layout.trackKeys
    .map((key, k) => {
      const clips = editDecision.segments
        .map((seg, i) => clipItem(seg, i, key, ctx, !layout.hasVideo && k === 0 && i === 0))
        .join('\n');
      const stereo = layout.trackKeys.length === 2;
      return `        <track currentExplodedTrackIndex="${k}" totalExplodedTrackCount="${layout.trackKeys.length}" premiereTrackType="${stereo ? 'Stereo' : 'Mono'}">
${stereo && layout.hasVideo ? `          <outputchannelindex>${k + 1}</outputchannelindex>\n` : ''}${clips}
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence explodedTracks="true">
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
            <samplerate>${layout.sampleRate}</samplerate>
          </samplecharacteristics>
        </format>
${audioTracks}
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

type TrackKey = 'v' | 'a1' | 'a2';

interface AudioLayout {
  hasVideo: boolean;
  /** Channel count of every audio stream in the source file, in order. */
  streams: number[];
  sampleRate: number;
  /** Timeline audio tracks: a1 + a2 for a stereo (or wider) first stream, a1 alone for mono. */
  trackKeys: TrackKey[];
}

interface ClipContext {
  metadata: VideoMetadata;
  rate: SequenceRate;
  pathUrl: string;
  totalSourceFrames: number;
  layout: AudioLayout;
}

/** Stereo at 48 kHz is the fallback when the browser could not read the audio layout. */
function audioLayout(metadata: VideoMetadata): AudioLayout {
  const streams = (metadata.audioStreams ?? [])
    .map((c) => Math.round(c))
    .filter((c) => c >= 1 && c <= 64);
  if (streams.length === 0) streams.push(2);
  return {
    hasVideo: metadata.hasVideo !== false,
    streams,
    sampleRate: metadata.audioSampleRate && metadata.audioSampleRate > 0 ? Math.round(metadata.audioSampleRate) : 48000,
    trackKeys: streams[0] >= 2 ? ['a1', 'a2'] : ['a1'],
  };
}

function clipId(key: TrackKey, seg: KeepSegment): string {
  return `clipitem-${key}-${seg.id}`;
}

function clipItem(
  seg: KeepSegment,
  index: number,
  key: TrackKey,
  ctx: ClipContext,
  includeFileDefinition: boolean,
): string {
  const { metadata, rate, pathUrl, totalSourceFrames, layout } = ctx;
  const inFrame = secondsToFrames(seg.sourceInPremiere, rate.fps);
  const outFrame = secondsToFrames(seg.sourceOut, rate.fps);
  const startFrame = secondsToFrames(seg.recordIn, rate.fps);
  // End = start + source length, so rounding never opens a 1-frame gap between clips.
  const endFrame = startFrame + (outFrame - inFrame);
  const rateXml = rateBlock(rate);
  const stereo = layout.trackKeys.length === 2;

  const fileVideo = layout.hasVideo
    ? `                <video>
                  <samplecharacteristics>
                    <width>${metadata.width}</width>
                    <height>${metadata.height}</height>
                  </samplecharacteristics>
                </video>
`
    : '';
  const fileAudio = layout.streams
    .map(
      (channels) => `                <audio>
                  <samplecharacteristics>
                    <depth>16</depth>
                    <samplerate>${layout.sampleRate}</samplerate>
                  </samplecharacteristics>
                  <channelcount>${channels}</channelcount>
                </audio>`,
    )
    .join('\n');

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
${fileVideo}${fileAudio}
              </media>
            </file>`
    : `            <file id="file-1"/>`;

  // Audio clips name the source channel they play. The video clip links itself to its
  // audio clips, so picture and sound move together on the timeline.
  let tail = '';
  if (key === 'v') {
    const links = [
      link(clipId('v', seg), 'video', 1, index + 1),
      ...layout.trackKeys.map((k, t) => link(clipId(k, seg), 'audio', t + 1, index + 1)),
    ];
    tail = `\n            <compositemode>normal</compositemode>\n${links.join('\n')}`;
  } else {
    tail = `
            <sourcetrack>
              <mediatype>audio</mediatype>
              <trackindex>${key === 'a2' ? 2 : 1}</trackindex>
            </sourcetrack>`;
  }
  const channelType = key === 'v' ? '' : ` premiereChannelType="${stereo ? 'stereo' : 'mono'}"`;

  return `          <clipitem id="${clipId(key, seg)}"${channelType}>
            <name>${escapeXml(metadata.fileName)}</name>
            <enabled>TRUE</enabled>
            <duration>${totalSourceFrames}</duration>
            ${rateXml}
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inFrame}</in>
            <out>${outFrame}</out>
${fileBlock}${tail}
          </clipitem>`;
}

function link(ref: string, mediatype: 'video' | 'audio', trackIndex: number, clipIndex: number): string {
  return `            <link>
              <linkclipref>${ref}</linkclipref>
              <mediatype>${mediatype}</mediatype>
              <trackindex>${trackIndex}</trackindex>
              <clipindex>${clipIndex}</clipindex>
            </link>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

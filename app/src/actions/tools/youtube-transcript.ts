'use server';

import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from 'ytdl-core';

interface TranscriptResult {
  success: boolean;
  transcript?: string;
  title?: string;
  error?: string;
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Try to fetch transcript using youtube-transcript library
 */
async function tryYoutubeTranscript(videoId: string): Promise<string | null> {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      return null;
    }

    return transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    console.log('youtube-transcript failed:', error);
    return null;
  }
}

/**
 * Fallback: Download audio and transcribe with Whisper
 */
async function transcribeWithWhisper(videoId: string): Promise<string | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Get video info
    const info = await ytdl.getInfo(videoUrl);

    // Find audio-only format
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: 'lowestaudio',
      filter: 'audioonly'
    });

    if (!audioFormat || !audioFormat.url) {
      console.log('No audio format found');
      return null;
    }

    console.log('Downloading audio for transcription...');

    // Download audio
    const audioResponse = await fetch(audioFormat.url);
    if (!audioResponse.ok) {
      console.log('Failed to download audio');
      return null;
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' });

    // Create a File object for the transcription service
    const audioFile = new File([audioBlob], 'audio.mp4', { type: 'audio/mp4' });

    console.log('Audio downloaded, size:', audioBuffer.byteLength, 'transcribing...');

    // Use OpenAI Whisper for transcription
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    return transcription.text;
  } catch (error) {
    console.error('Whisper transcription failed:', error);
    return null;
  }
}

/**
 * Fetch transcript from a YouTube video
 * Tries youtube-transcript first, then falls back to Whisper transcription
 */
export async function fetchYouTubeTranscript(url: string): Promise<TranscriptResult> {
  try {
    const videoId = extractVideoId(url);

    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    console.log('Fetching transcript for video:', videoId);

    // Try to get video title
    let title: string | undefined;
    try {
      const oembedResponse = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        title = oembedData.title;
      }
    } catch {
      // Title fetch is optional
    }

    // Method 1: Try youtube-transcript library (fastest, if captions exist)
    console.log('Trying youtube-transcript library...');
    let transcript = await tryYoutubeTranscript(videoId);

    // Method 2: Fall back to Whisper transcription
    if (!transcript) {
      console.log('Captions not available, falling back to Whisper transcription...');
      transcript = await transcribeWithWhisper(videoId);
    }

    if (!transcript) {
      return {
        success: false,
        error: 'Could not get transcript. Video may be restricted or too long.'
      };
    }

    console.log('Transcript fetched, length:', transcript.length);

    return {
      success: true,
      transcript,
      title,
    };
  } catch (error) {
    console.error('YouTube transcript fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch transcript'
    };
  }
}

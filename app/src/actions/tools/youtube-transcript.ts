'use server';

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
 * Fetch captions directly from YouTube's player API
 */
async function fetchCaptionsFromYouTube(videoId: string): Promise<string | null> {
  try {
    // Get the video page to extract caption tracks
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      console.log('Failed to fetch YouTube page:', response.status);
      return null;
    }

    const html = await response.text();

    // Extract captions URL from the page
    const captionRegex = /"captionTracks":\s*(\[.*?\])/;
    const match = html.match(captionRegex);

    if (!match) {
      console.log('No caption tracks found in page');
      return null;
    }

    let captionTracks;
    try {
      captionTracks = JSON.parse(match[1]);
    } catch {
      console.log('Failed to parse caption tracks');
      return null;
    }

    if (!captionTracks || captionTracks.length === 0) {
      console.log('Caption tracks array is empty');
      return null;
    }

    // Prefer English captions, fall back to first available
    let captionUrl = captionTracks.find((t: { languageCode: string }) =>
      t.languageCode === 'en' || t.languageCode?.startsWith('en')
    )?.baseUrl;

    if (!captionUrl) {
      captionUrl = captionTracks[0]?.baseUrl;
    }

    if (!captionUrl) {
      console.log('No caption URL found');
      return null;
    }

    // Fetch the caption XML
    console.log('Fetching captions from:', captionUrl);
    const captionResponse = await fetch(captionUrl);

    if (!captionResponse.ok) {
      console.log('Failed to fetch captions:', captionResponse.status);
      return null;
    }

    const captionXml = await captionResponse.text();

    // Parse XML to extract text
    const textRegex = /<text[^>]*>(.*?)<\/text>/gs;
    const texts: string[] = [];
    let textMatch;

    while ((textMatch = textRegex.exec(captionXml)) !== null) {
      // Decode HTML entities
      let text = textMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, ' ');
      texts.push(text);
    }

    if (texts.length === 0) {
      console.log('No text found in captions');
      return null;
    }

    const transcript = texts.join(' ').replace(/\s+/g, ' ').trim();
    console.log('Successfully extracted transcript, length:', transcript.length);
    return transcript;

  } catch (error) {
    console.error('Caption fetch error:', error);
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

    // Method 1: Try direct caption fetch (fastest, if captions exist)
    console.log('Fetching captions directly from YouTube...');
    let transcript = await fetchCaptionsFromYouTube(videoId);

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

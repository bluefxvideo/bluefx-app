'use server';

import { YoutubeTranscript } from 'youtube-transcript';

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
 * Fetch transcript from a YouTube video
 */
export async function fetchYouTubeTranscript(url: string): Promise<TranscriptResult> {
  try {
    const videoId = extractVideoId(url);

    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    console.log('Fetching transcript for video:', videoId);

    // Fetch transcript using youtube-transcript library
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      return { success: false, error: 'No transcript available for this video' };
    }

    // Combine all transcript segments into one text
    const transcript = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('Transcript fetched, length:', transcript.length);

    // Try to get video title from oEmbed API
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
      // Title fetch is optional, ignore errors
    }

    return {
      success: true,
      transcript,
      title,
    };
  } catch (error) {
    console.error('YouTube transcript fetch error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('disabled')) {
        return { success: false, error: 'Transcripts are disabled for this video' };
      }
      if (error.message.includes('not found') || error.message.includes('unavailable')) {
        return { success: false, error: 'Video not found or unavailable' };
      }
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Failed to fetch transcript' };
  }
}

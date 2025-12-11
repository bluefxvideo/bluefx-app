'use server';

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
 * Parse VTT subtitle content to plain text
 */
function parseVttToText(vttContent: string): string {
  const lines = vttContent.split('\n');
  const textLines: string[] = [];
  let lastText = '';

  for (const line of lines) {
    // Skip headers, timestamps, and empty lines
    if (
      line.startsWith('WEBVTT') ||
      line.startsWith('Kind:') ||
      line.startsWith('Language:') ||
      line.includes('-->') ||
      line.trim() === ''
    ) {
      continue;
    }

    // Remove VTT formatting tags like <00:00:01.560><c> etc
    const cleanLine = line
      .replace(/<[^>]+>/g, '') // Remove all tags
      .replace(/\[Music\]/gi, '') // Remove [Music] markers
      .replace(/\[Applause\]/gi, '') // Remove [Applause] markers
      .replace(/\[Laughter\]/gi, '') // Remove [Laughter] markers
      .trim();

    // Skip duplicate lines (VTT often has overlapping text)
    if (cleanLine && cleanLine !== lastText && cleanLine.length > 0) {
      textLines.push(cleanLine);
      lastText = cleanLine;
    }
  }

  // Join and clean up extra whitespace
  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parse SRT subtitle content to plain text
 */
function parseSrtToText(srtContent: string): string {
  const lines = srtContent.split('\n');
  const textLines: string[] = [];
  let lastText = '';

  for (const line of lines) {
    // Skip sequence numbers, timestamps, and empty lines
    if (
      /^\d+$/.test(line.trim()) || // Sequence numbers
      line.includes('-->') || // Timestamps
      line.trim() === ''
    ) {
      continue;
    }

    // Clean the line
    const cleanLine = line
      .replace(/&#39;/g, "'") // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/<[^>]+>/g, '') // Remove any HTML tags
      .replace(/\[Music\]/gi, '') // Remove [Music] markers
      .replace(/\[Applause\]/gi, '')
      .replace(/\[Laughter\]/gi, '')
      .trim();

    // Skip duplicate lines
    if (cleanLine && cleanLine !== lastText && cleanLine.length > 0) {
      textLines.push(cleanLine);
      lastText = cleanLine;
    }
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Method 1: Fetch transcript using RapidAPI YouTube Captions Transcript API (nikzeferis)
 * This is the most reliable method for production environments
 */
async function fetchWithRapidAPI(videoId: string): Promise<{ transcript: string | null; title: string | null }> {
  // Support both RAPIDAPI_KEY and APP_RAPIDAPI_KEY (Coolify uses APP_ prefix)
  const apiKey = process.env.RAPIDAPI_KEY || process.env.APP_RAPIDAPI_KEY;

  if (!apiKey) {
    console.log('No RapidAPI key found - RAPIDAPI_KEY:', !!process.env.RAPIDAPI_KEY, 'APP_RAPIDAPI_KEY:', !!process.env.APP_RAPIDAPI_KEY);
    return { transcript: null, title: null };
  }

  console.log('RapidAPI key found, key prefix:', apiKey.substring(0, 8) + '...');

  try {
    console.log('Trying RapidAPI YouTube Captions Transcript API...');

    // Using the YouTube Captions Transcript Subtitles Video Combiner API by nikzeferis
    // Host: youtube-captions-transcript-subtitles-video-combiner.p.rapidapi.com
    // Adding lang=en to only fetch English captions (reduces response size significantly)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for longer videos

    const response = await fetch(
      `https://youtube-captions-transcript-subtitles-video-combiner.p.rapidapi.com/download-all/${videoId}?format_subtitle=srt&format_answer=json&lang=en`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'youtube-captions-transcript-subtitles-video-combiner.p.rapidapi.com',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    console.log('RapidAPI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('RapidAPI error response:', errorText.substring(0, 200));
      return { transcript: null, title: null };
    }

    const data = await response.json();
    console.log('RapidAPI response type:', typeof data, Array.isArray(data) ? 'array length: ' + data.length : '');

    // The API returns an array of subtitle tracks: [{ languageCode: "en", subtitle: "SRT content" }, ...]
    let transcriptText = '';

    if (data && Array.isArray(data) && data.length > 0) {
      // Find English subtitle track, or use first available
      const englishTrack = data.find((track: { languageCode?: string }) =>
        track.languageCode === 'en' || track.languageCode?.startsWith('en')
      );
      const track = englishTrack || data[0];

      if (track && track.subtitle) {
        // Parse SRT format to plain text
        transcriptText = parseSrtToText(track.subtitle);
      }
    }

    if (transcriptText.length > 50) {
      console.log('RapidAPI transcript length:', transcriptText.length);
      return { transcript: transcriptText, title: null };
    }

    console.log('RapidAPI transcript too short or empty');
    return { transcript: null, title: null };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('RapidAPI error:', errorMessage);
    // Check if it's an abort error (timeout)
    if (errorMessage.includes('abort')) {
      console.error('RapidAPI request timed out after 60 seconds');
    }
    return { transcript: null, title: null };
  }
}

/**
 * Method 2: Fetch transcript using YouTube's internal API
 * This method parses the YouTube page to extract caption data
 */
async function fetchTranscriptFromYouTube(videoId: string): Promise<{ transcript: string | null; title: string | null }> {
  try {
    console.log('Fetching YouTube page for video:', videoId);

    // Fetch the YouTube video page
    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!pageResponse.ok) {
      console.log('Failed to fetch YouTube page:', pageResponse.status);
      return { transcript: null, title: null };
    }

    const html = await pageResponse.text();

    // Extract title
    let title: string | null = null;
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      title = titleMatch[1].replace(' - YouTube', '').trim();
    }

    // Find the caption tracks in the page data
    const captionMatch = html.match(/"captions":\{"playerCaptionsTracklistRenderer":\{"captionTracks":\[([^\]]+)\]/);

    if (!captionMatch) {
      console.log('No caption tracks found in page');
      return { transcript: null, title };
    }

    // Parse the caption tracks JSON
    let captionTracks: Array<{ baseUrl: string; languageCode: string }>;
    try {
      captionTracks = JSON.parse(`[${captionMatch[1]}]`);
    } catch {
      console.log('Failed to parse caption tracks');
      return { transcript: null, title };
    }

    if (captionTracks.length === 0) {
      console.log('No caption tracks available');
      return { transcript: null, title };
    }

    // Prefer English captions
    let captionTrack = captionTracks.find(t =>
      t.languageCode === 'en' || t.languageCode?.startsWith('en')
    );
    if (!captionTrack) {
      captionTrack = captionTracks[0];
    }

    // Get the caption URL and unescape it
    let captionUrl = captionTrack.baseUrl;
    captionUrl = captionUrl.replace(/\\u0026/g, '&');

    // Fetch captions in JSON3 format (more reliable than XML)
    const captionResponse = await fetch(`${captionUrl}&fmt=json3`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    const captionText = await captionResponse.text();

    if (!captionResponse.ok || captionText.length === 0) {
      // Try without fmt parameter (XML format)
      const fallbackResponse = await fetch(captionUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!fallbackResponse.ok) {
        console.log('Failed to fetch captions');
        return { transcript: null, title };
      }

      const xmlContent = await fallbackResponse.text();
      if (xmlContent.length === 0) {
        console.log('Empty caption response');
        return { transcript: null, title };
      }

      // Parse XML format - extract text from <text> tags
      const texts: string[] = [];
      const textMatches = xmlContent.match(/<text[^>]*>([^<]*)<\/text>/g) || [];
      for (const textMatch of textMatches) {
        const innerMatch = textMatch.match(/<text[^>]*>([^<]*)<\/text>/);
        if (innerMatch && innerMatch[1]) {
          const text = innerMatch[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, ' ')
            .trim();
          if (text) texts.push(text);
        }
      }

      const transcript = texts.join(' ').replace(/\s+/g, ' ').trim();
      return { transcript: transcript || null, title };
    }

    // Parse JSON3 format
    let captionData;
    try {
      captionData = JSON.parse(captionText);
    } catch {
      console.log('Failed to parse caption JSON, trying XML parse');
      // Try parsing as XML if JSON fails
      const texts: string[] = [];
      const textMatches = captionText.match(/<text[^>]*>([^<]*)<\/text>/g) || [];
      for (const textMatch of textMatches) {
        const innerMatch = textMatch.match(/<text[^>]*>([^<]*)<\/text>/);
        if (innerMatch && innerMatch[1]) {
          texts.push(innerMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim());
        }
      }
      const transcript = texts.join(' ').replace(/\s+/g, ' ').trim();
      return { transcript: transcript || null, title };
    }

    // Extract text from JSON3 format
    const events = captionData.events || [];
    const textSegments: string[] = [];

    for (const event of events) {
      if (event.segs) {
        const segmentText = event.segs
          .map((seg: { utf8?: string }) => seg.utf8 || '')
          .join('')
          .trim();
        if (segmentText && segmentText !== '\n') {
          textSegments.push(segmentText);
        }
      }
    }

    const transcript = textSegments.join(' ').replace(/\s+/g, ' ').trim();
    console.log('Extracted transcript length:', transcript.length);

    return { transcript: transcript || null, title };

  } catch (error) {
    console.error('Error fetching transcript:', error);
    return { transcript: null, title: null };
  }
}

/**
 * Method 3: Use yt-dlp if available (for local development or Docker with yt-dlp)
 */
async function fetchWithYtDlp(videoId: string): Promise<{ transcript: string | null; title: string | null }> {
  try {
    // Only try this in Node.js environment with child_process
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { readFile, unlink } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const { join } = await import('path');

    const execAsync = promisify(exec);
    const tempFile = join(tmpdir(), `yt_transcript_${videoId}_${Date.now()}`);

    console.log('Trying yt-dlp for subtitles...');

    // Download subtitles only (no video)
    const command = `yt-dlp --write-auto-sub --sub-lang en --sub-format vtt --skip-download --no-warnings -o "${tempFile}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;

    const { stdout } = await execAsync(command, { timeout: 60000 });
    console.log('yt-dlp output:', stdout.substring(0, 200));

    // Read the subtitle file
    const subtitlePath = `${tempFile}.en.vtt`;
    let transcript: string | null = null;

    try {
      const vttContent = await readFile(subtitlePath, 'utf-8');
      transcript = parseVttToText(vttContent);
      await unlink(subtitlePath).catch(() => {});
    } catch {
      console.log('Could not read subtitle file');
    }

    // Get video title
    let title: string | null = null;
    try {
      const titleCommand = `yt-dlp --get-title --no-warnings "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`;
      const { stdout: titleOutput } = await execAsync(titleCommand, { timeout: 30000 });
      title = titleOutput.trim();
    } catch {
      // Title is optional
    }

    return { transcript, title };
  } catch (error) {
    // yt-dlp not available or failed
    console.log('yt-dlp not available:', (error as Error).message);
    return { transcript: null, title: null };
  }
}

/**
 * Method 4: Fallback - Download audio and transcribe with Whisper
 * This is expensive but very reliable
 */
async function transcribeWithWhisper(videoId: string): Promise<string | null> {
  try {
    // This requires yt-dlp for audio download
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { readFile, unlink } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const { join } = await import('path');

    const execAsync = promisify(exec);
    const tempFile = join(tmpdir(), `yt_audio_${videoId}_${Date.now()}.mp3`);

    console.log('Downloading audio with yt-dlp for Whisper transcription...');

    // Download audio only
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 9 -o "${tempFile}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;

    await execAsync(command, { timeout: 180000 });

    // Read the audio file
    const audioBuffer = await readFile(tempFile);
    console.log('Audio downloaded, size:', audioBuffer.length);

    // Create a File-like object for OpenAI
    const audioData = new Uint8Array(audioBuffer);
    const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
    const audioFile = new File([audioBlob], 'audio.mp3', { type: 'audio/mp3' });

    // Use OpenAI Whisper for transcription
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log('Transcribing with Whisper...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    // Clean up
    await unlink(tempFile).catch(() => {});

    return transcription.text;
  } catch (error) {
    console.error('Whisper transcription failed:', error);
    return null;
  }
}

/**
 * Fetch transcript from a YouTube video
 * Tries multiple methods in order of reliability:
 * 1. RapidAPI (most reliable for production)
 * 2. Direct YouTube page parsing
 * 3. yt-dlp (if available)
 * 4. Whisper transcription (expensive fallback)
 */
export async function fetchYouTubeTranscript(url: string): Promise<TranscriptResult> {
  try {
    const videoId = extractVideoId(url);

    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    console.log('Fetching transcript for video:', videoId);
    console.log('RAPIDAPI_KEY configured:', !!process.env.RAPIDAPI_KEY);
    console.log('APP_RAPIDAPI_KEY configured:', !!process.env.APP_RAPIDAPI_KEY);

    // Method 1: Try RapidAPI (most reliable for production)
    console.log('Method 1: Trying RapidAPI...');
    let result = await fetchWithRapidAPI(videoId);

    if (result.transcript && result.transcript.length > 50) {
      console.log('Successfully got transcript via RapidAPI, length:', result.transcript.length);

      // Get title from oEmbed if not provided
      let title = result.title;
      if (!title) {
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
      }

      return {
        success: true,
        transcript: result.transcript,
        title: title || undefined,
      };
    }

    // Method 2: Try direct YouTube page parsing
    console.log('Method 2: Trying direct YouTube fetch...');
    result = await fetchTranscriptFromYouTube(videoId);

    if (result.transcript && result.transcript.length > 50) {
      console.log('Successfully got transcript via direct fetch, length:', result.transcript.length);
      return {
        success: true,
        transcript: result.transcript,
        title: result.title || undefined,
      };
    }

    // Method 3: Try yt-dlp (works locally or in Docker with yt-dlp installed)
    console.log('Method 3: Trying yt-dlp...');
    result = await fetchWithYtDlp(videoId);

    if (result.transcript && result.transcript.length > 50) {
      console.log('Successfully got transcript via yt-dlp, length:', result.transcript.length);
      return {
        success: true,
        transcript: result.transcript,
        title: result.title || undefined,
      };
    }

    // Method 4: Fall back to Whisper transcription (expensive but reliable)
    console.log('Method 4: Trying Whisper transcription...');
    const whisperTranscript = await transcribeWithWhisper(videoId);

    if (whisperTranscript) {
      // Get title if we don't have it
      let videoTitle = result.title;
      if (!videoTitle) {
        try {
          const oembedResponse = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
          );
          if (oembedResponse.ok) {
            const oembedData = await oembedResponse.json();
            videoTitle = oembedData.title;
          }
        } catch {
          // Title fetch is optional
        }
      }

      return {
        success: true,
        transcript: whisperTranscript,
        title: videoTitle || undefined,
      };
    }

    return {
      success: false,
      error: 'Could not get transcript. Video may not have captions or may be restricted.'
    };
  } catch (error) {
    console.error('YouTube transcript fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch transcript'
    };
  }
}

/**
 * External Editor Bridge
 * 
 * Helper functions and types for integrating with external React video editor.
 * This file can be copied to your external editor project for seamless integration.
 */

export interface VideoEditorData {
  videoId: string;
  userId: string;
  script: string;
  createdAt: string;
  updatedAt: string;
  
  voice: {
    url: string;
    whisperData: any;
  };
  
  images: {
    urls: string[];
    segments: any[];
  };
  
  captions: {
    data: any;
    wordTimings: any[];
  };
  
  metadata: {
    totalDuration: number;
    frameRate: number;
    wordCount: number;
    speakingRate: number;
  };
  
  apiEndpoint: string;
}

/**
 * Fetches video editor data from the BlueFX API
 * Use this in your external editor to load video data
 */
export async function fetchVideoEditorData(
  bluefxApiUrl: string = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  videoId?: string
): Promise<VideoEditorData | null> {
  try {
    const url = videoId 
      ? `${bluefxApiUrl}/api/script-video/editor-data?videoId=${videoId}`
      : `${bluefxApiUrl}/api/script-video/editor-data`;
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include', // Include cookies for auth
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch video data');
    }

    return result.data;
  } catch (error) {
    console.error('Error fetching video editor data:', error);
    return null;
  }
}

/**
 * Gets video parameters from URL (new simplified approach)
 */
export function getVideoParamsFromUrl(): { videoId?: string; userId?: string; apiUrl?: string } | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('videoId');
    const userId = urlParams.get('userId');
    const apiUrl = urlParams.get('apiUrl');
    
    if (!videoId || !userId || !apiUrl) {
      return null;
    }

    return { videoId, userId, apiUrl };
  } catch (error) {
    console.error('Error parsing video params from URL:', error);
    return null;
  }
}

/**
 * Parses video data from URL parameters (legacy method for backward compatibility)
 */
export function parseVideoDataFromUrl(): VideoEditorData | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    
    if (!dataParam) {
      return null;
    }

    const decodedData = decodeURIComponent(dataParam);
    return JSON.parse(decodedData);
  } catch (error) {
    console.error('Error parsing video data from URL:', error);
    return null;
  }
}

/**
 * Hook for React components in external editor
 * Usage example in your external editor:
 * 
 * ```tsx
 * import { useVideoEditorData } from './external-editor-bridge';
 * 
 * function VideoEditor() {
 *   const { data, loading, error } = useVideoEditorData();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!data) return <div>No video data available</div>;
 *   
 *   return (
 *     <div>
 *       <h1>Editing: {data.videoId}</h1>
 *       <audio src={data.voice.url} controls />
 *       {data.images.urls.map((url, index) => (
 *         <img key={index} src={url} alt={`Scene ${index + 1}`} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVideoEditorData(bluefxApiUrl?: string) {
  // Note: This is a TypeScript interface only
  // You'll need to implement this hook in your external editor using React
  return {
    data: null as VideoEditorData | null,
    loading: true,
    error: null as string | null,
    refetch: () => {},
  };
}

/**
 * Example integration guide for external editor
 */
export const INTEGRATION_GUIDE = `
# Integration Guide for External React Video Editor

## 1. Install this bridge file in your external editor:
Copy this file to your external editor project and import the needed functions.

## 2. Handle the redirect data:
Your external editor should check for data in URL params first, then fall back to API:

\`\`\`tsx
import { parseVideoDataFromUrl, fetchVideoEditorData } from './external-editor-bridge';

useEffect(() => {
  // Try to get data from URL first (redirect scenario)
  let videoData = parseVideoDataFromUrl();
  
  if (!videoData) {
    // Fall back to fetching from API
    fetchVideoEditorData().then(setVideoData);
  } else {
    setVideoData(videoData);
  }
}, []);
\`\`\`

## 3. Your external editor should run on localhost:3001
Update the port in EditorRedirect component if using a different port.

## 4. CORS Setup:
The API includes CORS headers for localhost:3001. Update if needed.

## 5. Asset URLs:
All image and voice URLs are direct URLs to Supabase storage and should work cross-origin.
`;
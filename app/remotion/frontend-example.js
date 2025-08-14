// Frontend integration example for Remotion SSR
// Add these environment variables to your frontend app

// For React/Next.js/.env.local:
// NEXT_PUBLIC_REMOTION_SERVER_URL=http://localhost:3000
// NEXT_PUBLIC_REMOTION_API_KEY=your-secure-api-key-here

// For Vue.js/.env:
// VUE_APP_REMOTION_SERVER_URL=http://localhost:3000
// VUE_APP_REMOTION_API_KEY=your-secure-api-key-here

// For Vite/.env:
// VITE_REMOTION_SERVER_URL=http://localhost:3000
// VITE_REMOTION_API_KEY=your-secure-api-key-here

class RemotionClient {
  constructor() {
    // Adjust these based on your frontend framework
    this.serverUrl = process.env.NEXT_PUBLIC_REMOTION_SERVER_URL || 
                     process.env.VUE_APP_REMOTION_SERVER_URL ||
                     process.env.VITE_REMOTION_SERVER_URL ||
                     'http://localhost:3000';
    
    this.apiKey = process.env.NEXT_PUBLIC_REMOTION_API_KEY || 
                  process.env.VUE_APP_REMOTION_API_KEY ||
                  process.env.VITE_REMOTION_API_KEY ||
                  'demo-key-change-in-production';
  }

  async renderVideo(compositionId, inputProps = {}, options = {}) {
    const response = await fetch(`${this.serverUrl}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        compositionId,
        inputProps,
        codec: options.codec || 'h264',
        quality: options.quality || 80,
        ...options
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Render failed: ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  async renderStill(compositionId, inputProps = {}, options = {}) {
    const response = await fetch(`${this.serverUrl}/render-still`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        compositionId,
        inputProps,
        frame: options.frame || 0,
        imageFormat: options.imageFormat || 'png',
        ...options
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Still render failed: ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  async getCompositions() {
    const response = await fetch(`${this.serverUrl}/compositions`, {
      headers: {
        'X-API-Key': this.apiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get compositions: ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    return await response.json();
  }

  async checkHealth() {
    const response = await fetch(`${this.serverUrl}/health`);
    return await response.json();
  }

  getDownloadUrl(downloadUrl) {
    return `${this.serverUrl}${downloadUrl}`;
  }

  async getVideoBlob(downloadUrl) {
    const response = await fetch(this.getDownloadUrl(downloadUrl));
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }
    return await response.blob();
  }

  async getVideoObjectUrl(downloadUrl) {
    const blob = await this.getVideoBlob(downloadUrl);
    return URL.createObjectURL(blob);
  }
}

// Usage examples:

// Initialize the client
const remotion = new RemotionClient();

// Example 1: Render a video with improved error handling
async function renderCustomVideo() {
  try {
    console.log('Starting video render...');
    
    const result = await remotion.renderVideo('MyVideo', {
      titleText: 'Hello from Frontend!',
      titleColor: 'blue'
    });
    
    console.log('Video rendered successfully:', {
      filename: result.filename,
      fileSize: result.fileSize,
      renderTime: result.renderTime
    });
    
    // Get the full download URL
    const downloadUrl = remotion.getDownloadUrl(result.downloadUrl);
    console.log('Download URL:', downloadUrl);
    
    return {
      ...result,
      fullDownloadUrl: downloadUrl
    };
  } catch (error) {
    console.error('Video render failed:', error);
    throw error;
  }
}

// Example 2: Render with immediate playback
async function renderAndPlayVideo() {
  try {
    const result = await remotion.renderVideo('MyVideo', {
      titleText: 'Hello from Frontend!',
      titleColor: 'blue'
    });
    
    // Get object URL for immediate playback
    const objectUrl = await remotion.getVideoObjectUrl(result.downloadUrl);
    
    // Create video element and play
    const video = document.createElement('video');
    video.src = objectUrl;
    video.controls = true;
    video.autoplay = true;
    
    document.body.appendChild(video);
    
    // Clean up object URL when done
    video.addEventListener('loadedmetadata', () => {
      console.log('Video ready for playback');
    });
    
    return result;
  } catch (error) {
    console.error('Video render and play failed:', error);
    throw error;
  }
}

// Example 3: Get available compositions
async function getAvailableCompositions() {
  try {
    const compositions = await remotion.getCompositions();
    console.log('Available compositions:', compositions.map(c => c.id));
    return compositions;
  } catch (error) {
    console.error('Failed to get compositions:', error);
    throw error;
  }
}

// Example 4: Check server health
async function checkServerHealth() {
  try {
    const health = await remotion.checkHealth();
    console.log('Server health:', health);
    return health;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
}

// React Hook Example (if using React)
// import { useState, useEffect } from 'react';

// export function useRemotion() {
//   const [client] = useState(() => new RemotionClient());
//   const [isHealthy, setIsHealthy] = useState(false);

//   useEffect(() => {
//     client.checkHealth()
//       .then(() => setIsHealthy(true))
//       .catch(() => setIsHealthy(false));
//   }, [client]);

//   return { client, isHealthy };
// }

// React Component Example
// function VideoRenderer() {
//   const { client, isHealthy } = useRemotion();
//   const [rendering, setRendering] = useState(false);
//   const [result, setResult] = useState(null);

//   const handleRender = async () => {
//     setRendering(true);
//     try {
//       const result = await client.renderVideo('MyVideo', {
//         titleText: 'Custom Title',
//         titleColor: 'blue'
//       });
//       setResult(result);
//     } catch (error) {
//       console.error('Render failed:', error);
//     } finally {
//       setRendering(false);
//     }
//   };

//   if (!isHealthy) {
//     return <div>Server is not available</div>;
//   }

//   return (
//     <div>
//       <button onClick={handleRender} disabled={rendering}>
//         {rendering ? 'Rendering...' : 'Render Video'}
//       </button>
//       {result && (
//         <div>
//           <p>Video rendered: {result.filename}</p>
//           <a href={client.getDownloadUrl(result.downloadUrl)} download>
//             Download Video
//           </a>
//         </div>
//       )}
//     </div>
//   );
// }

export { RemotionClient }; 
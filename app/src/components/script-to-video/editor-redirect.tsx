'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * EditorRedirect Component
 * 
 * Handles the transition from the internal editor to the external React video editor.
 * This component:
 * 1. Loads the user's latest script video data
 * 2. Redirects to the external editor running on localhost:3001
 * 3. Passes the video data via URL parameters for the external editor to consume
 */
export function EditorRedirect() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirectToExternalEditor = async () => {
      try {
        setIsLoading(true);
        
        // Get authenticated user
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          setError('Authentication required');
          router.push('/dashboard/script-to-video');
          return;
        }

        // Fetch the latest script video data using the editor-data endpoint
        const response = await fetch('/api/script-video/editor-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error:', response.status, errorText);
          throw new Error(`Failed to load video data: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.data) {
          setError('No video data found. Please generate a video first.');
          setTimeout(() => router.push('/dashboard/script-to-video'), 2000);
          return;
        }

        // The videoData is already properly formatted by the editor-data API
        const videoData = data.data;

        // Pass only essential data via URL to avoid size limits
        const essentialData = {
          videoId: videoData.videoId,
          userId: videoData.userId,
          // External editor can fetch full data using these IDs
          apiEndpoint: videoData.apiEndpoint
        };
        
        // Redirect to external editor root with minimal data
        // External editor should fetch full data using the API endpoint
        const externalEditorUrl = `http://localhost:3001/?videoId=${videoData.videoId}&userId=${videoData.userId}&apiUrl=http://localhost:3000`;
        
        // Use window.location for external redirect
        window.location.href = externalEditorUrl;
        
      } catch (err) {
        console.error('Error redirecting to external editor:', err);
        setError('Failed to load video data. Please try again.');
        setTimeout(() => router.push('/dashboard/script-to-video'), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    redirectToExternalEditor();
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-red-500 mb-4">❌ {error}</div>
        <div className="text-gray-500">Redirecting back to Script to Video...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <div className="text-lg mb-2">Opening External Video Editor...</div>
      <div className="text-gray-500">Loading your video assets and redirecting...</div>
    </div>
  );
}
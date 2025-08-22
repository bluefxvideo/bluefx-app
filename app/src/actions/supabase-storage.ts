'use server';

import { createClient, createAdminClient } from '@/app/supabase/server';

/**
 * Supabase Storage Operations for Thumbnail Machine
 * Handles reference image uploads before sending to Replicate
 */

interface UploadImageResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

interface UploadImageOptions {
  bucket?: string;
  folder?: string;
  filename?: string;
  contentType?: string;
  upsert?: boolean;
}

/**
 * Upload image to Supabase Storage and return public URL
 * Replicates legacy uploadImageToStorage() functionality
 */
export async function uploadImageToStorage(
  imageData: string | File | Blob,
  options: UploadImageOptions = {}
): Promise<UploadImageResult> {
  try {
    // Validate environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL not configured');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    // Use admin client for server-side uploads to bypass RLS policies
    const supabase = createAdminClient();
    
    const {
      bucket = 'images',
      folder = 'public',
      filename,
      contentType = 'image/png',
      upsert = true
    } = options;

    // Generate filename if not provided
    const finalFilename = filename || `thumbnail_${Date.now()}.png`;
    const filePath = `${folder}/${finalFilename}`;

    // Convert different input types to uploadable format
    let uploadData: File | Blob;
    let finalContentType = contentType;

    if (typeof imageData === 'string') {
      // Handle base64 data URLs (from legacy system)
      if (imageData.startsWith('data:')) {
        const [header, base64Data] = imageData.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch) {
          finalContentType = mimeMatch[1];
        }
        
        // Convert base64 to blob
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        uploadData = new Blob([bytes], { type: finalContentType });
      } else {
        // Handle regular URLs - would need to fetch first
        throw new Error('URL uploads not supported - convert to base64 or File first');
      }
    } else {
      // Handle File/Blob directly
      uploadData = imageData;
      
      // Safer type checking for File objects (File might not be available in server env)
      if (typeof File !== 'undefined' && imageData instanceof File) {
        finalContentType = imageData.type || contentType;
      } else if (imageData && typeof imageData === 'object' && 'type' in imageData) {
        // Handle File-like objects that have a type property
        finalContentType = (imageData as any).type || contentType;
      }
    }

    console.log(`Uploading image to storage: ${bucket}/${filePath}`, {
      contentType: finalContentType,
      dataSize: uploadData.size,
      upsert
    });

    // Upload to Supabase Storage
    const { error, data } = await supabase.storage
      .from(bucket)
      .upload(filePath, uploadData, {
        contentType: finalContentType,
        upsert,
      });

    if (error) {
      console.error('Supabase Storage upload error:', {
        message: error.message,
        bucket,
        filePath,
        contentType: finalContentType,
        dataSize: uploadData.size,
        error: error
      });
      return {
        success: false,
        error: `Upload failed: ${error.message} (bucket: ${bucket}, path: ${filePath})`,
      };
    }

    console.log('Upload successful:', data);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('Image uploaded successfully:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      path: filePath,
    };

  } catch (error) {
    console.error('uploadImageToStorage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}

/**
 * Download image from URL and re-upload to Supabase Storage
 * Used by webhook handler to store Replicate results
 */
export async function downloadAndUploadImage(
  imageUrl: string,
  toolType: string = 'thumbnail-machine',
  uniqueId?: string,
  options: UploadImageOptions = {}
): Promise<UploadImageResult> {
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    
    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const imageBlob = await response.blob();
    
    // Generate filename based on legacy pattern
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const filename = uniqueId 
      ? `${toolType}_${uniqueId}_${timestamp}.png`
      : `${toolType}_${timestamp}.jpg`;

    // Upload using existing function
    return await uploadImageToStorage(imageBlob, {
      ...options,
      filename,
      contentType: imageBlob.type || 'image/png',
    });

  } catch (error) {
    console.error('downloadAndUploadImage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download/upload failed',
    };
  }
}

/**
 * Download and upload video to Supabase Storage
 * Used for AI Cinematographer video results
 */
export async function downloadAndUploadVideo(
  videoUrl: string,
  toolType: string = 'ai-cinematographer',
  uniqueId?: string,
  options: UploadImageOptions = {}
): Promise<UploadImageResult> {
  try {
    console.log(`Downloading video from: ${videoUrl}`);
    
    // Download video
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }
    const videoBlob = await response.blob();
    
    // Generate filename for video
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const filename = uniqueId 
      ? `${toolType}_${uniqueId}_${timestamp}.mp4`
      : `${toolType}_${timestamp}.mp4`;
    
    // Upload to videos bucket
    return await uploadVideoToStorage(videoBlob, {
      ...options,
      filename,
      contentType: videoBlob.type || 'video/mp4',
    });
  } catch (error) {
    console.error('downloadAndUploadVideo error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Video download/upload failed',
    };
  }
}

/**
 * Upload video file to Supabase Storage and return public URL
 * Used for AI Cinematographer and other video tools
 */
export async function uploadVideoToStorage(
  videoData: string | File | Blob,
  options: UploadImageOptions = {}
): Promise<UploadImageResult> {
  try {
    // Use admin client for server-side uploads to bypass RLS policies
    const supabase = createAdminClient();
    
    const {
      bucket = 'videos',
      folder = 'cinematographer',
      filename,
      contentType = 'video/mp4',
      upsert = true
    } = options;

    // Generate filename if not provided
    const finalFilename = filename || `video_${Date.now()}.mp4`;
    const filePath = `${folder}/${finalFilename}`;

    // Convert different input types to uploadable format
    let uploadData: File | Blob;
    let finalContentType = contentType;

    if (typeof videoData === 'string') {
      throw new Error('String video data not supported - provide File or Blob');
    } else {
      // Handle File/Blob directly
      uploadData = videoData;
      
      // Safer type checking for File objects
      if (typeof File !== 'undefined' && videoData instanceof File) {
        finalContentType = videoData.type || contentType;
      } else if (videoData && typeof videoData === 'object' && 'type' in videoData) {
        finalContentType = (videoData as any).type || contentType;
      }
    }

    console.log(`Uploading video to storage: ${bucket}/${filePath}`, {
      contentType: finalContentType,
      dataSize: uploadData.size,
      upsert
    });

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, uploadData, {
        contentType: finalContentType,
        upsert
      });

    if (error) {
      console.error('Supabase Storage upload error:', {
        message: error.message,
        bucket,
        filePath,
        contentType: finalContentType,
        dataSize: uploadData.size,
        error
      });
      throw error;
    }

    console.log('Upload successful:', data);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    console.log(`Video uploaded successfully: ${publicUrl}`);

    return {
      success: true,
      url: publicUrl,
      path: filePath,
    };

  } catch (error) {
    console.error('uploadVideoToStorage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Video upload failed',
    };
  }
}

/**
 * Upload audio file to Supabase Storage and return public URL
 * Used for music generation input audio conditioning
 */
export async function uploadAudioToStorage(
  audioData: string | File | Blob,
  options: UploadImageOptions = {}
): Promise<UploadImageResult> {
  try {
    // Use admin client for server-side uploads to bypass RLS policies
    const supabase = createAdminClient();
    
    const {
      bucket = 'audio', // Use audio bucket for audio files
      folder = 'public',
      filename,
      contentType = 'audio/mpeg',
      upsert = true
    } = options;

    // Generate filename if not provided
    const finalFilename = filename || `audio_${Date.now()}.mp3`;
    const filePath = `${folder}/${finalFilename}`;

    // Convert different input types to uploadable format
    let uploadData: File | Blob;
    let finalContentType = contentType;

    if (typeof audioData === 'string') {
      // Handle base64 data URLs
      if (audioData.startsWith('data:')) {
        const [header, base64Data] = audioData.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch) {
          finalContentType = mimeMatch[1];
        }
        
        // Convert base64 to blob
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        uploadData = new Blob([bytes], { type: finalContentType });
      } else {
        // Handle regular URLs - would need to fetch first
        throw new Error('URL uploads not supported - convert to base64 or File first');
      }
    } else {
      // Handle File/Blob directly
      uploadData = audioData;
      
      // Safer type checking for File objects (File might not be available in server env)
      if (typeof File !== 'undefined' && audioData instanceof File) {
        finalContentType = audioData.type || contentType;
      } else if (audioData && typeof audioData === 'object' && 'type' in audioData) {
        // Handle File-like objects that have a type property
        finalContentType = (audioData as any).type || contentType;
      }
    }

    console.log(`Uploading audio to storage: ${bucket}/${filePath}`);

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, uploadData, {
        contentType: finalContentType,
        upsert,
      });

    if (error) {
      console.error('Audio upload error:', error);
      return {
        success: false,
        error: `Upload failed: ${error.message}`,
      };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('Audio uploaded successfully:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      path: filePath,
    };

  } catch (error) {
    console.error('uploadAudioToStorage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImageFromStorage(
  filePath: string,
  bucket: string = 'images'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      return {
        success: false,
        error: `Delete failed: ${error.message}`,
      };
    }

    return { success: true };

  } catch (error) {
    console.error('deleteImageFromStorage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Get public URL for stored image
 */
export async function getImagePublicUrl(
  filePath: string,
  bucket: string = 'images'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      success: true,
      url: data.publicUrl,
    };

  } catch (error) {
    console.error('getImagePublicUrl error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get URL',
    };
  }
}

/**
 * List images in storage bucket
 */
export async function listStorageImages(
  folder: string = 'public',
  bucket: string = 'images'
): Promise<{ success: boolean; files?: Record<string, unknown>[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder);

    if (error) {
      return {
        success: false,
        error: `List failed: ${error.message}`,
      };
    }

    return {
      success: true,
      files: data as unknown as Record<string, unknown>[],
    };

  } catch (error) {
    console.error('listStorageImages error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'List failed',
    };
  }
}
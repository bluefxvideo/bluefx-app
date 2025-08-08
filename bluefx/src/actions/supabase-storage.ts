'use server';

import { createClient } from '@/app/supabase/server';

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
    const supabase = await createClient();
    
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
      if (imageData instanceof File) {
        finalContentType = imageData.type || contentType;
      }
    }

    console.log(`Uploading image to storage: ${bucket}/${filePath}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, uploadData, {
        contentType: finalContentType,
        upsert,
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: `Upload failed: ${error.message}`,
      };
    }

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
 * Upload audio file to Supabase Storage and return public URL
 * Used for music generation input audio conditioning
 */
export async function uploadAudioToStorage(
  audioData: string | File | Blob,
  options: UploadImageOptions = {}
): Promise<UploadImageResult> {
  try {
    const supabase = await createClient();
    
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
      if (audioData instanceof File) {
        finalContentType = audioData.type || contentType;
      }
    }

    console.log(`Uploading audio to storage: ${bucket}/${filePath}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
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
      files: data,
    };

  } catch (error) {
    console.error('listStorageImages error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'List failed',
    };
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';

/**
 * API Route for Video Swap file uploads
 * Handles both video and image uploads via FormData
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string; // 'video' or 'image'
    const jobId = formData.get('jobId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!type || !['video', 'image'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Must be "video" or "image"' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Determine bucket and path
    const bucket = type === 'video' ? 'videos' : 'images';
    const folder = 'video-swap';
    const extension = file.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg');
    const filename = `${jobId}_${type}.${extension}`;
    const filePath = `${folder}/${filename}`;

    console.log(`📤 Uploading ${type} to ${bucket}/${filePath}`, {
      size: file.size,
      type: file.type,
    });

    // Convert File to ArrayBuffer for server-side upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log(`✅ ${type} uploaded: ${urlData.publicUrl}`);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    });

  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

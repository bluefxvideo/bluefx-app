import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';

/**
 * API Route for AI Cinematographer file uploads
 * Handles image uploads via FormData - required because File objects
 * cannot be properly serialized through Next.js server actions
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string; // 'reference' or 'last_frame'
    const batchId = formData.get('batchId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!type || !['reference', 'last_frame'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Must be "reference" or "last_frame"' },
        { status: 400 }
      );
    }

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'No batchId provided' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Determine path
    const bucket = 'images';
    const folder = 'cinematographer';
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `${batchId}_${type}.${extension}`;
    const filePath = `${folder}/${filename}`;

    console.log(`📤 Uploading ${type} image to ${bucket}/${filePath}`, {
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
        contentType: file.type || 'image/jpeg',
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

    console.log(`✅ ${type} image uploaded: ${urlData.publicUrl}`);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    });

  } catch (error) {
    console.error('Cinematographer upload route error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

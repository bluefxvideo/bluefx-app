import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';

/**
 * API Route for ReelEstate photo uploads
 * Handles multiple image uploads via FormData and returns public URLs
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const bucket = 'images';
    const folder = 'reelestate';
    const uploadedUrls: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const extension = file.name.split('.').pop() || 'jpg';
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const filename = `${uniqueSuffix}.${extension}`;
      const filePath = `${folder}/${filename}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error(`❌ Upload error for ${file.name}:`, error);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      uploadedUrls.push(urlData.publicUrl);
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files uploaded successfully' },
        { status: 500 }
      );
    }

    console.log(`✅ ReelEstate: uploaded ${uploadedUrls.length} photos`);

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
    });

  } catch (error) {
    console.error('❌ ReelEstate upload route error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

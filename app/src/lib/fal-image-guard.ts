import { uploadImageToStorage } from '@/actions/supabase-storage';

/**
 * fal.ai rejects input images over 7 MiB (error: file_too_large) — and the
 * effective limit is stricter than stated: a 6.69MB file was rejected
 * (reproduced 2026-07-04), consistent with fal measuring the base64-inflated
 * size (raw × 4/3 must stay under 7,340,032 → raw ceiling ≈ 5.5MB). Our
 * uploader accepts 10MB, so large photos (e.g. real-estate shots) passed the
 * UI and then failed asynchronously in fal's queue. Anything over 5MB gets
 * re-encoded with sharp (capped at 4K width, progressively lower JPEG
 * quality until it fits), uploaded as a copy, and submitted instead. Fails
 * open: any error returns the original URL so generation is still attempted.
 */
export const FAL_IMAGE_SAFE_BYTES = 5_000_000;

export async function ensureFalCompatibleImage(
  imageUrl: string | undefined,
  batchId: string,
  label: string
): Promise<string | undefined> {
  if (!imageUrl) return imageUrl;
  try {
    const head = await fetch(imageUrl, { method: 'HEAD' });
    const size = parseInt(head.headers.get('content-length') || '0', 10);
    if (!size || size <= FAL_IMAGE_SAFE_BYTES) return imageUrl;

    console.log(`🗜️ ${label} is ${(size / 1e6).toFixed(1)}MB — compressing for fal (limit 7MiB)`);
    const response = await fetch(imageUrl);
    if (!response.ok) return imageUrl;
    const input = Buffer.from(await response.arrayBuffer());

    const sharp = (await import('sharp')).default;
    let output: Buffer | null = null;
    for (const quality of [85, 75, 65]) {
      const candidate = await sharp(input)
        .rotate() // respect EXIF orientation before stripping metadata
        .resize({ width: 3840, height: 3840, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (candidate.length <= FAL_IMAGE_SAFE_BYTES) {
        output = candidate;
        break;
      }
    }
    if (!output) return imageUrl;

    const upload = await uploadImageToStorage(new Blob([new Uint8Array(output)], { type: 'image/jpeg' }), {
      bucket: 'images',
      folder: 'cinematographer',
      filename: `${batchId}_${label}_fal.jpg`,
      contentType: 'image/jpeg',
    });
    if (upload.success && upload.url) {
      console.log(`🗜️ ${label} compressed to ${(output.length / 1e6).toFixed(1)}MB:`, upload.url);
      return upload.url;
    }
    return imageUrl;
  } catch (error) {
    console.warn(`⚠️ ${label} compression failed — using original:`, error);
    return imageUrl;
  }
}

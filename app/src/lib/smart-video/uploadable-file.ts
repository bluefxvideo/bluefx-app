/**
 * An AVIF photo made a PNG in the browser before it is uploaded (owner 2026-11-07): the server's image library (sharp
 * on Alpine) turned an Amazon AVIF book cover into a picture with pure green blocks, and the AI presenter held that
 * cover. Browsers decode AVIF reliably. PNG keeps a transparent background. Any other file, or a browser that cannot
 * draw it, is sent as it is.
 */
export async function uploadableFile(file: File): Promise<File> {
  if (file.type !== 'image/avif' && !/\.avif$/i.test(file.name)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.avif$/i, '')}.png`, { type: 'image/png' });
  } catch {
    return file;
  }
}

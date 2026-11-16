/**
 * Browser-side image preparation before upload: downscale large photos to the category's
 * longest-side limit and make a small WebP thumbnail for galleries. Saves upload time, storage
 * and quota; the server still verifies the bytes it receives.
 */

/** Longest side of gallery thumbnails, in pixels. */
const THUMB_SIZE = 320;
/** JPEG/WebP quality for downscaled photos; visually lossless for item photos. */
const PHOTO_QUALITY = 0.85;
/** Re-encodable types; GIF (animation) and HEIC (no browser decoder) are sent as they are. */
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Upload-ready image plus what the server stores about it. */
export interface PreparedImage {
  file: File;
  width?: number;
  height?: number;
  thumb?: Blob;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function draw(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Downscales and thumbnails an image when the browser can decode it; otherwise returns the
 * original file untouched (the server accepts it if the type is allowed).
 *
 * @param file picked or captured file
 * @param maxDimension category limit for the longest side; null = keep size
 * @returns the file to upload, its pixel size, and a WebP thumbnail when one could be made
 */
export async function prepareImage(file: File, maxDimension: number | null): Promise<PreparedImage> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return { file };

  let bitmap: ImageBitmap;
  try {
    // from-image honours EXIF rotation, so phone photos are stored upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return { file }; // e.g. HEIC on browsers without a decoder
  }

  try {
    let out = file;
    let width = bitmap.width;
    let height = bitmap.height;
    if (RESIZABLE.has(file.type) && maxDimension && Math.max(width, height) > maxDimension) {
      const canvas = draw(bitmap, maxDimension);
      const blob = await toBlob(canvas, file.type, file.type === 'image/png' ? undefined : PHOTO_QUALITY);
      // Keep the original if re-encoding did not help (already small or well compressed).
      if (blob && blob.type === file.type && blob.size < file.size) {
        out = new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
        width = canvas.width;
        height = canvas.height;
      }
    }
    const thumb = await toBlob(draw(bitmap, THUMB_SIZE), 'image/webp', 0.8);
    // Browsers without a WebP encoder return PNG; the server only accepts WebP thumbnails.
    return { file: out, width, height, thumb: thumb && thumb.type === 'image/webp' ? thumb : undefined };
  } finally {
    bitmap.close();
  }
}

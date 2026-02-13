/**
 * Photo Upload Utility
 *
 * Handles uploading order photos to MinIO (S3-compatible storage).
 * When MINIO_* env vars are configured, uses real MinIO. Otherwise returns mock URLs for dev.
 */

import { Client } from 'minio';

export interface UploadPhotoResult {
  success: boolean;
  url?: string;
  error?: string;
}

function getMinioClient(): Client | null {
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  const port = parseInt(process.env.MINIO_PORT || '9000', 10);
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  return new Client({
    endPoint: endpoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });
}

/**
 * Upload order photo to storage
 *
 * @param file - File to upload
 * @param tenantOrgId - Tenant organization ID
 * @param orderId - Order ID
 * @returns Upload result with URL
 */
export async function uploadOrderPhoto(
  file: File,
  tenantOrgId: string,
  orderId: string
): Promise<UploadPhotoResult> {
  try {
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { success: false, error: 'File size exceeds 5MB limit' };
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed',
      };
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;
    const key = `orders/${tenantOrgId}/${orderId}/photos/${filename}`;

    const client = getMinioClient();
    const bucket = process.env.MINIO_BUCKET || 'cleanmatex';

    if (client) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await client.putObject(bucket, key, buffer, file.size, {
        'Content-Type': file.type,
      });
      const url = await client.presignedGetObject(bucket, key, 24 * 60 * 60);
      return { success: true, url };
    }

    // Fallback: mock URL when MinIO not configured
    const mockUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:9000'}/orders/${tenantOrgId}/${orderId}/photos/${filename}`;
    return { success: true, url: mockUrl };
  } catch (error) {
    console.error('[uploadOrderPhoto] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload photo',
    };
  }
}

/**
 * Delete order photo from storage
 *
 * @param url - Photo URL to delete (must contain bucket/key path for MinIO)
 * @returns Success status
 */
export async function deleteOrderPhoto(url: string): Promise<boolean> {
  try {
    const client = getMinioClient();
    const bucket = process.env.MINIO_BUCKET || 'cleanmatex';

    if (client) {
      const match = url.match(new RegExp(`/${bucket}/(.+)$`));
      const key = match?.[1];
      if (key) {
        await client.removeObject(bucket, key);
      }
    }
    return true;
  } catch (error) {
    console.error('[deleteOrderPhoto] Error:', error);
    return false;
  }
}

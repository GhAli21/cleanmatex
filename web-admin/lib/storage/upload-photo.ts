/**
 * Photo Upload Utility
 *
 * Handles uploading order photos to MinIO (S3-compatible storage).
 * For now, this is a placeholder that generates mock URLs.
 * In production, integrate with actual MinIO client.
 */

export interface UploadPhotoResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload order photo to storage
 *
 * @param file - File to upload
 * @param tenantOrgId - Tenant organization ID
 * @param orderId - Order ID
 * @returns Upload result with URL
 *
 * TODO: Implement actual MinIO integration
 * - Install @aws-sdk/client-s3
 * - Configure MinIO client
 * - Upload file to bucket: orders/{tenantOrgId}/{orderId}/photos/{filename}
 * - Return public URL
 */
export async function uploadOrderPhoto(
  file: File,
  tenantOrgId: string,
  orderId: string
): Promise<UploadPhotoResult> {
  try {
    // Validate file
    if (!file) {
      return {
        success: false,
        error: 'No file provided',
      };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size exceeds 5MB limit',
      };
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed',
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;

    // TODO: Upload to MinIO
    // const s3Client = new S3Client({ ... });
    // const command = new PutObjectCommand({
    //   Bucket: process.env.MINIO_BUCKET,
    //   Key: `orders/${tenantOrgId}/${orderId}/photos/${filename}`,
    //   Body: Buffer.from(await file.arrayBuffer()),
    //   ContentType: file.type,
    // });
    // await s3Client.send(command);

    // For now, return mock URL
    const mockUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:9000'}/orders/${tenantOrgId}/${orderId}/photos/${filename}`;

    return {
      success: true,
      url: mockUrl,
    };
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
 * @param url - Photo URL to delete
 * @returns Success status
 *
 * TODO: Implement actual MinIO deletion
 */
export async function deleteOrderPhoto(url: string): Promise<boolean> {
  try {
    // TODO: Delete from MinIO
    // Extract key from URL and delete

    console.log('[deleteOrderPhoto] Mock delete:', url);
    return true;
  } catch (error) {
    console.error('[deleteOrderPhoto] Error:', error);
    return false;
  }
}

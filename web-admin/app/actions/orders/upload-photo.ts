'use server';

import { uploadOrderPhoto } from '@/lib/storage/minio-client';
import { getCurrentTenant } from '@/lib/auth/get-session';

interface UploadPhotoInput {
  orderId: string;
  file: File;
}

interface UploadPhotoResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a photo for an order
 * This is a server action that handles file upload to MinIO
 */
export async function uploadPhotoAction(
  formData: FormData
): Promise<UploadPhotoResult> {
  try {
    // Get current tenant
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return { success: false, error: 'Unauthorized' };
    }

    // Extract form data
    const orderId = formData.get('orderId') as string;
    const file = formData.get('file') as File;

    if (!orderId || !file) {
      return { success: false, error: 'Missing required fields' };
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' };
    }

    // Max size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'File size must be less than 10MB' };
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to MinIO
    const url = await uploadOrderPhoto(
      orderId,
      buffer,
      file.name,
      tenant.id
    );

    return {
      success: true,
      url,
    };
  } catch (error: any) {
    console.error('Upload photo error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload photo',
    };
  }
}

/**
 * Upload multiple photos at once
 */
export async function uploadMultiplePhotos(
  orderId: string,
  files: File[]
): Promise<{ success: boolean; urls?: string[]; error?: string }> {
  try {
    // Get current tenant
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return { success: false, error: `${file.name} is not an image` };
      }
      if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: `${file.name} exceeds 10MB limit` };
      }
    }

    // Upload all files
    const uploadPromises = files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return uploadOrderPhoto(orderId, buffer, file.name, tenant.id);
    });

    const urls = await Promise.all(uploadPromises);

    return {
      success: true,
      urls,
    };
  } catch (error: any) {
    console.error('Upload multiple photos error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload photos',
    };
  }
}

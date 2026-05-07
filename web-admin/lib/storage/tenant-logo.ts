/**
 * Tenant logo storage — small wrapper over the proven `minio-client.ts`.
 *
 * Stricter than `uploadOrderPhoto`:
 *   - 2 MB maximum (matches the UI guideline at `settings.logoGuidelines`)
 *   - PNG / JPG only — SVG explicitly rejected (script-injection risk when
 *     rendered via <Image>/<img>)
 *
 * Object key shape: `tenants/{tenantOrgId}/logo/{timestamp}-{rand}.{ext}`.
 * The Branding PUT route validates the resulting URL has this prefix
 * before persisting `org_tenants_mst.logo_url`, defending against XSS
 * via attacker-supplied logo URLs.
 */

import { uploadFile, deleteFile, getFileUrl } from '@/lib/storage/minio-client';

export interface UploadLogoResult {
  success: boolean;
  url?: string;
  error?: string;
}

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export async function uploadTenantLogo(
  file: File,
  tenantOrgId: string
): Promise<UploadLogoResult> {
  if (!file) return { success: false, error: 'No file provided' };

  if (file.size > MAX_BYTES) {
    return { success: false, error: 'File size exceeds 2MB limit' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type. Only PNG and JPG images are allowed',
    };
  }

  try {
    const timestamp = Date.now();
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;
    const key = `tenants/${tenantOrgId}/logo/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadFile(buffer, key, file.type, {
      tenantOrgId,
      uploadedAt: new Date().toISOString(),
    });
    return { success: true, url };
  } catch (err) {
    console.error('[uploadTenantLogo] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload logo',
    };
  }
}

/**
 * Delete a tenant logo previously uploaded by {@link uploadTenantLogo}.
 * Returns true on success or no-op; false on a real failure so the caller
 * can log it.
 */
export async function deleteTenantLogo(url: string): Promise<boolean> {
  try {
    // Extract the storage key from the public URL produced by `getFileUrl`.
    const idx = url.indexOf('/tenants/');
    if (idx < 0) return true;
    const key = url.slice(idx + 1); // drop leading slash to get `tenants/...`
    await deleteFile(key);
    return true;
  } catch (err) {
    console.error('[deleteTenantLogo] Error:', err);
    return false;
  }
}

// Re-export for routes that build their own URLs (kept for symmetry)
export { getFileUrl };

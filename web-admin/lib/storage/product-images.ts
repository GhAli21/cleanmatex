/**
 * Supabase Storage helper for product images.
 * Bucket: product-images (public, created in migration 0116)
 * Path convention: {tenantId}/{productId}/image.{ext}
 * Deterministic path — re-uploading overwrites the previous file.
 */

import { createClient } from '@/lib/supabase/server'

const BUCKET = 'product-images'

/**
 * Upload (or replace) a product image in Supabase Storage.
 * Returns the public URL of the stored image.
 */
export async function uploadProductImage(
  productId: string,
  tenantId: string,
  file: File
): Promise<string> {
  const supabase = await createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${tenantId}/${productId}/image.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { upsert: true, contentType: file.type })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Remove a product image from Supabase Storage.
 * Errors are non-fatal — if the file is already gone, that is fine.
 */
export async function removeProductImage(
  productId: string,
  tenantId: string,
  ext: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const path = `${tenantId}/${productId}/image.${ext}`
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // Non-fatal — file may already be gone
  }
}

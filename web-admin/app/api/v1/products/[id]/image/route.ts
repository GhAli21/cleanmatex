/**
 * Product Image Upload API
 * POST   /api/v1/products/[id]/image — Upload image to Supabase Storage and persist URL
 * DELETE /api/v1/products/[id]/image — Remove image URL from product record
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/server-auth'
import { uploadProductImage, removeProductImage } from '@/lib/storage/product-images'
import { updateProduct, getProductById } from '@/lib/services/catalog.service'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

// ==================================================================
// POST /api/v1/products/[id]/image — Upload or replace product image
// ==================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await getAuthContext()
    const { id: productId } = await params

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File must be JPEG, PNG, or WebP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File size must be 5 MB or less' },
        { status: 400 }
      )
    }

    // Tenant-scoped guard — throws if product not found or belongs to another tenant
    await getProductById(productId)

    const url = await uploadProductImage(productId, tenantId, file)

    // Persist public URL on the product record
    await updateProduct({ id: productId, product_image: url })

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Error uploading product image:', error)

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message.startsWith('No tenant')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message === 'Product not found') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

// ==================================================================
// DELETE /api/v1/products/[id]/image — Remove product image
// ==================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await getAuthContext()
    const { id: productId } = await params

    // Tenant-scoped guard
    const product = await getProductById(productId)

    // Attempt to remove from storage (best-effort; non-fatal if already gone)
    if (product.product_image) {
      const ext = product.product_image.split('.').pop()?.split('?')[0] ?? 'jpg'
      await removeProductImage(productId, tenantId, ext)
    }

    // Clear the URL in the DB
    await updateProduct({ id: productId, product_image: null })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing product image:', error)

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message.startsWith('No tenant')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message === 'Product not found') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Failed to remove image' }, { status: 500 })
  }
}

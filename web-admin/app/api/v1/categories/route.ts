/**
 * PRD-007: Catalog Service Management API
 * Category management endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getServiceCategories,
  getEnabledCategories,
  enableCategories, 
} from '@/lib/services/catalog.service';
import type { EnableCategoriesRequest } from '@/lib/types/catalog';

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

/**
 * Get authenticated user and tenant context
 */
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) {
    throw new Error('No tenant access found' + error?.message);
  }

  return {
    user,
    tenantId: tenants[0].tenant_id,
    userId: user.id,
    userRole: tenants[0].user_role,
  };
}

// ==================================================================
// GET /api/v1/categories - List Categories
// ==================================================================

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: List service categories
 *     description: List all available service categories (global) or enabled for tenant
 *     tags: [Categories]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: boolean
 *         description: If true, return only enabled categories for tenant
 *         example: true
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ServiceCategory'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthContext();

    const { searchParams } = new URL(request.url);
    const enabled = searchParams.get('enabled') === 'true';

    // Get categories based on enabled  flag
    const categories = enabled
      ? await getEnabledCategories()
      : await getServiceCategories();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// ==================================================================
// POST /api/v1/categories - Enable Categories
// ==================================================================

/**
 * @swagger
 * /api/v1/categories:
 *   post:
 *     summary: Enable categories for tenant
 *     description: Enable/disable service categories for the current tenant
 *     tags: [Categories]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryCodes
 *             properties:
 *               categoryCodes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of category codes to enable
 *                 example: ["WASH", "DRY_CLEAN", "PRESS"]
 *     responses:
 *       200:
 *         description: Categories enabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid request - categoryCodes must be a non-empty array
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(request: NextRequest) {
  try {
    await getAuthContext();

    const body: EnableCategoriesRequest = await request.json();

    // Validate request body
    if (!body.categoryCodes || !Array.isArray(body.categoryCodes)) {
      return NextResponse.json(
        { error: 'categoryCodes must be an array' },
        { status: 400 }
      );
    }

    if (body.categoryCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one category code is required' },
        { status: 400 }
      );
    }

    // Enable categories
    await enableCategories(body);

    return NextResponse.json({
      success: true,
      message: 'Categories enabled successfully',
    });
  } catch (error) {
    console.error('Error enabling categories:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to enable categories' },
      { status: 500 }
    );
  }
}


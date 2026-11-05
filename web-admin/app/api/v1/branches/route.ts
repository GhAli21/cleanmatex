/**
 * GET /api/v1/branches
 * List active branches for the current tenant.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getBranchesForCurrentTenant } from '@/lib/services/inventory-service';

/**
 *
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const branches = await getBranchesForCurrentTenant();
    return NextResponse.json({ data: branches });
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch branches',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}


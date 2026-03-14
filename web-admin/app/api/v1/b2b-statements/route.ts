/**
 * B2B Statements API
 * GET /api/v1/b2b-statements?customer_id=xxx - List statements
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { listStatements } from '@/lib/services/b2b-statements.service';

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('b2b_statements:view')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id') ?? undefined;

    const statements = await listStatements({ customerId });
    return NextResponse.json({ success: true, data: statements });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list statements';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

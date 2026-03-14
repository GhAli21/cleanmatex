/**
 * B2B Statement Print Data API
 * GET /api/v1/b2b-statements/:id/print
 * Returns statement data for print/PDF (statement, customer, primary contact, invoices)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getStatementForPrint } from '@/lib/services/b2b-statements.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('b2b_statements:view')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { id } = await params;
    const data = await getStatementForPrint(id);
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Statement not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get statement for print';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

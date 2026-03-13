/**
 * B2B Statement by ID API
 * GET /api/v1/b2b-statements/:id
 * PATCH /api/v1/b2b-statements/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getStatementById,
  updateStatementStatus,
} from '@/lib/services/b2b-statements.service';
import { z } from 'zod';

const UpdateStatementSchema = z.object({
  statusCd: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { id } = await params;
    const statement = await getStatementById(id);
    if (!statement) {
      return NextResponse.json(
        { success: false, error: 'Statement not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: statement });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get statement';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateStatementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const statement = await updateStatementStatus(id, parsed.data.statusCd);
    return NextResponse.json({ success: true, data: statement });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update statement';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

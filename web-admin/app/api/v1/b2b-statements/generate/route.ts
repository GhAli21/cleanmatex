/**
 * B2B Statements Generate API
 * POST /api/v1/b2b-statements/generate - Generate consolidated statement
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { generateStatement } from '@/lib/services/b2b-statements.service';
import { z } from 'zod';

const GenerateStatementSchema = z.object({
  customerId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  periodFrom: z.string(),
  periodTo: z.string(),
  dueDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const body = await request.json();
    const parsed = GenerateStatementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const statement = await generateStatement({
      customerId: parsed.data.customerId,
      contractId: parsed.data.contractId,
      periodFrom: parsed.data.periodFrom,
      periodTo: parsed.data.periodTo,
      dueDate: parsed.data.dueDate,
    });
    return NextResponse.json({ success: true, data: statement }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate statement';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

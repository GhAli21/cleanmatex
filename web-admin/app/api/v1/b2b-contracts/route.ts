/**
 * B2B Contracts API
 * GET /api/v1/b2b-contracts?customer_id=xxx - List contracts
 * POST /api/v1/b2b-contracts - Create contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  listContracts,
  createContract,
} from '@/lib/services/b2b-contracts.service';
import { z } from 'zod';

const CreateContractSchema = z.object({
  customerId: z.string().uuid(),
  contractNo: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  pricingTerms: z.record(z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id') ?? undefined;

    const contracts = await listContracts({ customerId });
    return NextResponse.json({ success: true, data: contracts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list contracts';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const body = await request.json();
    const parsed = CreateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const contract = await createContract({
      customerId: parsed.data.customerId,
      contractNo: parsed.data.contractNo,
      effectiveFrom: parsed.data.effectiveFrom,
      effectiveTo: parsed.data.effectiveTo,
      pricingTerms: parsed.data.pricingTerms,
    });
    return NextResponse.json({ success: true, data: contract }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create contract';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

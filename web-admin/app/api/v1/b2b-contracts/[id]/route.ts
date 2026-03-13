/**
 * B2B Contract by ID API
 * GET /api/v1/b2b-contracts/:id
 * PATCH /api/v1/b2b-contracts/:id
 * DELETE /api/v1/b2b-contracts/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getContractById,
  updateContract,
  deleteContract,
} from '@/lib/services/b2b-contracts.service';
import { z } from 'zod';

const UpdateContractSchema = z.object({
  contractNo: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  pricingTerms: z.record(z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { id } = await params;
    const contract = await getContractById(id);
    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get contract';
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
    const parsed = UpdateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const contract = await updateContract(id, {
      contractNo: parsed.data.contractNo,
      effectiveFrom: parsed.data.effectiveFrom,
      effectiveTo: parsed.data.effectiveTo,
      pricingTerms: parsed.data.pricingTerms,
    });
    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update contract';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { id } = await params;
    await deleteContract(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete contract';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

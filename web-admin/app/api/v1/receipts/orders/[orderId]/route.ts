/**
 * Receipts API - Generate and Send Receipt
 * POST /api/v1/receipts/orders/:orderId
 * Generates and sends receipt via specified channels
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReceiptService } from '@/lib/services/receipt-service';
import { getAuthContext } from '@/lib/middleware/require-permission';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId } = authContext;
    const { orderId } = params;
    const body = await request.json();
    const { receiptTypeCode, deliveryChannels, language } = body;

    if (!receiptTypeCode || !deliveryChannels || !Array.isArray(deliveryChannels)) {
      return NextResponse.json(
        { success: false, error: 'Receipt type and delivery channels are required' },
        { status: 400 }
      );
    }

    const result = await ReceiptService.sendReceipt({
      orderId,
      tenantId,
      receiptTypeCode,
      deliveryChannels,
      language: language || 'en',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      receiptIds: result.receiptIds,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/receipts/orders/:orderId
 * Get all receipts for an order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId } = authContext;
    const { orderId } = params;

    const receipts = await ReceiptService.getReceipts({
      orderId,
      tenantId,
    });

    return NextResponse.json({
      success: true,
      receipts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


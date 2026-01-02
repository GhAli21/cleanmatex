/**
 * Receipts API - Resend Receipt
 * POST /api/v1/receipts/:id/resend
 * Resends a failed receipt
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReceiptService } from '@/lib/services/receipt-service';
import { getAuthContext } from '@/lib/middleware/require-permission';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const { id: receiptId } = params;
    const supabase = await createClient();

    // Get receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('org_rcpt_receipts_mst')
      .select('*')
      .eq('id', receiptId)
      .eq('tenant_org_id', tenantId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { success: false, error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check retry count
    if (receipt.retry_count >= receipt.max_retries) {
      return NextResponse.json(
        { success: false, error: 'Maximum retry count exceeded' },
        { status: 400 }
      );
    }

    // Resend receipt
    const result = await ReceiptService.sendReceipt({
      orderId: receipt.order_id,
      tenantId,
      receiptTypeCode: receipt.receipt_type_code,
      deliveryChannels: [receipt.delivery_channel_code],
    });

    if (!result.success) {
      // Update retry count
      await supabase
        .from('org_rcpt_receipts_mst')
        .update({
          retry_count: receipt.retry_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId);

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
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


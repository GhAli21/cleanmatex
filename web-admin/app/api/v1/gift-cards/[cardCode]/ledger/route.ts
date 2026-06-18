import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getGiftCardByCode, getGiftCardTransactions } from '@/lib/services/gift-card-service';

/**
 *
 * @param request
 * @param root0
 * @param root0.params
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardCode: string }> }
) {
  const auth = await requirePermission('gift_cards:view')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const { cardCode } = await params;

  try {
    const card = await getGiftCardByCode(cardCode, tenantId);
    if (!card) return NextResponse.json({ success: false, error: 'Gift card not found' }, { status: 404 });

    const transactions = await getGiftCardTransactions(card.id, tenantId);
    return NextResponse.json({ success: true, data: { card, transactions } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch ledger';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

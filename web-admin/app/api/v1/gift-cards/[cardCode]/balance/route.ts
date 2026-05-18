import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getGiftCardByCode } from '@/lib/services/gift-card-service';

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
    return NextResponse.json({
      success: true,
      data: {
        id:               card.id,
        code:             card.gift_card_code,
        status:           card.status,
        availableBalance: Number(card.current_balance ?? 0),
        currencyCode:     card.currency_code,
        expiryDate:       card.expiry_date,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch balance';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

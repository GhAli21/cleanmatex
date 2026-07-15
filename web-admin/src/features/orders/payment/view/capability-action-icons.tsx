/**
 * Lucide icons for payment capability dialog openers (Simple left rail tiles,
 * and any future tile surfaces). Icons stay presentation-only — no finance
 * meaning. Unknown keys fall back to a neutral ellipsis glyph.
 */

import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpCircle,
  Building2,
  Clock3,
  Coins,
  Columns2,
  Ellipsis,
  Gift,
  Tag,
  WalletCards,
} from 'lucide-react';
import {
  PAYMENT_CAPABILITY,
  type PaymentCapabilityKey,
} from '../capabilities/capability-keys';

const CAPABILITY_ACTION_ICONS: Partial<Record<PaymentCapabilityKey, LucideIcon>> = {
  [PAYMENT_CAPABILITY.CASH_CARD_SPLIT]: WalletCards,
  [PAYMENT_CAPABILITY.SPLIT_TENDER]: Columns2,
  [PAYMENT_CAPABILITY.GIFT_CARD]: Gift,
  [PAYMENT_CAPABILITY.PROMO_CODE]: Tag,
  [PAYMENT_CAPABILITY.CUSTOMER_CREDIT]: Coins,
  [PAYMENT_CAPABILITY.PAY_LATER]: Clock3,
  [PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING]: Building2,
  [PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING]: ArrowUpCircle,
};

/**
 * Resolves the Lucide icon for a capability action opener.
 *
 * @param key - Capability key from the view plan.
 * @returns Icon component (never null).
 */
export function getCapabilityActionIcon(key: PaymentCapabilityKey): LucideIcon {
  return CAPABILITY_ACTION_ICONS[key] ?? Ellipsis;
}

/**
 * Legacy Promotions route — consolidated into Promo Codes (/promos).
 * Keeps bookmarks working while avoiding the dual-admin drift.
 */

import { redirect } from 'next/navigation';

export const metadata = { title: 'Promotions — CleanMateX' };

/**
 * Redirect to the canonical promotions admin surface.
 */
export default function PromotionsPage() {
  redirect('/dashboard/marketing/promos');
}

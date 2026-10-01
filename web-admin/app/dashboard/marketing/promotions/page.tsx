/**
 * Legacy Promotions route — consolidated into Promo Codes (/promos).
 * Keeps bookmarks working while avoiding the dual-admin drift.
 */

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

/** Keeps legacy-bookmark history identifiable before redirecting to Promo Codes. */
export const metadata: Metadata = { title: 'Promotions' };

/**
 * Redirect to the canonical promotions admin surface.
 */
export default function PromotionsPage() {
  redirect('/dashboard/marketing/promos');
}

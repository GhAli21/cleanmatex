import { getLocale, getTranslations } from 'next-intl/server';
import { PublicOrderTrackingPage } from '@/src/features/orders/public/order-tracking-page';

/** Retired lookup endpoint; it always answers 404 (BF-16). */
const RETIRED_LOOKUP_PATH = '/api/v1/public/orders/retired/retired';
const RETIRED_CONFIRM_PATH = '/api/v1/public/orders/retired/retired/confirm-received';

/**
 * Retired readable public order page (BF-16).
 *
 * Old `/public/orders/{tenantId}/{orderNo}` links no longer show an order and
 * no longer redirect to the opaque token URL, which handed the token to anyone
 * who guessed an order number. The page renders the standard tracking screen,
 * whose lookup returns 404, so the customer sees the localized "We could not
 * find this order. Please check the link with the laundry shop." message
 * (EN/AR). Route params are deliberately not read.
 */
export default async function PublicOrderPage() {
  await getTranslations('publicOrderTracking');
  await getLocale();

  return (
    <PublicOrderTrackingPage
      lookupPath={RETIRED_LOOKUP_PATH}
      confirmPath={RETIRED_CONFIRM_PATH}
    />
  );
}

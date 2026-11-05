import 'server-only';

import type { OrderChangePreviewSuccess } from '@/lib/services/order-change/order-change-preview.service';
import type { OrderFinancialView, ResolvedOrderFinDisplayConfig } from '@/lib/types/order-fin-view';
import { mapEditQuoteToSourceSet } from '@features/orders/order-fin-view/edit/map-edit-quote-to-source-set';
import { assembleOrderFinancialView } from '@features/orders/order-fin-view/vwbuilders/assemble';
import { editQuoteFromPreview } from './edit-quote';
import { loadSavedOrderFinSourceSet } from './order-fin-view.service';

/**
 * The Order Edit live card's view (PLAN §6.4, P4-08): the saved order with one
 * preview laid over it, built on the server because the per-component figures
 * live in the preview's server-only `commercial` result. A NO_CHANGE preview
 * gives the saved order's own view.
 * @param tenantId - session tenant
 * @param orderId - order being edited
 * @param preview - a successful `previewOrderChange` result for the current draft
 * @param resolved - `resolveOrderFinDisplayConfig(config, 'edit')`
 * @returns the `edit` view (or the saved view when nothing changes)
 * @throws NotFoundError when the order is not in this tenant
 * @example await getOrderEditQuoteView(tenantId, orderId, preview, resolveOrderFinDisplayConfig({ preset: 'totals' }, 'edit'))
 */
export async function getOrderEditQuoteView(
  tenantId: string,
  orderId: string,
  preview: OrderChangePreviewSuccess,
  resolved: ResolvedOrderFinDisplayConfig,
): Promise<OrderFinancialView> {
  const saved = await loadSavedOrderFinSourceSet(tenantId, orderId, resolved.requiredSources);
  const quote = editQuoteFromPreview(preview);
  return assembleOrderFinancialView(quote ? mapEditQuoteToSourceSet(saved, quote) : saved, resolved, new Date().toISOString());
}

'use client';

import { useTranslations } from 'next-intl';
import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import { resolveEditControlCapability, resolveEditControlGroup } from './edit-control-capability';
import { useOrderWorkspaceSessionOptional } from './order-workspace-session';

/**
 * Reason lines for Edit controls.
 * A denied operation is named. New Order has no session, so nothing is shown there.
 */
export function EditControlNotice({
  codes,
  identity = false,
}: {
  codes?: readonly OrderChangeOperationCode[];
  identity?: boolean;
}) {
  const t = useTranslations('orders.edit');
  const session = useOrderWorkspaceSessionOptional();
  const operationLabels: Record<OrderChangeOperationCode, string> = {
    ADD_ITEM: t('policyInfo.operations.ADD_ITEM'),
    REMOVE_ITEM: t('policyInfo.operations.REMOVE_ITEM'),
    CHANGE_ITEM_QUANTITY: t('policyInfo.operations.CHANGE_ITEM_QUANTITY'),
    ADD_PIECE: t('policyInfo.operations.ADD_PIECE'),
    REMOVE_PIECE: t('policyInfo.operations.REMOVE_PIECE'),
    ADD_PREFERENCE: t('policyInfo.operations.ADD_PREFERENCE'),
    CHANGE_PREFERENCE: t('policyInfo.operations.CHANGE_PREFERENCE'),
    REMOVE_PREFERENCE: t('policyInfo.operations.REMOVE_PREFERENCE'),
    CHANGE_PRIORITY: t('policyInfo.operations.CHANGE_PRIORITY'),
    CHANGE_SERVICE_SPEED: t('policyInfo.operations.CHANGE_SERVICE_SPEED'),
    CHANGE_READY_BY: t('policyInfo.operations.CHANGE_READY_BY'),
    CHANGE_ORDER_NOTES: t('policyInfo.operations.CHANGE_ORDER_NOTES'),
    CHANGE_CUSTOMER_SNAPSHOT: t('policyInfo.operations.CHANGE_CUSTOMER_SNAPSHOT'),
    CHANGE_UNLISTED: t('policyInfo.operations.CHANGE_UNLISTED'),
  };
  if (!session) return null;
  const denied = identity || !codes
    ? []
    : codes.filter((code) => resolveEditControlCapability(session.editPolicy, code).reasonKey === 'deny');
  if (denied.length > 0) {
    return (
      <div role="status" className="text-start rounded border border-[rgb(var(--cmx-destructive-rgb,220_38_38))] bg-[rgb(var(--cmx-destructive-bg-rgb,254_242_242))] px-3 py-2">
        <ul className="space-y-1">
          {denied.map((code) => (
            <li key={code} className="text-sm">
              {t('capability.deniedOperation', { operation: operationLabels[code] })}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!identity && (!codes || codes.length === 0)) return null;
  const capability = identity
    ? { reasonKey: 'locked' as const, state: 'LOCKED' as const }
    : resolveEditControlGroup(session.editPolicy, codes ?? []);
  if (!capability.reasonKey || capability.state === 'CREATE') return null;
  return (
    <p role="status" className="text-start text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
      {t(`capability.${capability.reasonKey}`)}
    </p>
  );
}

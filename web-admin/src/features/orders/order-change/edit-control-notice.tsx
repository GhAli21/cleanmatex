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
              {t('capability.deniedOperation', { operation: t(`policyInfo.operations.${code}`) })}
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

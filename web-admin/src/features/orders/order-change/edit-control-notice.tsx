'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeEditPolicyRule } from '@/lib/types/order-change';
import { resolveEditControlCapability, resolveEditControlGroup } from './edit-control-capability';
import { useOrderWorkspaceSessionOptional } from './order-workspace-session';

/**
 * Reason lines for Edit controls.
 * A denied operation is named. New Order has no session, so nothing is shown there.
 */
export function EditControlNotice({
  codes,
  identity = false,
  targetType,
}: {
  codes?: readonly OrderChangeOperationCode[];
  identity?: boolean;
  /** Only the rules of this target (an operation can have ORDER and ITEM cells). */
  targetType?: OrderChangeEditPolicyRule['targetType'];
}) {
  const t = useTranslations('orders.edit');
  const locale = useLocale();
  const session = useOrderWorkspaceSessionOptional();
  if (!session) return null;
  const denied = identity || !codes
    ? []
    : codes.filter((code) => resolveEditControlCapability(session.editPolicy, code, targetType).reasonKey === 'deny');
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
  // Warning / override lines name their operations, so stacked notices never read as one control's.
  const named = (['override', 'warning'] as const)
    .map((key) => ({
      key,
      codes: identity || !codes ? [] : codes.filter((code) => resolveEditControlCapability(session.editPolicy, code, targetType).reasonKey === key),
    }))
    .filter((row) => row.codes.length > 0);
  if (named.length > 0) {
    const list = new Intl.ListFormat(locale, { type: 'conjunction' });
    return (
      <ul role="status" className="text-start space-y-0.5 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {named.map((row) => (
          <li key={row.key}>
            {t(`capability.${row.key}Operations`, {
              operations: list.format(row.codes.map((code) => t(`policyInfo.operations.${code}`))),
            })}
          </li>
        ))}
      </ul>
    );
  }
  const capability = identity
    ? { reasonKey: 'locked' as const, state: 'LOCKED' as const }
    : resolveEditControlGroup(session.editPolicy, codes ?? [], targetType);
  if (!capability.reasonKey || capability.state === 'CREATE') return null;
  return (
    <p role="status" className="text-start text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
      {t(`capability.${capability.reasonKey}`)}
    </p>
  );
}

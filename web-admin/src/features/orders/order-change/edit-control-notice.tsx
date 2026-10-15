'use client';

import { useTranslations } from 'next-intl';
import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import { resolveEditControlGroup } from './edit-control-capability';
import { useOrderWorkspaceSessionOptional } from './order-workspace-session';

/**
 * One reason line for a group of Edit controls.
 * New Order has no session, so the line stays absent there.
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

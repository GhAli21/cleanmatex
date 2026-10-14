'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { EditPolicyInfoDialog } from './edit-policy-info-dialog';
import { useOrderWorkspaceSessionOptional } from './order-workspace-session';

/**
 * Opens the current order's Edit Policy explanation.
 * Rendered in the top bar's trailing slot so New Order keeps that slot for the POS session.
 */
export function EditPolicyInfoButton() {
  const t = useTranslations('orders.edit');
  const session = useOrderWorkspaceSessionOptional();
  const [open, setOpen] = useState(false);
  if (!session) return null;

  return (
    <>
      <CmxButton type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('policyInfo.button')}
      </CmxButton>
      <EditPolicyInfoDialog open={open} policy={session.editPolicy} onOpenChange={setOpen} />
    </>
  );
}

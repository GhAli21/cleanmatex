/**
 * Create B2B contract from the tenant-wide contracts list (customer picker + optional fields).
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogClose,
} from '@ui/overlays';
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import { useMessage } from '@ui/feedback';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';

type B2bCustomerRow = {
  id: string;
  company_name: string | null;
  display_name: string | null;
};

export function B2bCreateContractDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('b2b');
  const tCommon = useTranslations('common');
  const { showErrorFrom, showSuccess } = useMessage();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? null;
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['b2b-customers', tenantId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('org_customers_mst')
        .select('id, company_name, display_name')
        .eq('tenant_org_id', tenantId)
        .eq('type', 'b2b')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as B2bCustomerRow[];
    },
    enabled: open && !!tenantId,
  });

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.company_name || c.display_name || c.id,
  }));

  const resetForm = () => {
    setCustomerId('');
    setContractNo('');
    setEffectiveFrom('');
    setEffectiveTo('');
  };

  const handleClose = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      showErrorFrom(new Error(t('selectCustomerFirst')), { fallback: t('selectCustomerFirst') });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/b2b-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          ...(contractNo.trim() ? { contractNo: contractNo.trim() } : {}),
          ...(effectiveFrom ? { effectiveFrom: effectiveFrom } : {}),
          ...(effectiveTo ? { effectiveTo: effectiveTo } : {}),
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(typeof json.error === 'string' ? json.error : t('contractCreateFailed'));
      }
      showSuccess(t('contractCreated'));
      await queryClient.invalidateQueries({ queryKey: ['b2b-contracts'] });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      showErrorFrom(err instanceof Error ? err : new Error(t('contractCreateFailed')), {
        fallback: t('contractCreateFailed'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={handleClose}>
      <CmxDialogContent className="max-w-lg w-full mx-4">
        <form onSubmit={handleSubmit}>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('createContract')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">{t('createContractDescription')}</p>
            {customersLoading ? (
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
            ) : customerOptions.length === 0 ? (
              <p className="text-sm text-amber-700">{t('noCustomers')}</p>
            ) : (
              <CmxSelect
                label={t('selectB2bCustomer')}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder={t('selectCustomerPlaceholder')}
                options={customerOptions}
              />
            )}
            <CmxInput
              label={t('optionalContractNo')}
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
              placeholder={t('optionalContractNoHint')}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contract-effective-from">{t('effectiveFrom')}</Label>
                <input
                  id="contract-effective-from"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-effective-to">{t('effectiveTo')}</Label>
                <input
                  id="contract-effective-to"
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          <CmxDialogFooter className="gap-2 sm:gap-0">
            <CmxDialogClose asChild>
              <CmxButton type="button" variant="outline" disabled={submitting}>
                {tCommon('cancel')}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton type="submit" disabled={submitting || !customerId || customersLoading}>
              {submitting ? tCommon('loading') : tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}

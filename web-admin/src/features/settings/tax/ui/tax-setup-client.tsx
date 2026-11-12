'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxEmptyState } from '@ui/data-display';
import { Badge } from '@ui/primitives/badge';
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback';
import { CmxTabsPanel } from '@ui/navigation';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import {
  createTaxExemptionAction,
  updateTaxExemptionAction,
  deactivateTaxExemptionAction,
} from '@/app/actions/settings/tax-actions';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const exemptionSchema = z.object({
  exemption_type: z.string().min(1),
  certificate_no: z.string().optional(),
  service_type: z.string().optional(),
  valid_from: z.string().min(1),
  valid_to: z.string().optional(),
});

type ExemptionFormValues = z.infer<typeof exemptionSchema>;

// ---------------------------------------------------------------------------
// Serialized types (date fields come as ISO strings from server component)
// ---------------------------------------------------------------------------

/**
 *
 */
export interface SerializedTaxExemption {
  id: string;
  tenant_org_id: string;
  customer_id: string | null;
  service_type: string | null;
  exemption_type: string;
  certificate_no: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaxSetupClientProps {
  initialExemptions: SerializedTaxExemption[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

const EXEMPTION_TYPES = ['CUSTOMER_EXEMPT', 'PRODUCT_EXEMPT', 'ZERO_RATED', 'REDUCED_RATE', 'OTHER'] as const;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 *
 * @param root0
 * @param root0.initialExemptions
 */
export function TaxSetupClient({ initialExemptions }: TaxSetupClientProps) {
  const t = useTranslations('taxSetup');
  const tCommon = useTranslations('common');
  const [isPending, startTransition] = useTransition();

  const [exemptions, setExemptions] = useState<SerializedTaxExemption[]>(initialExemptions);

  // Exemption dialog state
  const [exemptionDialogMode, setExemptionDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingExemption, setEditingExemption] = useState<SerializedTaxExemption | null>(null);

  // ---------------------------------------------------------------------------
  // Exemption form
  // ---------------------------------------------------------------------------

  const exemptionForm = useForm<ExemptionFormValues>({
    resolver: zodResolver(exemptionSchema),
    defaultValues: {
      exemption_type: 'CUSTOMER_EXEMPT',
      certificate_no: '',
      service_type: '',
      valid_from: new Date().toISOString().slice(0, 10),
      valid_to: '',
    },
  });

  const exemptionType = useWatch({ control: exemptionForm.control, name: 'exemption_type' });

  const openCreateExemption = () => {
    exemptionForm.reset({
      exemption_type: 'CUSTOMER_EXEMPT',
      certificate_no: '',
      service_type: '',
      valid_from: new Date().toISOString().slice(0, 10),
      valid_to: '',
    });
    setEditingExemption(null);
    setExemptionDialogMode('create');
  };

  const openEditExemption = (e: SerializedTaxExemption) => {
    exemptionForm.reset({
      exemption_type: e.exemption_type,
      certificate_no: e.certificate_no ?? '',
      service_type: e.service_type ?? '',
      valid_from: toDateInput(e.valid_from),
      valid_to: toDateInput(e.valid_to),
    });
    setEditingExemption(e);
    setExemptionDialogMode('edit');
  };

  const handleSubmitExemption = (values: ExemptionFormValues) => {
    startTransition(async () => {
      if (exemptionDialogMode === 'create') {
        const result = await createTaxExemptionAction({
          exemptionType: values.exemption_type,
          certificateNo: values.certificate_no || undefined,
          serviceType: values.service_type || undefined,
          validFrom: values.valid_from,
          validTo: values.valid_to || undefined,
        });
        if (result.success && result.data) {
          const d = result.data;
          setExemptions((prev) => [...prev, {
            ...d,
            valid_from: new Date(d.valid_from).toISOString(),
            valid_to: d.valid_to ? new Date(d.valid_to).toISOString() : null,
            created_at: new Date(d.created_at).toISOString(),
          }]);
          cmxMessage.success(t('exemptionSaved'));
          setExemptionDialogMode(null);
        } else {
          cmxMessage.error(result.error ?? t('exemptionSaved'));
        }
      } else if (exemptionDialogMode === 'edit' && editingExemption) {
        const result = await updateTaxExemptionAction(editingExemption.id, {
          exemptionType: values.exemption_type,
          certificateNo: values.certificate_no,
          serviceType: values.service_type,
          validFrom: values.valid_from,
          validTo: values.valid_to || null,
        });
        if (result.success && result.data) {
          const d = result.data;
          const updated: SerializedTaxExemption = {
            ...d,
            valid_from: new Date(d.valid_from).toISOString(),
            valid_to: d.valid_to ? new Date(d.valid_to).toISOString() : null,
            created_at: new Date(d.created_at).toISOString(),
          };
          setExemptions((prev) => prev.map((e) => (e.id === editingExemption.id ? updated : e)));
          cmxMessage.success(t('exemptionUpdated'));
          setExemptionDialogMode(null);
        } else {
          cmxMessage.error(result.error ?? t('exemptionUpdated'));
        }
      }
    });
  };

  const handleDeactivateExemption = (id: string) => {
    startTransition(async () => {
      const result = await deactivateTaxExemptionAction(id);
      if (result.success) {
        setExemptions((prev) => prev.filter((e) => e.id !== id));
        cmxMessage.success(t('exemptionDeactivated'));
      } else {
        cmxMessage.error(result.error ?? t('exemptionDeactivated'));
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const exemptionColumns = [
    {
      key: 'exemption_type',
      header: t('exemptionType'),
      sortable: true,
      render: (e: SerializedTaxExemption) => <Badge variant="outline">{e.exemption_type}</Badge>,
    },
    {
      key: 'customer_id',
      header: t('customerId'),
      render: (e: SerializedTaxExemption) => (
        <span className="font-mono text-xs">{e.customer_id ?? '—'}</span>
      ),
    },
    {
      key: 'service_type',
      header: t('serviceType'),
      render: (e: SerializedTaxExemption) => <span>{e.service_type ?? '—'}</span>,
    },
    {
      key: 'certificate_no',
      header: t('certificateNo'),
      render: (e: SerializedTaxExemption) => <span>{e.certificate_no ?? '—'}</span>,
    },
    {
      key: 'validity',
      header: t('validFrom'),
      sortable: true,
      render: (e: SerializedTaxExemption) => (
        <div className="text-sm">
          <div>{new Date(e.valid_from).toLocaleDateString()}</div>
          {e.valid_to
            ? <div className="text-xs text-muted-foreground">→ {new Date(e.valid_to).toLocaleDateString()}</div>
            : <div className="text-xs text-muted-foreground">{t('noExpiry')}</div>
          }
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('actions'),
      render: (e: SerializedTaxExemption) => (
        <div className="flex items-center gap-1">
          <CmxButton
            variant="ghost"
            size="sm"
            onClick={() => openEditExemption(e)}
            disabled={isPending}
          >
            <Pencil className="h-3.5 w-3.5" />
          </CmxButton>
          <CmxButton
            variant="ghost"
            size="sm"
            onClick={() => handleDeactivateExemption(e.id)}
            disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </CmxButton>
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------

  const tabs = [
    {
      id: 'exemptions',
      label: t('exemptions'),
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CmxButton onClick={openCreateExemption} disabled={isPending}>
              <Plus className="h-4 w-4 me-2" />
              {t('addExemption')}
            </CmxButton>
          </div>
          {exemptions.length === 0
            ? <CmxEmptyState title={t('emptyExemptions')} />
            : <CmxDataTable columns={exemptionColumns} data={exemptions} />
          }
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <CmxTabsPanel tabs={tabs} />

      {/* Exemption Dialog */}
      <CmxDialog
        open={exemptionDialogMode !== null}
        onOpenChange={(v) => !v && setExemptionDialogMode(null)}
      >
        <CmxDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {exemptionDialogMode === 'edit' ? t('editExemption') : t('addExemption')}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <form onSubmit={exemptionForm.handleSubmit(handleSubmitExemption)} className="space-y-4 py-2">

            <div>
              <label className="text-sm font-medium">{t('exemptionType')} *</label>
              <CmxSelectDropdown
                value={exemptionType}
                onValueChange={(v) => exemptionForm.setValue('exemption_type', v)}
              >
                <CmxSelectDropdownTrigger>
                  <CmxSelectDropdownValue />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {EXEMPTION_TYPES.map((type) => (
                    <CmxSelectDropdownItem key={type} value={type}>
                      {type}
                    </CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
              {exemptionForm.formState.errors.exemption_type && (
                <p className="text-xs text-destructive mt-1">{exemptionForm.formState.errors.exemption_type.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">{t('certificateNo')}</label>
              <CmxInput {...exemptionForm.register('certificate_no')} />
            </div>

            <div>
              <label className="text-sm font-medium">{t('serviceType')}</label>
              <CmxInput {...exemptionForm.register('service_type')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('validFrom')} *</label>
                <CmxInput type="date" {...exemptionForm.register('valid_from')} />
              </div>
              <div>
                <label className="text-sm font-medium">{t('validTo')}</label>
                <CmxInput type="date" {...exemptionForm.register('valid_to')} />
              </div>
            </div>

            <CmxDialogFooter>
              <CmxButton type="button" variant="outline" onClick={() => setExemptionDialogMode(null)} disabled={isPending}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton type="submit" disabled={isPending}>
                {isPending ? tCommon('loading') : tCommon('save')}
              </CmxButton>
            </CmxDialogFooter>
          </form>
        </CmxDialogContent>
      </CmxDialog>
    </>
  );
}

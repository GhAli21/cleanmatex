'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxEmptyState } from '@ui/data-display';
import { Badge } from '@ui/primitives/badge';
import { cmxMessage } from '@ui/feedback';
import { CmxTabsPanel } from '@ui/navigation';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownValue, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms';
import {
  createTaxProfileAction,
  updateTaxProfileAction,
  setDefaultTaxProfileAction,
  deactivateTaxProfileAction,
  createTaxExemptionAction,
  updateTaxExemptionAction,
  deactivateTaxExemptionAction,
} from '@/app/actions/settings/tax-actions';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().min(1),
  name2: z.string().optional(),
  tax_type: z.enum(['VAT', 'GST', 'CUSTOM']),
  rate: z.number().min(0).max(100),
  is_compound: z.boolean(),
  applies_to: z.string().optional(),
  effective_from: z.string().min(1),
  effective_to: z.string().optional(),
  is_default: z.boolean(),
});

const exemptionSchema = z.object({
  exemption_type: z.string().min(1),
  certificate_no: z.string().optional(),
  service_type: z.string().optional(),
  valid_from: z.string().min(1),
  valid_to: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type ExemptionFormValues = z.infer<typeof exemptionSchema>;

// ---------------------------------------------------------------------------
// Serialized types (date fields come as ISO strings from server component)
// ---------------------------------------------------------------------------

/**
 *
 */
export interface SerializedTaxProfile {
  id: string;
  tenant_org_id: string;
  name: string;
  name2: string | null;
  tax_type: string;
  rate: number;
  is_compound: boolean;
  applies_to: string[];
  effective_from: string | null;
  effective_to: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

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
  initialProfiles: SerializedTaxProfile[];
  initialExemptions: SerializedTaxExemption[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

const TAX_TYPES = ['VAT', 'GST', 'CUSTOM'] as const;
const EXEMPTION_TYPES = ['CUSTOMER_EXEMPT', 'PRODUCT_EXEMPT', 'ZERO_RATED', 'REDUCED_RATE', 'OTHER'] as const;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 *
 * @param root0
 * @param root0.initialProfiles
 * @param root0.initialExemptions
 */
export function TaxSetupClient({ initialProfiles, initialExemptions }: TaxSetupClientProps) {
  const t = useTranslations('taxSetup');
  const tCommon = useTranslations('common');
  const [isPending, startTransition] = useTransition();

  const [profiles, setProfiles] = useState<SerializedTaxProfile[]>(initialProfiles);
  const [exemptions, setExemptions] = useState<SerializedTaxExemption[]>(initialExemptions);

  // Profile dialog state
  const [profileDialogMode, setProfileDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingProfile, setEditingProfile] = useState<SerializedTaxProfile | null>(null);

  // Exemption dialog state
  const [exemptionDialogMode, setExemptionDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingExemption, setEditingExemption] = useState<SerializedTaxExemption | null>(null);

  // ---------------------------------------------------------------------------
  // Profile form
  // ---------------------------------------------------------------------------

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      name2: '',
      tax_type: 'VAT',
      rate: 15,
      is_compound: false,
      applies_to: '',
      effective_from: new Date().toISOString().slice(0, 10),
      effective_to: '',
      is_default: false,
    },
  });

  const profileTaxType = useWatch({ control: profileForm.control, name: 'tax_type' });
  const profileIsCompound = useWatch({ control: profileForm.control, name: 'is_compound' });
  const profileIsDefault = useWatch({ control: profileForm.control, name: 'is_default' });

  const openCreateProfile = () => {
    profileForm.reset({
      name: '',
      name2: '',
      tax_type: 'VAT',
      rate: 15,
      is_compound: false,
      applies_to: '',
      effective_from: new Date().toISOString().slice(0, 10),
      effective_to: '',
      is_default: false,
    });
    setEditingProfile(null);
    setProfileDialogMode('create');
  };

  const openEditProfile = (p: SerializedTaxProfile) => {
    profileForm.reset({
      name: p.name,
      name2: p.name2 ?? '',
      tax_type: p.tax_type as 'VAT' | 'GST' | 'CUSTOM',
      rate: Number(p.rate),
      is_compound: p.is_compound,
      applies_to: p.applies_to.join(', '),
      effective_from: toDateInput(p.effective_from),
      effective_to: toDateInput(p.effective_to),
      is_default: p.is_default,
    });
    setEditingProfile(p);
    setProfileDialogMode('edit');
  };

  const handleSubmitProfile = (values: ProfileFormValues) => {
    startTransition(async () => {
      if (profileDialogMode === 'create') {
        const result = await createTaxProfileAction({
          name: values.name,
          name2: values.name2 || undefined,
          taxType: values.tax_type,
          rate: values.rate,
          appliesTo: values.applies_to || '',
          effectiveFrom: values.effective_from,
          effectiveTo: values.effective_to || undefined,
          isDefault: values.is_default,
        });
        if (result.success && result.data) {
          const d = result.data;
          setProfiles((prev) => [...prev, {
            ...d,
            rate: Number(d.rate),
            effective_from: d.effective_from ? new Date(d.effective_from).toISOString() : null,
            effective_to: d.effective_to ? new Date(d.effective_to).toISOString() : null,
            created_at: new Date(d.created_at).toISOString(),
          }]);
          cmxMessage.success(t('saved'));
          setProfileDialogMode(null);
        } else {
          cmxMessage.error(result.error ?? t('saved'));
        }
      } else if (profileDialogMode === 'edit' && editingProfile) {
        const result = await updateTaxProfileAction(editingProfile.id, {
          name: values.name,
          name2: values.name2,
          taxType: values.tax_type,
          rate: values.rate,
          isCompound: values.is_compound,
          appliesTo: values.applies_to,
          effectiveFrom: values.effective_from,
          effectiveTo: values.effective_to || null,
          isDefault: values.is_default,
        });
        if (result.success && result.data) {
          const d = result.data;
          const updated: SerializedTaxProfile = {
            ...d,
            rate: Number(d.rate),
            effective_from: d.effective_from ? new Date(d.effective_from).toISOString() : null,
            effective_to: d.effective_to ? new Date(d.effective_to).toISOString() : null,
            created_at: new Date(d.created_at).toISOString(),
          };
          setProfiles((prev) => prev.map((p) => (p.id === editingProfile.id ? updated : p)));
          cmxMessage.success(t('updated'));
          setProfileDialogMode(null);
        } else {
          cmxMessage.error(result.error ?? t('updated'));
        }
      }
    });
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      const result = await setDefaultTaxProfileAction(id);
      if (result.success) {
        setProfiles((prev) => prev.map((p) => ({ ...p, is_default: p.id === id })));
        cmxMessage.success(t('setDefault'));
      } else {
        cmxMessage.error(result.error ?? t('setDefault'));
      }
    });
  };

  const handleDeactivateProfile = (id: string) => {
    startTransition(async () => {
      const result = await deactivateTaxProfileAction(id);
      if (result.success) {
        setProfiles((prev) => prev.filter((p) => p.id !== id));
        cmxMessage.success(t('deactivated'));
      } else {
        cmxMessage.error(result.error ?? t('deactivated'));
      }
    });
  };

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

  const profileColumns = [
    {
      key: 'name',
      header: t('profileName'),
      sortable: true,
      render: (p: SerializedTaxProfile) => (
        <div>
          <div className="font-medium">{p.name}</div>
          {p.name2 && <div className="text-xs text-muted-foreground" dir="rtl">{p.name2}</div>}
        </div>
      ),
    },
    {
      key: 'tax_type',
      header: t('taxType'),
      sortable: true,
      render: (p: SerializedTaxProfile) => <Badge variant="outline">{t(`typeLabels.${p.tax_type}` as never)}</Badge>,
    },
    {
      key: 'rate',
      header: t('rate'),
      sortable: true,
      render: (p: SerializedTaxProfile) => (
        <div className="font-mono">
          {Number(p.rate).toFixed(2)}%
          {p.is_compound && (
            <Badge variant="secondary" className="ms-2 text-xs">{t('compound')}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'applies_to',
      header: t('appliesTo'),
      render: (p: SerializedTaxProfile) => (
        <div className="flex flex-wrap gap-1">
          {p.applies_to.length === 0
            ? <span className="text-xs text-muted-foreground">—</span>
            : p.applies_to.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)
          }
        </div>
      ),
    },
    {
      key: 'effective_from',
      header: t('effectiveFrom'),
      sortable: true,
      render: (p: SerializedTaxProfile) => (
        <div className="text-sm">
          <div>{new Date(p.effective_from!).toLocaleDateString()}</div>
          {p.effective_to && (
            <div className="text-xs text-muted-foreground">→ {new Date(p.effective_to).toLocaleDateString()}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: '',
      render: (p: SerializedTaxProfile) => (
        <div className="flex gap-1">
          {p.is_default && <Badge className="bg-blue-600 text-white text-xs">{t('default')}</Badge>}
          <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-xs">
            {p.is_active ? t('active') : t('inactive')}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('actions'),
      render: (p: SerializedTaxProfile) => (
        <div className="flex items-center gap-1">
          <CmxButton
            variant="ghost"
            size="sm"
            onClick={() => openEditProfile(p)}
            disabled={isPending}
          >
            <Pencil className="h-3.5 w-3.5" />
          </CmxButton>
          {!p.is_default && (
            <CmxButton
              variant="ghost"
              size="sm"
              onClick={() => handleSetDefault(p.id)}
              disabled={isPending}
              title={t('setDefault')}
            >
              <Star className="h-3.5 w-3.5" />
            </CmxButton>
          )}
          <CmxButton
            variant="ghost"
            size="sm"
            onClick={() => handleDeactivateProfile(p.id)}
            disabled={isPending || p.is_default}
            title={t('deactivate')}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </CmxButton>
        </div>
      ),
    },
  ];

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
      id: 'profiles',
      label: t('profiles'),
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CmxButton onClick={openCreateProfile} disabled={isPending}>
              <Plus className="h-4 w-4 me-2" />
              {t('addProfile')}
            </CmxButton>
          </div>
          {profiles.length === 0
            ? <CmxEmptyState title={t('empty')} />
            : <CmxDataTable columns={profileColumns} data={profiles} />
          }
        </div>
      ),
    },
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

      {/* Profile Dialog */}
      <CmxDialog
        open={profileDialogMode !== null}
        onOpenChange={(v) => !v && setProfileDialogMode(null)}
      >
        <CmxDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {profileDialogMode === 'edit' ? t('editProfile') : t('addProfile')}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <form onSubmit={profileForm.handleSubmit(handleSubmitProfile)} className="space-y-4 py-2">

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('profileName')} *</label>
                <CmxInput {...profileForm.register('name')} />
                {profileForm.formState.errors.name && (
                  <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">{t('profileName2')}</label>
                <CmxInput {...profileForm.register('name2')} dir="rtl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('taxType')}</label>
                <CmxSelectDropdown
                  value={profileTaxType}
                  onValueChange={(v) => profileForm.setValue('tax_type', v as 'VAT' | 'GST' | 'CUSTOM')}
                >
                  <CmxSelectDropdownTrigger>
                    <CmxSelectDropdownValue />
                  </CmxSelectDropdownTrigger>
                  <CmxSelectDropdownContent>
                    {TAX_TYPES.map((type) => (
                      <CmxSelectDropdownItem key={type} value={type}>
                        {t(`typeLabels.${type}` as never)}
                      </CmxSelectDropdownItem>
                    ))}
                  </CmxSelectDropdownContent>
                </CmxSelectDropdown>
              </div>
              <div>
                <label className="text-sm font-medium">{t('rate')}</label>
                <CmxInput
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  {...profileForm.register('rate', { setValueAs: (v) => v === '' ? 0 : Number(v) })}
                />
                {profileForm.formState.errors.rate && (
                  <p className="text-xs text-destructive mt-1">{profileForm.formState.errors.rate.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t('appliesTo')}</label>
              <CmxInput
                {...profileForm.register('applies_to')}
                placeholder="WASH, IRON (comma-separated)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t('effectiveFrom')} *</label>
                <CmxInput type="date" {...profileForm.register('effective_from')} />
              </div>
              <div>
                <label className="text-sm font-medium">{t('effectiveTo')}</label>
                <CmxInput type="date" {...profileForm.register('effective_to')} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{t('isCompound')}</span>
              <CmxSwitch
                checked={profileIsCompound}
                onCheckedChange={(v) => profileForm.setValue('is_compound', v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{t('isDefault')}</span>
              <CmxSwitch
                checked={profileIsDefault}
                onCheckedChange={(v) => profileForm.setValue('is_default', v)}
              />
            </div>

            <CmxDialogFooter>
              <CmxButton type="button" variant="outline" onClick={() => setProfileDialogMode(null)} disabled={isPending}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton type="submit" disabled={isPending}>
                {isPending ? tCommon('loading') : profileDialogMode === 'edit' ? tCommon('save') : tCommon('save')}
              </CmxButton>
            </CmxDialogFooter>
          </form>
        </CmxDialogContent>
      </CmxDialog>

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

'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Star } from 'lucide-react';
import { CmxButton, CmxSkeletonTable, CmxCard, CmxCardContent } from '@ui/primitives';
import { CmxDataTable, CmxEmptyState } from '@ui/data-display';
import { Badge } from '@ui/primitives/badge';
import { cmxMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { CmxInput } from '@ui/primitives';
import {
  getTaxProfilesAction,
  createTaxProfileAction,
  setDefaultTaxProfileAction,
  deactivateTaxProfileAction,
  type TaxProfile,
  type CreateTaxProfileInput,
} from '@/app/actions/settings/tax-actions';

const TAX_TYPES = ['VAT', 'GST', 'CUSTOM'] as const;

export function TaxProfilesTab() {
  const t = useTranslations('settings.tax');
  const [isPending, startTransition] = useTransition();

  const [profiles, setProfiles] = useState<TaxProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formName2, setFormName2] = useState('');
  const [formTaxType, setFormTaxType] = useState<'VAT' | 'GST' | 'CUSTOM'>('VAT');
  const [formRate, setFormRate] = useState('');
  const [formAppliesTo, setFormAppliesTo] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [formEffectiveTo, setFormEffectiveTo] = useState('');

  const loadProfiles = () => {
    setIsLoading(true);
    startTransition(async () => {
      const result = await getTaxProfilesAction();
      setIsLoading(false);
      if (result.success && result.data) {
        setProfiles(result.data);
      } else if (!result.success) {
        cmxMessage.error(result.error ?? t('empty'));
      }
    });
  };

  useEffect(() => {
    loadProfiles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setFormName('');
    setFormName2('');
    setFormTaxType('VAT');
    setFormRate('');
    setFormAppliesTo('');
    setFormIsDefault(false);
    setFormEffectiveFrom('');
    setFormEffectiveTo('');
  };

  const handleCreate = () => {
    if (!formName.trim() || !formRate) return;
    const input: CreateTaxProfileInput = {
      name:          formName.trim(),
      name2:         formName2.trim() || undefined,
      taxType:       formTaxType,
      rate:          parseFloat(formRate),
      appliesTo:     formAppliesTo.trim() || undefined,
      isDefault:     formIsDefault,
      effectiveFrom: formEffectiveFrom || undefined,
      effectiveTo:   formEffectiveTo || undefined,
    };
    startTransition(async () => {
      const result = await createTaxProfileAction(input);
      if (result.success) {
        cmxMessage.success(t('saved'));
        setShowDialog(false);
        resetForm();
        loadProfiles();
      } else {
        cmxMessage.error(result.error ?? t('empty'));
      }
    });
  };

  const handleSetDefault = (profile: TaxProfile) => {
    startTransition(async () => {
      const result = await setDefaultTaxProfileAction(profile.id);
      if (result.success) {
        loadProfiles();
      } else {
        cmxMessage.error(result.error ?? t('empty'));
      }
    });
  };

  const handleDeactivate = (profile: TaxProfile) => {
    startTransition(async () => {
      const result = await deactivateTaxProfileAction(profile.id);
      if (result.success) {
        cmxMessage.success(t('deactivated'));
        loadProfiles();
      } else {
        cmxMessage.error(result.error ?? t('empty'));
      }
    });
  };

  const typeBadgeVariant = (type: string) => {
    if (type === 'VAT') return 'default' as const;
    if (type === 'GST') return 'secondary' as const;
    return 'outline' as const;
  };

  const columns = [
    {
      key: 'name',
      header: t('profileName'),
      render: (p: TaxProfile) => (
        <div>
          <div className="font-medium">{p.name}</div>
          {p.name2 && <div className="text-xs text-muted-foreground">{p.name2}</div>}
        </div>
      ),
    },
    {
      key: 'tax_type',
      header: t('taxType'),
      render: (p: TaxProfile) => (
        <Badge variant={typeBadgeVariant(p.tax_type)}>
          {t(`typeLabels.${p.tax_type}` as 'typeLabels.VAT')}
        </Badge>
      ),
    },
    {
      key: 'rate',
      header: t('rate'),
      render: (p: TaxProfile) => <span>{p.rate}%</span>,
    },
    {
      key: 'applies_to',
      header: t('appliesTo'),
      render: (p: TaxProfile) => (
        <div className="flex flex-wrap gap-1">
          {p.applies_to.length > 0
            ? p.applies_to.map((item) => (
                <Badge key={item} variant="secondary" className="text-xs">
                  {item}
                </Badge>
              ))
            : <span className="text-muted-foreground text-xs">—</span>}
        </div>
      ),
    },
    {
      key: 'effective_from',
      header: t('effectiveFrom'),
      render: (p: TaxProfile) =>
        p.effective_from ? new Date(p.effective_from).toLocaleDateString() : '—',
    },
    {
      key: 'status',
      header: t('active'),
      render: (p: TaxProfile) => (
        <div className="flex items-center gap-1">
          {p.is_default && (
            <Badge variant="default" className="gap-1">
              <Star className="h-3 w-3" />
              {t('default')}
            </Badge>
          )}
          <Badge variant={p.is_active ? 'secondary' : 'outline'}>
            {p.is_active ? t('active') : t('inactive')}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: TaxProfile) => (
        <div className="flex gap-2 justify-end">
          {!p.is_default && (
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => handleSetDefault(p)}
              disabled={isPending}
            >
              {t('setDefault')}
            </CmxButton>
          )}
          <CmxButton
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => handleDeactivate(p)}
            disabled={isPending}
          >
            {t('deactivate')}
          </CmxButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <CmxButton onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t('addProfile')}
        </CmxButton>
      </div>

      {isLoading ? (
        <CmxSkeletonTable rows={4} columns={6} showHeader />
      ) : profiles.length === 0 ? (
        <CmxEmptyState title={t('empty')} />
      ) : (
        <CmxDataTable columns={columns} data={profiles} />
      )}

      <CmxDialog open={showDialog} onOpenChange={(v) => { if (!v) { setShowDialog(false); resetForm(); } }}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('addProfile')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">{t('profileName')}</label>
              <CmxInput
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('profileName')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('profileName2')}</label>
              <CmxInput
                value={formName2}
                onChange={(e) => setFormName2(e.target.value)}
                placeholder={t('profileName2')}
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('taxType')}</label>
              <CmxSelectDropdown
                value={formTaxType}
                onValueChange={(v) => setFormTaxType(v as 'VAT' | 'GST' | 'CUSTOM')}
              >
                <CmxSelectDropdownTrigger>
                  <CmxSelectDropdownValue />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {TAX_TYPES.map((type) => (
                    <CmxSelectDropdownItem key={type} value={type}>
                      {t(`typeLabels.${type}` as 'typeLabels.VAT')}
                    </CmxSelectDropdownItem>
                  ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
            <div>
              <label className="text-sm font-medium">{t('rate')}</label>
              <CmxInput
                type="number"
                value={formRate}
                onChange={(e) => setFormRate(e.target.value)}
                placeholder="0.00"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('appliesTo')}</label>
              <CmxInput
                value={formAppliesTo}
                onChange={(e) => setFormAppliesTo(e.target.value)}
                placeholder="e.g. laundry, dry-cleaning"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('effectiveFrom')}</label>
              <CmxInput
                type="date"
                value={formEffectiveFrom}
                onChange={(e) => setFormEffectiveFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('effectiveTo')}</label>
              <CmxInput
                type="date"
                value={formEffectiveTo}
                onChange={(e) => setFormEffectiveTo(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isDefault" className="text-sm font-medium cursor-pointer">
                {t('isDefault')}
              </label>
            </div>
          </div>
          <CmxDialogFooter>
            <CmxButton
              variant="outline"
              onClick={() => { setShowDialog(false); resetForm(); }}
              disabled={isPending}
            >
              Cancel
            </CmxButton>
            <CmxButton
              onClick={handleCreate}
              disabled={isPending || !formName.trim() || !formRate}
            >
              {isPending ? 'Saving...' : t('addProfile')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxEmptyState } from '@ui/data-display';
import { Badge } from '@ui/primitives/badge';
import { cmxMessage } from '@ui/feedback';
import { CmxTabsPanel } from '@ui/navigation';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';

type TaxProfile = {
  id: string;
  name: string;
  name2: string | null;
  tax_type: string;
  rate: number;
  applies_to: string[];
  is_default: boolean;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
};

type TaxExemption = {
  id: string;
  customer_id: string | null;
  service_type: string | null;
  exemption_type: string;
  certificate_no: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
};

interface TaxSetupClientProps {
  initialProfiles: TaxProfile[];
  initialExemptions: TaxExemption[];
  tenantId: string;
}

export function TaxSetupClient({ initialProfiles, initialExemptions, tenantId }: TaxSetupClientProps) {
  const t = useTranslations('taxSetup');
  const [, startTransition] = useTransition();
  const [profiles, setProfiles] = useState<TaxProfile[]>(initialProfiles);
  const [exemptions, setExemptions] = useState<TaxExemption[]>(initialExemptions);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showExemptionForm, setShowExemptionForm] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '', name2: '', taxType: 'VAT', rate: '', appliesTo: '', isDefault: false,
    effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '',
  });

  // Exemption form state
  const [exemptionForm, setExemptionForm] = useState({
    customerId: '', exemptionType: 'CUSTOMER_EXEMPT', certificateNo: '',
    serviceType: '', validFrom: new Date().toISOString().slice(0, 10), validTo: '',
  });

  const handleSaveProfile = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/v1/settings/tax/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name:          profileForm.name,
            name2:         profileForm.name2 || undefined,
            taxType:       profileForm.taxType,
            rate:          Number(profileForm.rate),
            appliesTo:     profileForm.appliesTo ? profileForm.appliesTo.split(',').map((s) => s.trim()) : [],
            isDefault:     profileForm.isDefault,
            effectiveFrom: profileForm.effectiveFrom ? new Date(profileForm.effectiveFrom).toISOString() : undefined,
            effectiveTo:   profileForm.effectiveTo ? new Date(profileForm.effectiveTo).toISOString() : undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setProfiles((prev) => [...prev, { ...data.data, rate: Number(data.data.rate) }]);
          cmxMessage.success(t('saved'));
          setShowProfileForm(false);
          setProfileForm({ name: '', name2: '', taxType: 'VAT', rate: '', appliesTo: '', isDefault: false, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '' });
        } else {
          cmxMessage.error(data.error ?? 'Failed to save');
        }
      } catch {
        cmxMessage.error('Failed to save tax profile');
      }
    });
  };

  const handleSaveExemption = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/v1/settings/tax/exemptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            customerId:    exemptionForm.customerId || undefined,
            exemptionType: exemptionForm.exemptionType,
            certificateNo: exemptionForm.certificateNo || undefined,
            serviceType:   exemptionForm.serviceType || undefined,
            validFrom:     exemptionForm.validFrom ? new Date(exemptionForm.validFrom).toISOString() : undefined,
            validTo:       exemptionForm.validTo ? new Date(exemptionForm.validTo).toISOString() : undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setExemptions((prev) => [...prev, data.data]);
          cmxMessage.success(t('exemptionSaved'));
          setShowExemptionForm(false);
          setExemptionForm({ customerId: '', exemptionType: 'CUSTOMER_EXEMPT', certificateNo: '', serviceType: '', validFrom: new Date().toISOString().slice(0, 10), validTo: '' });
        } else {
          cmxMessage.error(data.error ?? 'Failed to save');
        }
      } catch {
        cmxMessage.error('Failed to save exemption');
      }
    });
  };

  const profileColumns = [
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
      key: 'type',
      header: t('taxType'),
      render: (p: TaxProfile) => <Badge variant="outline">{t(`typeLabels.${p.tax_type}` as never)}</Badge>,
    },
    {
      key: 'rate',
      header: t('rate'),
      render: (p: TaxProfile) => <span className="font-mono">{p.rate}%</span>,
    },
    {
      key: 'applies_to',
      header: t('appliesTo'),
      render: (p: TaxProfile) => (
        <div className="flex flex-wrap gap-1">
          {p.applies_to.length === 0
            ? <span className="text-xs text-muted-foreground">—</span>
            : p.applies_to.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)
          }
        </div>
      ),
    },
    {
      key: 'flags',
      header: '',
      render: (p: TaxProfile) => (
        <div className="flex gap-1">
          {p.is_default && <Badge className="bg-blue-600 text-white">{t('default')}</Badge>}
          <Badge variant={p.is_active ? 'default' : 'secondary'}>
            {p.is_active ? t('active') : t('inactive')}
          </Badge>
        </div>
      ),
    },
  ];

  const exemptionColumns = [
    {
      key: 'customer',
      header: t('customerId'),
      render: (e: TaxExemption) => <span className="font-mono text-xs">{e.customer_id ?? '—'}</span>,
    },
    {
      key: 'type',
      header: t('exemptionType'),
      render: (e: TaxExemption) => <Badge variant="outline">{e.exemption_type}</Badge>,
    },
    {
      key: 'cert',
      header: t('certificateNo'),
      render: (e: TaxExemption) => <span>{e.certificate_no ?? '—'}</span>,
    },
    {
      key: 'validity',
      header: t('validFrom'),
      render: (e: TaxExemption) => (
        <span className="text-sm">
          {new Date(e.valid_from).toLocaleDateString()}
          {' → '}
          {e.valid_to ? new Date(e.valid_to).toLocaleDateString() : t('noExpiry')}
        </span>
      ),
    },
  ];

  const tabs = [
    {
      id: 'profiles',
      label: t('profiles'),
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CmxButton onClick={() => setShowProfileForm(true)}>
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
            <CmxButton onClick={() => setShowExemptionForm(true)}>
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

  return (
    <>
      <CmxTabsPanel tabs={tabs} />

      {/* Profile Form Dialog */}
      <CmxDialog open={showProfileForm} onOpenChange={setShowProfileForm}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('addProfile')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">{t('profileName')} *</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileForm.name}
                onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('profileName2')}</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileForm.name2}
                onChange={(e) => setProfileForm((f) => ({ ...f, name2: e.target.value }))}
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('taxType')}</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileForm.taxType}
                onChange={(e) => setProfileForm((f) => ({ ...f, taxType: e.target.value }))}
              >
                <option value="VAT">{t('typeLabels.VAT')}</option>
                <option value="GST">{t('typeLabels.GST')}</option>
                <option value="CUSTOM">{t('typeLabels.CUSTOM')}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('rate')}</label>
              <input
                type="number" min="0" max="100" step="0.01"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileForm.rate}
                onChange={(e) => setProfileForm((f) => ({ ...f, rate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('appliesTo')}</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="WASH,IRON (comma separated)"
                value={profileForm.appliesTo}
                onChange={(e) => setProfileForm((f) => ({ ...f, appliesTo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('effectiveFrom')}</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileForm.effectiveFrom}
                onChange={(e) => setProfileForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={profileForm.isDefault}
                onChange={(e) => setProfileForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              <label htmlFor="isDefault" className="text-sm">{t('isDefault')}</label>
            </div>
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setShowProfileForm(false)}>Cancel</CmxButton>
            <CmxButton onClick={handleSaveProfile} disabled={!profileForm.name || !profileForm.rate}>Save</CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {/* Exemption Form Dialog */}
      <CmxDialog open={showExemptionForm} onOpenChange={setShowExemptionForm}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>{t('addExemption')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">{t('customerId')}</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Customer UUID (optional)"
                value={exemptionForm.customerId}
                onChange={(e) => setExemptionForm((f) => ({ ...f, customerId: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('exemptionType')} *</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exemptionForm.exemptionType}
                onChange={(e) => setExemptionForm((f) => ({ ...f, exemptionType: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('certificateNo')}</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exemptionForm.certificateNo}
                onChange={(e) => setExemptionForm((f) => ({ ...f, certificateNo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('serviceType')}</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exemptionForm.serviceType}
                onChange={(e) => setExemptionForm((f) => ({ ...f, serviceType: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('validFrom')}</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exemptionForm.validFrom}
                onChange={(e) => setExemptionForm((f) => ({ ...f, validFrom: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('validTo')}</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exemptionForm.validTo}
                onChange={(e) => setExemptionForm((f) => ({ ...f, validTo: e.target.value }))}
              />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setShowExemptionForm(false)}>Cancel</CmxButton>
            <CmxButton onClick={handleSaveExemption} disabled={!exemptionForm.exemptionType}>Save</CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  );
}

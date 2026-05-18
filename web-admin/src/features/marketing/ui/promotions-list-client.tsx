'use client';

/**
 * Promotions List — Client Component
 *
 * Displays all promotions with inline activate/deactivate toggle and a create/edit dialog.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { PlusCircle, Edit, ToggleLeft, ToggleRight } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { cmxMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import {
  listPromotionsAction,
  createPromotionAction,
  updatePromotionAction,
  togglePromotionAction,
} from '@/app/actions/marketing/promotions-actions';
import { PROMO_TYPES } from '@/lib/constants/order-financial';
import type { PromoType } from '@/lib/constants/order-financial';

interface PromotionRow {
  id:                   string;
  promo_name:           string | null;
  promo_name2:          string | null;
  promo_code:           string | null;
  discount_type:        string;
  discount_value:       { toNumber: () => number } | number;
  max_uses:             number | null;
  max_uses_per_customer: number | null;
  current_uses:         number | null;
  valid_from:           Date | string;
  valid_to:             Date | string | null;
  is_active:            boolean;
}

export function PromotionsListClient() {
  const t       = useTranslations('marketing.promotionsV2');
  const tCommon = useTranslations('common');

  const [rows, setRows]         = useState<PromotionRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [isLoading, setLoading] = useState(true);
  const [dialog, setDialog]     = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing]   = useState<PromotionRow | null>(null);
  const [isSaving, setSaving]   = useState(false);

  // Form fields
  const [name, setName]                   = useState('');
  const [name2, setName2]                 = useState('');
  const [code, setCode]                   = useState('');
  const [promoType, setPromoType]         = useState<PromoType>(PROMO_TYPES.PERCENTAGE);
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses]             = useState('');
  const [maxPerCustomer, setMaxPerCustomer] = useState('1');
  const [validFrom, setValidFrom]         = useState('');
  const [validTo, setValidTo]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPromotionsAction(page, 20);
    if (result.success) {
      setRows(result.data.items as PromotionRow[]);
      setTotal(result.data.total);
    } else {
      cmxMessage.error(result.error);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setName(''); setName2(''); setCode('');
    setPromoType(PROMO_TYPES.PERCENTAGE);
    setDiscountValue(''); setMaxUses(''); setMaxPerCustomer('1');
    setValidFrom(''); setValidTo('');
    setDialog('create');
  }

  function openEdit(row: PromotionRow) {
    setEditing(row);
    setName(row.promo_name ?? '');
    setName2(row.promo_name2 ?? '');
    setCode(row.promo_code ?? '');
    setPromoType((row.discount_type as PromoType) ?? PROMO_TYPES.PERCENTAGE);
    const dv = typeof row.discount_value === 'object'
      ? row.discount_value.toNumber()
      : Number(row.discount_value);
    setDiscountValue(String(dv));
    setMaxUses(row.max_uses != null ? String(row.max_uses) : '');
    setMaxPerCustomer(row.max_uses_per_customer != null ? String(row.max_uses_per_customer) : '1');
    setValidFrom(row.valid_from ? new Date(row.valid_from).toISOString().substring(0, 10) : '');
    setValidTo(row.valid_to   ? new Date(row.valid_to).toISOString().substring(0, 10)   : '');
    setDialog('edit');
  }

  async function handleSave() {
    if (!name.trim()) { cmxMessage.error('Name is required'); return; }
    const dv = parseFloat(discountValue);
    if (isNaN(dv) || dv <= 0) { cmxMessage.error('Discount value must be > 0'); return; }

    setSaving(true);
    let result: { success: boolean; error?: string };

    if (dialog === 'create') {
      result = await createPromotionAction({
        name,
        name2:               name2 || undefined,
        promoCode:           code  || undefined,
        promoType,
        discountValue:       dv,
        maxUses:             maxUses ? parseInt(maxUses) : undefined,
        maxUsesPerCustomer:  maxPerCustomer ? parseInt(maxPerCustomer) : undefined,
        startsAt:            validFrom || undefined,
        expiresAt:           validTo   || undefined,
      });
      if (result.success) cmxMessage.success(t('saved'));
    } else {
      result = await updatePromotionAction({
        id:                  editing!.id,
        name,
        name2:               name2 || undefined,
        promoCode:           code  || undefined,
        promoType,
        discountValue:       dv,
        maxUses:             maxUses ? parseInt(maxUses) : undefined,
        maxUsesPerCustomer:  maxPerCustomer ? parseInt(maxPerCustomer) : undefined,
        startsAt:            validFrom || undefined,
        expiresAt:           validTo   || undefined,
      });
      if (result.success) cmxMessage.success(t('saved'));
    }

    if (!result.success && result.error) cmxMessage.error(result.error);

    setSaving(false);
    if (result.success) { setDialog(null); void load(); }
  }

  async function handleToggle(row: PromotionRow) {
    const result = await togglePromotionAction(row.id, !row.is_active);
    if (result.success) {
      cmxMessage.success(row.is_active ? t('deactivated') : t('activated'));
      void load();
    } else {
      cmxMessage.error(result.error);
    }
  }

  const discountTypeLabel = (type: string) =>
    t(`discountTypeLabels.${type as keyof typeof PROMO_TYPES}`) as string;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <CmxButton variant="primary" size="sm" onClick={openCreate} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          {t('add')}
        </CmxButton>
      </div>

      {/* Table */}
      <CmxDataTable
        isLoading={isLoading}
        columns={[
          {
            key: 'promo_name',
            header: t('name'),
            render: (row: PromotionRow) => (
              <span className="font-medium">{row.promo_name ?? '—'}</span>
            ),
          },
          {
            key: 'promo_code',
            header: t('code'),
            render: (row: PromotionRow) =>
              row.promo_code ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {row.promo_code}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">Auto</span>
              ),
          },
          {
            key: 'discount_type',
            header: t('discountType'),
            render: (row: PromotionRow) => (
              <Badge variant="secondary">{discountTypeLabel(row.discount_type)}</Badge>
            ),
          },
          {
            key: 'discount_value',
            header: t('discountValue'),
            render: (row: PromotionRow) => {
              const dv = typeof row.discount_value === 'object'
                ? row.discount_value.toNumber()
                : Number(row.discount_value);
              return (
                <span className="tabular-nums">
                  {dv.toFixed(3)}
                  {row.discount_type === PROMO_TYPES.PERCENTAGE ? '%' : ''}
                </span>
              );
            },
          },
          {
            key: 'usage',
            header: t('currentUses'),
            render: (row: PromotionRow) =>
              row.max_uses != null
                ? `${row.current_uses ?? 0} / ${row.max_uses}`
                : String(row.current_uses ?? 0),
          },
          {
            key: 'validity',
            header: t('validFrom'),
            render: (row: PromotionRow) => {
              const from = new Date(row.valid_from).toLocaleDateString();
              const to   = row.valid_to
                ? new Date(row.valid_to).toLocaleDateString()
                : t('noExpiry');
              return <span className="text-xs">{from} → {to}</span>;
            },
          },
          {
            key: 'is_active',
            header: tCommon('status'),
            render: (row: PromotionRow) => (
              <Badge variant={row.is_active ? 'default' : 'secondary'}>
                {row.is_active ? tCommon('active') : tCommon('inactive')}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: tCommon('actions'),
            render: (row: PromotionRow) => (
              <div className="flex items-center gap-1">
                <CmxButton
                  variant="ghost"
                  size="xs"
                  title={tCommon('edit')}
                  onClick={() => openEdit(row)}
                >
                  <Edit className="h-4 w-4" />
                </CmxButton>
                <CmxButton
                  variant="ghost"
                  size="xs"
                  title={row.is_active ? t('deactivate') : t('activate')}
                  onClick={() => handleToggle(row)}
                >
                  {row.is_active
                    ? <ToggleRight className="h-4 w-4 text-green-600" />
                    : <ToggleLeft  className="h-4 w-4 text-muted-foreground" />}
                </CmxButton>
              </div>
            ),
          },
        ]}
        data={rows}
        totalCount={total}
        currentPage={page}
        pageSize={20}
        onPageChange={setPage}
      />

      {/* Create / Edit Dialog */}
      <CmxDialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>
              {dialog === 'create' ? t('add') : t('edit')}
            </CmxDialogTitle>
          </CmxDialogHeader>

          <div className="flex flex-col gap-4 py-2 max-h-[60vh] overflow-y-auto">
            <FieldRow label={t('name')} required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="cmx-input"
              />
            </FieldRow>
            <FieldRow label={t('name2')}>
              <input
                type="text"
                value={name2}
                onChange={(e) => setName2(e.target.value)}
                className="cmx-input"
                dir="rtl"
              />
            </FieldRow>
            <FieldRow label={t('code')}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="cmx-input font-mono"
                placeholder="SAVE20"
              />
            </FieldRow>
            <FieldRow label={t('discountType')} required>
              <select
                value={promoType}
                onChange={(e) => setPromoType(e.target.value as PromoType)}
                className="cmx-input"
              >
                {Object.values(PROMO_TYPES).map((pt) => (
                  <option key={pt} value={pt}>{discountTypeLabel(pt)}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label={t('discountValue')} required>
              <input
                type="number"
                min="0"
                step="0.001"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="cmx-input"
              />
            </FieldRow>
            <FieldRow label={t('maxUses')}>
              <input
                type="number"
                min="1"
                step="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="cmx-input"
                placeholder="Unlimited"
              />
            </FieldRow>
            <FieldRow label={t('maxUsesPerCustomer')}>
              <input
                type="number"
                min="1"
                step="1"
                value={maxPerCustomer}
                onChange={(e) => setMaxPerCustomer(e.target.value)}
                className="cmx-input"
              />
            </FieldRow>
            <FieldRow label={t('validFrom')}>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="cmx-input"
              />
            </FieldRow>
            <FieldRow label={t('validTo')}>
              <input
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className="cmx-input"
              />
            </FieldRow>
          </div>

          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setDialog(null)} disabled={isSaving}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? tCommon('saving') : tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxSelect, CmxSwitch, Label } from '@ui/primitives';
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { PRICE_BASIS, SPEED_PRICE_TYPES } from '@/lib/constants/commercial';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import type { SpeedRuleView } from '@/lib/services/catalog/speed-rules.service';
import { speedRuleBulkSchema, speedRuleCreateSchema } from '@/lib/validations/speed-rule-schemas';
import { SpeedRulesApiError, bulkCreateSpeedRulesApi, createSpeedRuleApi, updateSpeedRuleApi } from '../api/speed-rules-api';
import { SpeedRuleProductField, type PickedProduct } from './speed-rule-parts';

type Scope = 'TENANT' | 'CATEGORY' | 'PRODUCT';
type Option = { value: string; label: string };

/** Props of the rule editor. Mount it with a `key` per rule, so the form starts from that rule. */
export interface SpeedRuleEditorDialogProps {
  /** `edit` needs `rule`; `bulk` creates one product rule per product of a category. */
  mode: 'create' | 'edit' | 'bulk';
  rule?: SpeedRuleView;
  /** Opened from a product: the rule belongs to this product and the scope cannot change. */
  fixedProduct?: PickedProduct;
  speedOptions: Option[];
  branchOptions: Option[];
  categoryOptions: Option[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Add, edit or bulk-create a Speed Pricing rule. Typed amounts are sent exactly as
 * written: a value that does not fit the rule is refused at the field, never changed.
 * @param props - mode, the rule, the menu options and callbacks
 * @returns the dialog
 */
export function SpeedRuleEditorDialog({ mode, rule, fixedProduct, speedOptions, branchOptions, categoryOptions, onClose, onSaved }: SpeedRuleEditorDialogProps) {
  const t = useTranslations('catalog.speedPricing');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { token: csrfToken } = useCSRFToken();

  const [serviceSpeed, setServiceSpeed] = useState(rule?.serviceSpeed ?? speedOptions[0]?.value ?? '');
  const [scope, setScope] = useState<Scope>(mode === 'bulk' ? 'CATEGORY' : fixedProduct || rule?.productId ? 'PRODUCT' : rule?.serviceCategoryCode ? 'CATEGORY' : 'TENANT');
  const [categoryCode, setCategoryCode] = useState(rule?.serviceCategoryCode ?? '');
  const [product, setProduct] = useState<PickedProduct | null>(
    fixedProduct ?? (rule?.productId
      ? { id: rule.productId, label: (locale === 'ar' ? rule.productName2 || rule.productName : rule.productName || rule.productName2) ?? rule.productId }
      : null),
  );
  const [branchId, setBranchId] = useState(rule?.branchId ?? '');
  const [priceType, setPriceType] = useState(rule?.speedPriceType ?? SPEED_PRICE_TYPES.MULTIPLIER);
  const [amount, setAmount] = useState(rule?.defaultSpeedSellPrice ?? rule?.multiplierSpeed ?? rule?.speedExtraAmount ?? '');
  const [priceBasis, setPriceBasis] = useState(rule?.priceBasis ?? PRICE_BASIS.PER_UNIT);
  const [turnaround, setTurnaround] = useState(rule?.turnaroundHhSpeed ?? '');
  const [name, setName] = useState(rule?.name ?? '');
  const [name2, setName2] = useState(rule?.name2 ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(rule?.effectiveFrom ?? new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState(rule?.effectiveTo ?? '');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isSellPrice = priceType === SPEED_PRICE_TYPES.SELL_PRICE;
  const isMultiplier = priceType === SPEED_PRICE_TYPES.MULTIPLIER;
  const isFixed = priceType === SPEED_PRICE_TYPES.FIXED_AMOUNT;
  const amountField = isSellPrice ? 'defaultSpeedSellPrice' : isMultiplier ? 'multiplierSpeed' : 'speedExtraAmount';
  const amountPercent = isMultiplier && /^\d+(\.\d+)?$/.test(amount) ? (Number(amount) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) : null;

  const save = async () => {
    const trimmed = amount.trim();
    const payload = {
      serviceSpeed,
      branchId: branchId || null,
      serviceCategoryCode: scope === 'CATEGORY' ? categoryCode || null : null,
      productId: scope === 'PRODUCT' ? product?.id ?? null : null,
      speedPriceType: priceType,
      defaultSpeedSellPrice: isSellPrice ? trimmed : null,
      multiplierSpeed: isMultiplier ? trimmed : null,
      speedExtraAmount: isFixed ? trimmed : null,
      priceBasis: isFixed ? priceBasis : null,
      turnaroundHhSpeed: turnaround.trim() || null,
      name: name.trim() || null,
      name2: name2.trim() || null,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      isActive,
    };

    const errors: Record<string, string> = {};
    if (scope === 'PRODUCT' && !product) errors.productId = t('validation.productId');
    if (scope === 'CATEGORY' && !categoryCode) errors.serviceCategoryCode = t('validation.serviceCategoryCode');
    const parsed = mode === 'bulk' ? speedRuleBulkSchema.safeParse(payload) : speedRuleCreateSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'form');
        errors[field] = t.has(`validation.${field}`) ? t(`validation.${field}` as never) : t('validation.form');
      }
    }
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0 || !parsed.success) return;

    setSaving(true);
    try {
      if (mode === 'bulk') {
        const result = await bulkCreateSpeedRulesApi(parsed.data, csrfToken);
        cmxMessage.success(t('bulk.done', result));
      } else if (mode === 'edit' && rule) {
        await updateSpeedRuleApi(rule.id, parsed.data, csrfToken);
        cmxMessage.success(t('saved'));
      } else {
        await createSpeedRuleApi(parsed.data, csrfToken);
        cmxMessage.success(t('saved'));
      }
      onSaved();
    } catch (error) {
      const code = error instanceof SpeedRulesApiError ? error.code : 'INTERNAL_ERROR';
      setFormError(t.has(`errors.${code}`) ? t(`errors.${code}` as never) : t('errors.INTERNAL_ERROR'));
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'bulk' ? t('bulk.title') : mode === 'edit' ? t('editRule') : t('addRule');

  return (
    <CmxDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <CmxDialogContent scrollBody className="w-[calc(100vw-2rem)] max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{title}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4">
          {mode === 'bulk' ? <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('bulk.description')}</p> : null}
          {formError ? <CmxSummaryMessage type="error" title={t('errors.title')} items={[formError]} onDismiss={() => setFormError(null)} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <CmxSelect label={t('fields.speed')} options={speedOptions} value={serviceSpeed} onChange={(e) => setServiceSpeed(e.target.value)} error={fieldErrors.serviceSpeed} />
            <CmxSelect
              label={t('fields.branch')}
              options={[{ value: '', label: t('scope.allBranches') }, ...branchOptions]}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            />
            {mode === 'bulk' || fixedProduct ? null : (
              <CmxSelect
                label={t('fields.scope')}
                options={[
                  { value: 'TENANT', label: t('scope.allProducts') },
                  { value: 'CATEGORY', label: t('scope.category') },
                  { value: 'PRODUCT', label: t('scope.product') },
                ]}
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
              />
            )}
            {scope === 'CATEGORY' ? (
              <CmxSelect
                label={t('fields.category')}
                placeholder={t('fields.chooseCategory')}
                options={categoryOptions}
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                error={fieldErrors.serviceCategoryCode}
              />
            ) : null}
            {fixedProduct ? (
              <CmxInput label={t('fields.product')} value={fixedProduct.label} disabled />
            ) : scope === 'PRODUCT' ? (
              <SpeedRuleProductField label={t('fields.product')} value={product} onChange={setProduct} error={fieldErrors.productId} />
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CmxSelect
              label={t('fields.priceType')}
              options={Object.values(SPEED_PRICE_TYPES).map((value) => ({ value, label: t(`priceType.${value}`) }))}
              value={priceType}
              onChange={(e) => {
                // Each type's amount means something different, so the typed one is not carried over.
                setPriceType(e.target.value);
                setAmount('');
                setFieldErrors({});
              }}
              helpText={t('priceTypeChangeHint')}
            />
            <CmxInput
              label={t(`amountLabel.${priceType}` as never)}
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={fieldErrors[amountField]}
              helpText={amountPercent ? t('multiplierHint', { percent: amountPercent }) : isMultiplier ? t('multiplierExample') : undefined}
            />
            {isFixed ? (
              <CmxSelect
                label={t('fields.priceBasis')}
                options={Object.values(PRICE_BASIS).map((value) => ({ value, label: t(`priceBasis.${value}`) }))}
                value={priceBasis}
                onChange={(e) => setPriceBasis(e.target.value)}
                error={fieldErrors.priceBasis}
              />
            ) : null}
            <CmxInput
              label={t('fields.turnaround')}
              inputMode="decimal"
              dir="ltr"
              value={turnaround}
              onChange={(e) => setTurnaround(e.target.value)}
              error={fieldErrors.turnaroundHhSpeed}
              helpText={t('turnaroundHint')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CmxInput label={t('fields.effectiveFrom')} type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} error={fieldErrors.effectiveFrom} />
            <CmxInput label={t('fields.effectiveTo')} type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} error={fieldErrors.effectiveTo} helpText={t('effectiveToHint')} />
            <CmxInput label={t('fields.name')} value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} />
            <CmxInput label={t('fields.name2')} dir="rtl" value={name2} onChange={(e) => setName2(e.target.value)} error={fieldErrors.name2} />
          </div>

          <div className="flex items-center gap-3">
            <CmxSwitch id="speed-rule-active" checked={isActive} onCheckedChange={setIsActive} aria-labelledby="speed-rule-active-label" />
            <Label id="speed-rule-active-label" htmlFor="speed-rule-active">{tCommon('active')}</Label>
          </div>
          <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('newOrdersOnly')}</p>
        </div>

        <CmxDialogFooter>
          <CmxButton type="button" variant="outline" onClick={onClose} disabled={saving}>{tCommon('cancel')}</CmxButton>
          <CmxButton type="button" onClick={save} loading={saving}>{mode === 'bulk' ? t('bulk.create') : tCommon('save')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

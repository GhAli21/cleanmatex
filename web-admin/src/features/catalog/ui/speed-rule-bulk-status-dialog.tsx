'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxSelect } from '@ui/primitives';
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { useAuth } from '@/lib/auth/auth-context';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { SpeedRulesApiError, setProductRulesActiveApi } from '../api/speed-rules-api';

type Option = { value: string; label: string };

/** Props of the bulk retire dialog. */
export interface SpeedRuleBulkStatusDialogProps {
  speedOptions: Option[];
  categoryOptions: Option[];
  onClose: () => void;
  onDone: () => void;
}

/**
 * Retires or restores many product rules at once, so products can fall back to a
 * general rule. The server counts first, and warns when no general rule would take
 * over: those products would cost the same as Standard, which must not be a surprise.
 * @param props - the menu options and callbacks
 * @returns the dialog
 */
export function SpeedRuleBulkStatusDialog({ speedOptions, categoryOptions, onClose, onDone }: SpeedRuleBulkStatusDialogProps) {
  const t = useTranslations('catalog.speedPricing.bulkStatus');
  const tRules = useTranslations('catalog.speedPricing');
  const tCommon = useTranslations('common');
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const { token: csrfToken, loading: csrfLoading } = useCSRFToken();

  const [action, setAction] = useState<'retire' | 'restore'>('retire');
  const [serviceSpeed, setServiceSpeed] = useState(speedOptions[0]?.value ?? '');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scope = { serviceSpeed, serviceCategoryCode: category || null, isActive: action === 'restore' };
  const preview = useQuery({
    queryKey: ['speed-rules', 'bulk-status', tenantId, scope],
    queryFn: () => setProductRulesActiveApi({ ...scope, dryRun: true }, csrfToken),
    // Prevent the query before the tenant and the CSRF token are confirmed.
    enabled: !!tenantId && !csrfLoading && !!serviceSpeed,
    staleTime: 0,
  });

  const errorText = (e: unknown) => {
    const code = e instanceof SpeedRulesApiError ? e.code : 'INTERNAL_ERROR';
    return tRules.has(`errors.${code}`) ? tRules(`errors.${code}` as never) : tRules('errors.INTERNAL_ERROR');
  };
  const apply = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await setProductRulesActiveApi({ ...scope, dryRun: false }, csrfToken);
      cmxMessage.success(t(action === 'retire' ? 'doneRetired' : 'doneRestored', { count: result.changed }));
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const matched = preview.data?.matched ?? 0;

  return (
    <CmxDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <CmxDialogContent scrollBody className="w-[calc(100vw-2rem)] max-w-xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
          {error ? <CmxSummaryMessage type="error" title={tRules('errors.title')} items={[error]} onDismiss={() => setError(null)} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <CmxSelect
              label={t('action')}
              options={[{ value: 'retire', label: t('retire') }, { value: 'restore', label: t('restore') }]}
              value={action}
              onChange={(e) => setAction(e.target.value as 'retire' | 'restore')}
            />
            <CmxSelect label={tRules('fields.speed')} options={speedOptions} value={serviceSpeed} onChange={(e) => setServiceSpeed(e.target.value)} />
            <CmxSelect
              label={tRules('fields.category')}
              options={[{ value: '', label: t('allCategories') }, ...categoryOptions]}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div role="status" className="space-y-1 text-sm">
            {preview.isFetching ? <p>{tCommon('loading')}</p> : null}
            {preview.isError ? <p className="text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">{errorText(preview.error)}</p> : null}
            {preview.data && !preview.isFetching ? (
              <>
                <p className="font-medium">{t(action === 'retire' ? 'previewRetire' : 'previewRestore', { count: matched })}</p>
                {action === 'retire' && matched > 0 ? (
                  <p className={preview.data.generalRules === 0 ? 'text-[rgb(var(--cmx-destructive-rgb,220_38_38))]' : 'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]'}>
                    {preview.data.generalRules === 0 ? t('noGeneralRule') : t('hasGeneralRule')}
                  </p>
                ) : null}
                {action === 'restore' && matched > 0 ? <p className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('restoreNote')}</p> : null}
              </>
            ) : null}
          </div>
          <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tRules('newOrdersOnly')}</p>
        </div>

        <CmxDialogFooter>
          <CmxButton type="button" variant="outline" onClick={onClose} disabled={saving}>{tCommon('cancel')}</CmxButton>
          <CmxButton type="button" onClick={apply} loading={saving} disabled={matched === 0 || preview.isFetching}>
            {t(action === 'retire' ? 'confirmRetire' : 'confirmRestore')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

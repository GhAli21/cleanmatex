import { getLocale, getTranslations } from 'next-intl/server';
import {
  Alert,
  AlertDescription,
  CmxButton,
  CmxCard,
  CmxCardContent,
  CmxCardDescription,
  CmxCardHeader,
  CmxCardTitle,
  CmxInput,
  CmxSelect,
  CmxTextarea,
} from '@ui/primitives';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';
import { currentTenantCan } from '@/lib/services/feature-flags.service';
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard';
import { ErpLiteV2Service } from '@/lib/services/erp-lite-v2.service';
import type { ErpLitePoDashboardSnapshot } from '@/lib/types/erp-lite-v2';
import { createErpLitePurchaseOrderAction } from '@/app/actions/erp-lite/v2-actions';

type SearchParamsValue = string | string[] | undefined;

function getSingleParam(value: SearchParamsValue): string | null {
  return typeof value === 'string' ? value : null;
}

export default async function ErpLitePoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const t = await getTranslations('erpLite.po');
  const tCommon = await getTranslations('erpLite.common');
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const params = searchParams ? await searchParams : {};
  const notice = getSingleParam(params.notice);
  const error = getSingleParam(params.error);
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_PO_ENABLED);

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_PO_ENABLED} permissions={['erp_lite_po:view']}>
        {null}
      </ErpLitePageGuard>
    );
  }

  let loadError: string | null = null;
  let snapshot: ErpLitePoDashboardSnapshot = {
    po_list: [],
    branch_options: [],
    supplier_options: [],
    usage_code_options: [],
  };

  try {
    snapshot = await ErpLiteV2Service.getPoDashboardSnapshot(locale);
  } catch (loadFailure) {
    loadError =
      loadFailure instanceof Error
        ? loadFailure.message
        : tCommon('loadError');
  }

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_PO_ENABLED}
      permissions={['erp_lite_po:view']}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('eyebrow')}</p>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {notice ? (
          <Alert>
            <AlertDescription>{t(`notices.${notice}`)}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.po.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.po.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLitePurchaseOrderAction} className="space-y-3">
                <CmxSelect
                  name="supplier_id"
                  label={t('forms.po.fields.supplier')}
                  defaultValue=""
                  options={snapshot.supplier_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxInput name="po_date" type="date" label={t('forms.po.fields.poDate')} required />
                <CmxInput name="expected_date" type="date" label={t('forms.po.fields.expectedDate')} />
                <CmxSelect
                  name="branch_id"
                  label={t('forms.po.fields.branch')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalSelect')}
                  options={snapshot.branch_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxSelect
                  name="usage_code_id"
                  label={t('forms.po.fields.usageCode')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalUsageCode')}
                  options={snapshot.usage_code_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxInput name="currency_code" label={t('forms.po.fields.currencyCode')} placeholder="OMR" required />
                <CmxInput name="subtotal_amount" type="number" step="0.0001" min="0" label={t('forms.po.fields.subtotal')} required />
                <CmxInput name="tax_amount" type="number" step="0.0001" min="0" label={t('forms.po.fields.tax')} />
                <CmxTextarea name="description" label={t('forms.po.fields.description')} required />
                <CmxButton type="submit" className="w-full">{t('forms.po.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.po.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.po.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('lists.po.columns.no')}</th>
                      <th className="px-3 py-2 text-left">{t('lists.po.columns.date')}</th>
                      <th className="px-3 py-2 text-left">{t('lists.po.columns.supplier')}</th>
                      <th className="px-3 py-2 text-left">{t('lists.po.columns.branch')}</th>
                      <th className="px-3 py-2 text-left">{t('lists.po.columns.status')}</th>
                      <th className="px-3 py-2 text-right">{t('lists.po.columns.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.po_list.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                          {t('lists.po.empty')}
                        </td>
                      </tr>
                    ) : (
                      snapshot.po_list.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{item.po_no}</td>
                          <td className="px-3 py-2">{item.po_date}</td>
                          <td className="px-3 py-2">{item.supplier_name}</td>
                          <td className="px-3 py-2">{item.branch_name ?? '—'}</td>
                          <td className="px-3 py-2">{item.status_code}</td>
                          <td className="px-3 py-2 text-right">
                            {item.total_amount.toFixed(4)} {item.currency_code}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CmxCardContent>
          </CmxCard>
        </div>
      </div>
    </ErpLitePageGuard>
  );
}

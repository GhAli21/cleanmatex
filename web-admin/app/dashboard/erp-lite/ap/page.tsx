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
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard';
import { ErpLiteV2Service } from '@/lib/services/erp-lite-v2.service';
import {
  createErpLiteApInvoiceAction,
  createErpLiteApPaymentAction,
  createErpLiteSupplierAction,
} from '@/app/actions/erp-lite/v2-actions';

type SearchParamsValue = string | string[] | undefined;

function getSingleParam(value: SearchParamsValue): string | null {
  return typeof value === 'string' ? value : null;
}

export default async function ErpLiteApPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const t = await getTranslations('erpLite.ap');
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const params = searchParams ? await searchParams : {};
  const notice = getSingleParam(params.notice);
  const error = getSingleParam(params.error);
  const snapshot = await ErpLiteV2Service.getApDashboardSnapshot(locale);

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_AP_ENABLED}
      permissions={['erp_lite_ap:view']}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('eyebrow')}
          </p>
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

        <div className="grid gap-4 xl:grid-cols-3">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.supplier.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.supplier.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteSupplierAction} className="space-y-3">
                <CmxInput name="supplier_code" label={t('forms.supplier.fields.code')} />
                <CmxInput name="name" label={t('forms.supplier.fields.name')} required />
                <CmxInput name="name2" label={t('forms.supplier.fields.name2')} />
                <CmxSelect
                  name="branch_id"
                  label={t('forms.supplier.fields.branch')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalSelect')}
                  options={snapshot.branch_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxSelect
                  name="payable_acct_id"
                  label={t('forms.supplier.fields.payableAccount')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalAccount')}
                  options={snapshot.payable_account_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxInput name="currency_code" label={t('forms.supplier.fields.currencyCode')} placeholder="OMR" required />
                <CmxInput name="payment_terms_days" type="number" min="0" label={t('forms.supplier.fields.paymentTerms')} />
                <CmxInput name="email" label={t('forms.supplier.fields.email')} />
                <CmxInput name="phone" label={t('forms.supplier.fields.phone')} />
                <CmxButton type="submit" className="w-full">{t('forms.supplier.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.invoice.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.invoice.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteApInvoiceAction} className="space-y-3">
                <CmxSelect
                  name="supplier_id"
                  label={t('forms.invoice.fields.supplier')}
                  defaultValue=""
                  options={snapshot.supplier_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxInput name="invoice_date" type="date" label={t('forms.invoice.fields.invoiceDate')} required />
                <CmxInput name="due_date" type="date" label={t('forms.invoice.fields.dueDate')} />
                <CmxSelect
                  name="branch_id"
                  label={t('forms.invoice.fields.branch')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalSelect')}
                  options={snapshot.branch_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxInput name="currency_code" label={t('forms.invoice.fields.currencyCode')} placeholder="OMR" required />
                <CmxInput name="subtotal_amount" type="number" step="0.0001" min="0" label={t('forms.invoice.fields.subtotal')} required />
                <CmxInput name="tax_amount" type="number" step="0.0001" min="0" label={t('forms.invoice.fields.tax')} />
                <CmxInput name="supplier_inv_no" label={t('forms.invoice.fields.supplierInvoiceNo')} />
                <CmxTextarea name="description" label={t('forms.invoice.fields.description')} required />
                <CmxButton type="submit" className="w-full">{t('forms.invoice.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.payment.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.payment.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteApPaymentAction} className="space-y-3">
                <CmxSelect
                  name="supplier_id"
                  label={t('forms.payment.fields.supplier')}
                  defaultValue=""
                  options={snapshot.supplier_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxSelect
                  name="ap_invoice_id"
                  label={t('forms.payment.fields.invoice')}
                  defaultValue=""
                  options={snapshot.invoice_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxInput name="payment_date" type="date" label={t('forms.payment.fields.paymentDate')} required />
                <CmxInput name="currency_code" label={t('forms.payment.fields.currencyCode')} placeholder="OMR" required />
                <CmxInput name="amount_total" type="number" step="0.0001" min="0" label={t('forms.payment.fields.amount')} required />
                <CmxSelect
                  name="settlement_code"
                  label={t('forms.payment.fields.settlement')}
                  defaultValue="BANK"
                  options={[
                    { value: 'BANK', label: t('settlement.bank') },
                    { value: 'CASH', label: t('settlement.cash') },
                  ]}
                />
                <CmxSelect
                  name="bank_account_id"
                  label={t('forms.payment.fields.bankAccount')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalBank')}
                  options={snapshot.bank_account_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxSelect
                  name="cashbox_id"
                  label={t('forms.payment.fields.cashbox')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalCashbox')}
                  options={snapshot.cashbox_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxInput name="payment_method_code" label={t('forms.payment.fields.paymentMethod')} />
                <CmxInput name="ext_ref_no" label={t('forms.payment.fields.referenceNo')} />
                <CmxButton type="submit" className="w-full">{t('forms.payment.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr]">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.suppliers.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.suppliers.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.supplier_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.suppliers.empty')}</p>
              ) : (
                snapshot.supplier_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.supplier_code} · {item.supplier_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.branch_name ?? '—'}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.payable_account_name ?? '—'}</div>
                    <div className="mt-3 text-sm font-semibold">{item.currency_code} · {item.status_code}</div>
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.invoices.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.invoices.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.ap_invoice_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.invoices.empty')}</p>
              ) : (
                snapshot.ap_invoice_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.ap_inv_no}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.supplier_name} · {item.invoice_date}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.branch_name ?? '—'} · {item.status_code}</div>
                    <div className="mt-3 text-sm font-semibold">
                      {item.open_amount.toFixed(4)} / {item.total_amount.toFixed(4)} {item.currency_code}
                    </div>
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.payments.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.payments.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.ap_payment_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.payments.empty')}</p>
              ) : (
                snapshot.ap_payment_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.ap_pmt_no}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.supplier_name} · {item.payment_date}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.branch_name ?? '—'} · {item.status_code}</div>
                    <div className="mt-3 text-sm font-semibold">
                      {item.amount_total.toFixed(4)} {item.currency_code} · {t(`settlement.${item.settlement_code.toLowerCase()}`)}
                    </div>
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.aging.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.aging.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.ap_aging_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.aging.empty')}</p>
              ) : (
                snapshot.ap_aging_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.ap_inv_no}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.supplier_name}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {(item.due_date ?? '—')} · {t(`agingBuckets.${item.aging_bucket}`)}
                    </div>
                    <div className="mt-3 text-sm font-semibold">
                      {item.open_amount.toFixed(4)} {item.currency_code} · {t('agingDays', { days: item.days_overdue })}
                    </div>
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>
        </div>
      </div>
    </ErpLitePageGuard>
  );
}

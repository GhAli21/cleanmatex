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
} from '@ui/primitives';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard';
import { ErpLiteV2Service } from '@/lib/services/erp-lite-v2.service';
import {
  createErpLiteBankAccountAction,
  createErpLiteBankReconAction,
  createErpLiteBankStatementAction,
} from '@/app/actions/erp-lite/v2-actions';

type SearchParamsValue = string | string[] | undefined;

function getSingleParam(value: SearchParamsValue): string | null {
  return typeof value === 'string' ? value : null;
}

export default async function ErpLiteBankReconPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const t = await getTranslations('erpLite.bankRecon');
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const params = searchParams ? await searchParams : {};
  const notice = getSingleParam(params.notice);
  const error = getSingleParam(params.error);
  const snapshot = await ErpLiteV2Service.getBankDashboardSnapshot(locale);

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED}
      permissions={['erp_lite_bank_recon:view']}
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

        <div className="grid gap-4 xl:grid-cols-3">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.bankAccount.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.bankAccount.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteBankAccountAction} className="space-y-3">
                <CmxInput name="bank_code" label={t('forms.bankAccount.fields.code')} />
                <CmxInput name="name" label={t('forms.bankAccount.fields.name')} required />
                <CmxInput name="name2" label={t('forms.bankAccount.fields.name2')} />
                <CmxInput name="bank_name" label={t('forms.bankAccount.fields.bankName')} />
                <CmxInput name="bank_account_no" label={t('forms.bankAccount.fields.accountNo')} required />
                <CmxInput name="iban_no" label={t('forms.bankAccount.fields.iban')} />
                <CmxSelect
                  name="branch_id"
                  label={t('forms.bankAccount.fields.branch')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalSelect')}
                  options={snapshot.branch_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxSelect
                  name="account_id"
                  label={t('forms.bankAccount.fields.glAccount')}
                  defaultValue=""
                  options={snapshot.bank_gl_account_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxInput name="currency_code" label={t('forms.bankAccount.fields.currencyCode')} placeholder="OMR" required />
                <CmxSelect
                  name="stmt_import_mode"
                  label={t('forms.bankAccount.fields.importMode')}
                  defaultValue="CSV"
                  options={[
                    { value: 'CSV', label: 'CSV' },
                    { value: 'MANUAL', label: 'Manual' },
                    { value: 'API', label: 'API' },
                  ]}
                />
                <CmxButton type="submit" className="w-full">{t('forms.bankAccount.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.statement.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.statement.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteBankStatementAction} className="space-y-3">
                <CmxSelect
                  name="bank_account_id"
                  label={t('forms.statement.fields.bankAccount')}
                  defaultValue=""
                  options={snapshot.bank_account_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxInput name="stmt_date_from" type="date" label={t('forms.statement.fields.dateFrom')} required />
                <CmxInput name="stmt_date_to" type="date" label={t('forms.statement.fields.dateTo')} required />
                <CmxInput name="source_file_name" label={t('forms.statement.fields.sourceFile')} />
                <CmxInput name="opening_balance" type="number" step="0.0001" label={t('forms.statement.fields.openingBalance')} />
                <CmxInput name="closing_balance" type="number" step="0.0001" label={t('forms.statement.fields.closingBalance')} />
                <CmxButton type="submit" className="w-full">{t('forms.statement.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.recon.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.recon.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteBankReconAction} className="space-y-3">
                <CmxSelect
                  name="bank_account_id"
                  label={t('forms.recon.fields.bankAccount')}
                  defaultValue=""
                  options={snapshot.bank_account_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxSelect
                  name="period_id"
                  label={t('forms.recon.fields.period')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalPeriod')}
                  options={snapshot.period_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxInput name="recon_date" type="date" label={t('forms.recon.fields.reconDate')} required />
                <CmxInput name="stmt_date_from" type="date" label={t('forms.recon.fields.dateFrom')} required />
                <CmxInput name="stmt_date_to" type="date" label={t('forms.recon.fields.dateTo')} required />
                <CmxInput name="gl_balance" type="number" step="0.0001" label={t('forms.recon.fields.glBalance')} />
                <CmxInput name="stmt_balance" type="number" step="0.0001" label={t('forms.recon.fields.stmtBalance')} />
                <CmxInput name="unmatched_amount" type="number" step="0.0001" label={t('forms.recon.fields.unmatchedAmount')} />
                <CmxButton type="submit" className="w-full">{t('forms.recon.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.bankAccounts.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.bankAccounts.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.bank_account_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.bankAccounts.empty')}</p>
              ) : (
                snapshot.bank_account_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.bank_code} · {item.account_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.bank_name ?? '—'}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.branch_name ?? '—'} · {item.stmt_import_mode}</div>
                    <div className="mt-3 text-sm font-semibold">{item.currency_code} · {item.status_code}</div>
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.statements.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.statements.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.bank_statement_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.statements.empty')}</p>
              ) : (
                snapshot.bank_statement_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.import_batch_no}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.bank_name}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.stmt_date_from} → {item.stmt_date_to}</div>
                    <div className="mt-3 text-sm font-semibold">{item.line_count} · {item.status_code}</div>
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.recons.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.recons.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.bank_recon_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.recons.empty')}</p>
              ) : (
                snapshot.bank_recon_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.recon_code}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.bank_name} · {item.recon_date}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.stmt_date_from} → {item.stmt_date_to}</div>
                    <div className="mt-3 text-sm font-semibold">
                      {item.unmatched_amount?.toFixed(4) ?? '—'} · {item.status_code}
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

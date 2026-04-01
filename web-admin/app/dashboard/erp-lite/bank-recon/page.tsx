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
import type { ErpLiteBankDashboardSnapshot } from '@/lib/types/erp-lite-v2';
import {
  createErpLiteBankAccountAction,
  createErpLiteBankMatchAction,
  closeErpLiteBankReconAction,
  createErpLiteBankReconAction,
  importErpLiteBankStatementLinesAction,
  lockErpLiteBankReconAction,
  reverseErpLiteBankMatchAction,
  createErpLiteBankStatementLineAction,
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
  const tCommon = await getTranslations('erpLite.common');
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const params = searchParams ? await searchParams : {};
  const notice = getSingleParam(params.notice);
  const error = getSingleParam(params.error);
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED);

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_BANK_RECON_ENABLED} permissions={['erp_lite_bank_recon:view']}>
        {null}
      </ErpLitePageGuard>
    );
  }

  let loadError: string | null = null;
  let snapshot: ErpLiteBankDashboardSnapshot = {
    bank_account_list: [],
    bank_statement_list: [],
    bank_statement_line_list: [],
    bank_match_list: [],
    bank_recon_list: [],
    branch_options: [],
    bank_gl_account_options: [],
    bank_account_options: [],
    bank_stmt_options: [],
    bank_stmt_line_options: [],
    ap_payment_options: [],
    bank_recon_open_options: [],
    period_options: [],
  };

  try {
    snapshot = await ErpLiteV2Service.getBankDashboardSnapshot(locale);
  } catch (loadFailure) {
    loadError =
      loadFailure instanceof Error
        ? loadFailure.message
        : tCommon('loadError');
  }

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

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
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

        <div className="grid gap-4 xl:grid-cols-2">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.statementLine.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.statementLine.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteBankStatementLineAction} className="space-y-3">
                <CmxSelect
                  name="bank_stmt_id"
                  label={t('forms.statementLine.fields.statement')}
                  defaultValue=""
                  options={snapshot.bank_stmt_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxSelect
                  name="bank_account_id"
                  label={t('forms.statementLine.fields.bankAccount')}
                  defaultValue=""
                  options={snapshot.bank_account_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxInput name="txn_date" type="date" label={t('forms.statementLine.fields.txnDate')} required />
                <CmxInput name="value_date" type="date" label={t('forms.statementLine.fields.valueDate')} />
                <CmxInput name="ext_ref_no" label={t('forms.statementLine.fields.referenceNo')} />
                <CmxInput name="description" label={t('forms.statementLine.fields.description')} />
                <CmxInput name="debit_amount" type="number" step="0.0001" min="0" label={t('forms.statementLine.fields.debitAmount')} />
                <CmxInput name="credit_amount" type="number" step="0.0001" min="0" label={t('forms.statementLine.fields.creditAmount')} />
                <CmxInput name="balance_amount" type="number" step="0.0001" label={t('forms.statementLine.fields.balanceAmount')} />
                <CmxButton type="submit" className="w-full">{t('forms.statementLine.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.statementImport.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.statementImport.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={importErpLiteBankStatementLinesAction} className="space-y-3">
                <CmxSelect
                  name="bank_stmt_id"
                  label={t('forms.statementImport.fields.statement')}
                  defaultValue=""
                  options={snapshot.bank_stmt_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxTextarea
                  name="import_rows"
                  rows={8}
                  label={t('forms.statementImport.fields.rows')}
                  placeholder={t('forms.statementImport.placeholder')}
                  required
                />
                <p className="text-xs text-muted-foreground">{t('forms.statementImport.hint')}</p>
                <CmxButton type="submit" className="w-full">{t('forms.statementImport.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.match.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.match.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteBankMatchAction} className="space-y-3">
                <CmxSelect
                  name="bank_stmt_line_id"
                  label={t('forms.match.fields.statementLine')}
                  defaultValue=""
                  options={snapshot.bank_stmt_line_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxSelect
                  name="ap_payment_id"
                  label={t('forms.match.fields.apPayment')}
                  defaultValue=""
                  options={snapshot.ap_payment_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxSelect
                  name="bank_recon_id"
                  label={t('forms.match.fields.reconciliation')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalRecon')}
                  options={snapshot.bank_recon_open_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxInput name="match_amount" type="number" step="0.0001" min="0" label={t('forms.match.fields.matchAmount')} required />
                <CmxButton type="submit" className="w-full">{t('forms.match.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
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
                    {item.status_code === 'OPEN' ? (
                      <form action={closeErpLiteBankReconAction} className="mt-3">
                        <input type="hidden" name="bank_recon_id" value={item.id} />
                        <CmxButton type="submit" variant="outline" className="w-full">
                          {t('lists.recons.close')}
                        </CmxButton>
                      </form>
                    ) : null}
                    {item.status_code === 'CLOSED' ? (
                      <form action={lockErpLiteBankReconAction} className="mt-3">
                        <input type="hidden" name="bank_recon_id" value={item.id} />
                        <CmxButton type="submit" variant="outline" className="w-full">
                          {t('lists.recons.lock')}
                        </CmxButton>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.statementLines.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.statementLines.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.bank_statement_line_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.statementLines.empty')}</p>
              ) : (
                snapshot.bank_statement_line_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">#{item.line_no}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.txn_date} · {item.ext_ref_no ?? '—'}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{item.description ?? '—'}</div>
                    <div className="mt-3 text-sm font-semibold">
                      {(item.debit_amount > 0 ? item.debit_amount : item.credit_amount).toFixed(4)} · {item.match_status}
                    </div>
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.matches.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.matches.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.bank_match_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.matches.empty')}</p>
              ) : (
                snapshot.bank_match_list.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.source_doc_label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.statement_line_label}</div>
                    <div className="mt-3 text-sm font-semibold">
                      {item.match_amount.toFixed(4)} · {item.status_code}
                    </div>
                    {item.status_code === 'CONFIRMED' ? (
                      <form action={reverseErpLiteBankMatchAction} className="mt-3">
                        <input type="hidden" name="bank_match_id" value={item.id} />
                        <CmxButton type="submit" variant="outline" className="w-full">
                          {t('lists.matches.reverse')}
                        </CmxButton>
                      </form>
                    ) : null}
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

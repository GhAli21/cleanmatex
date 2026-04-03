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
import { ErpLiteCoaService } from '@/lib/services/erp-lite-coa.service';
import type { ErpLiteCoaDashboardSnapshot } from '@/lib/types/erp-lite-coa';
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard';
import { ErpLiteCoaListTable } from '@features/erp-lite/ui/erp-lite-coa-list-table';
import { createErpLiteAccountAction } from '@/app/actions/erp-lite/coa-actions';

type SearchParamsValue = string | string[] | undefined;

function getSingleParam(value: SearchParamsValue): string | null {
  return typeof value === 'string' ? value : null;
}

export default async function ErpLiteCoaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const t = await getTranslations('erpLite.coa');
  const tCommon = await getTranslations('erpLite.common');
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const params = searchParams ? await searchParams : {};
  const notice = getSingleParam(params.notice);
  const error = getSingleParam(params.error);
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED);

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED} permissions={['erp_lite_coa:view']}>
        {null}
      </ErpLitePageGuard>
    );
  }

  let loadError: string | null = null;
  let snapshot: ErpLiteCoaDashboardSnapshot = {
    account_list: [],
    account_type_options: [],
    account_group_options: [],
    parent_account_options: [],
    branch_options: [],
  };

  try {
    snapshot = await ErpLiteCoaService.getDashboardSnapshot(locale);
  } catch (loadFailure) {
    loadError =
      loadFailure instanceof Error
        ? loadFailure.message
        : tCommon('loadError');
  }

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED}
      permissions={['erp_lite_coa:view']}
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

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.account.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.account.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteAccountAction} className="space-y-3">
                <CmxInput name="account_code" label={t('forms.account.fields.code')} required />
                <CmxInput name="name" label={t('forms.account.fields.name')} required />
                <CmxInput name="name2" label={t('forms.account.fields.name2')} />
                <CmxSelect
                  name="acc_type_id"
                  label={t('forms.account.fields.accountType')}
                  defaultValue=""
                  options={snapshot.account_type_options.map((item) => ({ value: item.id, label: item.label }))}
                  required
                />
                <CmxSelect
                  name="acc_group_id"
                  label={t('forms.account.fields.accountGroup')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalGroup')}
                  options={snapshot.account_group_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxSelect
                  name="parent_account_id"
                  label={t('forms.account.fields.parentAccount')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalParent')}
                  options={snapshot.parent_account_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxSelect
                  name="branch_id"
                  label={t('forms.account.fields.branch')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.optionalBranch')}
                  options={snapshot.branch_options.map((item) => ({ value: item.id, label: item.label }))}
                />
                <CmxSelect
                  name="is_postable"
                  label={t('forms.account.fields.postable')}
                  defaultValue="true"
                  options={[
                    { value: 'true', label: t('forms.account.postableOptions.postable') },
                    { value: 'false', label: t('forms.account.postableOptions.headerOnly') },
                  ]}
                />
                <CmxTextarea name="description" label={t('forms.account.fields.description')} />
                <CmxButton type="submit" className="w-full">{t('forms.account.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.accounts.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.accounts.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <ErpLiteCoaListTable items={snapshot.account_list} />
            </CmxCardContent>
          </CmxCard>
        </div>
      </div>
    </ErpLitePageGuard>
  );
}

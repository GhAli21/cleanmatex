'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Settings2 } from 'lucide-react';
import { CmxButton, CmxSwitch } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxSkeletonTable } from '@ui/primitives';
import { CmxSelectDropdown, CmxSelectDropdownContent, CmxSelectDropdownItem, CmxSelectDropdownTrigger, CmxSelectDropdownValue } from '@ui/forms';
import { cmxMessage } from '@ui/feedback';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { CURRENCY_FX_PERMISSIONS } from '@/lib/constants/permissions/currency-fx-perm';
import { FX_RESOLUTION_POLICY, type FxResolutionPolicy } from '@/lib/constants/currency-fx';
import { getFxSettingsAction, updateFxSettingsAction } from '@/app/actions/fx/settings-actions';

export function SettingsTab() {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startTransition] = useTransition();
  const canManage = useHasPermissionCode(CURRENCY_FX_PERMISSIONS.FX_RATES_MANAGE);

  const [resolutionPolicy, setResolutionPolicy] = useState<FxResolutionPolicy>(FX_RESOLUTION_POLICY.TENANT_THEN_HQ);
  const [autoApproveImports, setAutoApproveImports] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      const result = await getFxSettingsAction();
      if (result.success && result.data) {
        setResolutionPolicy(result.data.resolutionPolicy);
        setAutoApproveImports(result.data.autoApproveImports);
      }
      setIsLoading(false);
    })();
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateFxSettingsAction({ resolutionPolicy, autoApproveImports });
      if (result.success) {
        cmxMessage.success(t('settings.saved'));
      } else {
        cmxMessage.error(result.error ?? tCommon('error'));
      }
    });
  };

  if (isLoading) return <CmxSkeletonTable rows={2} columns={1} />;

  return (
    <CmxCard className="max-w-xl">
      <CmxCardContent className="space-y-5 p-5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('settings.title')}</h3>
        </div>

        <div>
          <label className="text-sm font-medium">{t('settings.resolutionPolicy')}</label>
          <CmxSelectDropdown
            value={resolutionPolicy}
            onValueChange={(v) => setResolutionPolicy(v as FxResolutionPolicy)}
          >
            <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              {Object.values(FX_RESOLUTION_POLICY).map((policy) => (
                <CmxSelectDropdownItem key={policy} value={policy}>
                  {t(`settings.resolutionPolicyValue.${policy}` as Parameters<typeof t>[0])}
                </CmxSelectDropdownItem>
              ))}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t('settings.autoApproveImports')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.autoApproveImportsDescription')}</p>
          </div>
          <CmxSwitch checked={autoApproveImports} onCheckedChange={setAutoApproveImports} disabled={!canManage} />
        </div>

        {canManage && (
          <CmxButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? tCommon('saving') : tCommon('save')}
          </CmxButton>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}

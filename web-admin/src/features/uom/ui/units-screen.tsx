/** Units & Conversions screen (/dashboard/catalog/units): composes the two tabs. */
'use client';

import { useTranslations } from 'next-intl';
import { CmxTabs, CmxTabsContent, CmxTabsList, CmxTabsTrigger } from '@ui/primitives/tabs';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { UOM_PERMISSIONS } from '@/lib/constants/permissions/uom-perm';
import { UomConversionsPanel } from './conversions-panel';
import { UomUnitsPanel } from './units-panel';

/** The Units & Conversions screen. */
export function UnitsScreen() {
  const t = useTranslations('uom');
  const canManage = useHasPermissionCode(UOM_PERMISSIONS.MANAGE);

  return (
    <div className="space-y-6" data-testid="uom-units-screen">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CmxTabs defaultValue="units">
        <CmxTabsList>
          <CmxTabsTrigger value="units">{t('tabs.units')}</CmxTabsTrigger>
          <CmxTabsTrigger value="conversions">{t('tabs.conversions')}</CmxTabsTrigger>
        </CmxTabsList>
        <CmxTabsContent value="units"><UomUnitsPanel canManage={canManage} /></CmxTabsContent>
        <CmxTabsContent value="conversions"><UomConversionsPanel canManage={canManage} /></CmxTabsContent>
      </CmxTabs>
    </div>
  );
}

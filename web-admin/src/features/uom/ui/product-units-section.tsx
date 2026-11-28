/** "Units and packs" on the product page: the conversions that apply to this product only. */
'use client';

import { useTranslations } from 'next-intl';
import { CmxCard, CmxCardContent, CmxCardDescription, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { UOM_PERMISSIONS } from '@/lib/constants/permissions/uom-perm';
import { UomConversionsPanel } from './conversions-panel';

/**
 * @param props - section props
 * @param props.productId - the saved product
 * @returns the section, or nothing for a user who may not see units
 */
export function ProductUnitsSection({ productId }: { productId: string }) {
  const t = useTranslations('uom.conversions');
  const canView = useHasPermissionCode(UOM_PERMISSIONS.VIEW);
  const canManage = useHasPermissionCode(UOM_PERMISSIONS.MANAGE);
  if (!canView) return null;

  return (
    <CmxCard className="mt-5" data-testid="product-units-section">
      <CmxCardHeader className="border-b border-border">
        <CmxCardTitle className="text-base">{t('productTitle')}</CmxCardTitle>
        <CmxCardDescription className="text-sm">{t('productDescription')}</CmxCardDescription>
      </CmxCardHeader>
      <CmxCardContent className="p-4">
        <UomConversionsPanel canManage={canManage} productId={productId} />
      </CmxCardContent>
    </CmxCard>
  );
}

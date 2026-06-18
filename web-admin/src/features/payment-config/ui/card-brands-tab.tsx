'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Pencil } from 'lucide-react';
import { CmxDataTable, CmxEmptyState } from '@ui/data-display';
import { CmxSkeletonTable, CmxSwitch, CmxButton } from '@ui/primitives';
import { cmxMessage, CmxStatusBadge } from '@ui/feedback';
import { toggleCardBrandActive } from '@/app/actions/payment-config/card-brands-actions';
import { CardBrandConfigDialog } from './card-brand-config-dialog';
import type { OrgCardBrandConfig } from '@/lib/types/payment';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';

/**
 * Props for the tenant card brand management tab.
 */
interface CardBrandsTabProps {
  brands: OrgCardBrandConfig[];
  isLoading?: boolean;
  onRefresh: () => void;
}

/**
 * Card brands are editable only at the label/order level because the HQ code
 * remains the shared payment-data contract across the platform.
 * @param root0
 * @param root0.brands
 * @param root0.isLoading
 * @param root0.onRefresh
 */
export function CardBrandsTab({ brands, isLoading, onRefresh }: CardBrandsTabProps) {
  const t = useTranslations('paymentConfig');
  const [isPending, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<OrgCardBrandConfig | null>(null);
  const [localActive, setLocalActive] = useState<Record<string, boolean>>({});

  const getActive = (brand: OrgCardBrandConfig) =>
    localActive[brand.id] !== undefined ? localActive[brand.id] : brand.is_active;

  const CopyValue = ({
    value,
    maxLength,
  }: {
    value: string | number | null | undefined;
    maxLength?: number;
  }) => (
    <CmxCopyableCell
      as="span"
      value={value}
      maxLength={maxLength}
      align="left"
      className="px-0 py-0 text-sm text-foreground"
    />
  );

  /**
   * Applies optimistic active-state toggles so enable/disable feels immediate
   * while the server keeps the row for later re-enable flows.
   * @param brand
   * @param nextActive
   */
  const handleToggle = (brand: OrgCardBrandConfig, nextActive: boolean) => {
    setLocalActive((previous) => ({ ...previous, [brand.id]: nextActive }));

    startTransition(async () => {
      const result = await toggleCardBrandActive(brand.id, nextActive);

      if (result.success) {
        cmxMessage.success(nextActive ? t('cardBrands.activated') : t('cardBrands.deactivated'));
      } else {
        setLocalActive((previous) => ({ ...previous, [brand.id]: !nextActive }));
        cmxMessage.error(result.error ?? t('common.error'));
      }
    });
  };

  if (isLoading) {
    return <CmxSkeletonTable rows={4} columns={6} showHeader />;
  }

  if (!brands.length) {
    return (
      <CmxEmptyState
        icon={<CreditCard className="h-8 w-8" />}
        title={t('cardBrands.empty.title')}
        description={t('cardBrands.empty.description')}
      />
    );
  }

  const columns = [
    {
      key: 'card_brand_code',
      header: t('cardBrands.code'),
      render: (brand: OrgCardBrandConfig) => (
        <CopyValue value={brand.card_brand_code} />
      ),
    },
    {
      key: 'name',
      header: t('cardBrands.name'),
      render: (brand: OrgCardBrandConfig) => (
        <div>
          <div className="font-medium">{brand.name}</div>
          {brand.name2 && <div className="text-xs text-muted-foreground">{brand.name2}</div>}
        </div>
      ),
    },
    {
      key: 'description',
      header: t('cardBrands.description'),
      render: (brand: OrgCardBrandConfig) => {
        const english = brand.description?.trim();
        const arabic = brand.description2?.trim();

        if (!english && !arabic) {
          return <span className="text-xs text-muted-foreground">{t('cardBrands.noDescription')}</span>;
        }

        return (
          <div className="max-w-sm space-y-1">
            {english && <div className="line-clamp-2 text-sm text-muted-foreground">{english}</div>}
            {arabic && <div className="line-clamp-2 text-xs text-muted-foreground">{arabic}</div>}
          </div>
        );
      },
    },
    {
      key: 'rec_order',
      header: t('cardBrands.recOrder'),
      render: (brand: OrgCardBrandConfig) => (
        <span>{brand.rec_order ?? '—'}</span>
      ),
    },
    {
      key: 'audit',
      header: t('cardBrands.audit'),
      render: (brand: OrgCardBrandConfig) => (
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">{t('cardBrands.updatedBy')}</span>{' '}
            <span className="font-medium">{brand.updated_by ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('cardBrands.updatedAt')}</span>{' '}
            <span className="font-medium">
              {brand.updated_at ? new Date(brand.updated_at).toLocaleString() : '—'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('cardBrands.statusLabel'),
      render: (brand: OrgCardBrandConfig) => (
        <CmxStatusBadge
          label={getActive(brand) ? t('cardBrands.active') : t('cardBrands.inactive')}
          variant={getActive(brand) ? 'success' : 'outline'}
          size="sm"
        />
      ),
    },
    {
      key: 'is_active',
      header: t('cardBrands.enabled'),
      render: (brand: OrgCardBrandConfig) => (
        <CmxSwitch
          checked={getActive(brand)}
          onCheckedChange={(value) => handleToggle(brand, value)}
          disabled={isPending}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (brand: OrgCardBrandConfig) => (
        <div className="flex justify-end">
          <CmxButton variant="outline" size="sm" onClick={() => setEditTarget(brand)}>
            <Pencil className="h-3.5 w-3.5 me-1" />
            {t('common.edit')}
          </CmxButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <CmxDataTable columns={columns} data={brands} />

      {editTarget && (
        <CardBrandConfigDialog
          brand={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}

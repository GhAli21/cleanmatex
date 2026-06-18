'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Payment settings page content is isolated in a feature-local client
 * component so the route can remain a server gate while preserving the current
 * tabbed admin UX.
 */
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { CmxTabsPanel } from '@ui/navigation';
import { CmxSkeletonTable } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { cmxMessage } from '@ui/feedback';
import { PaymentMethodsTab } from '@features/payment-config/ui/payment-methods-tab';
import { CardBrandsTab } from '@features/payment-config/ui/card-brands-tab';
import { BranchOverridesTab } from '@features/payment-config/ui/branch-overrides-tab';
import { TerminalsTab } from '@features/payment-config/ui/terminals-tab';
import { CashDrawersTab } from '@features/payment-config/ui/cash-drawers-tab';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { getCardBrandConfigs } from '@/app/actions/payment-config/card-brands-actions';
import { getPaymentMethodConfigs } from '@/app/actions/payment-config/payment-methods-actions';
import { getTerminals } from '@/app/actions/payment-config/terminals-actions';
import { getCashDrawers } from '@/app/actions/payment-config/cash-drawers-actions';
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions';
import type {
  OrgCardBrandConfig,
  OrgPaymentMethodConfig,
  OrgPaymentTerminal,
} from '@/lib/types/payment';

interface Branch {
  id: string;
  branch_name: string;
}

/**
 * Client-side payment setup workbench with server-backed tabs for methods,
 * brands, branch overrides, terminals, and cash drawers.
 */
export function PaymentSettingsPage() {
  const t = useTranslations('paymentConfig');
  const tCommon = useTranslations('common');
  const [, startTransition] = useTransition();
  const { currencyCode: tenantCurrencyCode } = useTenantCurrency();

  const [methods, setMethods] = useState<OrgPaymentMethodConfig[]>([]);
  const [cardBrands, setCardBrands] = useState<OrgCardBrandConfig[]>([]);
  const [terminals, setTerminals] = useState<OrgPaymentTerminal[]>([]);
  const [drawers, setDrawers] = useState<Parameters<typeof CashDrawersTab>[0]['drawers']>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [methodsLoading, setMethodsLoading] = useState(true);
  const [cardBrandsLoading, setCardBrandsLoading] = useState(true);
  const [terminalsLoading, setTerminalsLoading] = useState(true);
  const [drawersLoading, setDrawersLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const loadMethods = () => {
    setMethodsLoading(true);
    startTransition(async () => {
      const result = await getPaymentMethodConfigs();
      setMethodsLoading(false);
      if (result.success && result.data) setMethods(result.data);
      else if (!result.success) cmxMessage.error(result.error ?? tCommon('error'));
    });
  };

  const loadCardBrands = () => {
    setCardBrandsLoading(true);
    startTransition(async () => {
      const result = await getCardBrandConfigs();
      setCardBrandsLoading(false);
      if (result.success && result.data) setCardBrands(result.data);
      else if (!result.success) cmxMessage.error(result.error ?? tCommon('error'));
    });
  };

  const loadTerminals = () => {
    setTerminalsLoading(true);
    startTransition(async () => {
      const result = await getTerminals();
      setTerminalsLoading(false);
      if (result.success && result.data) setTerminals(result.data);
      else if (!result.success) cmxMessage.error(result.error ?? tCommon('error'));
    });
  };

  const loadDrawers = () => {
    setDrawersLoading(true);
    startTransition(async () => {
      const result = await getCashDrawers();
      setDrawersLoading(false);
      if (result.success && result.data) setDrawers(result.data as Parameters<typeof CashDrawersTab>[0]['drawers']);
      else if (!result.success) cmxMessage.error(result.error ?? tCommon('error'));
    });
  };

  const loadBranches = () => {
    setBranchesLoading(true);
    startTransition(async () => {
      const result = await getBranchesAction();
      setBranchesLoading(false);
      if (result.success && result.data) {
        setBranches(
          (result.data as Array<{ id: string; name?: string; branch_name?: string }>).map((b) => ({
            id: b.id,
            branch_name: b.name ?? b.branch_name ?? 'Branch',
          }))
        );
      }
    });
  };

  useEffect(() => {
    loadMethods();
    loadCardBrands();
    loadTerminals();
    loadDrawers();
    loadBranches();
  }, []);  

  const tabs = [
    {
      id: 'methods',
      label: t('tabs.methods'),
      content: (
        <PaymentMethodsTab
          methods={methods}
          isLoading={methodsLoading}
          onRefresh={loadMethods}
        />
      ),
    },
    {
      id: 'cardBrands',
      label: t('tabs.cardBrands'),
      content: (
        <CardBrandsTab
          brands={cardBrands}
          isLoading={cardBrandsLoading}
          onRefresh={loadCardBrands}
        />
      ),
    },
    {
      id: 'branches',
      label: t('tabs.branches'),
      content: branchesLoading ? (
        <CmxSkeletonTable rows={3} columns={4} showHeader />
      ) : (
        <BranchOverridesTab branches={branches} />
      ),
    },
    {
      id: 'terminals',
      label: t('tabs.terminals'),
      content: (
        <TerminalsTab
          terminals={terminals}
          branches={branches}
          isLoading={terminalsLoading}
          onRefresh={loadTerminals}
        />
      ),
    },
    {
      id: 'cashDrawers',
      label: t('tabs.cashDrawers'),
      content: (
        <CashDrawersTab
          drawers={drawers}
          branches={branches}
          terminals={terminals}
          isLoading={drawersLoading}
          onRefresh={loadDrawers}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CmxCard>
          <CmxCardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('overview.tenantCurrency')}</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{tenantCurrencyCode}</p>
          </CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('overview.enabledMethods')}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {methods.filter((method) => method.is_enabled).length}
            </p>
          </CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('overview.activeTerminals')}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {terminals.filter((terminal) => terminal.is_enabled).length}
            </p>
          </CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('overview.openDrawers')}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {drawers.filter((drawer) => drawer.currentSession != null).length}
            </p>
          </CmxCardContent>
        </CmxCard>
      </div>
      <CmxTabsPanel tabs={tabs} />
    </div>
  );
}

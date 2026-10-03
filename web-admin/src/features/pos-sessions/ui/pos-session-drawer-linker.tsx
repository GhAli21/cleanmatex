'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link2, RefreshCw, WalletCards } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSelect } from '@ui/primitives/cmx-select';
import { Badge } from '@ui/primitives/badge';
import { cmxMessage } from '@ui/feedback';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import {
  fetchCashDrawersWithCurrentSession,
  type CashDrawerWithCurrentSession,
  type OpenCashDrawerSessionV2Result,
} from '@features/cash-drawers/api/cash-drawer-api';
import { CashDrawerOpenSessionDialog } from '@features/cash-drawers/ui/cash-drawer-open-session-dialog';
import { PosSessionApiError, postPosSessionAutoLinkDrawer } from '@features/pos-sessions/api/pos-session-api';
import { posSessionErrorKey } from '@features/pos-sessions/model/pos-session-flags';

interface PosSessionDrawerLinkerProps {
  branchId: string | null;
  posSessionId: string;
  canViewCashDrawer: boolean;
  canOpenCashDrawer: boolean;
  onLinked: () => Promise<void> | void;
}

/**
 * Lets the cashier choose or open a physical drawer from the POS Session Hub.
 *
 * The component intentionally calls cash-drawer APIs for drawer facts/actions,
 * then calls POS Session only for the operational link.
 */
export function PosSessionDrawerLinker({
  branchId,
  posSessionId,
  canViewCashDrawer,
  canOpenCashDrawer,
  onLinked,
}: PosSessionDrawerLinkerProps) {
  const t = useTranslations('posSessions');
  const { token: csrfToken } = useCSRFToken();
  const [selectedDrawerId, setSelectedDrawerId] = useState('');
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [busy, setBusy] = useState<'link' | 'open-link' | null>(null);

  // A known business rule reads in the cashier's language; anything else keeps the server text.
  const linkErrorMessage = (error: unknown): string => {
    const key = error instanceof PosSessionApiError ? posSessionErrorKey(error.errorCode) : null;
    return key ? t(`errors.${key}`) : error instanceof Error ? error.message : t('messages.drawerLinkFailed');
  };

  const drawersQuery = useQuery({
    queryKey: ['cash-drawers', 'with-current-session', branchId ?? 'none', 'pos-session-hub'],
    enabled: canViewCashDrawer && !!branchId,
    queryFn: () => fetchCashDrawersWithCurrentSession(branchId),
  });

  if (!canViewCashDrawer) {
    return <DrawerLinkNotice>{t('hub.drawerLinkNoViewPermission')}</DrawerLinkNotice>;
  }

  const drawers = drawersQuery.data ?? [];
  const effectiveDrawerId = selectedDrawerId || drawers[0]?.id || '';
  const selectedDrawer = drawers.find((drawer) => drawer.id === effectiveDrawerId) ?? null;
  const canUseSelectedOpenSession = !!selectedDrawer?.currentSession;

  const linkDrawerSession = async (drawerSessionId: string) => {
    if (!branchId) {
      cmxMessage.error(t('messages.selectBranch'));
      return;
    }
    setBusy('link');
    try {
      await postPosSessionAutoLinkDrawer({
        csrfToken,
        posSessionId,
        branchId,
        cashDrawerSessionId: drawerSessionId,
        sourceChannel: 'new_order_session_hub',
      });
      cmxMessage.success(t('messages.drawerLinked'));
      await onLinked();
    } catch (error) {
      cmxMessage.error(linkErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const handleDrawerOpened = async (result: OpenCashDrawerSessionV2Result) => {
    if (!branchId) {
      cmxMessage.error(t('messages.selectBranch'));
      return;
    }
    setBusy('open-link');
    try {
      await postPosSessionAutoLinkDrawer({
        csrfToken,
        posSessionId,
        branchId,
        cashDrawerSessionId: result.sessionId,
        sourceChannel: 'new_order_session_hub',
      });
      cmxMessage.success(t('messages.drawerOpenedAndLinked'));
      await onLinked();
    } catch (error) {
      cmxMessage.error(linkErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  if (drawersQuery.isLoading) {
    return <DrawerLinkNotice>{t('hub.drawerListLoading')}</DrawerLinkNotice>;
  }

  if (drawersQuery.isError) {
    return (
      <DrawerLinkNotice>
        {t('hub.drawerListError')}
        <CmxButton className="mt-3" size="sm" variant="outline" onClick={() => void drawersQuery.refetch()}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden />
          {t('refresh')}
        </CmxButton>
      </DrawerLinkNotice>
    );
  }

  if (drawers.length === 0) {
    return <DrawerLinkNotice>{t('hub.noDrawersForBranch')}</DrawerLinkNotice>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white p-2 text-[rgb(var(--cmx-primary-rgb,14_165_233))] shadow-sm">
          <WalletCards className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <div className="font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('hub.linkDrawerTitle')}</div>
          <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('hub.linkDrawerDescription')}
          </p>
        </div>
      </div>

      <CmxSelect
        label={t('cashDrawer')}
        value={effectiveDrawerId}
        options={drawers.map((drawer) => ({
          value: drawer.id,
          label: drawerLabel(drawer),
        }))}
        onChange={(event) => setSelectedDrawerId(event.target.value)}
      />

      {selectedDrawer ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={selectedDrawer.currentSession ? 'success' : 'secondary'}>
            {selectedDrawer.currentSession ? t('hub.drawerHasOpenSession') : t('hub.drawerNoOpenSession')}
          </Badge>
          <Badge variant="outline">{selectedDrawer.currency_code}</Badge>
          {selectedDrawer.currentSession ? <Badge variant="outline">{selectedDrawer.currentSession.session_no}</Badge> : null}
        </div>
      ) : null}

      {canUseSelectedOpenSession ? (
        <CmxButton
          type="button"
          size="sm"
          loading={busy === 'link'}
          onClick={() => selectedDrawer.currentSession && linkDrawerSession(selectedDrawer.currentSession.id)}
        >
          <Link2 className="me-2 h-4 w-4" aria-hidden />
          {t('hub.useOpenDrawer')}
        </CmxButton>
      ) : (
        <div className="space-y-3">
          <CmxButton
            type="button"
            size="sm"
            disabled={!canOpenCashDrawer}
            loading={busy === 'open-link'}
            onClick={() => setOpenDialogOpen(true)}
          >
            <Link2 className="me-2 h-4 w-4" aria-hidden />
            {canOpenCashDrawer ? t('hub.openAndLinkDrawer') : t('hub.drawerOpenPermissionRequired')}
          </CmxButton>
          {selectedDrawer ? (
            <CashDrawerOpenSessionDialog
              drawerId={selectedDrawer.id}
              currencyCode={selectedDrawer.currency_code}
              open={openDialogOpen}
              onOpenChange={setOpenDialogOpen}
              onOpened={handleDrawerOpened}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function DrawerLinkNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-4 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
      {children}
    </div>
  );
}

function drawerLabel(drawer: CashDrawerWithCurrentSession): string {
  const sessionSuffix = drawer.currentSession ? ` - ${drawer.currentSession.session_no}` : '';
  return `${drawer.drawer_name} (${drawer.drawer_code})${sessionSuffix}`;
}

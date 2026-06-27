'use client';

/**
 * Cash-drawer session state, query, and open-session flow for Payment Modal V4.
 *
 * Verbatim extraction of the modal's cash-drawer concern (previously inline in
 * `payment-modal-v4.tsx`): the active cash-drawers query, the selected-session +
 * open-session-dialog state, the preferred-drawer localStorage helpers, the
 * session-choice derivations, the `cashDrawerBlockingMessage` (the submit-gate
 * reason), the auto-select effect, and the open-dialog / create-session handlers.
 *
 * Scope (Phase 2E, program plan `:764-2043`): this hook owns the cash-drawer
 * **query + state + helpers + blocking message + selection effect + handlers**. Two
 * things stay in the view: (1) the DOM refs (`cashDrawerCardRef` /
 * `cashDrawerSelectorCardRef`) used for scroll/focus on a blocked submit (per the 2G
 * "refs/scroll/focus stay in the view" rule); (2) `cashDrawerRequired`, which is
 * derived from legs/derivations (`settlementLegEntries`, `paymentLegs`,
 * `getMethodOption`, the primary method) and is **threaded in** as a param — the
 * engine computes it at composition time (Phase 2G).
 *
 * Behavior freeze: the query (key/`enabled`/`staleTime`), the localStorage helpers,
 * the blocking-message precedence, the auto-select branches, and the open-session
 * POST stay byte-equivalent to the original inline code. The one deliberate
 * (behavior-equivalent) change vs the inline original: this slice's `open`-reset runs
 * at render-time (Pattern A) instead of in the component's big reset effect — the
 * clean fix the repo prescribes for `react-hooks/set-state-in-effect`. The auto-select
 * effect reacts to async React Query data + reads `localStorage` (external systems,
 * react-effects-patterns §5), so it stays an effect; its `setSelectedCashDrawerSessionId`
 * writes keep a scoped disable where the rule fires.
 *
 * See `docs/features/Order_Fin/Payment_Modal_Review/`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { cmxMessage } from '@ui/feedback';
import {
  getPreferredCashDrawerStorageKey,
  resolvePreferredCashDrawerSessionId,
} from '@features/orders/ui/payment-modal-v4.utils';

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type CashDrawerTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * An open cash-drawer session (the bound settlement context for cash legs).
 */
export type CashDrawerSessionOption = {
  id: string;
  session_no: string;
  opened_at: string | null;
  opening_float_amount: number;
};

/**
 * A cash drawer configured for the branch, with its current open session (if any).
 */
export type CashDrawerOption = {
  id: string;
  branch_id: string | null;
  drawer_name: string;
  drawer_name2: string | null;
  drawer_type: string;
  currency_code: string;
  requires_session: boolean;
  opening_float_required: boolean;
  currentSession: CashDrawerSessionOption | null;
};

/**
 * Inputs threaded from the modal. `cashDrawerRequired` is derived from
 * legs/derivations in the component (engine at 2G); the rest is order/locale context.
 */
export interface UseCashDrawerParams {
  /** Gates the query + slice `open`-reset; matches the modal `open` flag. */
  open: boolean;
  tenantOrgId: string;
  branchId?: string;
  userId?: string;
  /** Right-to-left locale flag — selects `drawer_name2` + Arabic date formatting. */
  isRTL: boolean;
  /** CSRF token for the open-session POST. */
  csrfToken: string | null;
  /** `newOrder.payment` translate function. */
  t: CashDrawerTranslate;
  /** Whether the current settlement requires a bound cash-drawer session (from legs/derivations). */
  cashDrawerRequired: boolean;
}

/**
 * Cash-drawer session state, query, blocking message, and open-session flow for
 * Payment Modal V4.
 *
 * @param params - {@link UseCashDrawerParams}.
 * @param params.open - Gates the query + slice `open`-reset.
 * @param params.tenantOrgId - Active tenant org id.
 * @param params.branchId - Active branch id (filters drawers + preferred-drawer key).
 * @param params.userId - Active user id (scopes the preferred-drawer key).
 * @param params.isRTL - Selects RTL drawer name + date formatting.
 * @param params.csrfToken - CSRF token for the open-session POST.
 * @param params.t - `newOrder.payment` translate function.
 * @param params.cashDrawerRequired - Whether settlement requires a bound session.
 * @returns Cash-drawer query data, session state + setters, helpers, the blocking
 *   message, and the open-dialog / create-session handlers.
 */
export function useCashDrawer({
  open,
  tenantOrgId,
  branchId,
  userId,
  isRTL,
  csrfToken,
  t,
  cashDrawerRequired,
}: UseCashDrawerParams) {
  const [selectedCashDrawerSessionId, setSelectedCashDrawerSessionId] = useState('');
  const [cashDrawerDialogOpen, setCashDrawerDialogOpen] = useState(false);
  const [cashDrawerToOpenId, setCashDrawerToOpenId] = useState('');
  const [openingBalanceValue, setOpeningBalanceValue] = useState(0);
  const [openingDrawerSession, setOpeningDrawerSession] = useState(false);
  const [cashDrawerRequestError, setCashDrawerRequestError] = useState<string | null>(null);

  // This slice's open-reset (render-time Pattern A — react-effects-patterns §2). Each
  // atom's initial value already equals its reset value, so the only observable reset
  // is when `open` flips true on a re-open.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedCashDrawerSessionId('');
      setCashDrawerDialogOpen(false);
      setCashDrawerToOpenId('');
      setOpeningBalanceValue(0);
      setOpeningDrawerSession(false);
      setCashDrawerRequestError(null);
    }
  }

  const {
    data: cashDrawers = [],
    isLoading: cashDrawersLoading,
    isFetching: cashDrawersFetching,
    error: cashDrawersError,
    refetch: refetchCashDrawers,
  } = useQuery<CashDrawerOption[]>({
    queryKey: ['cash-drawers-checkout', tenantOrgId, branchId ?? ''],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);

      const res = await fetch(`/api/v1/cash-drawers?${params.toString()}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(
          typeof json.error === 'string' && json.error.trim().length > 0
            ? json.error
            : 'FAILED_TO_LOAD_CASH_DRAWERS'
        );
      }

      return (json.data ?? []) as CashDrawerOption[];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const getDrawerDisplayName = useCallback(
    (drawer: CashDrawerOption) => isRTL ? (drawer.drawer_name2 || drawer.drawer_name) : drawer.drawer_name,
    [isRTL]
  );

  const formatCashDrawerOpenedAt = useCallback(
    (openedAt: string | null) => {
      if (!openedAt) {
        return '—';
      }
      return new Intl.DateTimeFormat(isRTL ? 'ar' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(openedAt));
    },
    [isRTL]
  );

  const cashDrawerSessionChoices = useMemo(
    () =>
      cashDrawers.flatMap((drawer) =>
        drawer.currentSession
          ? [{ drawer, session: drawer.currentSession }]
          : []
      ),
    [cashDrawers]
  );
  const preferredCashDrawerStorageKey = useMemo(
    () => getPreferredCashDrawerStorageKey({ tenantOrgId, branchId, userId }),
    [branchId, tenantOrgId, userId]
  );

  const readPreferredCashDrawerId = useCallback(() => {
    if (!preferredCashDrawerStorageKey || typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage.getItem(preferredCashDrawerStorageKey);
    } catch {
      return null;
    }
  }, [preferredCashDrawerStorageKey]);

  const persistPreferredCashDrawerId = useCallback(
    (cashDrawerId: string | null | undefined) => {
      if (!preferredCashDrawerStorageKey || typeof window === 'undefined') {
        return;
      }

      try {
        const normalizedCashDrawerId = cashDrawerId?.trim();
        if (normalizedCashDrawerId) {
          window.localStorage.setItem(preferredCashDrawerStorageKey, normalizedCashDrawerId);
          return;
        }
        window.localStorage.removeItem(preferredCashDrawerStorageKey);
      } catch {
        // Browser storage can be disabled; drawer validation still protects submission.
      }
    },
    [preferredCashDrawerStorageKey]
  );

  const canOpenNewCashDrawerSession = useMemo(
    () => cashDrawers.some((drawer) => !drawer.currentSession),
    [cashDrawers]
  );

  const selectedCashDrawerChoice = useMemo(
    () =>
      cashDrawerSessionChoices.find(
        ({ session }) => session.id === selectedCashDrawerSessionId
      ) ?? null,
    [cashDrawerSessionChoices, selectedCashDrawerSessionId]
  );

  const cashDrawerBlockingMessage = useMemo(() => {
    if (!cashDrawerRequired) {
      return null;
    }

    if (cashDrawersLoading || cashDrawersFetching) {
      return t('cashDrawer.messages.loading');
    }

    if (cashDrawerRequestError) {
      return cashDrawerRequestError;
    }

    if (cashDrawersError instanceof Error) {
      return cashDrawersError.message || t('cashDrawer.messages.loadFailed');
    }

    if (cashDrawers.length === 0) {
      return t('cashDrawer.messages.noDrawersConfigured');
    }

    if (cashDrawerSessionChoices.length === 0) {
      return t('cashDrawer.messages.noOpenSession');
    }

    if (!selectedCashDrawerSessionId) {
      return t('cashDrawer.messages.sessionRequired');
    }

    return null;
  }, [
    cashDrawerRequired,
    cashDrawersLoading,
    cashDrawersFetching,
    cashDrawerRequestError,
    cashDrawersError,
    cashDrawers.length,
    cashDrawerSessionChoices.length,
    selectedCashDrawerSessionId,
    t,
  ]);

  // Auto-select the bound session: clear when not required / no longer valid, else
  // prefer the cashier's saved drawer or the only open session. Reacts to async React
  // Query data + reads localStorage (external systems) → stays an effect.
  useEffect(() => {
    if (!cashDrawerRequired) {
      if (selectedCashDrawerSessionId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to async cash-drawer query data; clears a stale selection
        setSelectedCashDrawerSessionId('');
      }
      return;
    }

    if (selectedCashDrawerSessionId) {
      const selectedStillExists = cashDrawerSessionChoices.some(
        ({ session }) => session.id === selectedCashDrawerSessionId
      );
      if (!selectedStillExists) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to async cash-drawer query data; clears a vanished session
        setSelectedCashDrawerSessionId('');
      }
      return;
    }

    const preferredSessionId = resolvePreferredCashDrawerSessionId(
      cashDrawerSessionChoices,
      readPreferredCashDrawerId()
    );

    if (preferredSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-select from async query data + localStorage preference
      setSelectedCashDrawerSessionId(preferredSessionId);
      return;
    }

    if (cashDrawerSessionChoices.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-select the only open session once the async query resolves
      setSelectedCashDrawerSessionId(cashDrawerSessionChoices[0].session.id);
    }
  }, [cashDrawerRequired, cashDrawerSessionChoices, readPreferredCashDrawerId, selectedCashDrawerSessionId]);

  const handleOpenCashDrawerDialog = useCallback(() => {
    const savedPreferredDrawerId = readPreferredCashDrawerId();
    const savedPreferredDrawer = cashDrawers.find(
      (drawer) => drawer.id === savedPreferredDrawerId
    );
    const preferredDrawerId =
      selectedCashDrawerChoice?.drawer.id ??
      savedPreferredDrawer?.id ??
      cashDrawers.find((drawer) => !drawer.currentSession)?.id ??
      cashDrawers[0]?.id ??
      '';

    setCashDrawerToOpenId(preferredDrawerId);
    setOpeningBalanceValue(0);
    setCashDrawerRequestError(null);
    setCashDrawerDialogOpen(true);
  }, [cashDrawers, readPreferredCashDrawerId, selectedCashDrawerChoice]);

  const handleCreateCashDrawerSession = useCallback(async () => {
    if (!cashDrawerToOpenId) {
      const message = t('cashDrawer.messages.selectDrawer');
      setCashDrawerRequestError(message);
      cmxMessage.error(message);
      return;
    }

    setOpeningDrawerSession(true);
    setCashDrawerRequestError(null);

    try {
      const res = await fetch(`/api/v1/cash-drawers/${cashDrawerToOpenId}/open-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        credentials: 'include',
        body: JSON.stringify({
          openingBalance: openingBalanceValue,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const message =
        typeof json.error === 'string' && json.error.trim().length > 0
          ? json.error
          : t('cashDrawer.messages.openFailed');

      if (!res.ok || !json.success) {
        setCashDrawerRequestError(message);
        cmxMessage.error(message);
        return;
      }

      const createdSession = json.data as CashDrawerSessionOption;
      setSelectedCashDrawerSessionId(createdSession.id);
      persistPreferredCashDrawerId(cashDrawerToOpenId);
      setCashDrawerDialogOpen(false);
      setCashDrawerToOpenId('');
      setOpeningBalanceValue(0);
      await refetchCashDrawers();
      cmxMessage.success(t('cashDrawer.messages.sessionOpened'));
    } catch {
      const message = t('cashDrawer.messages.openFailed');
      setCashDrawerRequestError(message);
      cmxMessage.error(message);
    } finally {
      setOpeningDrawerSession(false);
    }
  }, [cashDrawerToOpenId, csrfToken, openingBalanceValue, persistPreferredCashDrawerId, refetchCashDrawers, t]);

  return {
    // query
    cashDrawers,
    cashDrawersLoading,
    cashDrawersFetching,
    refetchCashDrawers,
    // session state
    selectedCashDrawerSessionId,
    setSelectedCashDrawerSessionId,
    cashDrawerDialogOpen,
    setCashDrawerDialogOpen,
    cashDrawerToOpenId,
    setCashDrawerToOpenId,
    openingBalanceValue,
    setOpeningBalanceValue,
    openingDrawerSession,
    cashDrawerRequestError,
    setCashDrawerRequestError,
    // derivations
    cashDrawerSessionChoices,
    selectedCashDrawerChoice,
    canOpenNewCashDrawerSession,
    cashDrawerBlockingMessage,
    // helpers
    getDrawerDisplayName,
    formatCashDrawerOpenedAt,
    persistPreferredCashDrawerId,
    // handlers
    handleOpenCashDrawerDialog,
    handleCreateCashDrawerSession,
  };
}

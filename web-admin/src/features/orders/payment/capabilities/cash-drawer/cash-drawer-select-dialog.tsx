'use client';

/**
 * Cash-drawer session selector dialog (ADR condition #7 — an ambiguous drawer
 * is a pick-one prompt, never a mode change).
 *
 * Renders the open drawer sessions as a radio list; choosing one binds the
 * cash leg's settlement context through typed engine actions
 * (`selectCashDrawerSession` + `persistPreferredCashDrawerId`). No finance
 * logic here — the engine owns binding validity, and the server re-validates
 * on submit (`CASH_DRAWER_SESSION_*`).
 */

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import type {
  CashDrawerOption,
  CashDrawerSessionOption,
} from '@features/orders/hooks/use-cash-drawer';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';

/**
 * One selectable open session (drawer + its current session).
 */
export interface CashDrawerSessionChoice {
  drawer: CashDrawerOption;
  session: CashDrawerSessionOption;
}

/**
 * Typed engine actions the drawer selector may call — nothing more.
 */
export type CashDrawerSelectDialogActions = Pick<
  PaymentEngineActions,
  'selectCashDrawerSession' | 'persistPreferredCashDrawerId'
>;

/**
 * Props for {@link CashDrawerSelectDialog}.
 */
export interface CashDrawerSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CashDrawerSelectDialogActions;
  /** Open sessions the cashier may choose from (engine-derived). */
  choices: CashDrawerSessionChoice[];
  /** Currently bound session id ('' when unbound). */
  selectedSessionId: string;
  /** Bilingual drawer name resolver (from the engine's drawer slice). */
  getDrawerDisplayName: (drawer: CashDrawerOption) => string;
  /** Locale-aware opened-at formatter (from the engine's drawer slice). */
  formatOpenedAt: (openedAt: string | null) => string;
}

/**
 * Renders the drawer-session picker. Selection commits to engine state
 * immediately (engine owns state); Done closes.
 *
 * @param props - {@link CashDrawerSelectDialogProps}.
 * @returns The dialog element.
 */
export function CashDrawerSelectDialog({
  open,
  onOpenChange,
  actions,
  choices,
  selectedSessionId,
  getDrawerDisplayName,
  formatOpenedAt,
}: CashDrawerSelectDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  return (
    <PaymentCapabilityDialog
      capabilityKey={PAYMENT_CAPABILITY.CASH_DRAWER}
      open={open}
      onOpenChange={onOpenChange}
      title={t('cashDrawer.title')}
      description={t('cashDrawer.messages.selectionRequired')}
      cancelLabel={tCommon('cancel')}
      onCancel={() => onOpenChange(false)}
      confirmLabel={tCommon('done')}
      onConfirm={() => onOpenChange(false)}
      confirmDisabled={!selectedSessionId}
      errorFallbackMessage={t('capabilities.dialog.errorFallback')}
      errorCloseLabel={tCommon('close')}
      isRTL={isRTL}
    >
      <div
        role="radiogroup"
        aria-label={t('cashDrawer.selectLabel')}
        className="flex flex-col gap-2"
        data-testid="cash-drawer-choice-list"
      >
        {choices.map(({ drawer, session }) => {
          const selected = session.id === selectedSessionId;
          return (
            <button
              key={session.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`cash-drawer-choice-${session.id}`}
              onClick={() => {
                actions.selectCashDrawerSession(session.id);
                actions.persistPreferredCashDrawerId(drawer.id);
              }}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-start transition-colors ${
                isRTL ? 'flex-row-reverse text-right' : ''
              } ${
                selected
                  ? 'border-teal-600 bg-teal-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                  selected ? 'border-teal-600 bg-teal-600' : 'border-slate-300'
                }`}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-slate-800">
                  {getDrawerDisplayName(drawer)} · {session.session_no}
                </span>
                <span className="text-xs text-slate-500">
                  {t('cashDrawer.openedAt')}: {formatOpenedAt(session.opened_at)}
                </span>
              </span>
              {selected ? (
                <span className="shrink-0 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                  {t('cashDrawer.selectedBadge')}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </PaymentCapabilityDialog>
  );
}

'use client';

/**
 * Cash Drawer Detail — Client Component
 *
 * Handles all interactive UI for a single cash drawer:
 * - Open Session dialog
 * - Add Movement dialog
 * - Close Session dialog
 * - Movements table / Session history table
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  openDrawerSession,
  closeDrawerSession,
  addDrawerMovement,
} from '@/app/actions/billing/cash-drawer-actions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpenSession {
  id: string;
  session_no: string;
  opened_at: string | null;
  opened_by: string | null;
  opening_float_amount: number;
}

interface Movement {
  id: string;
  movement_type: string;
  direction: string;
  amount: number;
  reason: string | null;
  performed_by: string | null;
  performed_at: string | null;
}

interface ClosedSession {
  id: string;
  session_no: string;
  opened_at: string | null;
  closed_at: string | null;
  opening_float_amount: number;
  expected_cash_amount: number | null;
  counted_cash_amount: number | null;
  difference_amount: number | null;
}

interface CashDrawerDetailClientProps {
  drawerId: string;
  drawerName: string;
  drawerType: string;
  currencyCode: string;
  openSession: OpenSession | null;
  movements: Movement[];
  closedSessions: ClosedSession[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function fmtMoney(n: number | null | undefined, currency: string): string {
  if (n == null) return '—';
  return `${currency} ${n.toFixed(3)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 *
 * @param root0
 * @param root0.drawerId
 * @param root0.drawerName
 * @param root0.drawerType
 * @param root0.currencyCode
 * @param root0.openSession
 * @param root0.movements
 * @param root0.closedSessions
 */
export default function CashDrawerDetailClient({
  drawerId,
  drawerName,
  drawerType,
  currencyCode,
  openSession,
  movements,
  closedSessions,
}: CashDrawerDetailClientProps) {
  const t = useTranslations('billing.cashDrawers');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state — open session
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openNotes, setOpenNotes] = useState('');

  // Form state — movement
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT' | 'PETTY_CASH'>('CASH_IN');
  const [moveAmount, setMoveAmount] = useState('0');
  const [moveReason, setMoveReason] = useState('');

  // Form state — close session
  const [physicalCount, setPhysicalCount] = useState('0');
  const [closeNotes, setCloseNotes] = useState('');

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleOpenSession() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await openDrawerSession(drawerId, {
        openingBalance: parseFloat(openingBalance) || 0,
        notes: openNotes || undefined,
      });
      if (result.success) {
        setShowOpenDialog(false);
        setOpeningBalance('0');
        setOpenNotes('');
        router.refresh();
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  function handleAddMovement() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await addDrawerMovement(drawerId, {
        movementType,
        amount: parseFloat(moveAmount) || 0,
        reason: moveReason,
      });
      if (result.success) {
        setShowMoveDialog(false);
        setMoveAmount('0');
        setMoveReason('');
        router.refresh();
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  function handleCloseSession() {
    if (!openSession) return;
    setErrorMsg(null);
    startTransition(async () => {
      const result = await closeDrawerSession(openSession.id, {
        physicalCount: parseFloat(physicalCount) || 0,
        notes: closeNotes || undefined,
      });
      if (result.success) {
        setShowCloseDialog(false);
        setPhysicalCount('0');
        setCloseNotes('');
        router.refresh();
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{drawerName}</h1>
          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {drawerType}
          </span>
          {openSession ? (
            <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Open — {openSession.session_no}
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Closed
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!openSession && (
            <button
              onClick={() => setShowOpenDialog(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={isPending}
            >
              {t('openSession')}
            </button>
          )}
          {openSession && (
            <>
              <button
                onClick={() => setShowMoveDialog(true)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={isPending}
              >
                {t('addMovement')}
              </button>
              <button
                onClick={() => setShowCloseDialog(true)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={isPending}
              >
                {t('closeSession')}
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Open session info card */}
      {openSession && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Session Info</h2>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-gray-500">{t('sessionNo')}</p>
              <p className="font-medium">{openSession.session_no}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('openedAt')}</p>
              <p className="font-medium">{fmtDate(openSession.opened_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('openedBy')}</p>
              <p className="font-medium">{openSession.opened_by ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('openingBalance')}</p>
              <p className="font-medium">{fmtMoney(openSession.opening_float_amount, currencyCode)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Movements table (only when session is open) */}
      {openSession && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('movements')}</h2>
          </div>
          {movements.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">No movements yet.</p>
          ) : (
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('performedAt')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('movementType')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('amount')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('reason')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('performedBy')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(m.performed_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.direction === 'IN'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {fmtMoney(m.amount, currencyCode)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.reason ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{m.performed_by ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Session history table (always visible) */}
      {!openSession && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('sessionHistory')}</h2>
          </div>
          {closedSessions.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">No past sessions.</p>
          ) : (
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('sessionNo')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('openedAt')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('closedAt')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('openingBalance')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Expected</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('physicalCount')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('variance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {closedSessions.map((s) => {
                  const diff = s.difference_amount ?? 0;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{s.session_no}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(s.opened_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(s.closed_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{fmtMoney(s.opening_float_amount, currencyCode)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{fmtMoney(s.expected_cash_amount, currencyCode)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{fmtMoney(s.counted_cash_amount, currencyCode)}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                        Math.abs(diff) < 0.01
                          ? 'text-green-700'
                          : diff < 0
                          ? 'text-red-700'
                          : 'text-orange-700'
                      }`}>
                        {fmtMoney(diff, currencyCode)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Open Session Dialog ───────────────────────────────────────────────── */}
      {showOpenDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t('openSessionConfirm')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('openingBalance')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('notesOptional')}</label>
                <textarea
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowOpenDialog(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleOpenSession}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={isPending}
              >
                {isPending ? 'Opening...' : t('openSession')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Movement Dialog ───────────────────────────────────────────────── */}
      {showMoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t('addMovement')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('movementType')}</label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as typeof movementType)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="CASH_IN">{t('cashIn')}</option>
                  <option value="CASH_OUT">{t('cashOut')}</option>
                  <option value="PETTY_CASH">{t('pettyCash')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('amount')}</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={moveAmount}
                  onChange={(e) => setMoveAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('reason')}</label>
                <input
                  type="text"
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowMoveDialog(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMovement}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={isPending}
              >
                {isPending ? 'Saving...' : t('addMovement')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close Session Dialog ──────────────────────────────────────────────── */}
      {showCloseDialog && openSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold">{t('closeSessionConfirm')}</h3>
            <p className="mb-4 text-sm text-gray-600">{t('closeSessionDesc')}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('physicalCount')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('notesOptional')}</label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCloseDialog(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleCloseSession}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={isPending}
              >
                {isPending ? 'Closing...' : t('confirmClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

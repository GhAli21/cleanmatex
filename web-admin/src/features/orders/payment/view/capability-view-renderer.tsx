'use client';

/**
 * CapabilityViewRenderer — the L5 view renderer of the composable payment system.
 *
 * It turns a {@link CapabilityViewPlan} (produced by the pure planner) into three
 * ordered regions, and nothing more — it holds no finance logic, no validation,
 * no payload, and does not know how to build any capability's props:
 *
 *   1. **Inline** — the container renders each inline slot's surface (method
 *      chips, FX/rounding line, drawer line) via {@link renderInline}; those
 *      components have heterogeneous, engine-derived props, so they stay
 *      container-owned. Slots whose `renderInline` returns null are skipped.
 *   2. **Actions** — each dialog slot becomes a generic opener button (label +
 *      optional required badge + reason `data-reason` for explainability). The
 *      button calls {@link onOpenCapability}; the container owns the dialog mount
 *      and its open state (dialogs are overlays, not children of the view).
 *   3. **Guards** — the deduped blocked reasons (see `selectGuardSlots`) each
 *      render a {@link PaymentSubmitGuard} banner in place. A blocked condition is
 *      an error guard, never a mode switch (ADR).
 *
 * i18n stays in the caller: every label arrives resolved through the callbacks
 * (same convention as the L4 primitives). Introduced behind the kill-switch and
 * wired into the Full view section by section (Phase 4d+).
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import type { ReactNode } from 'react';
import { CmxButton } from '@ui/primitives';
import { PaymentSubmitGuard } from '../primitives/payment-submit-guard';
import {
  selectInlineSlots,
  selectDialogSlots,
  selectGuardSlots,
  type CapabilityViewPlan,
  type CapabilityViewSlot,
} from './capability-view-plan';

/**
 * Resolved guard content for one blocked slot (i18n stays in the caller).
 */
export interface CapabilityGuardDescriptor {
  /** Resolved guard message. */
  message: string;
  /** Optional resolved corrective-action label. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Props for {@link CapabilityViewRenderer}.
 */
export interface CapabilityViewRendererProps {
  /** The active view plan (already preset-resolved). */
  plan: CapabilityViewPlan;
  isRTL?: boolean;
  /**
   * Renders the inline surface for an inline slot. Container-owned because each
   * capability's inline props are heterogeneous and engine-derived. Return null
   * to render nothing for that slot (e.g. the SUBMIT_GUARDS meta-capability,
   * whose surface is the guard region).
   */
  renderInline: (slot: CapabilityViewSlot) => ReactNode;
  /** Resolved opener-button label for a dialog slot. */
  dialogButtonLabel: (slot: CapabilityViewSlot) => string;
  /** Resolved required-badge label, shown on a required dialog slot's button. */
  requiredBadgeLabel?: string;
  /** Opens the capability's dialog; container owns the dialog mount + open state. */
  onOpenCapability: (slot: CapabilityViewSlot) => void;
  /**
   * Resolves the guard descriptor for a blocked slot, or null to omit it. Only
   * called for the deduped guard slots.
   */
  resolveGuard: (slot: CapabilityViewSlot) => CapabilityGuardDescriptor | null;
  /** Optional class for the outer container. */
  className?: string;
}

/**
 * Generic dialog-opener button for a dialog slot. Internal to the renderer — not
 * a shared primitive until a second consumer exists.
 */
function CapabilityActionButton({
  slot,
  label,
  requiredBadgeLabel,
  isRTL,
  onOpen,
}: {
  slot: CapabilityViewSlot;
  label: string;
  requiredBadgeLabel?: string;
  isRTL: boolean;
  onOpen: () => void;
}) {
  const { evaluated } = slot;
  // First active reason drives explainability; required gates are emphasized.
  const reason = evaluated.reasons[0];
  return (
    <CmxButton
      type="button"
      variant={evaluated.required ? 'primary' : 'outline'}
      size="sm"
      onClick={onOpen}
      aria-haspopup="dialog"
      data-testid={`capability-action-${slot.key}`}
      data-capability={slot.key}
      data-required={evaluated.required ? 'true' : undefined}
      data-reason={reason}
      className={isRTL ? 'flex-row-reverse' : ''}
    >
      <span className="min-w-0">{label}</span>
      {evaluated.required && requiredBadgeLabel ? (
        <span
          data-testid={`capability-action-required-${slot.key}`}
          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
        >
          {requiredBadgeLabel}
        </span>
      ) : null}
    </CmxButton>
  );
}

/**
 * Renders a capability view plan into its inline / actions / guard regions.
 *
 * @param props - {@link CapabilityViewRendererProps}.
 * @returns The composed view regions.
 */
export function CapabilityViewRenderer({
  plan,
  isRTL = false,
  renderInline,
  dialogButtonLabel,
  requiredBadgeLabel,
  onOpenCapability,
  resolveGuard,
  className,
}: CapabilityViewRendererProps) {
  const inlineSlots = selectInlineSlots(plan);
  const dialogSlots = selectDialogSlots(plan);
  const guardSlots = selectGuardSlots(plan);

  const inlineNodes = inlineSlots
    .map((slot) => ({ slot, node: renderInline(slot) }))
    .filter((entry) => entry.node != null);

  const guardBanners = guardSlots
    .map((slot) => ({ slot, guard: resolveGuard(slot) }))
    .filter(
      (entry): entry is { slot: CapabilityViewSlot; guard: CapabilityGuardDescriptor } =>
        entry.guard != null && entry.slot.evaluated.blockReason != null,
    );

  return (
    <div className={className} data-testid="capability-view">
      {inlineNodes.length > 0 ? (
        <div data-testid="capability-view-inline" className="flex flex-col gap-3">
          {inlineNodes.map(({ slot, node }) => (
            <div key={slot.key} data-capability={slot.key} className="min-w-0">
              {node}
            </div>
          ))}
        </div>
      ) : null}

      {dialogSlots.length > 0 ? (
        <div
          data-testid="capability-view-actions"
          className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          {dialogSlots.map((slot) => (
            <CapabilityActionButton
              key={slot.key}
              slot={slot}
              label={dialogButtonLabel(slot)}
              requiredBadgeLabel={requiredBadgeLabel}
              isRTL={isRTL}
              onOpen={() => onOpenCapability(slot)}
            />
          ))}
        </div>
      ) : null}

      {guardBanners.length > 0 ? (
        <div data-testid="capability-view-guards" className="flex flex-col gap-2">
          {guardBanners.map(({ slot, guard }) => (
            <PaymentSubmitGuard
              key={slot.key}
              reason={slot.evaluated.blockReason!}
              message={guard.message}
              actionLabel={guard.actionLabel}
              onAction={guard.onAction}
              isRTL={isRTL}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

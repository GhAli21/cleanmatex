import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';

/** Assigns stable legRef UUIDs required by ADR-047 RETURN_CASH_CHANGE lines. */
export function ensurePaymentLegRefs(legs: PaymentLeg[]): PaymentLeg[] {
  return legs.map((leg) =>
    leg.legRef ? leg : { ...leg, legRef: crypto.randomUUID() }
  );
}

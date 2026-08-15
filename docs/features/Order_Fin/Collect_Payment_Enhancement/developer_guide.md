# Collect Payment — Developer Guide

## Component

`web-admin/src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx`

A **shared** dialog, not a Ready-page component. Three mounts, **two lifecycles** — this is the single most important thing to know before changing it.

| Route | Mount | Lifecycle | `onCollected` |
|---|---|---|---|
| `/dashboard/ready/[id]` | `app/dashboard/ready/[id]/page.tsx` | persistent; `open` toggles | `loadOrder()` |
| `/dashboard/delivery` | `app/dashboard/delivery/page.tsx` | **conditional remount** per row; `open` hardcoded `true` | `refetchOrders()` |
| `/dashboard/orders/[id]` → Financial tab | `order-receivable-collection-panel.tsx` | persistent; `open` toggles | `router.refresh()` |

### The lifecycle trap

The per-open reset — including the B5 idempotency key and `cashLegRef` — runs as a **render-time Pattern A** block (`react-effects-patterns.md` §2):

```ts
const [prevOpen, setPrevOpen] = useState(open);
if (open !== prevOpen) { setPrevOpen(open); if (open) { /* reset */ } }
```

On Ready and the Financial tab that block *is* the reset. On Delivery the component **remounts per order**, so it never fires on "reopen" — the `useState` initialisers do the job instead. **Any state you add must reset correctly under both shapes**, or a cashier working the Delivery list carries one order's entry into the next order. That is the likeliest regression in this file.

## Props

```ts
interface OrderCollectPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerId?: string | null;
  branchId?: string | null;
  outstandingAmount: number;   // parent's figure — may be stale, see below
  currencyCode: string;
  onCollected?: () => void;
  onPrintReceipt?: () => void; // Ready only — surface capability, not inferred
  handoverIntent?: boolean;    // Ready only
}
```

`onPrintReceipt` and `handoverIntent` are optional **by design**. Only Ready has print infrastructure and a handover step; the modal never sniffs which surface it is on.

## Money inputs

`outstandingAmount` is whatever the *parent* last read — the Delivery list passes a row value that can be minutes old. The modal re-reads the authoritative figure on open:

```
GET /api/v1/orders/{id}/state  →  paymentSummary.remaining  →  effectiveOutstanding
```

`effectiveOutstanding` (not the prop) feeds **every** derived money input: overpayment metrics, `capCollectPaymentAmount`, pay-extra `saleTotal`/allocation, the catalog `amount` query, the Outstanding display, and "Full outstanding".

`/state` is used rather than `/financial-summary` on purpose: `/state` is tenant-scoped with no extra permission, while `financial-summary` requires `orders:view_financial_breakdown` that a till user may legitimately lack.

### CRITICAL RULE #15 boundary

A late authoritative value re-prefills the amount **only while `amountDirty` is false**. Once the cashier types, their figure stands and a warning states the balance moved. Quick-tender chips set **tendered only**, never the amount. Never add a code path that rewrites entered money as a side effect of a toggle, method switch, or dialog close.

## API contract

`POST /api/v1/orders/[id]/payments` (canonical) and `POST /api/v1/orders/[id]/collect-payment` (legacy twin). Both import **one** shared leg schema:

```ts
// lib/validations/new-order-payment-schemas.ts
collectionPaymentLegSchema  // paymentMethodId, amount, reference, cashTendered,
                            // checkNumber, checkBank, checkDate (+ check due-date rule)
collectionNotesSchema       // notes, max 500 → org_order_payments_dtl.rec_notes
```

They previously declared this inline and independently, which is how their contracts drifted. Keep it shared.

`paymentLegs` is `z.array(...).min(1)` with **no max** — the API has always accepted N legs. The UI still sends exactly one (split tender is an open follow-up).

## Persistence path

```
route → collectPaymentTx → createBizVoucher (RECEIPT)
                         → addVoucherLine (one per leg, LINE_ROLE.ORDER_PAYMENT)
                         → postAndWireBizVoucher
                              → orderPaymentWiringHandler   → org_order_payments_dtl
                              → cashDrawerWiringHandler     → org_cash_drawer_movements_dtl
```

Notes ride on the voucher line (`line.notes`) because the handler creates one payment row per leg — that is the only place it can live to reach `rec_notes`.

`VoucherLineForWiring.notes` is declared **optional** while every sibling is required. That is deliberate: it keeps the addition strictly additive so no other handler or test fixture needed touching.

## Permissions

- `orders:collect_payment` — gates the trigger (`CollectPaymentButton`), the modal (`if (!canCollect) return null`), and the API (`requirePermission`). Frontend gates are UX only; the API re-checks.
- Overpayment sub-permissions via `OVERPAYMENT_RESOLUTION_PERMISSIONS`.

Permission codes are written as **string literals** in components and route guards — the platform inventory extractor resolves literals only.

## Reusable components introduced

| Component | Location | Why |
|---|---|---|
| `CollectPaymentButton` | `features/orders/ui/collect-payment/` | Permission-aware trigger for all 3 call sites. Feature UI (reads orders RBAC/i18n), so **not** `Cmx`-prefixed and not in `src/ui` |
| `CmxChangeDueRow` | `src/ui/data-display/` | Genuine design-system primitive; has `.stories.tsx` |

`CollectPaymentButton` uses the codebase's soft-lock: `aria-disabled` + muted styling, click still fires so the denial explains itself.

## Extension points / open work

- **Split tender** — adopt `usePaymentLegs` (standalone: `saleTotal`, `decimalPlaces`, `getMethodOption`, `open`) with `saleTotal = effectiveOutstanding`, then mount `SplitTenderDialog`. **Do not** adopt `usePaymentEngine`: it is checkout-shaped (items, discounts, promo, RHF) because it prices an order being built. Watch per-leg drawer binding — `cashDrawerBlocksSubmit` must consider every cash leg.
- **`usePaymentCatalog`** — reuse its *types*, but note its checkout-options query maps a non-ok response to an empty list, which would erase this modal's load-error + Retry surface. Changing that affects the new-order modal.

## Hard constraint

**Shared components are additive-only.** Anything under `src/features/orders/payment/**`, `hooks/use-payment-*`, or `ui/payment-modal*` is co-owned with the new-order checkout — the highest-traffic money screen. Extend via new optional props with behaviour-preserving defaults; never change an existing signature to suit this modal. If it cannot be expressed additively, write a collect-local wrapper.

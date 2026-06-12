# ADR-049 — Online Payment Gateway Integration Program (Greenfield)

**Date:** 2026-06-11  
**Status:** Deferred — provider not chosen; canonical model documented, no integration work until decision  
**Project:** CleanMateX  
**Scope:** Online checkout via `PAYMENT_GATEWAY` + `gateway_code` (HyperPay, PayTabs, Stripe)  
**Depends on:** [ADR-048](./ADR-048-Canonical-Payment-Gateway-Method-Model.md), V1 Payment Config (0267/0269/0291), BVM submit-order orchestrator, ADR-046/047 settlement rules

---

## Deferred (2026-06-11)

**Decision:** Park all gateway integration work until a provider is chosen (HyperPay vs PayTabs vs Stripe vs other).

**What this means now:**

- No Phase 0–5 implementation in this repo until `Approved_By_Jh` picks a provider and reactivates this ADR.
- **Cash, card, check, bank transfer, wallet, and settlement/receipt allocation** are unaffected — continue as shipped.
- Config rows (`PAYMENT_GATEWAY` + per-gateway seeds) can stay; checkout should keep gateway options **hidden or submit-blocked** until integration starts.
- ADR-048 canonical model remains the binding write shape when work resumes.

**To resume:** Pick provider → approve this ADR → start Phase 0 (code contract) then Phase 1+ for that adapter only.

---

## Executive summary

**Nothing is implemented for online gateway capture today.** Config rows exist; Payment Modal V4 can *select* gateway options; submit is blocked or would create inconsistent state if forced. There are **zero** `org_order_payments_dtl` gateway transactions.

This ADR defines a **production-ready, gap-free** program to add online gateway payments without legacy baggage. No payment-row backfill is required.

---

## Current state (verified 2026-06-11)

### Config inventory (query #5)

| tenant_org_id | gateway_code | is_active | rec_status |
|---------------|--------------|-----------|------------|
| 11111111-… | HYPERPAY | true | 1 |
| 11111111-… | MANUAL | true | 1 |
| 11111111-… | PAYTABS | true | 1 |
| 11111111-… | STRIPE | true | 1 |
| c9ac29d1-… | (same four) | true | 1 |

All use `payment_method_code = PAYMENT_GATEWAY`. No duplicates per `(tenant, gateway_code)`.

### Pre-flight (ADR-048)

| Check | Result |
|-------|--------|
| Legacy sys provider methods | Deprecated ✅ |
| Legacy tenant method rows | 0 ✅ |
| Gateway payment transactions | 0 ✅ |

### Code reality

| Area | State |
|------|--------|
| Gateway adapter services (`lib/payments/gateway/*`) | **Missing** |
| Initiate / callback / webhook API routes | **Missing** |
| Gateway session / intent persistence table | **Missing** |
| Payment Modal V4 redirect / embed UX | **Missing** (helpers `buildGatewayReturnState` exist only) |
| `order-payment-wiring.handler.ts` | Still branches on `HYPERPAY`/`PAYTABS`/`STRIPE` **method codes**, not `PAYMENT_GATEWAY` |
| Tenant credentials | `org_payment_methods_cf.gateway_config` JSONB column exists; no UI/API wiring for secrets |
| Feature flags | `payment_gateway_hyperpay` etc. defined in TS; not gating checkout |

---

## Goals

1. **Single canonical write model:** `PAYMENT_GATEWAY` + `gateway_code` (ADR-048).
2. **Async capture lifecycle:** payment starts `PROCESSING`/`PENDING`, completes via provider callback — never fake `COMPLETED` on submit.
3. **Atomic business safety:** order + voucher + payment row created in known state; capture failure leaves auditable `FAILED` / retry path.
4. **Provider isolation:** HyperPay / PayTabs / Stripe behind one orchestrator + adapter interface.
5. **Tenant secrets:** stored in `gateway_config`, never logged, masked on read.
6. **Idempotent webhooks** and return-url handling.
7. **Reconciliation:** gateway line must have `gateway_code` + `gateway_transaction_id` (existing voucher check).
8. **Bilingual UX** + clear cashier messaging (no silent submit disable).

### Non-goals (this program)

- Replacing **POS CARD + terminal** flow (separate rail — immediate `COMPLETED`).
- Customer mobile app checkout (Phase 4 — same adapters, different channel flags).
- HQ SaaS gateway credential management UI in cleanmatexsaas (may consume later; tenant admin config in web-admin first).

---

## Canonical model (binding)

```text
payment_method_code = 'PAYMENT_GATEWAY'
gateway_code        = 'HYPERPAY' | 'PAYTABS' | 'STRIPE'   -- sys_payment_gateway_cd.code (UPPER_SNAKE)
```

Payment leg payload:

```typescript
{
  method: 'PAYMENT_GATEWAY',
  gateway_code: 'HYPERPAY',
  amount: number,
  gateway_reference?: string,      // set after initiate
  gateway_transaction_id?: string // set after capture
}
```

**Do not** persist `HYPERPAY` as `payment_method_code` on new rows.

---

## MANUAL gateway row — clarify before go-live

`sys_payment_gateway_cd.MANUAL` is **`is_online = false`** (manual verification, not an online provider).

Payment Config Guide §13 defines:

| Use case | Correct shape |
|----------|----------------|
| POS terminal card (manual auth entry) | `payment_method_code = CARD`, `gateway_code = MANUAL` (optional) |
| Online checkout | `payment_method_code = PAYMENT_GATEWAY`, `gateway_code = HYPERPAY` etc. |

**Today:** seed 0291 created `PAYMENT_GATEWAY + MANUAL` for both demo tenants. That is **misleading for online checkout**.

**Decision (recommended):**

- **Online program:** exclude `gateway_code = 'MANUAL'` from Payment Modal V4 gateway rail and checkout-options when `sys_payment_gateway_cd.is_online = true` filter applies.
- **Optional migration:** soft-disable `PAYMENT_GATEWAY + MANUAL` tenant rows OR re-home under CARD if product wants “manual card” at POS.
- Do **not** build a HyperPay adapter for `MANUAL`.

---

## Target architecture

```text
┌─────────────────────┐
│ Payment Modal V4    │
│ (select gateway)    │
└──────────┬──────────┘
           │ submit-order (gateway leg → PROCESSING)
           ▼
┌─────────────────────┐     ┌──────────────────────────┐
│ submit-order        │────►│ org_order_payments_dtl   │
│ orchestrator        │     │ status = PROCESSING      │
└──────────┬──────────┘     └──────────────────────────┘
           │
           ▼
┌─────────────────────┐     POST /api/v1/payments/gateway/initiate
│ gateway-orchestrator│◄──── (orderId, paymentId, gateway_code)
└──────────┬──────────┘
           │ adapter.createSession()
           ▼
┌─────────────────────┐
│ Provider (HyperPay…)│ redirect / widget URL
└──────────┬──────────┘
           │ customer pays
           ▼
┌─────────────────────┐     POST /api/webhooks/gateway/{code}
│ callback + webhook  │────► verify signature → capture service
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ complete-gateway-   │──► payment COMPLETED, voucher line update,
│ payment.service   │    workflow advance, outbox events
└─────────────────────┘
```

### Adapter interface (sketch)

```typescript
interface PaymentGatewayAdapter {
  readonly gatewayCode: 'HYPERPAY' | 'PAYTABS' | 'STRIPE';
  createCheckoutSession(input: GatewaySessionInput): Promise<GatewaySessionResult>;
  parseWebhook(payload: unknown, headers: Headers): Promise<GatewayWebhookEvent>;
  verifyReturnQuery(params: URLSearchParams): Promise<GatewayReturnVerification>;
}
```

Orchestrator selects adapter by `gateway_code`, loads tenant `gateway_config`, enforces feature flag + `allowed_in_*` + credentials present.

---

## Payment & order lifecycle

| Step | Order payment status | Order financial | Cashier UX |
|------|---------------------|-----------------|------------|
| Submit with gateway leg | `PROCESSING` | Unpaid / partial per policy | “Redirecting to payment…” |
| Provider session created | `PROCESSING` + session row | unchanged | Browser redirect / iframe |
| Capture success | `COMPLETED` | Paid amount updated | Success toast + receipt |
| Capture failed / abandoned | `FAILED` or `CANCELLED` | unchanged | Retry or change method |
| Webhook late success | Idempotent upgrade to `COMPLETED` | reconcile | Admin notification if mismatch |

**Rule:** Submit-order must **never** set gateway legs to `COMPLETED` without provider confirmation (planner already defaults `gatewayCode` → `PROCESSING` — keep and enforce in validator).

---

## Data model additions

### New table: `org_order_gateway_sess_tr` (name TBD — max 30 chars)

Suggested columns:

| Column | Purpose |
|--------|---------|
| `tenant_org_id`, `order_id`, `order_payment_id` | Tenant scope + links |
| `gateway_code` | HYPERPAY / … |
| `session_status` | `CREATED`, `REDIRECTED`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `EXPIRED` |
| `provider_session_id` | Provider checkout id |
| `provider_transaction_id` | Set on capture |
| `amount`, `currency_code` | Snapshot |
| `return_url`, `cancel_url` | Client routes |
| `idempotency_key` | Replay-safe initiate |
| `raw_initiate_response`, `raw_webhook_payload` | Audit (JSONB, PII-safe) |
| Standard audit + RLS | Required |

**Alternative:** extend `org_order_payments_dtl` with session fields only — rejected for audit clarity and webhook correlation.

### Existing columns to use

- `org_order_payments_dtl.gateway_code`, `gateway_reference`, `gateway_transaction_id` (confirm column names in 0269+ patches)
- `org_fin_voucher_trx_lines_dtl.gateway_code`, `gateway_transaction_id` (reconciliation check exists)
- `org_payment_methods_cf.gateway_config` for tenant secrets

---

## API surface

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/v1/payments/gateway/initiate` | Tenant user + permission | Create provider session after submit |
| `GET /api/v1/payments/gateway/return` | Public signed token | Browser return from provider |
| `POST /api/webhooks/gateway/[gatewayCode]` | Provider signature | Async status updates |
| `GET /api/v1/payments/gateway/session/[id]` | Tenant user | Poll status for modal |

**Permissions (new migration, single file):**

- `payments:gateway_initiate`
- `payments:gateway_manage_config` (tenant admin — credentials)
- Webhook routes: service role / signature only — no RBAC

**Feature flags (HQ, cleanmatexsaas):**

- `payment_gateway_hyperpay`, `payment_gateway_paytabs`, `payment_gateway_stripe` (already in TS — wire to checkout-options)

---

## Frontend (Payment Modal V4)

Replace **silent submit disable** with explicit states:

1. Gateway selected + flag off → show banner “HyperPay not enabled for this tenant” + disable submit with reason.
2. Gateway selected + flag on + missing credentials → settings link for admin.
3. Gateway selected + ready → submit creates order, then calls `initiate`, then `window.location` or embedded widget.
4. Return route reopens order / shows payment result modal.

Reuse `buildGatewayReturnState` / `parseGatewayReturnState` for signed return envelope.

---

## Code cleanup (pre-requisite — Phase 0)

Before any provider work:

| File | Fix |
|------|-----|
| `order-payment-wiring.handler.ts` | Treat `PAYMENT_GATEWAY` as PENDING; remove legacy `HYPERPAY` method-code branch |
| `payment-service.ts` / `erp-lite-auto-post.service.ts` | Route by `gateway_code` under `PAYMENT_GATEWAY` |
| `checkout-config.service.ts` | Filter `is_online` gateways for online rail; hide `MANUAL` from online list |
| `payment.ts` constants | Keep normalizer; stop new feature usage of `PAYMENT_METHODS.HYPERPAY` |
| Settlement planner tests | Use `PAYMENT_GATEWAY` + `gatewayCode` only |

---

## Phased rollout

| Phase | Deliverable | Production gate |
|-------|-------------|-----------------|
| **0 — Contract hardening** | ADR-049 approved; Phase 0 code fixes; checkout hides immature gateways | No user-facing gateway |
| **1 — Platform skeleton** | Session table migration; orchestrator; initiate + return routes (stub adapter); Modal V4 explicit UX | Internal QA only |
| **2 — HyperPay (GCC)** | Full adapter; webhook; credentials UI; tests; `payment_gateway_hyperpay` flag | First production provider |
| **3 — PayTabs + Stripe** | Additional adapters; shared webhook router | Multi-provider tenants |
| **4 — Customer channel** | `allowed_in_customer_app`; public initiate with customer auth | Optional |
| **5 — Reconciliation** | Extend fin reconciliation: orphaned PROCESSING > N hours; gateway amount mismatch | Ops dashboard |

**Recommended first provider:** **HyperPay** (GCC, existing env vars in `.codex/docs/env_config.md`, `sys_payment_gateway_cd` seed).

---

## Security & compliance

- Secrets only in `gateway_config` / env — never client bundle.
- Webhook signature verification mandatory per adapter.
- Return URL tokens: HMAC signed, short TTL, tenant + order bound.
- Idempotency on initiate and webhook processing (unique on provider transaction id per tenant).
- PCI: prefer redirect/hosted payment page — no raw card data in web-admin.

---

## Testing strategy

| Layer | Coverage |
|-------|----------|
| Unit | Adapter request/response mapping, signature verification, state machine |
| Service | Orchestrator idempotency, tenant isolation, flag gating |
| Integration | Submit → initiate → webhook → COMPLETED; failed capture; duplicate webhook |
| E2E | Modal redirect mock; return URL resume |
| Manual | test_guide Scenario 14 updated with full gateway flow |

---

## Migration checklist (when Phase 1 starts)

- [ ] `{next_seq}_org_order_gateway_sess_tr.sql` — table + RLS + indexes
- [ ] `{next_seq}_permissions_payment_gateway.sql` — permission seeds
- [ ] No change to ADR-048 data (already clean)
- [ ] Optional: `{next_seq}_disable_payment_gateway_manual_online.sql` — set `allowed_in_pos=false` on `PAYMENT_GATEWAY+MANUAL` until CARD rail clarified

---

## Open decisions (for `Approved_By_Jh`)

1. **Order-first vs pay-first:** This ADR assumes **order-first** (submit creates PROCESSING payment, then redirect). Confirm vs pay-before-order for customer app.
2. **MANUAL row:** Soft-disable `PAYMENT_GATEWAY+MANUAL` at online checkout vs migrate to CARD.
3. **First provider:** HyperPay only in Phase 2, or parallel PayTabs?
4. **Partial gateway + cash split:** Same submit transaction with one PROCESSING gateway leg + COMPLETED cash legs — supported; confirm UX.

---

## Related documents

- [ADR-048 Canonical Payment Gateway Method Model](./ADR-048-Canonical-Payment-Gateway-Method-Model.md)
- [V1 Payment Config Client Guide](../../Payment_Config_Setup/CleanMateX_V1_Payment_Config_Client_Level_Implementation_Guide.md)
- [test_guide Scenario 14](../../Order_Payment_Model/test_guide.md)
- [BVM Phase 2 Entry Plan](../BVM_PHASE_2_ENTRY_PLAN.md) — gateway submit-block note

---

## Approval

- [ ] `Approved_By_Jh` — architecture, order-first flow, HyperPay-first Phase 2
- [x] Config + pre-flight discovery recorded (2026-06-11)

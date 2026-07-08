# Payment Modal Composable Capability Program — STATUS

**Branch:** `feature/payment-modal-composable-capabilities` (one final merge; small commits per phase)
**Plan:** [`Payment_Modal_Implementation_Plan.md`](./Payment_Modal_Implementation_Plan.md) · **ADR:** [`../ADR/ADR_payment_modal_single_engine_two_mode.md`](../ADR/ADR_payment_modal_single_engine_two_mode.md) (amended 2026-07-08)
**Last update:** 2026-07-09

## Phase board

| Phase | Scope | Status | Gates |
|-------|-------|--------|-------|
| 0 | Engine action facade + config boundary + kill-switch + task docs | 🟡 IN PROGRESS (~80%) | new tests 6/6 · oracle 8/8 · eslint 0 · tsc 0 |
| 0B | Backend credit-limit hard-deny by default (orchestrator only) | ⬜ pending | — |
| 1 | Capability registry + unified reason codes + CapabilityContext | ⬜ pending | — |
| 2 | Reusable primitives + capability dialog shell | ⬜ pending | — |
| 3 | Capability dialogs (domain-level) | ⬜ pending | — |
| 4 | Presets + view renderer (strangler decomposition of payment-full-view) | ⬜ pending | — |
| 5 | Behavior reversal + server-error→capability routing | ⬜ pending | — |
| 6 | i18n EN/AR + new test coverage + full gates | ⬜ pending | — |
| 7 | Docs (/documentation), QA guide, closeout | ⬜ pending | — |

## Phase 0 — detail (2026-07-09)

**Done:**
- `web-admin/src/features/orders/payment/capabilities/capability-keys.ts` — `PAYMENT_CAPABILITY` (13 keys) + types
- `web-admin/src/features/orders/payment/presets/preset-keys.ts` — `PAYMENT_PRESET`; SIMPLE/FULL active; SEMI_PRO/PRO/ACCOUNTANT/B2B_COLLECTION/MOBILE_POS type-scaffolding only
- `web-admin/src/features/orders/payment/config/payment-modal-config.ts` — `resolvePaymentModalConfig` + `DEFAULT_PAYMENT_MODAL_CONFIG` + `PAYMENT_MODE_USER_CONTROLLED` kill-switch (named `*ModalConfig` to avoid collision with `lib/services/payment-config.service.ts`, which owns payment *method* config — handoff rule H1)
- `web-admin/src/features/orders/payment/engine/payment-engine-actions.ts` — `PaymentEngineActions` typed facade (17 handlers, identity mapping, types indexed off the engine return so drift = type error)
- Tests: `web-admin/__tests__/features/orders/payment/payment-modal-config.test.ts` (4/4) · `payment-engine-actions.test.ts` (2/2)
- Gates: oracle **8/8** · needs-advanced 13/13 · eslint (new module) **0** · `tsc --noEmit` **0 errors**
- Task docs: this STATUS + `Payment_Modal_Implementation_Plan.md` + `Deferred_Backend_Tasks.md` created

**Remaining:** first commit (stage payment-modal/program files ONLY — see Foreign-files warning below).

**⚠ Kill-switch is dormant (handoff H6):** `PAYMENT_MODE_USER_CONTROLLED = true` exists but nothing consumes it yet — the modal still auto-escalates until Phase 5 wires the container through `resolvePaymentModalConfig`. Do not report the new behavior as live.

**⚠ Facade is deliberately partial (handoff H2):** leg editing (`updateLeg`/`addLeg`/`removeLeg`) and cash-drawer actions are NOT yet in `PaymentEngineActions`; each Phase-3 dialog adds the actions it needs in the same commit.

**⚠ Foreign uncommitted files on this branch (handoff H3) — NEVER stage:** `web-admin/app/dashboard/internal_fin/pos-sessions/page.tsx`, `web-admin/messages/{en,ar}/posSessions.json`, `supabase/migrations/0400_pos_sessions_rebuild_effective_permissions.sql` (separate pos-sessions work). No `git add -A`.

## Cross-layer audit — exact repo references (clarification #2; verified 2026-07-09)

| Area | File · symbol | Line(s) | Finding |
|------|---------------|---------|---------|
| Submit entry / auth / idempotency | `web-admin/app/api/v1/orders/submit-order/route.ts` · `POST` | 66–257 | `requirePermission('orders:create')` + CSRF + `submitOrderRequestSchema.safeParse`; idempotency key **required**, staked pre-orchestrator, hash-conflict → 409, prior-attempt recovery. |
| Idempotency utils | `web-admin/lib/utils/idempotency.ts` · `hashPayload`/`findIdempotencyHash`/`stakeIdempotencyHash`/`storeIdempotencyHash`/`deleteIdempotencyHash` | — | Payload-hash + staking lifecycle owned by the route. |
| Orchestrator (business rules) | `web-admin/lib/services/order-submit-orchestrator.service.ts` · `submitOrder` | throws documented 247–257 | Recomputes totals; typed codes `AMOUNT_MISMATCH`, `SPLIT_AMOUNT_MISMATCH`, `DEFERRED_LEG_NOT_ALONE`, `OUTSTANDING_POLICY_REQUIRED`, `CHECK_NUMBER_REQUIRED`. |
| B2B credit check | `order-submit-orchestrator.service.ts` · `checkCreditLimit` call | 372–386 | `CREDIT_INVOICE` → `B2B_CREDIT_HOLD` / `B2B_CREDIT_EXCEEDED` unless `creditLimitOverride` (line 377). |
| B2B field persistence | `order-submit-orchestrator.service.ts` (create payload) | 625–627 | `b2bContractId` / `costCenterCode` / `poNumber` persisted — **not UI-only**. |
| Credit-limit override | `order-submit-orchestrator.service.ts` | 348, 377, 628–631 | **Today:** client boolean honored, audit-stamped (`creditLimitOverrideBy/At`), **not permission-gated**. **Phase 0B:** hard-deny by default. Gated re-enable = deferred task. |
| Submit request schema | `web-admin/lib/validations/new-order-payment-schemas.ts` · `submitOrderRequestSchema` | 500–505 | `b2bContractId`/`costCenterCode`/`poNumber`/`creditLimitOverride` in the frozen contract. |
| Drawer / overpayment / gateway validation | `submit-order/route.ts` error→HTTP map | 425–436 | `CASH_DRAWER_SESSION_*`, `OVERPAYMENT_RESOLUTION_*`, `GATEWAY_NOT_CONFIGURED`, `PAYMENT_REFERENCE_REQUIRED`, `PAYMENT_TERMINAL_REQUIRED` → 422. |
| Client error surfacing | `web-admin/src/features/orders/hooks/use-order-submission.ts` · `infrastructureMessages` | 607–646 | Server-code → i18n map; Phase 5 extends into server-code → capability-guard routing. |

**Audit net:** one approved backend change (Phase 0B — accounting safety, orchestrator only, no DB/payload change). Everything else: no backend/DB change.

## Decisions log

- 2026-07-08 — ADR amended: user-controlled Simple/Full, dialogs/guards, demoted suggestion, restricted class.
- 2026-07-09 — Plan approved with composable capability architecture; full program on one branch; kill-switch constant.
- 2026-07-09 — **Phase 0B approved:** credit-limit exceedance hard-denied by default even with client `creditLimitOverride`; gated exception (explicit enablement + `orders:override_credit_limit`, both required) deferred HIGH-PRIORITY.
- 2026-07-09 — Handoff rules H1–H9 added to plan (naming, facade extension, foreign files, test-rewrite timing, 0B-first, dormant kill-switch, oracle scope, task docs, simpleDisabled).

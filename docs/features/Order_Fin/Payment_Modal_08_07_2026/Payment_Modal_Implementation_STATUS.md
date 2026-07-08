# Payment Modal Composable Capability Program — STATUS

**Branch:** `feature/payment-modal-composable-capabilities` (one final merge; small commits per phase)
**Plan:** [`Payment_Modal_Implementation_Plan.md`](./Payment_Modal_Implementation_Plan.md) · **ADR:** [`../ADR/ADR_payment_modal_single_engine_two_mode.md`](../ADR/ADR_payment_modal_single_engine_two_mode.md) (amended 2026-07-08)
**Last update:** 2026-07-09

## Phase board

| Phase | Scope | Status | Gates |
|-------|-------|--------|-------|
| 0 | Engine action facade + config boundary + kill-switch + task docs | ✅ DONE — commit `83147972` | new tests 6/6 · oracle 8/8 · eslint 0 · tsc 0 |
| 0B | Backend credit-limit hard-deny by default (orchestrator only) | ✅ DONE (2026-07-09) | hard-deny tests 5/5 · oracle 8/8 · eslint 0 · tsc 0 · i18n ✓ |
| 1 | Capability registry + unified reason codes + CapabilityContext | ✅ DONE (2026-07-09) | registry tests 15/15 · all payment suites 42/42 · oracle 8/8 · eslint 0 · tsc 0 |
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

## Phase 0B — detail (2026-07-09)

**Change:** B2B credit-limit exceedance is **hard-denied by default**; the client `creditLimitOverride` boolean is fully inert server-side.

- `web-admin/lib/services/credit-limit.service.ts` — new exported pure gate `assertCreditWithinPolicy(creditCheck)`: throws `B2B_CREDIT_HOLD` / `B2B_CREDIT_EXCEEDED` (with `creditLimit`/`currentBalance`/`available` attached). **Takes no override input by design** — inertness is structural.
- `web-admin/lib/services/order-submit-orchestrator.service.ts` — CREDIT_INVOICE path now calls the gate unconditionally; removed the `creditLimitOverride` const, the `!creditLimitOverride` bypass, and the now-meaningless `creditLimitOverrideBy/At` stamping (nothing is ever overridden). Schema field stays (payload frozen); `order-service.ts` pass-through params kept for the future gated path.
- Tests: `web-admin/__tests__/services/credit-limit-hard-deny.test.ts` (5/5) — within-limit passes · hold throws · exceeded throws with details · **structural inertness** (single-param signature + smuggled flag still denied) · non-B2B passes.
- i18n: added missing `newOrder.payment.errors.*` keys (EN+AR): `b2bCreditHold`, `b2bCreditExceeded`, `splitAmountMismatch`, `deferredLegNotAlone`, `paymentReferenceRequired`, `paymentTerminalRequired`, `outstandingPolicyRequired` — **pre-existing gap**: `use-order-submission.ts:607-646` referenced all of these but none existed, so those server rejections rendered raw key paths. Now fixed; `check:i18n` ✓.
- **Interim seam (accepted, H5):** until Phase 5 removes the UI override affordance (`creditExceededWarn` flow), a cashier using it simply gets the server's hard `B2B_CREDIT_EXCEEDED` denial. Not a bug. The stale `b2b.creditExceededWarn` copy ("You may override…") is removed/reworded in Phase 5.
- **Deferred (HIGH-PRIORITY):** gated override re-enable — see `Deferred_Backend_Tasks.md` §1.

## Phase 1 — detail (2026-07-09)

**New pure layers (no React, no money math — classifier only):**
- `payment/domain/payment-reasons.ts` — unified `PAYMENT_REASON` codes: **server-mirror family** (values are the exact backend error codes, e.g. `CASH_DRAWER_SESSION_CLOSED`, `B2B_CREDIT_EXCEEDED` — contract-mirror rule) + **UX family** (`SHOWN_*`, `REQUIRED_*`, `SUGGEST_FULL_COMPLEXITY`); `SERVER_ERROR_TO_REASON` map (Phase 5 extends into guard routing); `needsAdvancedToSuggestion` (demoted suggestion); `reasonMessageKey` (`newOrder.payment.reasons.<code>` — catalog entries land with consuming UI in Phase 6).
- `payment/domain/capability-context.ts` — `CapabilityContext` (pure facts: catalog/customer/legs/overpayment/drawer/FX/submit), `createCapabilityContext` builder, `toNeedsAdvancedInput` adapter so the retained `computeNeedsAdvanced` predicate and the registry classify from the SAME facts (no drift).
- `payment/capabilities/registry.ts` — declarative descriptors for all 13 capabilities (`isAvailable`/`isRequired`/`isBlocked`/`presentation`/`activeReasons` + messageKeys) + `evaluateCapability`/`evaluateCapabilities`; config `capabilityOverrides` applies last and cannot resurrect an unavailable capability. ADR mappings pinned: split=dialog(#1), PIN inside gift dialog(#6), drawer-ambiguity=required inline prompt(#7), drawer-blocked=submit guard(#8), overpayment=required dialog(#5), B2B pay-now unforced / account-billing missing-fields=required gate(#3), FX=read-only inline(#9).
- Tests: `capability-registry.test.ts` (15/15) incl. server-mirror identity check and adapter parity with `computeNeedsAdvanced`. `payment-needs-advanced.ts` and its tests untouched.
- Note: `Dialog` component wiring is deliberately absent from descriptors until Phase 3 (H2 — facade extends per capability then).

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

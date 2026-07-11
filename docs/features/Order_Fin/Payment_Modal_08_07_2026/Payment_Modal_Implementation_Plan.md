# Plan — Payment Modal → Composable Capability-Based Payment System (ADR-Aligned)

## ⚠ Implementer handoff notes (read first — state as of 2026-07-09)

**Phase 0 is ~70% done and green on branch `feature/payment-modal-composable-capabilities` (uncommitted).** Do not redo it. Already implemented:

- `web-admin/src/features/orders/payment/capabilities/capability-keys.ts` — `PAYMENT_CAPABILITY` keys + types
- `web-admin/src/features/orders/payment/presets/preset-keys.ts` — `PAYMENT_PRESET` (SIMPLE/FULL active; future keys type-scaffolding only)
- `web-admin/src/features/orders/payment/config/payment-modal-config.ts` — config boundary + kill-switch
- `web-admin/src/features/orders/payment/engine/payment-engine-actions.ts` — typed action facade (17 handlers)
- Tests: `web-admin/__tests__/features/orders/payment/payment-modal-config.test.ts` (4/4) + `payment-engine-actions.test.ts` (2/2); oracle 8/8 and needs-advanced 13/13 still green; eslint clean on the new module.

**Remaining for Phase 0:** full `tsc --noEmit` confirmation · create the repo task docs (see rule H8) · first commit.

**Hard handoff rules (from pre-implementation review):**

- **H1 — Naming is final; the plan's older names are superseded.** The repo already has `lib/services/payment-config.service.ts` (DB-backed payment *method* config). To avoid collision the new L2 boundary is named `resolvePaymentModalConfig(context)` / `DEFAULT_PAYMENT_MODAL_CONFIG` / `PaymentModalConfig` / `PaymentModalConfigContext`. Anywhere this plan says `getEffectivePaymentConfig` / `DEFAULT_PAYMENT_CONFIG`, read the new names. Do **not** rename back or create a second resolver.
- **H2 — Extend the action facade per capability, same commit.** `PaymentEngineActions` does not yet cover leg editing (`updateLeg`, `addLeg`, `removeLeg` from the `legs` slice) or cash-drawer actions (`handleOpenCashDrawerDialog`, `persistPreferredCashDrawerId`, `handleCreateCashDrawerSession`). When building each capability dialog (Phase 3), add the actions it needs to the facade in the same commit — dialogs must never reach around the facade.
- **H3 — Foreign uncommitted work on the branch: never stage it.** `web-admin/app/dashboard/internal_fin/pos-sessions/page.tsx`, `web-admin/messages/{en,ar}/posSessions.json`, and `supabase/migrations/0400_pos_sessions_rebuild_effective_permissions.sql` belong to other work. Stage payment-modal/program files **only** — no `git add -A`.
- **H4 — Tests asserting old behavior are rewritten in the same phase that changes the behavior** (gates must be green after every phase). Phase 0B: update orchestrator/B2B tests asserting the override bypass in the same commit as hard-deny. Phase 5: rewrite `payment-simple-mode.test.ts` escalation assertions + `payment-needs-advanced.test.ts` consequence wording in the same commit as the reversal. Phase 6 adds *new* coverage only.
- **H5 — Do Phase 0B immediately after Phase 0 commit** (independent, highest-value accounting fix; don't let it be hostage to the UI program). Interim seam is accepted: until Phase 5 removes the UI override affordance, a cashier using it simply gets the server's `B2B_CREDIT_EXCEEDED`. Record this in STATUS so QA doesn't file it as a bug.
- **H6 — Kill-switch is dormant until Phase 5.** `PAYMENT_MODE_USER_CONTROLLED = true` exists but nothing consumes it yet; the modal still auto-escalates until Phase 5 wires the container through the config. State this in STATUS after each phase until wired.
- **H7 — Don't gold-plate oracle fixtures (hardening #8).** The 8 existing fixtures already cover split, gift-card+PIN, B2B, overpayment, cash. Add fixtures only for genuinely uncovered paths (customer-credit/advance leg, drawer-choice variants). Do not duplicate all fixtures per capability.
- **H8 — First commit = repo task docs.** Before more code: copy this plan into `docs/features/Order_Fin/Payment_Modal_08_07_2026/Payment_Modal_Implementation_Plan.md`; create `Payment_Modal_Implementation_STATUS.md` (record the Phase-0 partial state above + the exact audit-reference table from this plan); create `Deferred_Backend_Tasks.md` (credit-override gated exception + kill-switch removal). Plans live under `docs/features/<feature>/`, per standing user preference.
- **H9 — `simpleDisabled` note.** The plan says the toggle's `simpleDisabled` becomes "restricted-only", but the final ADR handles the restricted class via required dialogs/approval gates, not by locking the Simple segment. Expect `simpleDisabled` to end up unused; if so, delete it with the kill-switch cleanup rather than preserving it speculatively.

## Context

The amended ADR ([`ADR_payment_modal_single_engine_two_mode.md`](f:/jhapp/cleanmatex/docs/features/Order_Fin/ADR/ADR_payment_modal_single_engine_two_mode.md), 2026-07-08) reverses the escalation model: **Simple is default and stays selected; complications resolve via focused dialogs and guards; Full is user-chosen; `computeNeedsAdvanced` is demoted to a dismissible suggestion; a narrow restricted class may require a dialog/gate.**

But behavior alignment alone would leave `payment-full-view.tsx` (~5,900 lines) as a growing monolith. The real goal is **structural**: rebuild the modal as a **composable payment system** so that Simple, Full, and any future view (Semi-Pro, Pro, Accountant, B2B-Collection, Mobile-POS) are *compositions of reusable capabilities*, never copied business logic — and so the same capabilities can later power Collect Payment, Refund, wallet top-up, and POS session close. The engine, submit contract, and payload stay **frozen** (payload-fixtures oracle is the proof).

## Decisions locked (from user)

- **Full program on one feature branch / one final merge** — "one go" means one branch, **not** one giant commit. Implement in **small phases/commits with all gates green after each**; do **not** merge until the whole program is complete and verified. No interim merged state where Simple still auto-jumps to Full.
- **Local kill-switch constant** — `PAYMENT_MODE_USER_CONTROLLED` (folded into config), default = new behavior; QA can flip to old auto-escalation without a revert. **Temporary** — removal after QA sign-off (before production hardening) is a **tracked task**, not optional. Not an HQ feature flag.
- **Composable capability architecture is mandatory** — no isolated hardcoded screens; views are presets over a capability registry; dialogs are payment-domain components; all state flows through typed engine actions; no finance/validation/payload logic in any visual component.
- **Capability registry is a classifier, not a second engine** — it classifies availability/required/blocked/presentation using engine/backend-derived facts only. It must **never** duplicate financial calculation, validation, or submit-payload logic; those stay in the engine (L1). Computing money in the registry is a design error.
- **Module home** — `src/features/orders/payment/`, self-contained so it can move to a top-level module later. **Not** moved to `src/features/payments/` now.
- **New permissions = audit-then-migration** — never a TS-only constant. Manual FX, restricted overpayment routing, credit-limit override, refund reversal, or any restricted action needing a non-existent permission is documented and done properly (backend + DB seed/migration + tests + i18n + docs).

## Scope guardrails (this phase — explicit "do not")

- **No DB-driven config** — code defaults only via `resolvePaymentModalConfig` (boundary built; body returns `DEFAULT_PAYMENT_MODAL_CONFIG`). See handoff rule H1.
- **No HQ payment configuration screens.**
- **No unused future views** — `SEMI_PRO` / `PRO` / `ACCOUNTANT` / `B2B_COLLECTION` / `MOBILE_POS` are **type scaffolding only**, not built.
- **No module move** to top-level `src/features/payments/`.
- **No submit-payload shape change** unless a real backend-contract gap is discovered *and approved* (Payload rule).
- **No backend/DB change by default** — audit them; fix/document only for proven payment correctness, security, or accounting-enforcement gaps. **One approved exception:** Phase 0B credit-limit hard-deny (orchestrator only; no DB/payload change).
- **CLAUDE.md is binding** — load required skills before writing (`/frontend`, `/i18n`, `/database` only if a migration is truly required), use agents per task type, follow the rules docs, and **reuse existing Cmx UI or create a reusable component** when an element will appear in 2+ places.

---

## Architecture overview (the layered composable system)

```
┌──────────────────────────────────────────────────────────────┐
│  L6  Presets / layouts     SIMPLE · FULL  (+ future SEMI_PRO…) │  composition only
├──────────────────────────────────────────────────────────────┤
│  L5  View renderer         renders capabilities by preset meta │  no business logic
├──────────────────────────────────────────────────────────────┤
│  L4  Capability dialogs    payment/capabilities/{cap}/…        │  domain-reusable UI
│  L4  Reusable primitives   amount, method, leg-editor, guard…  │
├──────────────────────────────────────────────────────────────┤
│  L3  Capability registry   declarative: available/required/    │  pure, tested
│                            blocked/inline + reason codes        │
├──────────────────────────────────────────────────────────────┤
│  L2  Config resolver       getEffectivePaymentConfig(ctx)       │  isolated, mockable
│                            → DEFAULT_PAYMENT_CONFIG (code only)  │
├──────────────────────────────────────────────────────────────┤
│  L1  Headless engine       usePaymentEngine + typed actions     │  single source of truth
│      state · derivations · validation · guards · payload        │  FROZEN payload
└──────────────────────────────────────────────────────────────┘
                 ▲ backend/API = final enforcement authority ▲
```

**Data flow:** engine state → `CapabilityContext` (pure projection) → config resolver enables/overrides → registry computes each capability's state + reason code → preset selects/arranges capabilities → renderer draws primitives/dialogs → dialogs call **typed engine actions** → engine re-derives. One direction, one source of truth.

---

## Best-practice architecture and maintainability plan

**Engine responsibilities (L1).** All payment state, money derivations, validation, guard truth, permission checks, and the submit payload. Exposed through a **typed action facade** `PaymentEngineActions` (groups today's loose handlers — `handleApplyGiftCard`, `handleCustomerCreditSelect`, `legs.*`, `cashDrawer.*`, `handleOutstandingPolicyChange`, overpayment) into a coherent, discoverable, typed API. No behavior change — a facade over existing `usePaymentEngine` return (`use-payment-engine.ts:1369-1486`).

**View responsibilities (L5/L6).** Choose a preset, ask the registry which capabilities are available/required/inline/hidden, and lay them out. Zero finance logic, zero validation, zero payload assembly. A view is ~a layout + a preset reference.

**Dialog responsibilities (L4).** One capability each, small and focused. Render primitives, read engine-derived state, call typed engine actions. Never compute money, never validate, never build payload. Domain-level (not view-scoped) so they are reusable.

**Reusable primitives (L4).** `AmountInput`, `MethodSelector`, `LegEditor`, `ActionButton`, `DialogShell`, `SummaryLine`, `MoneyValue`, `SubmitGuard`. Reuse existing where present (`CmxMoneyField`, `CmxKeypad`, `SummaryRow`, `quick-tender-chips`, `payment-mode-toggle`); extract the rest. All Cmx-based.

**Shared types/constants.** `lib/constants/payment.ts` + `lib/types/payment.ts` remain the single source (DB-mirror rule). Add capability keys, preset keys, reason codes, config types here — not scattered in components.

**Domain utilities.** Pure helpers (leg balance math, capability-context projection, config merge) in `payment/domain/` — no React, unit-tested in isolation.

**Test organization.** Pure layers (registry rules, config resolver, context projection, reason codes, engine actions) tested without React; dialogs tested for engine-action interaction; presets tested for "SIMPLE shows X, FULL shows Y"; the **payload-fixtures oracle stays authoritative** and unchanged. See Test organization section.

**Centralized validation.** Stays in the engine validation slice (`runValidatePayment`, `validationItems`, `overpaymentBlocksSubmit`, etc.). Capabilities *surface* validation items + reason codes; they never re-implement rules.

**Centralized submit payload.** Stays in the engine/submit slice. No dialog or view touches the payload. Oracle guarantees it is byte-stable.

**How components stay small.** Hard rule: a capability dialog that needs finance logic is a smell — the logic belongs in the engine/domain util, the dialog calls an action. Views may not branch on raw engine flags; they branch on **capability state** from the registry.

---

## Future-proof capability/config architecture

**No DB config this phase.** We build the *code boundary* only, isolated and mockable:

```ts
// payment/config/payment-modal-config.ts  (IMPLEMENTED — Phase 0)
export function resolvePaymentModalConfig(
  context: PaymentModalConfigContext = {},
): PaymentModalConfig {
  return DEFAULT_PAYMENT_MODAL_CONFIG; // code defaults only, today
}
```

`PaymentModalConfig` describes: user-controlled-mode flag (mirrors the kill-switch), available presets + default preset, and per-capability presentation overrides (hidden / inline / dialog). `DEFAULT_PAYMENT_MODAL_CONFIG` lives in `payment/config/payment-modal-config.ts`. Named `*ModalConfig` deliberately — `payment-config.service.ts` already owns payment *method* config (H1).

**Later** (separate program, no code churn to callers) the resolver body is swapped to merge, in precedence order: code defaults → `sys_*` payment catalogs → HQ grants → paid add-ons → plan entitlements → feature flags → tenant overrides → branch overrides → role/user preferences. Because every caller depends only on the returned `PaymentConfig` shape and the resolver is mockable, this is a body swap, not an API change.

**Presets today:** `SIMPLE`, `FULL`. **Type support (not built) for:** `SEMI_PRO`, `PRO`, `ACCOUNTANT`, `B2B_COLLECTION`, `MOBILE_POS` — enum members + `PaymentPreset` type so a future preset is an additive descriptor.

---

## Capability-based design

`payment/capabilities/registry.ts` holds declarative descriptors. Each capability:

```ts
interface PaymentCapability {
  key: PaymentCapabilityKey;
  messageKeys: { title: string; action: string; /* … */ };
  isAvailable(ctx: CapabilityContext): boolean;
  isRequired(ctx: CapabilityContext): boolean;
  isBlocked(ctx: CapabilityContext): { blocked: boolean; reason?: PaymentReasonCode };
  presentation(ctx: CapabilityContext): CapabilityPresentation; // 'inline' | 'dialog' | 'suggestion' | 'hidden'
  engineActions: (keyof PaymentEngineActions)[];  // typed actions it may call
  reasonCodes: PaymentReasonCode[];               // why shown/required/blocked/suggested
  Dialog?: ComponentType<CapabilityDialogProps>;  // domain dialog, if any
}
```

**Capabilities (initial set):**

```
CASH · CARD · CASH_CARD_SPLIT · SPLIT_TENDER · GIFT_CARD · PROMO_CODE ·
CUSTOMER_CREDIT · PAY_LATER · B2B_ACCOUNT_BILLING · CASH_DRAWER ·
OVERPAYMENT_ROUTING · FX_ROUNDING · SUBMIT_GUARDS
```

The **registry is the single decision point** (ADR + user req #6) for what is available/required/hidden/blocked/inline — replacing the scattered `needsAdvanced`/`if` checks in `payment-full-view.tsx`. `computeNeedsAdvanced` is refactored to feed the registry (predicate + reason codes retained; consequence = registry input + suggestion).

---

## Reusability strategy

**Folder home** (`src/features/orders/payment/` — self-contained so it can move to a cross-feature `src/features/payments/` later without touching internals):

```
payment/
  engine/            # typed action facade over usePaymentEngine (L1)
  config/            # getEffectivePaymentConfig + DEFAULT_PAYMENT_CONFIG (L2)
  capabilities/
    registry.ts
    {cash,card,split-tender,gift-card,promo-code,customer-credit,
     b2b-account-billing,cash-drawer,overpayment-routing,fx-rounding,
     submit-guards}/          # descriptor + dialog + tests, colocated per capability
  presets/           # simple.preset.ts, full.preset.ts (+ future presets) (L6)
  primitives/        # amount, method, leg-editor, action-button, dialog-shell,
                     # summary-line, money-value, submit-guard (L4)
  domain/            # pure utils + CapabilityContext projection
  view/              # capability-driven renderer (L5)
```

Dialogs are **payment-domain** components (not `simple-dialogs/`), reusable in **Collect Payment, Refund, B2B statement payment, wallet top-up, POS session close, Mobile POS**. Existing `pay-extra/payment-extra-receipt-dialog.tsx`, allocation drawers, and credit-note picker are wrapped as capability dialogs, not rebuilt.

---

## Cross-layer impact audit (completed read-only; findings below)

This is **not a frontend-only task** — but the audit shows enforcement is already server-side, so the required change stays frontend/engine-composition. Findings per layer:

| # | Layer | Finding | Change needed |
|---|-------|---------|---------------|
| 1 | Frontend modal components | Escalation/lock live in `payment-full-view.tsx` (see inventory); Simple/Full are hardcoded, not composed. | **Yes** — capability/preset refactor + reversal. |
| 2 | Payment engine hooks | `usePaymentEngine` already owns state/derivations/validation/payload; handlers exist but untyped-as-group. | **Wrap only** — typed action facade, no behavior change. |
| 3 | Shared payment types/constants | `lib/constants/payment.ts` + `lib/types/payment.ts`. | **Add** capability/preset/reason/config types. |
| 4 | Validation utilities | Centralized in engine validation slice (`runValidatePayment`, `validationItems`, `overpaymentBlocksSubmit`). | **Reuse** — capabilities surface, never re-implement. |
| 5 | Backend payment APIs | `/api/v1/orders/submit-order`, `[id]/collect-payment`, `[id]/payments`, refunds, credit-applications — all present, permission-gated. | **No change** for correctness (see rule). |
| 6 | Backend services | `order-submit-orchestrator.service.ts` enforces totals/settlement/credit/voucher/drawer. | **No change.** |
| 7 | B2B invoice/payment validation | **Resolved:** `b2bContractId`/`costCenterCode`/`poNumber` are in `submitOrderRequestSchema` *and* persisted by the orchestrator (`order-submit-orchestrator.service.ts:625-627`); server emits `B2B_CREDIT_HOLD`/`B2B_CREDIT_EXCEEDED`. Not UI-only. | **No change.** |
| 8 | Cash drawer/session validation | Server emits `CASH_DRAWER_SESSION_REQUIRED/SELECTION_REQUIRED/CLOSED`. | **No change** — UI guard mirrors these codes. |
| 9 | Gift card / promo / credit / overpayment services | Enforced server-side; overpayment via `OVERPAYMENT_RESOLUTION_*`; apply-credit gated by `orders:apply_credit`. | **No change** — reuse. |
| 10 | Permission constants / DB seed | Rich model exists: `orders:create`, `orders:collect_payment`, `orders:apply_credit`, `orders:process_refund`, `orders:approve_refund`, `orders:refunds_manual_exception`, `orders:verify_payment`, `orders:create_adjustment`, `orders:view_financial_breakdown`. | **No new permission** unless a restricted action needs one (see rule). |
| 11 | Idempotency / payload contract | `submit-order` requires an idempotency key; staking + hash-conflict + prior-attempt recovery; payload validated by `submitOrderRequestSchema`. | **No change** — payload frozen. |
| 12 | i18n | `messages/{en,ar}/**`. | **Add** keys for capabilities/reasons/dialogs. |
| 13 | Tests | Payload-fixtures oracle + suite. | **Add** registry/config/dialog/preset tests; oracle unchanged. |
| 14 | Docs & QA guides | ADR + Engine Architecture. | **Update** + new architecture & QA docs. |

**Exact repo references (record verbatim in `Payment_Modal_Implementation_STATUS.md` — clarification #2):**

| Area | File · symbol | Line(s) | Finding |
|------|---------------|---------|---------|
| Submit entry / auth / idempotency | `web-admin/app/api/v1/orders/submit-order/route.ts` · `POST` | `:66-257` | `requirePermission('orders:create')` + CSRF + `submitOrderRequestSchema.safeParse`; idempotency key **required**, staked pre-orchestrator, hash-conflict → 409, prior-attempt recovery. |
| Idempotency utils | `web-admin/lib/utils/idempotency.ts` · `hashPayload`/`findIdempotencyHash`/`stakeIdempotencyHash`/`storeIdempotencyHash`/`deleteIdempotencyHash` | — | Payload-hash + staking lifecycle owned by the route. |
| Orchestrator (business rules) | `web-admin/lib/services/order-submit-orchestrator.service.ts` · `submitOrder` | `:264` (called) | Recomputes totals; throws typed codes `AMOUNT_MISMATCH`, `SPLIT_AMOUNT_MISMATCH`, `DEFERRED_LEG_NOT_ALONE`, `OUTSTANDING_POLICY_REQUIRED`. |
| B2B credit check | `order-submit-orchestrator.service.ts` · `checkCreditLimit` | `:372-386` | `CREDIT_INVOICE` path → `B2B_CREDIT_HOLD` / `B2B_CREDIT_EXCEEDED` unless `creditLimitOverride`. |
| B2B field persistence | `order-submit-orchestrator.service.ts` (order create payload) | `:625-627` | `b2bContractId` / `costCenterCode` / `poNumber` persisted (not UI-only). |
| Credit-limit override audit | `order-submit-orchestrator.service.ts` | `:348`, `:377`, `:628-631` | **Today:** override honored from client boolean, not permission-gated. **Phase 0B:** hard-deny by default (client flag inert); gated re-enable is the deferred task. |
| Submit request schema | `web-admin/lib/validations/new-order-payment-schemas.ts` · `submitOrderRequestSchema` | `:500-505` | `b2bContractId`/`costCenterCode`/`poNumber`/`creditLimitOverride` in the frozen contract. |
| Drawer / overpayment / gateway validation | `submit-order/route.ts` (error→HTTP map) + orchestrator | `:425-436` | `CASH_DRAWER_SESSION_*`, `OVERPAYMENT_RESOLUTION_*`, `GATEWAY_NOT_CONFIGURED`, `PAYMENT_REFERENCE_REQUIRED`, `PAYMENT_TERMINAL_REQUIRED` → 422. |
| Client error surfacing | `web-admin/src/features/orders/hooks/use-order-submission.ts` · `infrastructureMessages` | `:607-646` | Existing server-code → i18n message map; the refactor extends this into server-code → capability-guard routing (hardening #2). |

**Verification tasks — resolved:**
- (a) **B2B fields persist server-side** — schema `:500-505` + orchestrator `:625-627`. Not UI-only. **No backend change.**
- (b) **Credit-limit override is server-enforced** — orchestrator `:377` throws `B2B_CREDIT_EXCEEDED` unless overridden; audited at `:628-631`. **No bypass** (permission-gating deferred, high-priority).

**Net: one approved backend change (Phase 0B, accounting-safety) — credit-limit hard-deny; no DB or payload-shape change. Everything else needs no backend/DB change.** Pin any remaining exact line for `checkCreditLimit`/drawer service during Phase 0 doc close-out.

**One pre-existing hardening opportunity (NOT caused by this refactor) — decision made:** the credit-limit override is *audited* but not *permission-gated* server-side. Per user decision it is a **deferred HIGH-PRIORITY** standalone task (see the deferred note in Phases and `Deferred_Backend_Tasks.md`), excluded from this program's scope unless separately approved, and explicitly tracked so it does not disappear.

## Frontend / backend separation (enforcement authority)

Dialogs **guide**; the engine + backend **enforce** — and the audit confirms the authority already exists. UI guards/reason codes **mirror** these; they never become the only gate:

| Concern | Authoritative enforcement (confirmed) |
|---|---|
| Drawer session validity | orchestrator → `CASH_DRAWER_SESSION_*` (422) |
| B2B credit hold / limit | orchestrator → `B2B_CREDIT_HOLD` / `B2B_CREDIT_EXCEEDED` (400). **Phase 0B: hard-deny by default — client `creditLimitOverride` no longer bypasses; override only via the future gated path (permission + explicit enablement).** |
| Split integrity | orchestrator → `SPLIT_AMOUNT_MISMATCH` / `DEFERRED_LEG_NOT_ALONE` |
| Outstanding policy | orchestrator → `OUTSTANDING_POLICY_REQUIRED` |
| Overpayment routing | orchestrator → `OVERPAYMENT_RESOLUTION_*`; apply-credit gated by `orders:apply_credit` |
| Totals integrity | orchestrator recomputes → `AMOUNT_MISMATCH` |
| Gateway / reference / terminal | orchestrator → `GATEWAY_NOT_CONFIGURED` / `PAYMENT_REFERENCE_REQUIRED` / `PAYMENT_TERMINAL_REQUIRED` |
| Idempotent submit / payload integrity | route: required key + hash-conflict + staking; `submitOrderRequestSchema` |

**Design tie-in:** the unified reason codes (explainability section) **map 1:1 to these server error codes** where one exists — so a blocked/required state in the UI names the same cause the server would reject with. New reason codes are added only for pure UX affordances (e.g. `SHOWN_GIFT_CARD_DETECTED`, `SUGGEST_FULL_*`) that have no server analogue.

## Backend & database rule

**No backend/DB change by default.** The audit shows enforcement is already server-side. Change backend/DB **only** if a verification task (above) proves an enforcement point is UI-only, or a restricted action genuinely needs a new gate — driven by correctness, security, accounting safety, or enforcement, never convenience. Any such change is added to this plan explicitly (files, migration, tests) before coding, and follows the migration workflow (create SQL → STOP → user applies).

## Permission rule

No permission is defined in TypeScript alone. Reuse the existing codes (audit #10). If a restricted action needs a **new** permission (candidate: manual-FX edit, if that capability is ever enabled — not in this phase), it requires all of: backend enforcement, DB seed/migration, tests, an i18n/support reason message, and documentation. If it cannot be added safely now, **stop and document it as a separate blocking backend/database task** rather than shipping a TS-only constant. Manual-FX edit is explicitly **deferred** — FX/rounding is read-only display this phase.

## Payload rule

The submit payload is **frozen** and validated by `submitOrderRequestSchema` + guaranteed byte-stable by the payload-fixtures oracle. Do not change its shape. If a real backend-contract gap is discovered (e.g. B2B fields captured in UI but absent from the submit schema — verification task a), **stop and document**: why the current payload is insufficient, affected frontend files, affected API/service files, migration impact, test impact, and a backward-compatibility plan — then get explicit approval before changing it.

---

## Supportability and explainability (reason codes)

Extend the reason-code idea beyond `NEEDS_ADVANCED_REASON` into a unified `payment/domain/payment-reasons.ts` registry covering **why shown / hidden / required / blocked / suggested**, e.g.:

- `SHOWN_GIFT_CARD_DETECTED` — gift-card action visible because a gift card is applied.
- `BLOCKED_SUBMIT_DRAWER_CLOSED` — submit blocked because the drawer is closed.
- `REQUIRED_B2B_PO_MISSING` — B2B dialog required because PO number is missing.
- `SUGGEST_FULL_SPLIT_AND_GIFT_CARD` — Full suggested because split + gift card are active.

Every capability state and every guard/suggestion carries a **reason code, never a hardcoded string**; message keys resolve codes to EN/AR text. Support/QA and the UI can always answer "why is this shown/blocked/suggested."

---

## Future additional views (Simple / Semi-Pro / Pro / Full / role- or tenant-specific)

A new view is **a preset + optional layout**, never new business logic:

1. Add a member to `PaymentPresetKey` (types already scaffold `SEMI_PRO`/`PRO`/`ACCOUNTANT`/`B2B_COLLECTION`/`MOBILE_POS`).
2. Write a preset descriptor: which capabilities are inline vs behind buttons vs hidden, and the layout.
3. (Optional) add a layout component if the arrangement differs; otherwise reuse the renderer.
4. Enable it via `getEffectivePaymentConfig` (code default now; DB/plan/role-driven later).

Because capabilities own availability/required/blocked/validation and the engine owns finance, a `PRO` or `MOBILE_POS` view inherits all correctness for free and differs only in composition. The same mechanism lets other screens (Collect Payment, Refund, wallet top-up, POS close) mount a preset over the same capabilities.

---

## Guardrails (every phase)

- **Payload frozen** — payload-fixtures oracle (jest, 8/8) stays green; no engine finance change.
- **`computeNeedsAdvanced` predicate + reason codes preserved**; consequence refactored into the registry/suggestion.
- **No backend/DB change by default** (cross-layer audit confirmed enforcement is server-side); change backend/DB only for a proven enforcement gap or a genuinely-needed new gate, per the Backend & DB / Permission / Payload rules below — never a TS-only permission.
- **Skills before code:** `/frontend`, `/i18n` (and `/database` only if a migration is required).
- **Cmx components only**; EN/AR + RTL mandatory.
- **Gates each phase:** `eslint --quiet` 0 · `tsc` 0 · `jest` green (incl. oracle 8/8) · `npm run build` ✓ · `npm run check:i18n` ✓.
- **Per-phase docs:** update `STATUS.md`, refresh affected docs, invoke `/documentation` at close.

## Current-state inventory (behavior to change, in `payment-full-view.tsx`)

| Ref | Change |
|-----|--------|
| `:750-753` | Remove render-time auto-escalation. |
| `:760-767` | `handleModeChange`: drop the Simple-return refusal. |
| `:1824` | `simpleDisabled={needsAdvanced}` → unlock (reserve for restricted-only). |
| `:1524-1543` | `handleSimpleMoreOptions/ManageDrawer/ChangePolicy` → capability dialog openers. |
| `:1550-1558` | Blocked submit → `SUBMIT_GUARDS` capability (disable CTA + reason), no switch. |
| `:1837-1856` | `autoEscalated` banner → dismissible suggestion driven by reason codes. |
| `payment-mode-toggle.tsx` | `simpleDisabled` semantics → restricted-only. |
| `payment-simple-view.tsx` | Becomes the `SIMPLE` preset composition; header comment corrected. |

## Phases (architecture-first, all merged together)

- **Phase 0 — Engine action facade + config boundary + kill-switch. ✅ DONE (`83147972`).** `PaymentEngineActions` typed facade (no behavior change); `resolvePaymentModalConfig` + `DEFAULT_PAYMENT_MODAL_CONFIG`; `PAYMENT_MODE_USER_CONTROLLED` in config. Oracle green.

- **Phase 0B — Backend: credit-limit hard-deny by default (APPROVED, in scope). ✅ DONE (`70eaafda`).** Change the orchestrator so exceeding a B2B credit limit is **denied by default even with permission** — the client `creditLimitOverride` boolean is **no longer honored as a bypass**. `order-submit-orchestrator.service.ts:377` becomes an unconditional `if (creditCheck.wouldExceed) throw B2B_CREDIT_EXCEEDED` (override only becomes possible later via the gated path). Load `/backend`. **No DB or payload-shape change** — `creditLimitOverride` stays in the schema but is inert until the gated path ships. Update orchestrator tests to assert hard-deny; add an i18n reason message; UI drops the override/warn affordance and renders B2B-credit-exceeded as a hard guard with reason code. **Backward-compat note:** any current flow relying on client-driven override loses it until the gated exception ships — a deliberate accounting-safety tightening.
- **(Deferred — HIGH-PRIORITY, must not disappear.)** The **gated override exception** is the standalone task in `Deferred_Backend_Tasks.md`: override is permitted **only** when BOTH (a) an explicit enablement policy/config (defaults **OFF**) and (b) the new `orders:override_credit_limit` permission hold — permission alone is never sufficient. Requires new permission + DB seed migration + explicit enablement setting + orchestrator gated check (re-honoring `creditLimitOverride` only under both gates, stamping `creditLimitOverrideBy`/`creditLimitOverrideAt` at `:628-631`) + tests + i18n + docs. Scheduled separately; does not block this program.
- **Phase 1 — Capability registry + unified reason codes + CapabilityContext. ✅ DONE (`3de3d66b`).** Pure, tested. Refactor `computeNeedsAdvanced` to feed the registry.
- **Phase 2 — Reusable primitives + dialog shell. ✅ DONE (`8728810a`).** Extract/confirm the 8 primitives; `PaymentCapabilityDialog` shell.
- **Phase 3 — Capability dialogs (domain-level). ✅ DONE (`eedf703`).** Split-tender, gift-card (+PIN), promo, customer-credit, B2B account-billing, cash-drawer selector, overpayment (wrap existing dialog), FX/rounding line, submit-guards. Typed actions only. **Done:** 3a facade legs+drawer (`e80f9258`) · split-tender (`5297a7f3`) · cash-drawer selector (`277e8778`) · gift-card +PIN (`898821e2`) · promo (`PROMO_CODE`) · customer-credit (`CUSTOMER_CREDIT`) · B2B account-billing (`B2B_ACCOUNT_BILLING`, required-gate) · overpayment wrap (`OVERPAYMENT_ROUTING`, reuses `PaymentExtraReceiptDialog`) · FX line (`FX_ROUNDING`, read-only inline) · PAY_LATER (balance-policy selector) · **registry `Dialog`/presentation wiring `eedf703`** (`capability-components.ts` `CAPABILITY_COMPONENTS` map + `hasCapabilityComponent` guard + barrel `index.ts`). Gates verified green (Bash restored 2026-07-09): wiring 5/5 · full payment module 24 suites / 206 tests · tsc 0 · eslint 0 · i18n ✓.
- **Phase 4 — Presets + view renderer (strangler decomposition). ✅ CORE DONE (2026-07-10).** … **4g ✅ DONE (QA-R4.5):** pay-extra top strip + hard overpayment gate — `resolveSupportsRetainedOverpayment` (intent ∧ method), strip under header, allocate-perm toggle ON, block OFF while excess > ε, cash change exempt, Collect/Simple parity. Normative: [`Pay_Extra_Top_Strip_QA_R4_5_Spec.md`](./Pay_Extra_Top_Strip_QA_R4_5_Spec.md).
- **Phase 5 — Behavior reversal + error routing. 🟡 IN PROGRESS.** Server-error→capability-guard routing ✅ (`routeServerErrorToGuard`, pure). **Behavior reversal WIRED ✅ (2026-07-10):** kill-switch consumed via `resolvePaymentModalConfig().userControlledMode`; auto-escalation + Simple-lock + handleModeChange-refusal gated off by default; `autoEscalated` banner → dismissible `PaymentModeSuggestion` (5/5 tests). **QA rounds 1/2/3 done (2026-07-10):** dialog amount focus, cash tendered/change per split leg + tendered-aware field, single-source `PaymentLegDetailFields` across Full/split/Simple, missing capability i18n keys. Gates green incl. `next build` (256 tests). Remaining: wire `routeServerErrorToGuard` into `use-order-submission.ts:607-646`; full manual QA. Original scope: Remove auto-escalation/lock (per inventory); user-controlled mode; dismissible suggestion; #8 guard; #3 B2B required dialog; restricted-class guards with reason codes. Extend the `infrastructureMessages` map into **server-error → capability-guard routing** so rejections render in the active view without forcing Full (hardening #2). Error boundary around dialogs (hardening #11); observability hooks (hardening #12).
- **Phase 6 — i18n, tests, gates.** EN/AR keys for capabilities/reasons/dialogs; **new** coverage only (per-layer + dialog + preset tests) — old-behavior tests were already rewritten in the phase that changed them (H4); oracle + full jest green; eslint/tsc/build.
- **Phase 7 — Docs & closeout.** Invoke the `/documentation` skill to **generate all needed docs**; flip the ADR "Follow-up (post-amendment)" note to *aligned*; update `Payment_Modal_v4_Engine_Architecture.md` + `Payment_System_Architecture.md`; correct the Simple-view header comment; write `Payment_Modal_Amendment_Manual_QA_Guide.md`; finalize `Payment_Modal_Implementation_STATUS.md`. **Record the kill-switch removal as an explicit tracked follow-up** (temporary `PAYMENT_MODE_USER_CONTROLLED` + old auto-escalation code deleted after QA sign-off, before production hardening) in `Deferred_Backend_Tasks.md` / STATUS — it must not be forgotten.

**Cross-cutting cadence (every phase — clarifications #9/#10/#11):** after each step/phase, (a) update `Payment_Modal_Implementation_STATUS.md` with progress, findings, and gate results; (b) refresh any documentation the change touched (permissions, i18n keys, capability list, presets, reason codes, architecture). The final Phase-7 `/documentation` pass generates/reconciles all remaining required docs. Each phase ends only when gates are green and STATUS + docs are updated (DoD, hardening #14).

## Production-readiness hardening (self-audit — gaps closed)

These are mandatory acceptance criteria, not optional polish:

1. **Full-view decomposition is a strangler, not a rewrite** (ADR rejects rewrite). The capability renderer is introduced behind the kill-switch; the existing `payment-full-view.tsx` is routed through capabilities **section by section**, with the payload oracle green at every step. No big-bang replacement; behavior freeze holds throughout. This is the program's top risk — sequenced explicitly in Phase 4.
2. **Server-error → capability-guard routing.** Reuse and extend the existing `infrastructureMessages` map (`use-order-submission.ts:607-646`): each server `errorCode` maps to a **capability + reason code** so a server rejection renders as the in-view guard (Simple stays selected — no forced Full), with a safe generic fallback for unknown codes. Server truth and UI guidance never diverge.
3. **Capability availability derives from real gates, never blanket re-enable.** `isAvailable` reads the existing checkout-options catalog (`catalog` / `deriveSimpleModeMethodOptions`, which already reflect tenant settings / feature flags / plan limits consumed via HQ API) **and** client `hasPermission` (e.g. apply-credit → `orders:apply_credit`). Server still enforces; UI only hides what the user/tenant can't use. No new flags, read-only consumption.
4. **State-survival invariant (ADR).** A partially-typed amount and any in-progress capability input survive mode switch **and** dialog open/commit/cancel (engine owns state). Explicit tests: "type 50 in Simple → open Split/Full → 50 persists"; dialog cancel restores prior engine state.
5. **Simple method reconciliation.** With auto-escalation gone, advanced methods must stay reachable — the `SIMPLE` preset shows common methods inline and routes the rest through capability dialogs; `deriveSimpleModeMethodOptions` is re-expressed as preset metadata, not a hard filter that hides methods with no path.
6. **Accessibility + keyboard.** Every dialog: focus-trap, focus-return to the launching control, `aria-modal`/labelledby, `Esc` to close; suggestion and guards in polite live regions; RTL focus order verified. Integrate `use-payment-shortcuts.ts` (Enter submit, shortcuts to open capability dialogs) with **no shortcut conflicts**. Pass the mandated React-lint checklist (`docs/dev/rules/react-lint-verification-checklist.md`).
7. **Async / loading / error / empty per dialog.** Gift-card fetch, promo validation, stored-value/advance balance, drawer-session list each render loading/error(retry)/empty states, with stale-response/abort guards (`react-effects-patterns.md`) — no setState-after-unmount, no stale writes.
8. **Oracle coverage per capability.** Add payload-fixture scenarios proving each capability path (split, gift card, credit, overpayment, B2B, drawer) yields a **byte-identical** payload to the pre-refactor path. Oracle stays authoritative.
9. **Collect Payment non-regression.** `usePayExtraCheckout` is shared with `order-collect-payment-modal.tsx`; add a regression test + smoke so extraction/typing changes don't regress Collect Payment.
10. **Kill-switch scope is narrow.** `PAYMENT_MODE_USER_CONTROLLED` gates only the decision layer (auto-escalate+lock vs user-controlled+suggest); both branches reuse the same capabilities/dialogs/views — no duplicated dialog logic. Post-QA removal + dead-code deletion is a tracked task (Phase 7 follow-up).
11. **Error boundary.** Wrap capability dialogs so a dialog-level crash surfaces a recoverable error without losing payment state or crashing the modal.
12. **Observability — safe metadata only.** Log (existing `logger`) capability-dialog opens, suggestion accept/dismiss, and guard blocks using **only** safe metadata: capability key, reason code, event type, and allowed IDs per the existing logging policy. **Never** log card numbers, gift-card codes/PINs, customer-credit identifiers, payment references, or full payloads.
13. **Responsive/tablet preserved.** Presets and dialogs keep the existing responsive behavior (2-pane / rail slide-over / docked summary); dialogs are tablet-usable now (MOBILE_POS preset deferred but unblocked by the architecture).
14. **Security + Definition of Done.** Run `/security-review` before merge (payment-critical). Per-phase DoD: gates green (eslint/tsc/jest incl. oracle/build/i18n) · a11y + RTL checked · docs + STATUS updated · no dead code introduced.

## Task documents (under `docs/features/Order_Fin/Payment_Modal_08_07_2026/`)

- `README.md` (scaffolded) · `Payment_Modal_Implementation_Plan.md` (this plan expanded) · `Payment_System_Architecture.md` (layers, capability registry, config boundary, extension guide) · `Payment_Modal_Implementation_STATUS.md` (updated after **every step** — progress, exact audit refs, gate results) · `Payment_Modal_Amendment_Manual_QA_Guide.md` (Phase 7) · `Deferred_Backend_Tasks.md` (credit-limit-override permission gate + kill-switch removal — standalone/tracked, out of scope here).

## Test organization

- **Pure (no React):** registry rules, `CapabilityContext` projection, config resolver + default config, reason-code mapping, `computeNeedsAdvanced`, engine action facade.
- **Component:** each capability dialog (engine-action interaction, guard/required rendering), primitives.
- **Composition:** `SIMPLE` shows the fast lane + right buttons; `FULL` shows the workbench; suggestion appears/dismisses; restricted gate blocks submit.
- **Authoritative:** payload-fixtures oracle unchanged and green (finance freeze proof).

## Verification (end-to-end)

1. `cd web-admin && npm run dev`; open an order → Payment.
2. Drive each capability with **Simple staying selected**: exact cash (no chip) · split cash+card · gift card + PIN · apply credit · overpayment routing · >1 open drawer (selector) · drawer blocked (CTA disabled + reason) · B2B account-billing missing fields (required dialog) · toggle to Full and back (never locked).
3. Confirm **identical payload** vs pre-change — oracle green.
3b. **Credit-limit hard-deny (Phase 0B):** a B2B order exceeding the credit limit is **denied even with a client override flag set** (`B2B_CREDIT_EXCEEDED`); UI shows the hard guard + reason, no override affordance.
4. Flip `PAYMENT_MODE_USER_CONTROLLED` off → old auto-escalation returns (kill-switch works, same dialogs).
5. Confirm every shown/hidden/blocked/suggested element exposes a **reason code**, and a forced server rejection (e.g. close the drawer, then submit) renders the **in-view guard** — Simple is not ejected to Full.
6. **State survival:** type an amount in Simple → open a dialog / toggle Full → value persists; cancel a dialog → prior engine state restored.
7. **A11y/keyboard:** each dialog traps focus, returns focus on close, closes on `Esc`; suggestion/guards announced; keyboard shortcuts open dialogs with no conflict; RTL focus order correct in Arabic.
8. **Collect Payment** smoke — unaffected by the shared-hook extraction.
9. Gates: `npx eslint . --quiet` · `tsc` · `npm test` (oracle + suite) · `npm run build` · `npm run check:i18n` · `/security-review`. RTL pass in Arabic.

# B34 — Refund Back-office UI

## Metadata
Backlog ID: B34 · Severity: HIGH · Classification: BLOCKS_FEATURE / CONTROL_GAP · Status: **IMPLEMENTED 2026-07-18** — flagged implementation against the B1 contract complete; all gates + contract checks green (see Completion evidence); flag `order_fin_refund_ui` disabled by default everywhere; **awaiting owner commit → Preview QA (flag-on) → approval**; production activation gated per Safety block (D002/D003 APPROVED (Expert) 2026-07-16, v2)
Authoritative report sections: Addendum A1, §8, §43, §50-B34
Required decisions: [D002](00_Phase_0_Financial_Semantics/D002_Refund_Source_Classification.md), [D003](00_Phase_0_Financial_Semantics/D003_Refund_Reopen_Due_Rules.md) (policy — UI must display/collect the approved v2 semantics)
Dependencies: [B01](B01_Refund_Lineage_And_Reopen_Due.md) (hard for activation — classification/context/reopen contract), [B02](B02_Shared_Financial_Aggregation.md) (hard for activation — one aggregation authority), [B27](B27_Financial_Permissions_And_Approvals.md) (impl — permission-sensitive actions: rebill, manual exception), [B09](B09_Refund_Execution_Parity.md) (hard for cash/original-method activation only)
Blocks: — · Recommended phase: Seq 2–3 (design + flagged implementation; activation per Safety block)

## Confirmed problem
The refund maker-checker workflow is API-complete but UI-absent (Addendum A1): `initiateOrderRefund` has zero callers, `/dashboard/internal_fin/refunds` is read-only, and the only way refund rows come into existence is the cancel-order REFUND disposition. Users cannot refund a live order or approve/process pending refunds from any screen.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| app/actions/billing/refund-actions.ts:123 | initiateOrderRefund server action | zero UI callers |
| src/features/billing/ui/refunds-list-client.tsx | read-only table | no initiate/approve/process actions |
| app/api/v1/orders/refunds/[refundId]/approve\|process | stage endpoints live | unreachable from UI |
| cancel-order-dialog.tsx | REFUND disposition on cancel | only creating path |

## Required outcome (full-cycle rule)
End-to-end usable refund workflow: **initiate** from order detail (Financial tab) with payment/credit-leg picker supplying lineage (D002 v2 — UI never picks the classification, only the source leg), amount with live cap display, destination + reason, and the D003 v2 **reason-context selector** (STANDARD / PRICE_ADJUSTMENT_GOODWILL; REFUND_AND_REBILL shown only to holders of the B27 rebill permission, with an explicit inline warning that it reopens the amount due and a mandatory reason — a normal refund never silently reopens due); **approval queue** (pending-approval list, approve/reject with reason); **process** action with result feedback; refunds hub upgraded from read-only to actionable; EN/AR i18n; Cmx components; permission-gated per action (`orders:process_refund` / `orders:approve_refund` + B27 codes for rebill/manual exception, maker≠checker enforced visually and server-side).

## Scope
Screens/dialogs + hooks + server-action/API wiring; navigation entry (dual-write rule); access contracts + page-access registry; i18n keys; receipt/print link-through for processed refunds.

## Out of scope
Classification/reopen write logic ([B01](B01_Refund_Lineage_And_Reopen_Due.md)); drawer/voucher/gateway execution ([B09](B09_Refund_Execution_Parity.md)); new permission codes ([B27](B27_Financial_Permissions_And_Approvals.md)); pending-payment worklist ([B30](B30_Pending_Payment_Backoffice_Lifecycle.md)).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO (UI drives existing service; snapshot effects belong to B1) |
| Reconciliation | NO |
| Customer receipt | YES (refund receipt access) |
| Audit/outbox | YES (user-driven stage actions now actually occur) |

## Acceptance criteria
A user with the right permissions can, from screens alone: refund part of a live order against a chosen payment leg, see caps enforced live, watch it appear in the approval queue, approve as a second user, process it, and see the outcome on the order Financial tab and refunds hub — with maker-checker impossible to self-complete, all texts bilingual, and no raw API usage required.

## Required tests
UI, API (action wiring), integration (full three-stage flow), idempotency (double-click safety), regression, access-contract checks, i18n check.

## Dependencies and sequencing
Design and flagged implementation target the **B1 contract** (D002 v2 lineage/classification, D003 v2 reason-context) — B34 must **not** be built or activated against the current pre-B1 API, whose refund semantics are known-unsafe. The flag stays disabled by default in every environment; Preview/staging activation only for QA against B1+ builds; production activation strictly per the Safety block. Coordinate the leg-picker lineage contract with D002 v2.

## Delivery surfaces

Backend services: none new — consumes existing initiate/approve/process services; B1 adds fields it displays
Database/schema: none
API/endpoints: existing three-stage endpoints; initiate gains required key + refundContext with B1
Frontend page/screen/dialog/action: (1) Initiate Refund dialog from order Financial tab — payment/credit-leg picker (lineage), amount with live remaining-cap display, destination, D003 refund-context selector, reason; (2) Approval queue screen (pending-approval list with order/customer/amount/requester, approve/reject with reason); (3) Process action with outcome feedback; (4) refunds hub upgraded from read-only to actionable; loading/empty/error/retry/success/disabled states throughout
Reusable components/helpers: leg-picker (payments/credit-apps tables reuse), approval dialog (B27 pattern), amount input with cap hint
Permissions: `orders:process_refund` (initiate/process), `orders:approve_refund` (approve); maker≠checker enforced server-side and reflected in UI (self-approval buttons disabled with reason)
Validation: client mirrors caps/lineage rules; server remains authoritative; double-click safe (per-attempt key)
i18n/RTL: full EN/AR for all dialogs/queue/statuses; RTL layouts
Accessibility: dialogs focus-trapped; cap and error text associated to inputs; queue keyboard-navigable
Audit trail: stage actions carry actor + reason (existing service audit); UI surfaces the trail on the refund row
Observability: stage funnel counts (initiated/approved/processed/rejected)
Jobs/workers: none
Feature flag: `order_fin.refund_ui` — disabled by default in every environment
Rollout: design now; implementation behind the disabled flag against the B1 contract; Preview/staging activation only for QA on B1+ builds; production activation strictly per Safety block (B01+B02 VERIFIED; B09 for cash/original-method; B27 for permission-sensitive actions)
Rollback: flag off → read-only hub returns; no data effects

## End-to-end operational flow

1. User opens Initiate Refund on an order → picks the source leg → enters amount (cap shown live), destination, context, reason → submits with attempt key.
2. Refund appears in the approval queue; a different user approves (self-approval blocked visibly and server-side).
3. Processor executes → outcome shown (destination result); order Financial tab and refunds hub update; receipt/print reachable (B9 adds the voucher artifact).
4. Errors are explicit (cap exceeded, lineage mismatch, conflict on retry); every action is audited and replay-safe.

## Safety

UI design allowed: YES (now)
UI implementation allowed: YES — behind the `order_fin.refund_ui` feature flag, **disabled by default in every environment**; no build against the pre-B1 API
Production activation allowed: **NO for any refund workflow until B01 AND B02 are both VERIFIED** (correct facts + one aggregation authority). **Cash and original-method refund actions additionally stay disabled until B09 is VERIFIED** (until then they are record-only and the UI must label that honestly or hide them)
Required backend gates: B01 VERIFIED + B02 VERIFIED (all refund workflows); B09 VERIFIED (cash/original-method execution)
Required decision gates: D002, D003 APPROVED (Expert) — recorded (v2 semantics)
Required permission gates: permission-sensitive actions (REFUND_AND_REBILL, manual exception, approval thresholds) gated by the applicable [B27](B27_Financial_Permissions_And_Approvals.md) codes before those actions are enabled
Required verification gates: B1 §14 matrix green; B34 UI/idempotency/access-contract tests green; Preview QA approval recorded

## Completion evidence

**Migration:** none (no schema/nav changes — the approval workbench lives inside the existing `/dashboard/internal_fin/refunds` route, so the dual-write navigation rule is not triggered; if the owner wants a separate sidebar item later, that is a small `/navigation` follow-up).

**DONE (2026-07-17/18 overnight):**
- Flag: `order_fin_refund_ui` added to `lib/types/tenant.ts` (FeatureFlags) + `lib/constants/feature-flags.ts` FLAG_CATALOG (independent, default **false** — key normalized from the spec's `order_fin.refund_ui` to catalog snake_case). **HQ-side seeding into `hq_ff_feature_flags_mst` is a cleanmatexsaas follow-up** (until then resolution returns the false default everywhere).
- Maker≠checker: `approveRefund` service guard (requester cannot approve own refund → typed 403 `REFUND_SELF_APPROVAL_BLOCKED`, new REFUND_ERROR_CODES entry); approve/process routes map `RefundValidationError` to code+status.
- Initiate dialog: `src/features/orders/ui/order-financial/refund-initiate-dialog.tsx` (Cmx components; leg picker from COMPLETED real payments + APPLIED credits with live per-leg remaining caps; goodwill option with mandatory reason; CmxMoneyField amount with cap hint + inline errors — no silent money mutation; destination select with record-only labeling for CASH/ORIGINAL_METHOD pre-B09; context selector limited to STANDARD/PRICE_ADJUSTMENT_GOODWILL pre-B27; reason-code select; per-attempt idempotency key; loading/error/success states) + pure model `src/features/orders/model/refund-initiate.ts` (cap math via the B02 aggregation module, validation, attempt key).
- Financial tab wiring: `order-payments-credits-tables.tsx` — flag+permission-gated "Refund…" button + dialog mount (`useFeature('order_fin_refund_ui')` + `orders:process_refund`).
- Refunds hub: `refunds-list-client.tsx` rewritten actionable (Approve on PENDING_APPROVAL with self-approval disabled+reason, Process on APPROVED; confirm dialog; double-click-safe; typed error mapping; permission-gated via `orders:approve_refund`/`orders:process_refund`); `app/dashboard/internal_fin/refunds/page.tsx` passes flag state + current user id.
- i18n EN/AR: `orders/detail.json` → `refunds.initiate.*` (full dialog) + `REFUND_SELF_APPROVAL_BLOCKED`; `billing.json` → `refunds.actions.*` + `refunds.errors.*`.
- Access contracts: `/dashboard/internal_fin/refunds` gains approve/process actions (+flag) and PATCH apiDependencies; `/dashboard/orders/[id]` gains `initiateRefund` action (+flag) and the POST refunds apiDependency.
- Tests: `__tests__/features/orders/refund-initiate-model.test.ts` (caps/validation/whitelist/attempt-key) + maker≠checker service tests — 23/23 green.

**Gates + contract validation (2026-07-18 — all green):**
- `npx tsc --noEmit`: clean except the 2 known pre-existing errors in owner-committed keypad/split-tender files (outside this program; the earlier useMessage API fallout in B34 files was found and fixed [showSuccess/showError]).
- `npx eslint . --quiet`: 0 errors.
- Full jest: **1946 passed / 1960** — the 14 failures are exactly the 4 known pre-existing suites (cash-drawer.service, cash-drawer-close-preview, order-calculation.service, credit-note-picker-focus), all from owner keypad/split-payment/promo commits; zero program fallout.
- `npm run build`: success (full route manifest emitted).
- `npm run check:i18n`: passed (4 pre-existing benign same-EN/AR warnings).
- `npm run check:ui-access-contract -- --route=/dashboard/internal_fin/refunds --wire`: PASS (1 contract, page gate OK). Same for `--route=/dashboard/orders/[id]`: PASS (4 contracts, page gate OK + 3 N/A, 4 API gates OK). Note: run these from the repo root with PowerShell — Git Bash mangles the `/dashboard/...` route argument (MSYS path conversion) into a false 0-route PASS.
- `npm run sync:ui-access-contract`: complete — reconcile drift 0, all generated views refreshed. `npm run check:platform-info-inventories`: 10/10 tests passed.

**Deferred (recorded gaps):** reject-with-reason action (needs a small `rejectRefund` service/status transition — B34 declares "no new backend services"; propose with B27/B30 wave) · REFUND_AND_REBILL + MANUAL_EXCEPTION UI actions (B27 permission codes) · refund receipt/print artifact (B09 voucher) · HQ flag seeding (cleanmatexsaas).

**Commit:** — (owner) · **Preview QA:** — pending (flag enabled on Preview only for QA per Safety block) · **Verification:** — (production activation requires B01+B02 VERIFIED)

# 10 — UI Workflow and Document Output Findings

Assessed against: easy to learn/use, GCC + worldwide POS patterns, mistake-prevention on sensitive actions, clarity of totals/statuses/next actions, EN/AR + RTL, responsive behavior.

## Payment Modal v4 (New Order checkout) — 🟢 strong; the reference surface

Architecture: one engine (`use-payment-engine.ts`) with two faces — Simple (default) and Full — per `Payment_Modal_v4_Engine_Architecture.md` + `ADR_payment_modal_single_engine_two_mode.md`.

What meets or exceeds market standard:
- **Simple-by-default cashier flow** (cash-first method chips capped at 3, hero amount editor, quick-tender chips, collapsible keypad) with **auto-escalation** to Full on 9 priority-ordered reason codes (split, customer credit, B2B invoice, gift/promo, overpayment routing, PIN, drawer ambiguity/block, currency rounding) — this is exactly the "fast lane + guarded advanced lane" pattern good POS systems use; escalation reasons are named to the user (amber `role="status"` banner).
- **Mistake prevention:** Simple can never fork finance (consumes shared engine handlers only); submit blocked in Simple escalates then runs focus-first-blocking; keyboard shortcuts (Enter/F2/Ctrl+Enter) hard-disabled while busy/blocked/nested-dialog-open; mode flips never drop state; Simple segment disabled (with tooltip) while `needsAdvanced` holds.
- **Contract safety:** `buildPaymentPayload` is pure and frozen by an 8-fixture deep-equality oracle — UI refactors cannot silently change what gets posted.
- **Responsive:** md–xl 2-pane with sticky tools; <xl rail becomes an RTL-aware slide-over + `PaymentDockedSummaryBar` (Final Total + Change always visible); xl+ 3-column. Tablet-cashier viable.
- **EN/AR:** mode/quick-tender/a11y key sets shipped in both locale trees; `check:i18n` green.

Open (not defects): manual QA for escalation scenario #9 and the tablet visual pass still pending a running app (R-05).

## Order details (full view) — 🟠 one contradiction, otherwise good

- Financial summary panel + Financial tab read the canonical snapshot (totals, credit vs paid separation, VAT lines, warnings) — clear and audit-friendly.
- ❌ **FN-01 UX consequence:** the **Payments tab** (fed from `_tr`, `order-details-full-client.tsx:1296-1297`) can contradict the Financial tab centimeters away. An operator reconciling a dispute sees two different payment lists on one screen. This is the single worst UX defect found — not because of layout, but trust.
- Tabs (Vouchers/Receipts/Invoices/Edit history) give good traceability of the financial audit trail.

## Collect payment (later collection) — 🟢

Preview-before-post, per-event idempotency key (double-click safe), overpayment resolution required before submit, canonical field separation — meets the bar (baseline + Phase 5 verification).

## Refund / adjustment / cancel — 🟠 policy gaps, not widget gaps

- Refund: initiate→approve→process with separate permissions (`orders:process_refund` vs `orders:approve_refund`) — good maker-checker shape.
- ❌ **FN-02 UX consequence:** cancelling a **paid** order gives the operator no disposition step (refund vs store credit), no warning that money remains on the order, and failures in the (legacy) unwind are silent. Worldwide-standard flow: cancel of a paid order must show "This order has X paid — choose refund / store credit / keep on account (approval)".
- Adjustments: exist behind `orders:create_adjustment` with audit rows; fine.

## Receipt allocation (pay-extra / customer receipts) — 🟢

Auto-allocation preview with policy + cap + fallback matrix; manual drawer with over-allocation guard (submit disabled both directions + warning, added Phase 5); blocked-fallback path surfaces a BLOCKED warning instead of silently parking money. Good control design.

## Reports hub + reconciliation — 🟢 structure / ❌ FN-01 content

- Reconciliation reports distinguish not-loaded vs loaded-empty, date-window filters with aria-labels, CSV export, exception thresholds — usable by finance without training.
- The tenant **Payments report's numbers are wrong** while FN-01 stands (under-reports canonical collections) — content, not layout.
- Branch filter exists in recon APIs 3–4 but not in the client (known, deferred) — fine.

## Document outputs (prints)

- Order invoices+payments print: shared money formatter, explicit `−` for negatives, RTL-aware — good pattern; payment rows inherit FN-01.
- AR invoice + customer statement prints: clean layout, translated labels; ⚠ FN-11 `ar-OM`/`en-OM` hardcoding mis-formats numbers/dates for non-Omani tenants — visible to end customers on fiscal documents, so fix despite LOW code cost.

## Cross-cutting UX verdicts

| Question | Verdict |
|---|---|
| Easy to learn (cashier)? | ✅ Simple mode is a genuine fast lane; escalation teaches the advanced lane progressively |
| Totals/balances hard to misunderstand? | ✅ on canonical surfaces (one Final Total, change vs overpay separated); ❌ on `_tr` surfaces (FN-01) |
| Sensitive-action protection? | ✅ payment/refund/allocation; ❌ cancellation (FN-02) |
| Confirmation + traceability of financial changes? | ✅ vouchers/audit/warnings; cancel path is the exception (console.warn) |
| EN/AR + RTL? | ✅ throughout inspected surfaces; locale-region hardcode in 2 prints (FN-11) |
| Overengineering? | None found in v4 — the two-mode design *reduces* daily complexity. The avoidable complexity in the system is the dual ledger + dual cash-recon (FN-01/FN-06) and the near-duplicate route/ADR pairs — cognitive load for maintainers rather than end users. |
| Simplification opportunities | Retire cash-up UI (FN-06); collapse Payments tab into the canonical Financial tab's payment list once repointed (one payment list per order, one source). |

# Payment Modal — Manual QA Checklist (composable-capabilities program)

**Purpose:** the remaining human verification before merge. Work top-to-bottom; write your notes in the **Notes / result** column of each item (this file is yours to annotate — commit it with your findings).

Canonical rule reference: `docs/dev/rules/no-silent-money-mutation.md`

**Where:** Vercel **preview** deploy of `feature/payment-modal-composable-capabilities` (never production/main).
**Before starting:** confirm the preview build's commit hash on the Vercel deployment card matches the latest branch commit — a stale preview invalidates the whole pass.
**Data:** the preview uses the shared Supabase — use the demo tenant as usual.

Legend: `[ ]` not run · `[x]` pass · `[!]` FAIL (add a note + screenshot)

---

## 1 · Mode reversal (core ADR behavior)

| # | Check | Steps | Expected | Notes / result |
|---|-------|-------|----------|----------------|
| 1.1 | No auto-escalation | Open payment modal on a "complex" order (B2B customer, or apply a gift card / split) | Modal opens **Simple** and STAYS Simple; no automatic jump to Advanced | [ yes] |
| 1.2 | Suggestion appears | Same state | Dismissible banner "Advanced options may help — {reason}" (not the old amber escalation banner) | [ yes] |
| 1.3 | Suggestion accept | Click "Switch to Advanced" | Goes to Advanced | [ yes] |
| 1.4 | Suggestion dismiss | Click the ✕ on the banner | Hidden; stays hidden until modal is closed and reopened | [yes ] |
| 1.5 | Toggle never locked | Switch Simple↔Advanced repeatedly | Both segments always clickable; Simple never disabled | [ yes] |
| 1.6 | State survival | Type 50 in Simple → switch Advanced → back to Simple | The 50 (and any applied gift/promo/credit/split legs) is still there | [ yes] |

My Notes:
MISSING_MESSAGE: newOrder.payment.expressLabel 

## 2 · Simple quick-actions ("More ways to pay")

| # | Check | Steps | Expected | Notes / result |
|---|-------|-------|----------|----------------|
| 2.1 | Buttons per availability | Look at the quick-action card | One button per available capability (Cash+card, Split payment, Gift card, Promo code, Store credit, Pay later; **Account billing** on a B2B customer; **Route extra amount** when overpaid); REQUIRED badge when a capability is required | [ yes] |
| 2.1b | B2B in-place *(new 2026-07-10)* | B2B customer in Simple → click Account billing | B2B dialog opens **over Simple** (no mode switch): contract dropdown, cost center, PO number; read-only credit status when a limit exists; fields persist to Advanced inspector tab (shared form) | [yes ] |

| 2.1c | Overpayment in-place *(new 2026-07-10)* | Overpay (pay-extra ON) in Simple → click Route extra amount | Extra-receipt routing dialog opens **over Simple**; choosing a destination works exactly as from Advanced | [ ! No] | in both simple and advance when choose destination it still showing the same no state change, see screenshots with file names 2.1c_xx

| 2.2 | In-place dialogs | Click each button | Its dialog opens **over Simple**; closing returns to Simple with state intact | [ ! No] | see screenshots with file names 2.1c_xx

| 2.3 | Split dialog focus | Open split, add a leg, change a leg's method | Cursor lands in the **active leg's own amount field** each time (never the background editor) | [ yes] |

| 2.4 | Split cash leg | Cash leg, tender more than due (e.g. 10 vs 7 due) | Field shows the TENDERED amount; "Cash Tendered / Change Returned" chips below show tendered and change | [ yes] |

| 2.5 | Split over-allocation label | Make legs total exceed the order total with a CARD leg (e.g. card 10 on a 7.897 order) | Balance line shows **"Over {amount}"** in red — NOT "Fully Allocated" *(fixed in QA round 4 — re-verify)* | [ yes] |

| 2.6 | Dialog cancel/Done | Cancel and Done from each dialog | Engine state never lost either way | [ !] | there is no Cancel button And I want all windows to be movable 

## 3 · Per-method leg fields (single-source component)

| # | Check | Steps | Expected | Notes / result |
|---|-------|-------|----------|----------------|
| 3.1 | Advanced: card | Card leg in Advanced | Terminal (if required), brand, last-4, auth code — entry works exactly as before the swap | [ yes] |
| 3.2 | Advanced: check | Check leg | Number / bank / due-date; past date rejected | [ yes] |
| 3.3 | Advanced: transfer + gateway | Bank-transfer and gateway legs | Reference field; gateway code/txn-id/reference | [ yes] |
| 3.4 | Simple parity | Card / gateway method in Simple | Same fields render under the amount editor; cash shows tendered + change | [ yes] |
| 3.5 | Chip limit | Simple method chips | Max **3** chips + "More options" | [ yes] |

## 4 · Server-error → in-view guard (new)

| # | Check | Steps | Expected | Notes / result |
|---|-------|-------|----------|----------------|
| 4.1 | Closed-drawer repro | Cash order → close/end the drawer session from another tab → Submit | Toast **plus** a red guard banner above Cancel/Submit naming the same cause, with a "Cash drawer" button that opens the session dialog | [ yes] |
| 4.2 | B2B credit exceeded | B2B customer, bill-to-account beyond limit → Submit | Guard routed to Account billing; corrective button opens the **B2B account-billing dialog in-place** in BOTH faces *(changed 2026-07-10 — was a "Switch to Advanced" hop)* | [ no] | where is the corrective button opens the **B2B account-billing dialog in-place**
| 4.3 | Guard lifecycle | After a guard shows: fix the issue, Submit again | Guard clears on the new attempt; does not reappear after close/reopen | [ ] |
| 4.4 | Both faces | Trigger a guard, flip Simple↔Advanced | Banner visible in both (shared footer) | [ ] |
| 4.5 | Generic errors | Force a non-typed failure (e.g. network drop) | Toast only — no guard, no view switch | [ ] |

## 5 · Odds and ends

| # | Check | Steps | Expected | Notes / result |
|---|-------|-------|----------|----------------|
| 5.1 | FX line | Non-base-currency order (exchange rate ≠ 1) — skip if single-currency | "Currency & rounding — Exchange rate" line at top of the Advanced payment-tools rail | [ ] |
| 5.2 | Blocked submit in Simple | Submit with a blocker active | Opens Advanced to fix (user-initiated); no "we escalated you" banner | [ ] |
| 5.3 | RTL | Switch to Arabic; walk sections 1–4 | Suggestion, quick-actions, dialogs, guard banner: correct alignment/icon side; no raw i18n keys | [ ] |
| 5.4 | Narrow / tablet | Window below ~1280px | Receipt rail becomes slide-over; docked total/change bar shows; guard banner doesn't break the footer | [ ] |

---

## QA round 4 — findings from 2026-07-10 screenshots (cash leg + state)

Scenario reproduced: order total **7.897**, split with **CARD 10.000** + **CASH tendered 50.000**.

**What the numbers mean (all internally consistent, but shown with different definitions):**

| Display | Value | Definition |
|---|---|---|
| Cash leg "Applied" | 0.000 | Card 10 already covers the 7.897 due, so the engine caps the cash leg's applied amount at the remaining balance = 0 |
| Cash leg "Cash Tendered / Change Returned" | 50.000 / 50.000 | Per-leg cash-back: tendered − applied (50 − 0). Give the whole 50 back |
| Receipt "Total Settled Now" | 7.897 | Amount applied **to the order** (capped at due) |
| Receipt "Change" | 0.000 | The rail's change definition (resolved change toward the order), **not** the per-leg cash-back — see finding 4.2 |
| Submit label | 10.000 | `settledNowAmount` = sum of real legs (card 10 + cash 0) incl. the unresolved 2.103 overpay |
| Guard "return OMR 2.103" | 2.103 | Card overpay (10 − 7.897): card can't give change, so it must be resolved (reduce, or route via Extra amount) — this blocks submit, correctly |

**Findings:**

- **4.1 — FIXED (this commit): split dialog said "Fully Allocated" while legs over-allocated** (legs 17.897 vs due 7.897). Root cause: the dialog's 'over' branch read `remainingBalance < 0`, but the engine floors `remainingBalance` at 0 — the branch was unreachable. Now detected from `legsTotal − amountDue`; shows **"Over {amount}"** in red. Re-verify via item 2.5.
- **4.2 — OPEN (UX decision): two "change" definitions visible at once.** The cash-leg chip says "Change Returned 50.000" while the receipt says "Change 0.000". Both are defensible (per-leg cash-back vs order-level resolved change), but side-by-side they read as a contradiction. Options: (a) relabel the leg chip when applied = 0 (e.g. "Not applied — return OMR 50.000"), (b) make the rail Change row show total cash-back. **Recommendation: (a)** — display-only, no money-math change. → your call: ______
- **4.3 — OPEN (UX decision): a zero-applied cash leg still looks like an active payment.** The Simple amount editor shows 50.000 for a leg contributing 0.000. Recommendation: when `applied = 0 ∧ tendered > 0`, show an explicit inline note "This cash is not needed — the order is covered by other methods" (display-only, i18n EN+AR). → your call: ______
- **4.4 — OPEN (informational): submit label vs rail.** "Submit — OMR 10.000" (real legs incl. overpay) vs "Total Settled Now 7.897" (applied). Legacy pre-program semantics, blocked anyway until the 2.103 is resolved — suggest leaving as-is unless it keeps confusing cashiers. → your call: ______

- **4.5 — APPROVED DESIGN (2026-07-10, user-approved): pay-extra top strip + hard overpayment gate.** To implement after this checklist pass, as the `OVERPAYMENT_ROUTING` inline surface through the capability renderer (strangler 4g):
  1. **Top-of-workbench strip:** "Customer is paying extra" toggle + read-only mirror "Extra: OMR X → destination" (never an editable second money field). Amber while unresolved, emerald once resolved — never red (red = blocked/error only).
  2. **Hard gate:** non-change-capable overpay (card/gateway/transfer) is **capped while the toggle is OFF**, even when the method config supports overpayment. The cap is explained inline at the moment it happens: "Capped at remaining — customer paying extra? Enable 'Customer is paying extra' above." Engine rule becomes `supportsOverpayment && payExtraIntent` (first deliberate lift of the money-model freeze — own commit + new oracle fixtures + ADR/plan note). **Cash over-tender stays exempt** — it is change, not extra.
  3. **Toggle ON gate:** requires the overpayment-allocation permission. Without it: `aria-disabled` (not native `disabled` — click must still fire) + `cmxMessage` naming the permission **name and code**. Server re-enforces regardless.
  4. **Toggle OFF gate:** blocked while `extra > epsilon` (regardless of resolution state) — `aria-disabled` + message naming the two exits: reduce the legs to the order total, or validate and route the extra. Toggle frees itself when extra reaches zero. No re-capping side effect ever.
  5. **Simple face parity:** same registry facts drive the existing "Extra amount REQUIRED" quick-button; the cap hint appears in Simple's amount editor too.
  - Governed by the new repo-wide rule **"No silent money mutation"** (CLAUDE.md CRITICAL RULE #15 / `.cursor/rules/no-silent-money-mutation.mdc`), which this design produced.
  - Canonical wording now lives in `docs/dev/rules/no-silent-money-mutation.md`.
  - Plan: two commits — (a) engine cap rule + oracle fixtures + tests, (b) top strip + toggle UX + i18n EN/AR.

*(Numbering continues from QA rounds 1–3, which are closed — see the STATUS doc.)*

---

## 6 · QA-R4.5 — Pay-extra top strip + hard overpayment gate

> **Not** the same as table row **4.5** (Generic errors) above. Spec: [`Pay_Extra_Top_Strip_QA_R4_5_Spec.md`](./Pay_Extra_Top_Strip_QA_R4_5_Spec.md).

| # | Check | Steps | Expected | Notes / result |
|---|-------|-------|----------|----------------|
| 6.1 | Strip placement | Open Payment Modal (Simple + Advanced); RTL | "Customer is paying extra" strip under header, above mode banners; not mid-workbench | [ ] |
| 6.2 | Hard gate — Full | Toggle OFF; enter card amount > remaining (method supports overpayment) | Amount capped at remaining; amber hint points to strip | [ ] |
| 6.3 | Hard gate — Simple / Split / Collect | Same over-remaining entry on each surface | Cap + amber hint (Collect); Split via engine cap; Simple shows amountCapHint | [ ] |
| 6.4 | Cash change exempt | Toggle OFF; cash tender > due | Change returned; no forced toggle; applied capped | [ ] |
| 6.5 | Toggle ON without allocate perm | User without `orders:overpayment_allocate` clicks toggle | Toast/message with permission **name + code**; toggle stays OFF | [ ] |
| 6.6 | Toggle OFF while extra | Enable toggle, create extra, try turn OFF | Blocked; message names reduce-legs or validate/route; amounts unchanged | [ ] |
| 6.7 | Validate + route | Toggle ON + Validate + choose destination | Emerald Extra mirror; submit succeeds | [ ] |
| 6.8 | Legacy stuck-excess card | Force excess with toggle OFF (if reachable) | ExtraReceiptHandlingCard still usable; no silent leg rewrite | [ ] |
| 6.9 | Tablet | Narrow window | Strip + banners + keypad usable; receipt slide-over OK | [ ] |
| 6.10 | Server guard | Trigger overpayment server rejection | Guard still opens routing dialog; strip consistent | [ ] |

My Notes:
1. 
2. 

---

## 7 · Simple↔Advanced active-leg binding + gateway identity *(2026-07-11)*

> Fixes the screenshot bug: Advanced Stripe (off-chip) active → switch Simple showed Stripe amount + gateway fields while Card looked selected. Also hardens split dialog multi-gateway option lookup.

| # | Check | Steps | Expected | Notes / result |
|---|-------|-------|----------|----------------|
| 7.1 | Advanced→Simple retarget | Advanced: add Cash + Card + Stripe (fill Stripe details); leave Stripe active; switch **Simple** | Simple amount/details show a **chip-visible** leg (Cash first if present), **not** Stripe gateway fields; Cash chip teal/`aria-pressed`; Card may show lighter "has leg" style | [ ] |
| 7.2 | Stripe state preserved | After 7.1, switch back to Advanced; select Stripe leg | Amount + gateway txn/ref still present (engine state survived; no silent money rewrite) | [ ] |
| 7.3 | Off-chip-only hint | Advanced: only Check + Stripe legs; switch Simple | Amount editor empty/disabled; info hint about Advanced method; More options still works | [ ] |
| 7.4 | Advanced method highlight | Advanced with Cash + Stripe; activate Stripe | Only Stripe method card is primary-selected; Cash shows secondary "has leg" (not both primary) | [ ] |
| 7.5 | Split gateway identity | Split dialog: two gateway options (e.g. STRIPE + HYPERPAY); Stripe leg with details; change method to Cash | Option lookup keeps correct gateway row; method change sets method + clears `gateway_code`; **amount unchanged** | [ ] |
| 7.6 | Cap hint gated | Off-chip active in Advanced with a cap notice → Simple with no chip-visible active | Cap hint hidden on Simple until a chip method is active | [ ] |

---

## Sign-off

| Section | Result | Date | By |
|---|---|---|---|
| 1 Mode reversal | | | |
| 2 Quick-actions | | | |
| 3 Leg fields | | | |
| 4 Server guard | | | |
| 5 Odds & ends | | | |
| 6 QA-R4.5 pay-extra strip | | | |
| 7 Active-leg / gateway identity | | | |

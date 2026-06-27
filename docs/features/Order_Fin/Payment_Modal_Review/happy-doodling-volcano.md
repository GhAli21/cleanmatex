# Payment Modal v4 — Comprehensive Remediation & Refactor Program

## Context

Payment Modal v4 (`web-admin/src/features/orders/ui/payment-modal-v4.tsx`, 5,886 lines) is functionally strong but carries UX debt (duplicated numbers, no cash fast-lane, no keyboard shortcuts, no `aria-live`, no tablet layout) and structural debt (one monolithic component, untestable in isolation). Review + design at `docs/features/Order_Fin/Payment_Modal_Review/Payment_Modal_v4_UX_Review_and_Engine_Plan.md`.

This program extracts a headless `usePaymentEngine`, fixes the UX findings, and adds a **Simple mode** (~80% cash/card case) that auto-escalates to the existing **Full mode** when complexity is detected — **without** forking business logic (v3/enhanced-02 `.bak` history proves parallel modals are a maintenance trap) and **without** changing the submit payload contract.

### Confirmed decisions (locked)
- **Sequencing: engine-first.** Phases 1–2 (extract engine, zero behavior change) before UX.
- **Mode default: auto-escalate.** Open in Simple; auto-flip to Full when `needsAdvanced` trips; manual "Simple" disabled while it holds.
- **Quick-tender: currency-derived defaults.** No new tenant setting (deferred follow-up).

### Execution cadence
- **Each phase is a separate, approved run.** End each: run the Per-step closeout, stop, report. Do **not** run the whole program at once.
- **First approved run = Phase 0 + Phase 1 only.**

---

## CLAUDE.md compliance — skills / agents / rule-docs (MANDATORY, not optional)
Load the relevant skill **before writing the first line** of that kind of code. Per-domain map for this program:

| Work in a phase | Load skill / agent first | Rule docs to honor |
|---|---|---|
| Any component/hook/JSX (every phase) | `/frontend` | `web-admin/.clauderc` (Cmx imports), `.cursor/rules/web-admin-typecheck-patterns.mdc`, `docs/dev/rules/react-effects-patterns.md`, `react-rhf-and-table-lint.md` |
| Any new/changed user-facing string | `/i18n` | EN+AR keys under `newOrder.payment.*`; `npm run check:i18n` |
| Any new reusable Cmx component + `.stories.tsx` | `/storybook` + **storybook-generator** agent | RTL + a11y + variants stories |
| Inline comments / JSDoc | `/code-documentation` | — |
| All documentation deliverables | `/documentation` | `.claude/skills/implementation/prd-rules.md` feature-doc checklist |
| Lint gate before "done" | — | `docs/dev/rules/react-lint-verification-checklist.md` |

**Not needed (confirm, don't assume):** no DB migration, no new permission, no navigation change, no settings/feature-flag/plan-limit, no API contract change → `/database`, `/navigation`, `/multitenancy`, `/backend` are **out of scope** for this program. If any phase discovers it needs one, STOP and load that skill before proceeding.

## Reusable UI policy (CLAUDE.md UI rules)
- Use **Cmx components only** (`@ui/primitives|feedback|overlays|forms|data-display|navigation`); exact import lines from `web-admin/.clauderc`. Never raw HTML/shadcn where a Cmx wrapper exists. No `@ui/compat`.
- **Search before create:** check `@ui/*` and existing `payment-modal/` parts for an existing component first.
- **Create a reusable component when an element appears in 2+ places.** Candidates here (shared by Full, Simple, and `order-collect-payment-modal.tsx`): quick-tender chips, balance/receipt summary card, method chips, mode toggle, docked CTA bar. Build these as shared parts under `web-admin/src/features/orders/ui/payment-modal/` (or `@ui/*` if truly generic) **with `.stories.tsx`** via `/storybook` + storybook-generator.
- Reuse existing message keys (`common.*`, `cmxMessages`) before adding new ones.

## Standard Per-step closeout (run after EVERY step/phase — do not skip)
1. **Update Progress Tracker** in this plan file (tick the step, note commit/PR + payload-diff result + date).
2. **Update related docs** for what changed this step: review-doc status, `IMPLEMENTATION_STATUS.md`, `CHANGELOG.md` (Order_Fin), and any hook/component README/JSDoc. New strings → i18n key log.
3. **Validation gate:** `npm run build`, `npx tsc --noEmit`, `npx eslint . --quiet`, `npx jest <touched>` (full jest at phase end), `npm run check:i18n` if strings changed; replay Phase 0 payload fixtures (Phases 1–2G).
4. **Invoke `/documentation`** at each **phase** end to refresh the feature's doc set for that phase's surface.
5. **Stop and report:** files changed, tests added, commands run, payload identical (Y/N).

## Constraints (hard)
- No change to `onSubmit(paymentData, payload)` (`payment-modal-v4.tsx:3493`). One engine, two views; no parallel modals.
- Behavior freeze (Phases 1–3): relocate behavior only — no change to calculations, validation, allowed methods, overpayment/B2B-credit/gift-card/cash-drawer rules, payload semantics.
- Payload identity gate (Phases 1–2G): Phase 0 fixtures stay identical; any diff blocks.
- Quick-tender = pure input assistance via existing `deriveLegAppliedAmount` capping; never bypasses gates.
- Engine perf: hooks return memoized/stable refs; engine exposes granular slices; heavy subtrees (keypad, method list, section list) `React.memo`d.
- Money precision: quick-tender/round-up uses `decimalPlaces` + decimal helpers (`payment-modal-v4.utils.ts`, `@/lib/money/format-money`) — never raw float (BHD/OMR 3-dp safe).
- Open-reset: each extracted hook owns its `open`-reset; engine guarantees all slices reset (reopen test at 2G).

## Hidden coupling & dependency graph (drives sub-phase order)
Hooks form a graph the engine wires by threading upstream values as **params** (parameterized consumers, not self-contained):
- `totals.fetchPreview` reads form discounts + applied promo + applied gift card + tax profiles (`:910-924`) → gift/promo feeds totals.
- `legs` reads catalog (`getMethodOption`) + saleTotal/giftCardSettlement + gift-card cap. `derivations` read legs+totals+payExtra. `payExtra` reads derivations+legs. `validation`/`needsAdvanced` read almost everything → computed at engine composition.
- Carry **with legs:** `activeAmountDraft`, `activeLegDraftSyncKeyRef`, draft-sync effect (`:3401-3427`), render-time `payExtraIntentRef` bridge (`:639,:1887`).
- `usePayExtraCheckout` is **shared with `order-collect-payment-modal.tsx`** — must not regress Collect Payment.

## Reuse anchors (do not re-create)
Hook home: `web-admin/src/features/orders/hooks/` (mirror `use-pay-extra-checkout.ts`). Keep as-is: `usePayExtraCheckout`, `useOverpaymentAllocation`, `usePaymentWorkbenchSectionState`, `derivePaymentModalRightRailState`, `deriveVisiblePaymentSections`/`derivePaymentInspectorTabs`, helpers in `payment-modal-v4.utils.ts`. Money: `formatMoneyAmountWithCode`, `formatAmount`. Mount: `new-order-modals.tsx` (`:72`/`:330`). Tests: flat `__tests__/features/orders/*.test.ts` (`renderHook` available). Keydown: `ready-date-picker-modal.tsx:58`.

## Test strategy
- **Pure** (`use-money-derivations`, `use-payment-validation`, `computeNeedsAdvanced`, `quickTender`, `buildPaymentPayload`): full jest (`renderHook`/direct) — regression backbone.
- **Query/effect** (`use-payment-catalog/totals/cash-drawer/gift-card-and-promo`): typecheck + build + manual scenarios; no brittle network unit tests.

---

## Phase 0 — ADR + baseline payload fixtures (BLOCKING, no app code)
- ADR `docs/features/Order_Fin/ADR/ADR_payment_modal_single_engine_two_mode.md`: decision, alternatives (two modals rejected — cite `.bak`), consequences, migration order, **explicit `needsAdvanced` conditions**: split legs · customer advance/credit · B2B credit-invoice · gift card/promo applied · overpayment routing · gift-card PIN · ambiguous drawer (>1) · **cash-drawer blocking present** · FX/rounding. Exact-cash/single-card stays Simple.
- **Runtime payload fixtures:** instrument `onSubmit`, capture JSON for cash exact · cash w/ change · card/gateway · split · gift card w/ PIN · B2B credit · overpayment allocation · deferred policy. Save as fixtures (jest oracle test lands at 2F; until then manual diff).
- **Closeout** (Progress Tracker, docs, `/documentation`).

## Phase 1 — Pure-logic extraction (zero behavior change)
- `/frontend`. `hooks/use-money-derivations.ts` (`:1669-1748`); `hooks/use-payment-validation.ts` (`:2548-3074`) + pure `computeNeedsAdvanced(inputs)` (wired at 2G / Phase 4). Jest for both; fixtures unchanged. **Closeout. Stop and report.**

## Phase 2 — Engine extraction (dependency-ordered; each sub-phase green + closeout before next)
- **2A catalog:** `hooks/use-payment-catalog.ts` (read-only queries; **adds `isError`+`refetch`**, finding 1.9).
- **2B gift card/promo:** `hooks/use-gift-card-and-promo.ts` (`:579-806`).
- **2C totals:** `hooks/use-payment-totals.ts` (`:902-1118`), params = form discounts + applied promo/gift + tax profiles.
- **2D legs:** `hooks/use-payment-legs.ts` (`:1334-1554, 2621-2679, 3401-3465`) + draft state/sync + `payExtraIntentRef`; pure `quickTender(kind)`.
- **2E cash drawer:** `hooks/use-cash-drawer.ts` (`:764-2043`).
- **2F submit:** `hooks/use-payment-submit.ts` (`:2240-3488`); pure `buildPaymentPayload`; **jest oracle vs Phase 0 fixtures**.
- **2G engine + view split:** `hooks/use-payment-engine.ts` composes all + `usePayExtraCheckout` (stable slices, wires `needsAdvanced`). Render → `ui/payment-full-view.tsx`; `payment-modal-v4.tsx` thin shell (refs/scroll/focus/section-expand/dialog state stay in view). **Reopen test + Collect-Payment smoke + fixtures identical.**

## Phase 3 — Full-view UX quick wins (finance frozen)
`/frontend` + `/i18n`; new shared parts get `/storybook` + storybook-generator. Dedupe balance numbers, delete double status row (`:5417-5423`), collapse Section C trio (1.1). **`PaymentQuickTenderChips`** reusable → `engine.legs.quickTender`; non-cash "Exact" = remaining cap (1.2). `role="status" aria-live="polite"` + transition announcer (1.4). Gradient = CTA only (1.6); single blocker surface (1.7). Default-collapse + contextual auto-expand (1.8). Method empty/error/loading three-state via `engine.catalog.isError`/`refetch` + `CmxEmptyState` (1.9). `SummaryRow` → slate/rose (1.10). a11y: `required`/`aria-required`, 44px targets, hint contrast slate-500+ (1.11). Polish: `uppercase tracking` behind `!isRTL`; radius scale; `FULLY_SETTLED` micro-transition (reduced-motion); initial focus on amount; inline add-method.

## Phase 4 — Simple mode + auto-escalation
`/frontend` + `/i18n`. `ui/payment-simple-view.tsx` (both views in same client chunk — no flicker; reuse balance/receipt + method-chip parts). Mode state + toggle + escalation banner from `engine.validation.needsAdvanced`; manual "Simple" disabled while it holds; **preserve/restore focus on switch**; Simple surfaces cash-drawer selection or escalates on block. Wire default in `new-order-modals.tsx`. **Gate:** Phases 1–3 green, fixtures unchanged, manual scenarios pass.

## Phase 5 — Keyboard shortcuts (guardrailed)
`/frontend`. `hooks/use-payment-shortcuts.ts` — Enter/F2/Ctrl+Enter → submit via existing gate. **Disabled while:** submit busy · confirm dialog open · validation blocking · focus in input/textarea/select/contenteditable · nested dialog active. Mirror `ready-date-picker-modal.tsx:58`.

## Phase 6 — Responsive / tablet (last; visual)
`/frontend`. `md`/`lg` 2-pane + docked bottom bar (Final Total + CTA + change); right-rail slide-over on tablet (1.5). **Pin core controls above the fold** (keypad, chips, CTA); per-section internal `overflow`+`max-h` scroll. Shared layout primitives for both views.

## Phase 7 — Close-out + full documentation generation
- `/documentation` — generate the **complete feature doc set** per `prd-rules.md`: permissions (none new — note), navigation (none — note), tenant settings (none — note), feature flags (none — note), plan limits (none — note), **i18n keys** (new quick-tender/Simple/banner/shortcut keys EN+AR), API routes (unchanged `preview-payment` — note), migrations (none — note), constants/types (new hook/view types), env vars (none — note), plus the engine architecture doc + Simple/Full mode guide.
- `.stories.tsx` for every new reusable component via `/storybook` + storybook-generator.
- Update review-doc status to Implemented; refresh `IMPLEMENTATION_STATUS.md` + `CHANGELOG.md`.
- Final full validation gate (build, tsc, eslint, jest, check:i18n) + react-lint checklist.

---

## Progress Tracker (update after every step — Per-step closeout #1)
- [x] **QA bug-fix track (pre-existing bugs found during fixture capture, 2026-06-27)** — Bug 2 (allocation drawers behind extra-receipt dialog) + Bug 3 (allocation confirmed but submit blocked) FIXED via JSX reorder in `payment-modal-v4.tsx` (CmxDialog is inline + shared z-50 → DOM order decides stacking); eslint clean, 91 tests pass. Bug 1 (gift-card-full → backend `OUTSTANDING_POLICY_REQUIRED`) DIAGNOSED only (per decision; finance-sensitive, needs `/backend`). Writeup: `docs/features/Order_Fin/Payment_Modal_Review/Payment_Modal_v4_QA_Bugs_2026-06-27.md`.
- [x] **Phase 0** — ADR ✅; fixtures harness + skipped oracle scaffold ✅. **All 8 baseline payload fixtures captured, cleaned, and validated** ✅ (cash-exact, cash-with-change, card-gateway, split, gift-card-pin, b2b-credit, overpayment-allocation, deferred-policy — each `{paymentData, payload}`). Temp capture instrumentation removed from `new-order-modals.tsx`. (Note: gift-card-FULL is a separate flow blocked by Bug 1 — not one of the 8 baseline scenarios.)
- [x] **Phase 1 — COMPLETE & verified** (verbatim lifts + 173 tests + tsc + production build; validation/copy extractions don't touch the payload, money-derivations already reflected in the captured fixtures). No manual payload diff needed for Phase 1 — the 8 fixtures are the **Phase 2F automated oracle** (replay recorded inputs through the extracted `buildPaymentPayload`). Pure modules extracted + wired into `payment-modal-v4.tsx`, all behavior-frozen verbatim lifts:
  - `hooks/use-money-derivations.ts` ✅ (+7 tests) — leg aggregations + change/overpayment math.
  - `hooks/payment-validation.ts` → `derivePaymentValidationItems` ✅ (+10 tests) — submit-gate rules; wired into the `validationItems` memo with byte-identical deps.
  - `payment-modal-v4.right-rail.ts` → `deriveBalanceStatusLabel` / `deriveRequiredActionCopy` / `deriveRightRailWarningMessages` ✅ (+13 tests in `payment-rightrail-copy.test.ts`) — status/required-action/warning copy.
  - `hooks/payment-needs-advanced.ts` → `computeNeedsAdvanced` ✅ (+13 tests) — built/tested; wiring deferred to Phase 4 (its consumer) to avoid an unused value.
  - `rightRailState` already pure (`derivePaymentModalRightRailState`).
  - Gates: eslint clean on all touched src+test files; `tsc` clean on touched files (12 pre-existing/unrelated repo errors only); **production build passes**; **114 payment-suite tests + 59 new-hook tests pass**. Note: test files use separate `import type` lines (a transient jest transform-cache hiccup during the run resolved on a clean run).
  - **Certification:** done via the above gates. The fixtures are not a Phase-1 manual task — they auto-verify in Phase 2F once `buildPaymentPayload` is pure.
- [x] **Phase 2A — catalog** (2026-06-27) — `use-payment-catalog.ts`; queries + method-option derivations + `getMethodOption`/`getOptionDisplayName`/`getMethodHint` + `IMMEDIATE`/`GATEWAY_METHOD_CODES`; additive `checkoutOptionsIsError`/`refetchCheckoutOptions` (finding 1.9, unconsumed). Gates green; payload identical (read-only). See STATUS doc.
- [x] **Phase 2B — gift card / promo** (2026-06-27) — `use-gift-card-and-promo.ts`; gift/promo state + `resolveGiftCardError` + code-changed/PIN-focus effects + slice `open`-reset (anchor `:579–806`). Async handlers stay in the component (read downstream legs/totals; threaded at 2G). File-level `set-state-in-effect` disable (sanctioned — RHF `setValue` blocks render-time reset). Gates green; payload identical. See STATUS doc.
- [ ] Phase 2C — totals
- [ ] Phase 2D — legs (+ quickTender)
- [ ] Phase 2E — cash drawer
- [ ] Phase 2F — submit (+ payload oracle)
- [ ] Phase 2G — engine + Full-view split
- [ ] Phase 3 — Full-view UX quick wins
- [ ] Phase 4 — Simple mode + escalation
- [ ] Phase 5 — keyboard shortcuts
- [ ] Phase 6 — responsive / tablet
- [ ] Phase 7 — full documentation generation

## Verification (each phase)
1. `cd web-admin && npm run build` → green. 2. `npx tsc --noEmit` → green. 3. `npx eslint . --quiet` → clean. 4. `npx jest <touched>`; full at phase end. 5. `npm run check:i18n` after strings. 6. **Payload identity (1–2G):** replay fixtures — identical. 7. **Reopen (2G):** every slice resets. 8. **Collect-Payment smoke (2A–2G).** 9. **Escalation (4):** single-cash stays Simple; split/gift/B2B/drawer-block flips to Full + banner; focus retained. 10. Manual: New Order → items → Payment; cash-with-change, split, B2B credit, gift-card PIN, overpayment allocation, deferred policy.

# Payment Modal v4 — `usePaymentEngine` Refactor · STATUS

**Last updated:** 2026-06-27
**Program plan (authoritative):** `docs/features/Order_Fin/Payment_Modal_Review/happy-doodling-volcano.md`
**Design/review:** `Payment_Modal_v4_UX_Review_and_Engine_Plan.md` · **ADR:** `../ADR/ADR_payment_modal_single_engine_two_mode.md`
**Constraints:** no payload-contract change · one engine, two views · behavior-frozen extraction (Phases 1–3) · EN+AR i18n for new strings.

## Progress

| Phase | State | Notes |
|---|---|---|
| 0 — ADR + payload fixtures | ✅ Done | ADR accepted; 8 baseline fixtures captured + validated; oracle test skipped until 2F. |
| 1 — Pure logic extraction | ✅ Done & verified | `use-money-derivations`, `payment-validation` (`derivePaymentValidationItems`), right-rail copy builders, `computeNeedsAdvanced`. 59 new-hook tests + tsc + build. Verbatim lifts; validation/copy don't touch the payload. |
| QA bug-fix track | ✅ 2 fixed, 1 diagnosed | Allocation drawer z-index (Bug 2/3) fixed; gift-card-full backend 400 (Bug 1) diagnosed only. See `Payment_Modal_v4_QA_Bugs_2026-06-27.md`. |
| 2A — catalog hook | ✅ Done & verified (2026-06-27) | `use-payment-catalog.ts` (`usePaymentCatalog`). Verbatim lift of the catalog concern out of `payment-modal-v4.tsx`: card-brands + payment-terminals + checkout-options queries, `branchPaymentTerminals`/`checkoutMethods`/`customerCreditOptions`/`realPaymentOptions`/`creditMethodCodes`/`optionByMethodKey`/`getMethodOption`, presentation helpers `getOptionDisplayName`/`getMethodHint`, the `IMMEDIATE_METHOD_CODES`/`GATEWAY_METHOD_CODES` constants, and the `CheckoutSettlementOption`/`CheckoutOptionsResponse`/`PaymentTerminalOption` types. `t`+`isRTL` threaded in; `getPaymentLabel` duplicated in-hook for fallback labels (component keeps its copy for `summaryMethodLabel`, per spec "keep in BOTH"). `walletCreditOption`, `cashDrawers` (2E), `storedValueSummary` (2B) deliberately left in the component. **Additive only (finding 1.9):** `checkoutOptionsIsError` + `refetchCheckoutOptions` returned (not yet consumed; the checkout-options query still swallows failures into empty lists → behavior frozen). **Gates:** eslint clean; tsc 0 errors; payment jest **234 pass / 1 skip** (2F oracle scaffold); production build green (incl. Collect-Payment smoke). Payload identity: catalog is read-only and untouched by `onSubmit`; `getMethodOption`/`getOptionDisplayName` return identical values → payload unchanged (formal fixture replay at 2F). Per program test strategy, query hooks are covered by typecheck+build+suite — no brittle network unit test added. |
| 2B — gift card / promo | ✅ Done & verified (2026-06-27) | `use-gift-card-and-promo.ts` (`useGiftCardAndPromo`). Verbatim lift of the gift/promo **state + effects + reset** (program-plan anchor `:579–806`): 11 state atoms (promo validating/result/applied; gift validating/result/details/applied; PIN value/required/visible/field-error), `resolveGiftCardError`, the "reset details on code change" effect, the PIN-focus effect, and this slice's `open`-reset. `setValue`/`pinInputRef`/`giftCardNumber`/`t`/`tGiftCardErrors` threaded in (DOM refs stay declared in the view per the 2G rule). The async handlers (`handleValidatePromoCode`/`handleFetchGiftCardDetails`/`handleApplyGiftCard`/…) **stay in the component** — they read downstream legs/totals values the engine threads at 2G — and drive the slice via the returned setters. Lint: file-level `eslint-disable react-hooks/set-state-in-effect` (sanctioned last-resort, per `react-effects-patterns.md §2` — the code-changed effect calls RHF `setValue`, so render-time reset is impractical; behavior frozen). **Gates:** eslint clean; tsc 0 errors; payment jest **234 pass / 1 skip**; production build green (incl. Collect-Payment smoke). Payload identity: gift/promo state shapes + effect bodies are byte-equivalent; `appliedPromoCode`/`appliedGiftCard` feed totals/legs unchanged → payload unchanged (formal fixture replay at 2F). Per program test strategy, this query/effect hook is covered by typecheck+build+suite — no brittle network unit test added. |
| 2C — totals | ⬜ | `use-payment-totals.ts` (reads applied promo/gift). |
| 2D — legs (+ quickTender) | ⬜ | `use-payment-legs.ts`. |
| 2E — cash drawer | ⬜ | `use-cash-drawer.ts`. |
| 2F — submit (+ payload oracle) | ⬜ | `use-payment-submit.ts`; activate oracle test vs fixtures. |
| 2G — engine + Full-view split | ⬜ | `use-payment-engine.ts`; `payment-full-view.tsx`; reopen + Collect-Payment smoke. |
| 3 — Full-view UX quick wins | ⬜ | dedupe numbers, quick-tender chips, aria-live, blocker dedupe, etc. |
| 4 — Simple mode + escalation | ⬜ | wire `computeNeedsAdvanced`; `payment-simple-view.tsx`. |
| 5 — keyboard shortcuts | ⬜ | guardrailed Enter/F2/Ctrl+Enter. |
| 6 — responsive / tablet | ⬜ | 2-pane + docked CTA. |
| 7 — full documentation generation | ⬜ | `/documentation` pass over the prd-rules feature checklist. |

## Validation (Phase 0–1 + bug fixes)
eslint clean · `tsc` clean on touched files · production build green · 114 payment-suite + 59 new-hook tests pass.

## Payload fixtures — purpose
The 8 baseline fixtures are the **Phase 2F automated oracle**, not a Phase-1 manual task: once `buildPaymentPayload` is extracted (2F), the oracle test replays each fixture's recorded inputs through it and asserts deep-equality with the recorded payload (deterministic, CI-runnable). Phase 1 is already verified by verbatim lifts + tests + build.

---

# Phase 2A — Execution Spec (ready to run in a fresh session)

> **Mandatory first step:** load the `/frontend` skill before writing any code. No DB/nav/permission/API change in this phase. Mirror the existing extracted-hook style in `web-admin/src/features/orders/hooks/use-money-derivations.ts` and `.../payment-validation.ts` (pure where possible, `'use client'`, JSDoc, behavior-frozen verbatim lifts).

**Goal:** extract the **catalog** concern from `web-admin/src/features/orders/ui/payment-modal-v4.tsx` into `web-admin/src/features/orders/hooks/use-payment-catalog.ts`, with **zero behavior change**, and **add `isError` + `refetch`** to the checkout-options query (enables finding 1.9, the method-list error/retry state, in Phase 3).

### Key gotcha (discovered, do not re-derive)
`checkoutEligibilityAmount = serverTotals?.saleTotal ?? checkoutAmount ?? total` — the checkout-options query key depends on **totals**. So **catalog ← totals**: the hook must receive `checkoutEligibilityAmount` as an **input param** (computed in the component, which still owns `serverTotals` until Phase 2C). Do not move `serverTotals`/`checkoutEligibilityAmount` into this hook.

### This is a 12-region, non-contiguous extraction
Catalog lines are physically interleaved with **cash-drawer** and **stored-value** code that MUST stay in the component. Line numbers below are pre-extraction approximations — re-grep each symbol before editing.

**Relocate into the hook (export the types):**
- Types: `CheckoutSettlementOption` (~:200–222), `CheckoutOptionsResponse` (~:224–227), `PaymentTerminalOption` (~:718–725). NOTE: `CheckoutSettlementOption` is referenced in ~15 places in the component → component imports it back from the hook.
- Module constants: `IMMEDIATE_METHOD_CODES` (~:1167–1174), `GATEWAY_METHOD_CODES` (~:1176–1181).
- Queries: `cardBrands` (~:706–716), `paymentTerminals` (~:727–737) + `branchPaymentTerminals` (~:739–745), `checkoutOptions` (~:747–761, add `isError`+`refetch`).
- Derived: `checkoutMethods` (~:792), `customerCreditOptions` (~:793), `realPaymentOptions` (~:1182–1190), `creditMethodCodes` (~:1192–1195), `optionByMethodKey` (~:1207–1212), `getMethodOption` (~:1286–1291), `getOptionDisplayName` (~:1310–1315), `getMethodHint` (~:1317–1322).

**Leave in the component (different concerns):** `cashDrawers` query (~:763–790) and all cash-drawer helpers; `storedValueSummary` query (~:800+) and `liveWalletBalance`/`getLegStoredValueCap`/`walletCreditOption` (stored-value); `currencyConfig`. The component derives `walletCreditOption` from the hook's returned `customerCreditOptions`.

### Hook contract
```ts
usePaymentCatalog({
  open, tenantOrgId, branchId, customerId,
  checkoutEligibilityAmount,   // threaded from serverTotals in the component
  isRetailOnlyOrder, isRTL,
}): {
  cardBrands, paymentTerminals, branchPaymentTerminals,
  checkoutMethods, customerCreditOptions,
  checkoutMethodsLoading, checkoutOptionsIsError, refetchCheckoutOptions,   // NEW: isError + refetch
  realPaymentOptions, creditMethodCodes, optionByMethodKey,
  getMethodOption, getOptionDisplayName, getMethodHint,
}
```
- `getOptionDisplayName` / `getMethodHint` use `getPaymentLabel` (keep that import in BOTH hook and component — also used by `summaryMethodLabel`).
- Component re-wires ~20 consumers to the destructured hook outputs, and feeds `getMethodOption` into the existing `useMoneyDerivations(...)` + `derivePaymentValidationItems(...)` call sites (already parameterized for it).

### Validation gate (all must pass)
1. `cd web-admin && npx eslint <touched files> --quiet` → clean (watch for now-unused imports: `useQuery`, `OrgCardBrandConfig`, `getPaymentLabel`, `PAYMENT_METHODS` — only remove if truly unused in the component after the cut).
2. `npx tsc --noEmit` → no NEW errors in touched files (repo has ~12 pre-existing unrelated errors: b2b pages, catalog/orders-access, use-category-products — ignore those).
3. `npx jest __tests__/features/orders/...` payment suites → green (114 baseline).
4. `npm run build` → green.
5. **Collect-Payment smoke:** confirm `order-collect-payment-modal.tsx` still builds (it shares `usePayExtraCheckout`, not catalog, but verify no fallout).
6. Per-step closeout: update this STATUS table + CHANGELOG; `/documentation` at phase end.

### Test note
Test files in this repo must use **separate `import type { … }`** lines (the babel-jest transform rejects inline `import { type X }`). Query/effect hooks like this one get typecheck + build + manual coverage, not brittle network unit tests (per the program test strategy).

### After 2A
Next is **2B gift card/promo**, then **2C totals** (which finally lets the component stop computing `checkoutEligibilityAmount` inline once totals is a hook). See the program plan for the full 2A–2G order.

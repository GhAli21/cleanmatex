# Payment Modal v4 — Engine Architecture & Simple/Full Mode Guide

**Status:** Implemented (program complete 2026-07-03)
**Program plan:** `happy-doodling-volcano.md` · **Review/design:** `Payment_Modal_v4_UX_Review_and_Engine_Plan.md` · **ADR:** `../ADR/ADR_payment_modal_single_engine_two_mode.md` · **Phase log:** `Payment_Modal_v4_Engine_Refactor_STATUS.md`

---

## 1. Architecture — one engine, two faces

```
payment-modal-v4.tsx                      ← thin shell (~190 lines)
  RHF form + zodResolver · currencyConfig load · open-reset · CSRF
  │
  └─► payment-full-view.tsx               ← mounted CONTAINER (owns everything below)
        DOM refs · focus/scroll helpers · section state · submit orchestration
        mode state ('simple' | 'full') + auto-escalation + rail slide-over
        │
        ├─ usePaymentEngine()             ← single logic core (hooks/use-payment-engine.ts)
        │    gift/promo → totals → catalog → stored-value → legs
        │    → money-derivations → pay-extra → cash-drawer
        │    + every cross-slice derivation, validationItems, rightRailState,
        │      needsAdvanced (computeNeedsAdvanced), non-DOM handlers
        │
        ├─ mode === 'simple' → <PaymentSimpleView/>   (presentational body)
        └─ mode === 'full'   → full workbench JSX     (in-file)

        Shared across BOTH faces: dialog header (PaymentModeToggle), escalation
        banner, footer (docked summary bar + CTA + validation summary), confirm
        dialogs, keyboard shortcuts → ONE submit contract.
```

Key invariants (locked):

- **`onSubmit(paymentData, payload)` contract is frozen** — the pure `buildPaymentPayload` (hooks/use-payment-submit.ts) is the only assembly path, CI-guarded by the 8-fixture payload oracle (`__tests__/features/orders/payment-payload-fixtures/payment-payload-oracle.test.ts`).
- **State survives mode flips** — mode only swaps the dialog *body*; the engine, RHF form, and refs live in the mounted container.
- **Simple can never fork finance** — it consumes existing engine handlers only (`handleMethodSelect`, shared `handleAmountValueChange` capped write path, `fillLegRemaining`, quick-tender via the same `updateLeg`).

## 2. Engine slices (hooks/)

| Hook | Concern | Notes |
|---|---|---|
| `use-gift-card-and-promo.ts` | promo/gift state, PIN | async handlers threaded from engine |
| `use-payment-totals.ts` | server totals, debounced preview, tax | params: discounts + applied promo/gift + profiles |
| `use-payment-catalog.ts` | methods/terminals/brands queries | `checkoutOptionsIsError` + `refetch` (finding 1.9) |
| `use-payment-legs.ts` | legs, active leg, drafts, mutators | `payExtraIntentRef` bridge; pure `quickTender` seam |
| `use-money-derivations.ts` | pure leg/total selectors | remaining/change/overpayment math |
| `use-pay-extra-checkout.ts` | overpayment/allocation | shared with Collect-Payment modal |
| `use-cash-drawer.ts` | drawer sessions, blocking message | preferred-drawer localStorage |
| `use-payment-submit.ts` | **pure `buildPaymentPayload`** | oracle-frozen |
| `use-payment-engine.ts` | composes all + `needsAdvanced` | single import for any face |
| `payment-needs-advanced.ts` | pure `computeNeedsAdvanced` | reason codes below |
| `use-payment-shortcuts.ts` | guardrailed keyboard shortcuts | pure `resolvePaymentShortcutAction` |

## 3. Simple/Full mode behavior

- **Default:** opens in **Simple** (`initialPaymentMode="simple"` wired in `new-order-modals.tsx`; prop threaded shell → container).
- **Auto-escalation:** `engine.needsAdvanced` (render-time Pattern A flip) with priority-ordered reasons: `SPLIT_PAYMENT · CUSTOMER_CREDIT · B2B_CREDIT_INVOICE · GIFT_CARD_OR_PROMO · OVERPAYMENT_ROUTING · GIFT_CARD_PIN · DRAWER_AMBIGUOUS · DRAWER_BLOCKED · CURRENCY_ROUNDING`. Amber `role="status"` banner names up to 3 reasons (`newOrder.payment.mode.reasons.*`).
- **Manual toggle:** `PaymentModeToggle` in the shared header; the Simple segment is **disabled while `needsAdvanced` holds** (tooltip = `mode.simpleDisabledHint`). Users may enter Full manually anytime; returning to Simple never drops state.
- **Blocked submit in Simple** escalates to Full, then runs the existing focus-first-blocking flow.
- **Focus:** both faces attach the same `amountInputRef`; a restore effect refocuses the amount editor when the previously-focused control unmounted with the old face.
- **Simple face contents:** Simple-safe method chips (`deriveSimpleModeMethodOptions`: cash + card/gateway, no `requires_reference`, cash-first, cap 3) + "More options"→Full · hero amount editor (same `payment-amount-editor` testid) · quick-tender chips · collapsible keypad · compact terminal select when `requires_terminal` · cash-drawer bound line (Manage→Full) · remaining-balance policy line (Change→Full) · `SummaryRow` receipt card with polite live region.

## 4. Keyboard shortcuts (Phase 5)

`Enter` / `F2` / `Ctrl(⌘)+Enter` → the footer CTA gate (`handleSubmit(onSubmitForm, onInvalidForm)`).
Disabled while: submit busy · validation blocking · any nested dialog/drawer open (close-guard, submit-confirm, cash-drawer, credit-note picker, extra-receipt, auto/manual allocation) · focus in input/textarea/select/contenteditable. Plain `Enter` additionally defers to focused buttons/links. Pure matrix: `resolvePaymentShortcutAction` (+6 tests).

## 5. Tablet / responsive (Phase 6)

- `md–xl`: 2-pane grid (`280px` tools | workbench); tools column sticky with internal scroll so keypad/chips/CTA stay above the fold.
- `< xl`: receipt rail = slide-over (`payment-rail-toggle` button in the footer, backdrop + close, RTL-aware translate); footer docks `PaymentDockedSummaryBar` (Final Total + Change) beside the CTA.
- `xl+`: unchanged 3-column layout (rail pinned per `PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL`).

## 6. Reusable parts (`ui/payment-modal/`, each with stories)

`quick-tender-chips.tsx` · `payment-mode-toggle.tsx` · `summary-row.tsx` · `docked-summary-bar.tsx` (+ existing allocation/pay-extra parts).

## 7. Feature-doc checklist (prd-rules)

| Surface | Delta |
|---|---|
| Permissions | **None new** (existing overpayment-resolution permission checks unchanged) |
| Navigation | **None** (modal inside New Order flow) |
| Tenant settings | **None** (quick-tender ladders are currency-derived by locked decision; tenant setting deferred) |
| Feature flags | **None** (module const `PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL` only) |
| Plan limits | **None** |
| API routes | **Unchanged** (`preview-payment` and submit payload identical — oracle-proven) |
| Migrations | **None** in Phases 3–7 (0392 was the 2D-QA constraint fix; next seq 0393) |
| Env vars | **None** |
| i18n keys | `newOrder/payment/quickTender.json`, `a11y.json` (Phase 3), `mode.json` (Phase 4) — EN+AR aligned; Phases 5–6 reuse existing keys |
| Constants/types | `PAYMENT_MODAL_MODE`/`PaymentModalMode`, `SIMPLE_MODE_METHOD_CHIP_LIMIT`, `deriveSimpleModeMethodOptions` (`payment-modal-v4.utils.ts`); `NEEDS_ADVANCED_REASON` (`payment-needs-advanced.ts`); shortcut types (`use-payment-shortcuts.ts`) |

## 8. Test map

- Payload oracle: 8 fixtures, deep-equality — frozen contract.
- Pure: money-derivations, validation, needs-advanced, quick-tender (values), simple-mode helpers, shortcut matrix, right-rail copy, sections/auto-expand.
- Query/effect hooks: typecheck + build + manual scenarios (program strategy).
- Manual QA: 2D guide (complete 2026-07-02); Simple/escalation + tablet visual pass pending a running app.

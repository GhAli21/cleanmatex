# Simple face — movable keypad, inline discounts, full-story receipt

**Date:** 2026-07-11
**Status:** Implemented
**Layered on:** the shipped Composable Capability program (`Payment_Modal_Implementation_STATUS.md`, COMPLETE 2026-07-11). This is a follow-on UI enhancement to the Simple face, not a new phase of that program — the engine, submit contract, and payload are untouched.
**Manual QA:** not yet run — see Rollout below.

## What changed

1. **Movable, non-modal numeric keypad.** The Simple amount field grew a **⌨ trigger button**; tapping it opens `CmxKeypadPopover` (new, `@ui/overlays`) anchored to the field. It's draggable (pointer events, mouse + touch), clamps to the viewport, edge-snaps on release, remembers its last position per device (`localStorage`), and offers a one-tap **dock-to-bottom**. Replaces the old always-visible inline `CmxKeypad` block.
2. **Manual discount fields inline in Simple.** The existing OMR/% discount editor (previously Full-view only, under "Discounts & Credits") is now a shared primitive (`PaymentDiscountFields`) rendered directly in the Simple PAY column. **No engine change was needed** — `computeNeedsAdvanced`'s `hasGiftCardOrPromo` only checks promo/gift-card, never manual/percent discount, so a plain discount never forced escalation to Full; it just had no home in Simple's UI until now.
3. **Full-story receipt.** The Simple receipt now shows the order-value breakdown (gross → discounts → tax) via the extracted `OrderValueBreakdownPanel`, when a discount is applied — followed by the existing Order Total / Settled / Remaining / Change / Status rows. The panel is the same one the Full-view financial inspector already used; the container computes the model once (`orderValueBreakdownModel`, driven by canonical server-side `totals`) and passes it to both faces — no duplicated discount math.
4. **CTA copy fix.** The shared submit button's partial-payment label read as a double negative: *"Submit — OMR 0.000 · Not paid after this payment: OMR 3.050"*. Reworded to *"Submit — OMR 0.000 · OMR 3.050 will remain due"* (EN+AR). Text-only; same `submitWithUnpaid`/`submitChargeOnly` state logic, shared by both faces.

## No-silent-money-mutation compliance

Discount entry was already compliant (clamped to `[0, total]` on blur/change, never silently rewritten) — that behavior moved unchanged into the shared `PaymentDiscountFields` primitive and is now exercised on both faces. Verified by a new clamp test (`payment-discount-fields.test.tsx`): a discount typed above the order total is clamped to the total, not silently accepted or dropped.

## Permissions / RBAC

None new. Manual discount visibility in Simple reuses the existing `showDiscountsCreditsSection` gate (tenant section-visibility registry) already governing the Full-view card — a tenant that hides Discounts & Credits in Full also won't see it in Simple.

## Navigation

None. No new route, no `sys_components_cd` change.

## i18n

Namespace `newOrder.payment.mode.simpleView` (EN+AR) — new keys: `keypadTitle`, `keypadDock`, `keypadClose`, `keypadHint`, `keypadRestored`.
Namespace `newOrder.payment.actions` — `submitWithUnpaid` template reworded (placeholder set unchanged).
Namespace `newOrder.payment.summary` — `notPaidBalance` value reworded ("will remain due" / "سيبقى مستحقًا").
No new namespace for discounts/order-value — Simple reuses the existing `newOrder.payment.manualDiscount.*`, `rightRail.discounts*`, and `orderValue.*` keys the Full view already shipped.
`npm run check:i18n` passes (catalogs aligned).

## Feature flags / settings

None new.

## APIs / migrations

None. No new endpoint, no DB migration — this is a client-side UI/UX change consuming the existing `preview-financials` / `order-calculation.service.ts` totals.

## New shared primitives (reusable beyond this feature)

| Component | Path | Reused by |
|---|---|---|
| `CmxKeypadPopover` + geometry helpers | `web-admin/src/ui/overlays/cmx-keypad-popover.tsx`, `.geometry.ts` | Any future numeric-entry surface needing a movable keypad |
| `PaymentDiscountFields` | `web-admin/src/features/orders/payment/primitives/payment-discount-fields.tsx` | Full workbench (replaced its inline block) + Simple |
| `OrderValueBreakdownPanel` (+ `OrderValueBreakdownRow`/`Model` types) | `web-admin/src/features/orders/ui/payment-modal/order-value-breakdown-panel.tsx` | Full financial-inspector tab (replaced its local copy) + Simple receipt |

## Tests

- `__tests__/ui/overlays/cmx-keypad-popover.geometry.test.ts` — 13 cases (clamp/snap/anchor/dock, LTR+RTL)
- `__tests__/ui/overlays/cmx-keypad-popover.test.tsx` — 8 cases (open/close, Escape, forward key press, dock persists position, restore announcement, disabled)
- `__tests__/features/orders/payment/payment-discount-fields.test.tsx` — 5 cases (render, %→OMR sync, OMR→% sync, clamp-above-total, clamp-above-100)
- Full `__tests__/features/orders` regression: 47 suites / 447 tests green after Phases 1–4; 49/468 after the discount test addition
- Payment payload oracle (`payment-payload-oracle.test.ts`): 21/21 unchanged — confirms the submit payload contract is untouched by this UI-only work

## Gates (2026-07-11)

- ESLint (changed files): 0 errors. Repo-wide `npx eslint .`: 245 pre-existing errors, all confined to `storybook-static/` (generated build output, unrelated to this change — not fixed, out of scope).
- `tsc --noEmit` (whole project): 0 errors
- `npx jest` (whole project): 1834/1838 pass. The 4 failures are pre-existing, in `cash-drawer.service.test.ts` / `cash-drawer-close-preview.test.ts` — files this change never touched (confirmed via `git status`); per project memory, a concurrent Cursor agent's foreign pos-sessions/cash-drawer commits already exist on this shared branch.
- `npm run check:i18n`: catalogs aligned
- `npx next build --webpack`: succeeded (Windows EPERM prisma-DLL workaround per project memory)

## Rollout / risks

- **Manual QA not yet run** — recommend: open a new order → Simple face → apply a % and OMR discount, confirm the full-story receipt appears and the amount due updates; open the keypad from the amount field, drag it, close and reopen to confirm it restores position; confirm RTL mirrors the keypad's default placement; confirm a partial cash payment shows the reworded "will remain due" CTA.
- **Discount order-of-operations and VAT inclusive/exclusive are unchanged** — this work only *displays* the server-computed `totals`; it introduces no new discount math, so no new finance risk.
- Shared-branch risk: this session staged nothing (user commits directly); verify `git status` before committing to exclude any concurrent agent's unrelated files.

## Developer entry points

| Concern | Path |
|---|---|
| Movable keypad | `web-admin/src/ui/overlays/cmx-keypad-popover.tsx` |
| Keypad geometry (pure, tested) | `web-admin/src/ui/overlays/cmx-keypad-popover.geometry.ts` |
| Discount fields (shared) | `web-admin/src/features/orders/payment/primitives/payment-discount-fields.tsx` |
| Order-value breakdown panel (shared) | `web-admin/src/features/orders/ui/payment-modal/order-value-breakdown-panel.tsx` |
| Simple face wiring | `web-admin/src/features/orders/ui/payment-simple-view.tsx` |
| Container wiring | `web-admin/src/features/orders/ui/payment-full-view.tsx` |
| CTA copy | `web-admin/messages/{en,ar}/newOrder/payment/actions.json`, `summary.json` |

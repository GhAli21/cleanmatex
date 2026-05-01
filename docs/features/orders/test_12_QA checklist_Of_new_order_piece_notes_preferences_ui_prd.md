# QA checklist — §12 / piece preferences UI (new order)

**PRD:** `docs/features/orders/new_order_piece_notes_preferences_ui_prd.md` (§12 QA checklist)

**Purpose:** Notes from manual QA; track parity with product expectations.

---

## Original findings (2026)

- add to the piece name the service category name it will be (service category name - Item Name - Piece xx) e.g. ( Dry Clean - Shirt - Piece 1 )
and put that full name in box or any way that show it clearly .

- the preferences kinds should wrap to next down line if it will be hide in the row to avoid hiding : see Screenshot_A_1
- the preferences kinds should show only those is_active=true and is_show_in_quick_bar=true and is_stopped_by_saas=false
- the preferences kinds should show order by rec_order
- the preferences kinds should have color from kind_bg_color if not null

- the preferences should show those which is_active=true and is_show_in_quick_bar=true and is_used_by_system not true and is_allow_to_show_for_user=true
- add divider or any thing that show seperation between preferences kinds and the chips (the selected preferences values)

- chip of selected preference should take its color with it or its kind kind_bg_color as surrounding color 

- There is wrong calculation when select preference that have extra cost , It should added not minues : see Screenshot_C_1 and Screenshot_C_2

---

## Status — implemented / verified in code (web-admin)

| # | Finding | Status | Notes |
|---|--------|--------|--------|
| 1 | Piece header: category – item – piece | **Done** | `order-piece-preferences-section.tsx` → `PiecePreferenceCard` `categoryLabel`; bordered header in `piece-preference-card.tsx`. |
| 2 | Kind buttons wrap (no horizontal-only hide) | **Done** | `flex flex-wrap` on kind toolbar; removed overflow-x-only scroll. |
| 3 | Kinds: active, quick bar, not stopped by SaaS | **Done** | `PreferenceCatalogService.getPreferenceKinds` + `GET .../preference-kinds?quickBarOnly=`; quick-bar uses `show === true`; SaaS stop + tenant inactive filtered. |
| 4 | Kinds ordered by `rec_order` | **Done** | Merged `cf.rec_order ?? sys.rec_order`, then sorted ascending. |
| 5 | `kind_bg_color` on kind tabs | **Done** | Unchanged tailwind passthrough on tab buttons. |
| 6 | Preferences (values): visibility flags | **Done** | API returns merged `is_show_in_quick_bar` / sys `is_used_by_system` / `is_allow_to_show_for_user`; `usePreferenceCatalog(..., true, true)` filters for Edit Items Preferences; full catalog kept for pricing / auto-apply. |
| 7 | Divider between kinds and chips | **Done** | `border-t` separator before chip row. |
| 8 | Chip styling / kind color | **Done** | Chips use kind map from `kind_code` → `kind_bg_color` (tailwind) with fallback to semantic `chipKindClass`. |
| 9 | Extra-cost prefs: total wrong (add vs minus / modal vs sidebar) | **Done** | `UPDATE_ITEM_SERVICE_PREFS` now sets `totalPrice = qty * pricePerUnit + servicePrefCharge`; related: `ADD_ITEM` merge, `SET_EXPRESS`, price override include surcharge. |
| 10 | Payment: `promoCodeId` / `giftCardId` invalid body | **Done** | `optionalUuidJsonPreprocess` strips non-UUID strings so unused fields do not fail Zod. |

**Regression tests:** `__tests__/features/orders/new-order-reducer.test.ts` (service pref totals), `__tests__/validations/b2b-create-with-payment-schema.test.ts` (promo/gift UUID omit).

**PRD §12 automated checks (unchanged):** `npm run check:i18n`; `npx jest __tests__/selected-piece-preference.test.ts __tests__/services/order-piece-service.test.ts`.

---

## Still manual / data-dependent

- [ ] Confirm tenant **sys/org catalog** rows have `is_show_in_quick_bar` and related flags set where pieces should see them (strict `true` for quick-bar surfaces).
- [ ] Full **create vs edit** DB checks (`prefs_source`, `prefs_no`, `PIECE` level) per PRD §12 items 1–2.

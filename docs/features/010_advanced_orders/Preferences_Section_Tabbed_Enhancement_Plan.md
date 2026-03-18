# Preferences Section Tabbed Enhancement Plan

**Version:** 1.1  
**Last Updated:** 2026-03-18  
**Reference UI:** `Order_UI_Samples/Order/Edit_Order_Notes_02-05.PNG`

## Overview

Restructure the Customer/Order/Item/Pieces Preferences panel on the New Order page into a tabbed interface (Service Prefs, Colors, Stains, Damage, All) and add UX patterns from the reference Edit Item Notes designs: Copy to all pieces, Show All Items toggle, and enhanced summary text.

---

## Target Structure

### Tabbed Quick-Select Panel

| Tab | Content |
|-----|---------|
| **Service Prefs** | ServicePreferenceSelector (starch, perfume, delicate, etc.) |
| **Colors** | ColorPickerGrid — circular swatches from catalog |
| **Stains** | Condition buttons filtered to stains only |
| **Damage** | Condition buttons filtered to damage only |
| **All** | All conditions (stains + damage + special) in one grid |

Notes textarea remains below the tabs.

---

## Reference UX Patterns (from Edit_Order_Notes samples)

| Pattern | Description | Implementation |
|---------|-------------|----------------|
| **Tap-to-add** | Click tag in bottom grid → adds to selected piece | Existing in StainConditionToggles |
| **Copy to all pieces** | Blue copy icon copies settings from one piece to all pieces of same item | **NEW** — Add to plan |
| **Show All Items** | Toggle item-level vs piece-level view | **NEW** — Add when trackByPiece |
| **Summary text** | Comma-separated attributes under each item in sidebar | **Enhance** — Add color + notes |
| **Active row highlight** | Light blue on selected row | Existing via selectedPieceId |
| **Edit Item Notes overlay** | Panel as overlay when clicking edit | **Optional** — Future enhancement |

---

## Implementation Phases

### Phase 1: Tabbed Preferences Panel

**Files:** `PreferencesForSelectedPiecePanel.tsx`, `StainConditionToggles.tsx`, new `ColorPickerGrid.tsx`

1. Add tab state: `activeTab: 'service' | 'colors' | 'stains' | 'damage' | 'all'`
2. Tab bar with pill buttons (same pattern as PreferencesTabsSection)
3. Tab content:
   - Service Prefs → ServicePreferenceSelector (when servicePrefs.length > 0)
   - Colors → ColorPickerGrid (new component)
   - Stains → StainConditionToggles with `filter="stain"`
   - Damage → StainConditionToggles with `filter="damage"`
   - All → StainConditionToggles with `filter="all"`
4. Add optional `filter` prop to StainConditionToggles; when set, hide filter bar
5. Create ColorPickerGrid: fetch colors from catalog or fallback constant; single-select swatches

**Catalog API:** Add `getConditionsAndColors()` to PreferenceCatalogService; create `GET /api/v1/catalog/conditions-colors` (or extend service-preferences). Gate by `item_conditions_colors_enabled`.

---

### Phase 2: Copy to All Pieces

**Files:** `ItemCartItem.tsx`, `pre-submission-pieces-manager.tsx`, `new-order-reducer.ts`

1. Add copy icon (Copy or CopyPlus from lucide-react) to each piece row in the cart
2. On click: copy `color`, `conditions`, `notes`, `servicePrefs` from source piece to all other pieces of the same item
3. Add reducer action: `COPY_PIECE_PREFS_TO_ALL` — `{ productId, sourcePieceId }`
4. Show tooltip: "Copy preferences to all pieces of this item"
5. i18n: `copyToAllPieces`, `copiedToAllPieces`

**Placement:** In ItemCartItem, when a piece is expanded or in pre-submission-pieces-manager next to each piece row.

---

### Phase 3: Show All Items Toggle

**Files:** `OrderSummaryPanel.tsx`, `ItemCartList.tsx`, `new-order-content.tsx`

1. When `trackByPiece` is true and item has multiple pieces, add "Show All Items" / "Show by Pieces" toggle
2. **Show All Items:** Collapsed view — one row per product (item-level)
3. **Show by Pieces:** Expanded view — one row per piece (current behavior)
4. Store toggle in local state or order context: `prefsViewMode: 'items' | 'pieces'`
5. When in items mode, selecting an item applies prefs to all its pieces (or first piece as representative — clarify behavior)

**Note:** May overlap with existing expand/collapse in ItemCartList. Align with current UX.

---

### Phase 4: Enhanced Summary Text

**Files:** `ItemCartItem.tsx`, `item-cart-list.tsx`

1. Under each item in the sidebar, show comma-separated: `Color / Condition1 / Condition2 / Notes`
2. Example: `Gray / Striped / Torn / Cuff Torn / Oil / Make-up / note jhh`
3. Aggregate from pieces when trackByPiece: show union of all piece attributes or "Mixed" when differing
4. Truncate with ellipsis when long; tooltip for full text

---

### Phase 5 (Optional): Edit Item Notes Overlay

**Files:** New `EditItemNotesModal.tsx`, `OrderSummaryPanel.tsx`

1. Replace always-visible PreferencesForSelectedPiecePanel with on-demand overlay
2. When user clicks edit icon on item/piece in cart → open Edit Item Notes modal
3. Modal contains: table of items/pieces + tabbed quick-select grid below
4. Matches reference layout (Edit_Order_Notes_02.PNG)
5. Defer to later iteration if scope is large

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `lib/services/preference-catalog.service.ts` | Add `getConditionsAndColors()` |
| `app/api/v1/catalog/conditions-colors/route.ts` | Create |
| `hooks/use-preference-catalog.ts` | Add `conditionsColors` query |
| `ui/preferences/ColorPickerGrid.tsx` | Create |
| `ui/stain-condition-toggles.tsx` | Add optional `filter` prop |
| `ui/preferences/PreferencesForSelectedPiecePanel.tsx` | Refactor to tabbed layout |
| `ui/item-cart-item.tsx` | Add copy icon, enhanced summary |
| `ui/pre-submission-pieces-manager.tsx` | Add copy-to-all handler |
| `context/new-order-reducer.ts` | Add `COPY_PIECE_PREFS_TO_ALL` |
| `messages/en.json`, `ar.json` | Add tab labels, copy strings |

---

## Data Flow

- **Colors:** `PreSubmissionPiece.color` — support catalog code (e.g. `RED`) or hex. Persist via order-piece-service to `org_order_item_pieces_dtl.color` (JSONB).
- **Conditions:** `PreSubmissionPiece.conditions` — array of codes. Persist to `org_order_preferences_dtl` with `preference_sys_kind` IN ('condition_stain','condition_damag').
- **Copy to all:** Source piece → iterate same item's pieces → apply `{ color, conditions, notes, servicePrefs }`.

---

## i18n Keys

| Key | EN | AR |
|-----|----|----|
| `servicePrefs` | Service Preferences | تفضيلات الخدمة |
| `colors` | Colors | الألوان |
| `stains` | Stains | البقع |
| `damage` | Damage | التلف |
| `all` | All | الكل |
| `copyToAllPieces` | Copy to all pieces | نسخ إلى جميع القطع |
| `copiedToAllPieces` | Copied to all pieces | تم النسخ إلى جميع القطع |
| `showAllItems` | Show all items | عرض جميع الأصناف |
| `showByPieces` | Show by pieces | عرض حسب القطع |

---

## Execution Order

1. **Phase 1** — Tabbed panel + ColorPickerGrid + catalog API
2. **Phase 2** — Copy to all pieces
3. **Phase 4** — Enhanced summary text (can run parallel with Phase 2)
4. **Phase 3** — Show All Items toggle (after Phase 1–2)
5. **Phase 5** — Overlay (optional, future)

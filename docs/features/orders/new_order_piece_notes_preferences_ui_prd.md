# PRD (outline): New Order — Edit Item Notes (piece-level preferences)

**Status:** Draft for planning  
**Last updated:** 2026-04-30  
**Scope:** Web-admin New Order wizard, step “Edit Item Notes” (piece-centric notes + preferences). Aligns with `org_order_item_pieces_dtl` and `org_order_preferences_dtl` (`prefs_level = PIECE`).

**Indexed from:** [Edit Order — INDEX](./edit_order/INDEX.md) · [Advanced Orders README](../010_advanced_orders/README.md)

---

## 1. Problem & goal

**Problem:** Piece-level fields (color, damage, stains, upcharges, notes) and multi-category preferences are crowded in a single wide table. Staff repeat work across many pieces; edit/remove actions are easy to miss.

**Goal:** Make **per-piece preference capture** fast, obvious, and reversible, without losing the ability to scan all pieces of an item at once.

**Non-goals (this phase):** Changing backend contracts beyond what the wizard already submits; redesigning unrelated wizard steps.

---

## 2. Users & primary jobs

| Persona | Job |
|--------|-----|
| Counter / intake staff | Enter accurate piece data under time pressure; copy patterns across pieces. |
| Supervisor | Trust that Order Summary reflects piece-level choices. |

---

## 3. Proposed information architecture (screens / surfaces)

1. **Item accordion (existing mental model)**  
   - Header: product name, quantity (“x N pieces”), optional collapsed summary (e.g. “2 with stains”).  
   - Body: **one row per piece** (summary mode).

2. **Piece summary row (compact)**  
   - Columns: Piece label, color (text or swatch), **chips** for active stains/damage/special/upcharges (count if many), notes one-line truncated.  
   - Primary action: **“Edit piece”** (opens detail). Secondary: overflow menu (Copy to…, Clear prefs, Reset notes).

3. **Piece detail surface (focused)**  
   - Pattern: **drawer / slide-over** (desktop) or **full-width sheet** (narrow breakpoints).  
   - Inside: grouped sections — Notes (textarea), Color, Conditions (stains / damage / special / patterns / materials — tabs or accordions mirroring the bottom category bar), Service preferences, Packing preference for this piece.  
   - Footer: **Save** (explicit or auto-save with debounce — pick one in implementation spec), **Cancel** (discard unsaved), optional **“Save & next piece”**.

4. **Bulk / line actions (toolbar on item)**  
   - “Copy piece 1 → all pieces of this item” (confirm if targets already have data).  
   - Optional: “Clear all piece prefs for this item” (destructive, confirm).

5. **Order Summary (right rail)**  
   - Continues to show aggregated line; must **subscribe to same state** as piece detail (no drift).

---

## 4. States

| State | Behavior |
|-------|----------|
| **Initial load** | Skeleton on piece rows; preserve wizard step if user navigates back/forward. |
| **Single piece, no data** | Empty summary row; detail opens with empty sections; no error. |
| **Many pieces** | Virtualize or paginate piece list if performance degrades (threshold TBD, e.g. > 20 pieces). |
| **Unsaved changes in drawer** | Closing drawer or browser back: prompt “Discard changes?” unless auto-save is on. |
| **Auto-save (if chosen)** | Subtle “Saved” / spinner; last-error toast on failure; disable “Next” until critical fields valid (if any). |
| **Validation** | Inline errors next to field; focus first invalid on Save; do not lose scroll position on item list. |
| **Read-only / locked** | N/A for New Order create path unless shared component used in edit-order later — document extension point. |

---

## 5. Empty, edge, and error handling

| Scenario | UX |
|----------|-----|
| No stains / damage selected | Show placeholder in summary (“—”); detail shows empty groups with short helper text. |
| Catalog fetch fails (preference lists) | Block only affected sections with retry; allow notes/color; toast with correlation id in dev. |
| Submit payload too large / API 413 | Message + suggest reducing notes or splitting order (product decision). |
| Partial apply after “Copy to all” | Transactional UI update: all-or-nothing with toast on failure. |
| RTL (Arabic) | Drawer opens from logical start edge; chip order and icons mirror correctly. |

---

## 6. Accessibility (WCAG-oriented targets)

- **Keyboard:** Piece row is focusable; Enter/Space opens detail; **Escape** closes drawer and returns focus to triggering row; visible focus ring on chips and buttons.  
- **Screen readers:** Row announces “Piece 2 of 4, Underpants”; detail has `aria-labelledby` tied to piece title; live region for “Saved” / errors (polite).  
- **Touch targets:** Minimum 44×44px for chip remove and primary actions on touch breakpoints.  
- **Contrast:** Chips and category tabs meet contrast for default + hover + selected states.  
- **Motion:** Respect `prefers-reduced-motion` for drawer transitions.

---

## 7. Data & implementation notes (for engineering plan)

- Piece-level payload should remain compatible with existing create paths: `pieces[].conditions`, `pieces[].servicePrefs`, `pieces[].packingPrefCode`, notes/color on piece.  
- Prefer **one reducer/source of truth** for piece array so Order Summary and detail stay aligned.  
- Document parity: **create-with-payment (Prisma)** vs **API Supabase create** for `org_order_preferences_dtl` if UI adds piece-level packing rows everywhere.

---

## 8. Success metrics (suggest)

- Time on step “Edit Item Notes” ↓ (baseline after release).  
- Support tickets / internal complaints about “wrong stain on wrong piece” ↓.  
- Task success rate in moderated usability (e.g. 5 users): add 3 pieces with different stains without error.

---

## 9. Open questions

1. **Save model:** Explicit Save in drawer vs debounced auto-save — risk vs speed tradeoff.  
2. **Mobile:** Is counter strictly desktop, or must sheet be first-class on tablet portrait?  
3. **Edit Order reuse:** Should the same piece-detail component ship in edit-order in the same release or phase 2?

---

## 10. Suggested phases

| Phase | Deliverable |
|-------|-------------|
| **P0** | Piece summary row + drawer with Notes + Color + Conditions + sticky Save/Cancel; keyboard + focus trap. |
| **P1** | Service + packing inside drawer; chip remove on summary; “Copy piece 1 → all”. |
| **P2** | Virtualized long lists; telemetry on time-on-step; edit-order integration if separate. |

---

## 11. Implementation landed (wizard)

- **Decision A:** Preferences are owned by wizard tab **Edit Items Preferences** (chip cards + kind bar). **Edit Item Notes** is notes-first only (no stain/damage/upcharge columns; no duplicate `PreferencesPanel`).
- **Edit / create parity:** When `trackByPiece`, edit mode uses the same tabs including piece preferences.
- **`prefs_source`:** `OrderPieceService.createPiecesForItem` / `createPiecesForItemWithTx` take `preferencesSourceDefault` (`ORDER_CREATE` | `ORDER_EDIT`). Order **update** (Prisma) passes `ORDER_EDIT` for piece preference rows created in that transaction; **create** paths keep `ORDER_CREATE` (default).
- **Piece prefs `prefs_no`:** Inserts follow create-order ordering: conditions, then service prefs, then optional packing row — stable sequential `prefs_no` per piece.
- **API:** `updateOrderPieceSchema` accepts `conditions`, `servicePrefs`, and `packingPrefCode`; `use-order-submission` edit payloads mirror create for those fields.

**DB `prefs_source`:** `org_order_preferences_dtl.prefs_source` is `VARCHAR(50)` (migration `0166_create_org_order_preferences_dtl.sql`). Values such as `ORDER_CREATE`, `ORDER_EDIT`, and per-pref `source` strings from the client are expected; there is no tight enum check in that migration that would reject `ORDER_EDIT`.

---

## 12. QA checklist (create vs edit, piece prefs)

Prerequisites: tenant with **track by piece** enabled.

1. **Create** — Add item (qty ≥ 2), use **Edit Items Preferences** for stains + service pref + packing on piece 1, submit. In DB: `org_order_preferences_dtl` rows for `prefs_level = PIECE` with sequential `prefs_no` (conditions → service_prefs → packing). New piece condition/packing rows from create should show **`ORDER_CREATE`** (or explicit item/pref sources where applicable).
2. **Edit** — Edit order, change piece prefs, save. Rows inserted on update should show **`ORDER_EDIT`** as the default source for piece condition/packing inserts from `createPiecesForItemWithTx` (service rows still use each pref’s `source` when provided).
3. **Regression** — Notes tab is notes + copy only; order summary still sensible after service pref changes.
4. **Automated (web-admin)** — `npm run check:i18n`; `npx jest __tests__/selected-piece-preference.test.ts __tests__/services/order-piece-service.test.ts`.

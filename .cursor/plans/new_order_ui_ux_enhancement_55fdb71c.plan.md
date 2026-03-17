---
name: New Order UI/UX Enhancement
overview: "Implement all UI/UX best-practice enhancements for the New Order page: responsive layout with mobile bottom sheet, improved loading/empty states, validation feedback, typography scale, accessibility, and microinteractions. Production-ready with no gaps."
todos:
  - id: p1-use-breakpoint
    content: Create useBreakpoint hook (lib/hooks/use-breakpoint.ts)
    status: completed
  - id: p1-bottom-sheet
    content: Create OrderSummaryBottomSheet component with floating bar + slide-up sheet
    status: completed
  - id: p1-responsive-layout
    content: Integrate responsive layout in new-order-content (sidebar desktop, bottom sheet mobile/tablet)
    status: completed
  - id: p1-content-area
    content: Main content area responsiveness (p-4 sm:p-6, branch selector stacking)
    status: completed
  - id: p2-product-grid
    content: Product grid breakpoints (2-col mobile to 7-col 2xl)
    status: completed
  - id: p2-product-card
    content: ProductCard touch targets 44px + scale animation
    status: completed
  - id: p2-skeletons
    content: Align ProductGridSkeleton and CategoryTabsSkeleton with actual layouts
    status: completed
  - id: p3-product-empty
    content: Product grid empty state with icon and CTA
    status: completed
  - id: p3-cart-empty
    content: Cart empty state enhancement (larger icon, clearer CTA)
    status: completed
  - id: p3-customer-empty
    content: No customer state aria-describedby and helper text
    status: completed
  - id: p4-inline-validation
    content: Inline validation for branch, customer, ready-by with aria-describedby
    status: completed
  - id: p4-aria-validation
    content: role=alert and aria-live for validation errors
    status: completed
  - id: p5-typography
    content: Typography scale (titles, labels, body) across New Order flow
    status: completed
  - id: p5-primary-action
    content: Submit/Add Order button emphasis (font-semibold, py-3)
    status: completed
  - id: p6-step-tabs
    content: Step tabs completion indicators and transition-opacity
    status: completed
  - id: p7-focus
    content: Focus trap and return in customer picker, payment, ready-by modals
    status: completed
  - id: p7-aria
    content: ARIA labels, aria-live regions, tab order verification
    status: completed
  - id: p7-contrast
    content: Color contrast audit for WCAG AA
    status: completed
  - id: p8-transitions
    content: Tab panel, ProductCard, bottom sheet transitions
    status: completed
  - id: p8-badge
    content: Quantity badge animation on change
    status: completed
  - id: p9-rtl
    content: RTL logical properties (ps-/pe-, inset-inline-0)
    status: completed
  - id: p9-i18n
    content: Add new i18n keys and run check:i18n
    status: completed
  - id: p10-branch
    content: Branch selector prominence (banner when missing)
    status: completed
  - id: p10-category
    content: Category tabs horizontal scroll and touch targets
    status: completed
  - id: p11-unified-panel
    content: Create PreferencesForSelectedPiecePanel (Service Prefs + Conditions + Notes) on Select Items tab
    status: completed
  - id: p11-prefs-responsive
    content: PreferencesTabsSection and PreferencesForSelectedPiecePanel responsive
    status: completed
  - id: p11-prefs-empty
    content: Empty states (no items, no piece selected for in-context panel)
    status: completed
  - id: p11-prefs-touch
    content: All preference controls touch targets 44px
    status: completed
  - id: p11-prefs-rtl
    content: RTL logical properties in Preferences (border-s-, ps-/pe-)
    status: completed
  - id: p12-piece-source
    content: Clarify single source for piece editing (Cart vs Order Details)
    status: completed
  - id: p12-order-details-pieces
    content: Order Details piece rows responsive grid, labels, touch targets
    status: completed
  - id: p12-cart-pieces
    content: PreSubmissionPiecesManager responsive, touch targets
    status: completed
  - id: p12-piece-selection
    content: Piece selection feedback and scroll-into-view
    status: completed
  - id: p12-add-piece
    content: Consistent Add Piece flow and auto-select new piece
    status: completed
  - id: p12-progressive-disclosure
    content: Piece cards collapsed summary (number + color/brand) with expand for full details
    status: completed
  - id: p12-gripvertical
    content: Remove GripVertical or implement drag-reorder for piece sequence
    status: completed
  - id: p12-empty-piece-state
    content: Add first piece CTA when item has no pieces
    status: completed
  - id: p12-color-swatch
    content: Color swatch visual indicator when piece color is set
    status: completed
  - id: p12-keyboard-nav
    content: Keyboard nav between pieces (arrows, Enter add, Delete remove)
    status: completed
  - id: test-responsive
    content: Test at 320, 768, 1024, 1440px + RTL
    status: completed
  - id: test-build
    content: npm run build and npm run check:i18n pass
    status: completed
isProject: false
---

# New Order Page UI/UX Enhancement Plan

## Scope

Enhance [web-admin/src/features/orders/ui/new-order-content.tsx](web-admin/src/features/orders/ui/new-order-content.tsx) and related components to follow UI/UX best practices per [.cursor/rules/uiuxrules.mdc](.cursor/rules/uiuxrules.mdc). All changes must support RTL and bilingual (EN/AR).

**Key design decision (Option A — in-context for speed):** Keep preferences in context on the Select Items tab. Replace StainConditionToggles with a unified "Preferences for selected piece" panel that includes Service Prefs + Conditions + Notes. This panel appears below the product grid when items exist and a piece is selected. Minimizes tab switching and supports fast order creation. Order Details tab retains PreferencesTabsSection (Quick Apply | Service Preferences) for bulk review/editing.

---

## Phase 1: Responsive Layout and Breakpoints

### 1.1 Create `useBreakpoint` Hook

**File:** `web-admin/lib/hooks/use-breakpoint.ts` (new)

- Hook that returns current breakpoint: `'sm' | 'md' | 'lg' | 'xl'` based on Tailwind defaults (640, 768, 1024, 1280).
- Use `window.matchMedia` with `(min-width: Npx)` for SSR-safe, performant detection.
- Return `isMobile` (lt 768), `isTablet` (768–1023), `isDesktop` (gte 1024) for convenience.

### 1.2 Responsive Sidebar / Bottom Sheet

**Files:** [new-order-content.tsx](web-admin/src/features/orders/ui/new-order-content.tsx), new `OrderSummaryBottomSheet.tsx`

- **Desktop (gte 1024px):** Keep current layout — fixed right sidebar `w-96`, full height.
- **Mobile/Tablet (lt 1024px):** Replace sidebar with collapsible bottom sheet:
  - Floating bar at bottom showing item count + total + "View cart" / "Add Order" CTA.
  - Tap opens bottom sheet (slide-up) with full OrderSummaryPanel content.
  - Sheet has handle for drag-to-close, backdrop click to close.
  - Sticky CTA bar always visible when items exist.
- Use `useBreakpoint` to switch layout; no hydration mismatch (render same on server, adjust on mount).

### 1.3 Main Content Area Responsiveness

- Reduce padding on mobile: `p-4 sm:p-6` instead of fixed `p-6`.
- Branch selector: stack vertically on narrow screens; full width on mobile.

---

## Phase 2: Product Grid and Cards

### 2.1 Product Grid Breakpoints

**File:** [product-grid.tsx](web-admin/src/features/orders/ui/product-grid.tsx)

- Change grid from `grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7` to mobile-first:
  - `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7`
- Gap: `gap-2 sm:gap-3` for touch-friendly spacing on mobile.

### 2.2 ProductCard Touch Targets

**File:** [product-card.tsx](web-admin/src/features/orders/ui/product-card.tsx)

- Ensure +/- and Add buttons meet 44x44px minimum (WCAG 2.5.5): use `min-h-[44px] min-w-[44px]` or `p-3` to achieve.
- Add subtle scale animation on add: `transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]` for feedback.

### 2.3 Loading Skeleton Alignment

**File:** [loading-skeletons.tsx](web-admin/src/features/orders/ui/loading-skeletons.tsx)

- `ProductGridSkeleton`: Match ProductCard layout — same grid breakpoints, card-like structure (image area, name bar, price bar, button area).
- `CategoryTabsSkeleton`: Align with actual CategoryTabs pill count/size.

---

## Phase 3: Empty States

### 3.1 Product Grid Empty State

**File:** [product-grid.tsx](web-admin/src/features/orders/ui/product-grid.tsx)

- When `products.length === 0`: Show illustration/icon (e.g. Package from Lucide), heading, short message, optional "Try another category" hint.
- Use `text-gray-500`, centered layout, adequate padding.

### 3.2 Cart Empty State

**File:** [item-cart-list.tsx](web-admin/src/features/orders/ui/item-cart-list.tsx)

- Already has ShoppingCart icon + message. Enhance: larger icon, clearer CTA ("Select items from the grid above"), ensure RTL alignment.

### 3.3 No Customer State

**File:** [order-summary-panel.tsx](web-admin/src/features/orders/ui/order-summary-panel.tsx)

- Customer selector already shows "Select Customer". Add `aria-describedby` linking to short helper text when empty.

---

## Phase 4: Validation and Feedback

### 4.1 Inline Validation

**Files:** [new-order-content.tsx](web-admin/src/features/orders/ui/new-order-content.tsx), [order-summary-panel.tsx](web-admin/src/features/orders/ui/order-summary-panel.tsx)

- Branch: Show inline error below select when `!branchId && branches.length > 1` (already present); add `aria-describedby` to select.
- Customer: When no customer and user attempts submit, show inline error near customer selector (use existing `cmxMessage.error` but also set local error state to display below button).
- Ready-by: Already has validation in OrderSummaryPanel; ensure `aria-invalid` and `role="alert"` on error message.

### 4.2 Success Feedback on Add Item

**File:** [new-order-content.tsx](web-admin/src/features/orders/ui/new-order-content.tsx)

- After `state.addItem(newItem)`: Optional brief toast "Item added" (configurable, low priority) or rely on cart update + quantity badge. Document decision: prefer no toast to avoid noise; ensure cart/quantity update is immediate and visible.

---

## Phase 5: Typography and Visual Hierarchy

### 5.1 Typography Scale

**Files:** [new-order-content.tsx](web-admin/src/features/orders/ui/new-order-content.tsx), [order-summary-panel.tsx](web-admin/src/features/orders/ui/order-summary-panel.tsx), [product-grid.tsx](web-admin/src/features/orders/ui/product-grid.tsx)

- Page/section titles: `text-xl sm:text-2xl font-semibold`
- Subsection labels: `text-sm font-semibold text-gray-700`
- Body/labels: `text-sm text-gray-600`
- Ensure consistent use across New Order flow.

### 5.2 Primary Action Emphasis

**File:** [order-summary-panel.tsx](web-admin/src/features/orders/ui/order-summary-panel.tsx)

- Submit/Add Order button: `font-semibold`, sufficient size (`py-3`), primary color. Disabled state clearly visible.

---

## Phase 6: Step Tabs and Navigation

### 6.1 Step Tabs Enhancement

**File:** [new-order-content.tsx](web-admin/src/features/orders/ui/new-order-content.tsx)

- Add step completion indicator: e.g. checkmark when items added (tab 2), when customer selected (tab 3).
- Tab transition: Add `transition-opacity duration-200` when switching panels to avoid abrupt flash.
- Ensure `aria-selected`, `aria-controls`, `id` linkage is correct (already present; verify).

---

## Phase 7: Accessibility

### 7.1 Focus Management

- Modals (customer picker, payment, ready-by): Ensure focus trap and return focus on close. Audit [customer-picker-modal.tsx](web-admin/src/features/orders/ui/customer-picker-modal.tsx), [payment-modal-enhanced-02.tsx](web-admin/src/features/orders/ui/payment-modal-enhanced-02.tsx), [ready-date-picker-modal.tsx](web-admin/src/features/orders/ui/ready-date-picker-modal.tsx). Use Radix/Dialog focus management if not already.
- Tab order: Branch -> Categories -> Products -> Cart -> Submit. Verify with keyboard-only navigation.

### 7.2 ARIA and Semantics

- Add `aria-live="polite"` region for dynamic updates (e.g. "3 items in order") — already present in new-order-content.
- Ensure all interactive elements have `aria-label` or visible text.
- Error messages: `role="alert"` and `aria-live="assertive"` for validation errors.

### 7.3 Color Contrast

- Audit text/background contrast for WCAG AA. Gray-500 on white, blue-600 on white — verify ratios.

---

## Phase 8: Microinteractions

### 8.1 Transitions

- Tab panel switch: `transition-opacity duration-200 ease-out`
- ProductCard hover: `transition-all duration-150`
- Bottom sheet: slide-up/down animation (e.g. `transform translateY`, `transition-transform duration-300`)

### 8.2 Quantity Badge Animation

**File:** [product-card.tsx](web-admin/src/features/orders/ui/product-card.tsx)

- When quantity changes: brief `animate-pulse` or scale bounce (CSS keyframe) for 200ms.

---

## Phase 9: RTL and Bilingual

### 9.1 Logical Properties

- Replace `left`/`right` with `start`/`end` where Tailwind supports it (`ps-`, `pe-`, `ms-`, `me-`).
- Bottom sheet: Use `inset-inline-0` instead of `left-0 right-0` for RTL correctness.

### 9.2 i18n Keys

- Add any new strings to `messages/en.json` and `messages/ar.json` under `newOrder.`*.
- Run `npm run check:i18n` after changes.

---

## Phase 10: Branch Selector and Category Tabs

### 10.1 Branch Selector Prominence

**File:** [new-order-content.tsx](web-admin/src/features/orders/ui/new-order-content.tsx)

- When required and missing: Use card/banner style (`bg-amber-50 border-amber-200`) to draw attention.
- Replace raw `<select>` with Cmx design system component if available (e.g. CmxSelect from `@ui/forms`).

### 10.2 Category Tabs

**File:** [category-tabs.tsx](web-admin/src/features/orders/ui/category-tabs.tsx)

- Ensure horizontal scroll on mobile with `overflow-x-auto` and `scrollbar-hide` or thin scrollbar.
- Touch-friendly tap targets for category pills.

---

## Phase 11: Preferences Section — Option A (In-Context for Fast Order Creation)

**Design decision:** Keep preferences in context on the Select Items tab. Replace StainConditionToggles with a unified "Preferences for selected piece" panel. Order Details tab keeps PreferencesTabsSection for bulk review.

### 11.0 Unified "Preferences for Selected Piece" Panel (Select Items Tab)

**Location:** Select Items tab, below product grid. Replaces StainConditionToggles.

**Content (when piece selected):**

1. **Service Preferences** — ServicePreferenceSelector for the selected piece (starch, perfume, delicate)
2. **Conditions** — Toggle grid for stains, damage, special (reuse StainConditionToggles logic)
3. **Notes** — CmxTextarea for piece notes

**Behavior:**

- Visible when `items.length > 0` and `selectedPieceId` is set.
- Auto-select last added piece when adding item (existing behavior).
- User can select piece from cart (OrderSummaryPanel) to change context.
- When no piece selected: Show "Select a piece from the cart to apply preferences" with cart hint.
- Collapsible or always-visible; compact on mobile.

**Implementation:**

- Create new component `PreferencesForSelectedPiecePanel.tsx` (or extend StainConditionToggles into it).
- Place in [product-grid.tsx](web-admin/src/features/orders/ui/product-grid.tsx) or in new-order-content as sibling to ProductGrid when `activeTab === 'select'`.
- Reuse: ServicePreferenceSelector, StainConditionToggles filter/toggle logic, add Notes textarea.
- Pass: selectedPieceId, selectedConditions, onConditionToggle, updateItemServicePrefs, updateItemPieces (for notes), servicePrefs from catalog.

**Order Details tab:** PreferencesTabsSection unchanged — Quick Apply | Service Preferences for all items. Used for bulk review/editing.

### 11.1 PreferencesTabsSection Responsive

**File:** [PreferencesTabsSection.tsx](web-admin/src/features/orders/ui/preferences/PreferencesTabsSection.tsx)

- Tabs: Horizontal scroll on mobile when multiple tabs; `overflow-x-auto`, `scrollbar-hide`.
- Content area: `max-h-[50vh] sm:max-h-[40vh]` for scrollable list.
- Tab buttons: Touch targets min 44px height.

### 11.2 Empty State

- When `state.items.length === 0`: Show empty state with icon, "Add items first to configure preferences", hint to Select Items tab.
- When items exist but no piece selected (for conditions/notes): "Select a piece from the cart to apply conditions and notes".

### 11.3 Preference Selectors Touch Targets

**Files:** [ServicePreferenceSelector.tsx](web-admin/src/features/orders/ui/preferences/ServicePreferenceSelector.tsx), [PackingPreferenceSelector.tsx](web-admin/src/features/orders/ui/preferences/PackingPreferenceSelector.tsx), condition toggles

- All interactive elements min 44px touch targets.

### 11.4 Preferences RTL

- Use `border-s-2`, `ps-4` for RTL correctness.

### 11.5 Condition Toggles (Inlined in Preferences)

- Condition toggles (stains, damage, special) live inside PreferencesForSelectedPiecePanel.
- Responsive grid, touch targets, filter buttons (All, Stains, Damage, Special).

---

## Phase 12: Pieces UI/UX

Pieces are editable in two places: Order Details table (expandable rows) and Cart (PreSubmissionPiecesManager). Both need UX improvements for clarity, speed, and mobile.

### 12.1 Single Source of Truth for Piece Editing

**Current:** Pieces editable in Order Details table AND in Cart (PreSubmissionPiecesManager). Redundant, can cause confusion.

**Recommendation:** Treat Cart as the primary piece selector; Order Details as the full editing surface. Or: PreSubmissionPiecesManager in Cart is for selection + quick edit; Order Details is for full detail. Ensure no conflicting UX — consider making Order Details the canonical edit surface and Cart pieces read-only with "Edit in Order Details" link, OR consolidate so Cart has full piece editing (color, brand, rack, conditions, notes) and Order Details shows read-only summary. **Preferred:** Cart has full piece editing (already has color, brand, rack, notes, hasStain, hasDamage). Order Details can show the same or link to cart context. Simplify: one place to edit piece details.

### 12.2 Order Details Piece Rows

**File:** [order-details-section.tsx](web-admin/src/features/orders/ui/order-details-section.tsx)

- **Expand behavior:** Consider allowing multiple items expanded (user preference) or keep one-at-a-time but add "Expand all" / "Collapse all" for power users.
- **Piece row layout:** Replace flex-wrap with responsive grid — `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for piece fields. Group: Identity (color, brand) | Location (rack) | Flags (stain, damage) | Prefs (packing) | Notes.
- **Labels:** Increase from `text-[10px]` to `text-xs` for readability.
- **Touch targets:** Remove piece button — `min-h-[44px] min-w-[44px]` or `p-3`. Checkboxes — ensure 44px tap area.

### 12.3 PreSubmissionPiecesManager (Cart)

**File:** [pre-submission-pieces-manager.tsx](web-admin/src/features/orders/ui/pre-submission-pieces-manager.tsx)

- **Piece cards:** Clearer visual hierarchy — piece number more prominent, grouped fields.
- **Touch targets:** Add/Remove piece buttons min 44px.
- **Responsive:** 2-col grid on mobile may be tight; consider 1-col on very narrow.
- **GripVertical:** Remove if not used for drag-reorder, or implement drag-reorder for piece sequence.

### 12.4 Piece Selection Feedback

- Selected piece (for PreferencesForSelectedPiecePanel): Orange ring is good. Add subtle label "Selected for preferences" when piece is selected.
- In Cart: When piece selected, scroll PreferencesForSelectedPiecePanel into view (if below fold) or show brief tooltip.

### 12.5 Add Piece Flow

- "+ Add piece" in Order Details and "Add Piece" in Cart — ensure consistent placement and styling.
- After adding piece: Auto-select new piece for immediate preference application.

### 12.6 Progressive Disclosure

**Files:** [pre-submission-pieces-manager.tsx](web-admin/src/features/orders/ui/pre-submission-pieces-manager.tsx), [order-details-section.tsx](web-admin/src/features/orders/ui/order-details-section.tsx)

- **Collapsed state:** Show piece number + color/brand (or "—" if not set) as a compact summary. One-line per piece when collapsed.
- **Expanded state:** Full fields (color, brand, rack, notes, stain, damage) on tap/click. Chevron icon to expand/collapse.
- Reduces visual clutter when many pieces; power users expand for full edit.

### 12.7 GripVertical — Remove or Implement

**File:** [pre-submission-pieces-manager.tsx](web-admin/src/features/orders/ui/pre-submission-pieces-manager.tsx)

- **Option A (recommended for MVP):** Remove GripVertical icon — it suggests drag-reorder but is non-functional.
- **Option B:** Implement drag-reorder for piece sequence using `@dnd-kit/core` or similar. GripVertical becomes the drag handle.

### 12.8 Empty Piece State

**Files:** [pre-submission-pieces-manager.tsx](web-admin/src/features/orders/ui/pre-submission-pieces-manager.tsx), [item-cart-item.tsx](web-admin/src/features/orders/ui/item-cart-item.tsx)

- When item has `pieces.length === 0` and `trackByPiece`: Show dedicated "Add first piece" CTA with icon (Plus) and short helper text.
- Avoid generic "No pieces" — use actionable prompt: "Add a piece to track color, conditions, and notes."

### 12.9 Color Swatch

**Files:** [pre-submission-pieces-manager.tsx](web-admin/src/features/orders/ui/pre-submission-pieces-manager.tsx), [order-details-section.tsx](web-admin/src/features/orders/ui/order-details-section.tsx)

- When `piece.color` is set: Show small color swatch (e.g. `w-3 h-3 rounded-full` with `bg-[color]` or fallback for named colors via CSS variable or mapping).
- Place next to piece number in collapsed/summary view for quick visual identity.
- Handle unknown color strings gracefully (show text chip if not mappable to swatch).

### 12.10 Keyboard Navigation

**Files:** [pre-submission-pieces-manager.tsx](web-admin/src/features/orders/ui/pre-submission-pieces-manager.tsx), [order-details-section.tsx](web-admin/src/features/orders/ui/order-details-section.tsx)

- **Arrow keys:** Up/Down or Left/Right to move focus between pieces when piece list is focused.
- **Enter:** Add new piece (when focus on Add Piece button or list).
- **Delete/Backspace:** Remove selected piece (with confirmation or undo hint for safety).
- Ensure `tabIndex` and `onKeyDown` handlers; announce with `aria-live` for screen readers.

---

## File Summary


| Action       | File                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Create       | `web-admin/lib/hooks/use-breakpoint.ts`                                                            |
| Create       | `web-admin/src/features/orders/ui/OrderSummaryBottomSheet.tsx`                                     |
| Modify       | `web-admin/src/features/orders/ui/new-order-content.tsx`                                           |
| Modify       | `web-admin/src/features/orders/ui/order-summary-panel.tsx`                                         |
| Create       | `web-admin/src/features/orders/ui/preferences/PreferencesForSelectedPiecePanel.tsx`                |
| Modify       | `web-admin/src/features/orders/ui/product-grid.tsx` (replace StainConditionToggles with new panel) |
| Modify       | `web-admin/src/features/orders/ui/product-card.tsx`                                                |
| Modify       | `web-admin/src/features/orders/ui/loading-skeletons.tsx`                                           |
| Modify       | `web-admin/src/features/orders/ui/item-cart-list.tsx`                                              |
| Modify       | `web-admin/src/features/orders/ui/category-tabs.tsx`                                               |
| Modify       | `web-admin/src/features/orders/ui/preferences/PreferencesTabsSection.tsx`                          |
| Modify       | `web-admin/src/features/orders/ui/preferences/ServicePreferenceSelector.tsx`                       |
| Modify       | `web-admin/src/features/orders/ui/preferences/PackingPreferenceSelector.tsx`                       |
| Modify       | `web-admin/src/features/orders/ui/stain-condition-toggles.tsx` (extract toggle logic for reuse)    |
| Modify       | `web-admin/src/features/orders/ui/pre-submission-pieces-manager.tsx`                               |
| Audit/Modify | Modal components for focus management                                                              |
| Add          | i18n keys in `messages/en.json`, `messages/ar.json`                                                |


---

## Testing Checklist

- Desktop (1024px+): Sidebar layout unchanged, all features work
- Tablet (768–1023px): Bottom sheet layout, cart accessible
- Mobile (320–767px): 2-col product grid, bottom sheet, touch targets 44px
- Preferences: In-context panel on Select Items; Order Details has Quick Apply | Service Preferences
- Pieces: Responsive piece rows, touch targets, selection feedback, Add Piece flow, progressive disclosure, color swatch, empty state, keyboard nav
- RTL: All layouts mirror correctly (including Preferences, piece borders)
- Keyboard: Tab order, Enter to submit, Alt+1/2/3 for tabs
- Screen reader: Announcements, labels, errors
- `npm run build` passes
- `npm run check:i18n` passes

---

## Todo Tasks by Phase


| Phase | Todo ID                    | Task                                                        | Depends On               |
| ----- | -------------------------- | ----------------------------------------------------------- | ------------------------ |
| 1     | p1-use-breakpoint          | Create useBreakpoint hook                                   | —                        |
| 1     | p1-bottom-sheet            | Create OrderSummaryBottomSheet                              | p1-use-breakpoint        |
| 1     | p1-responsive-layout       | Integrate responsive layout                                 | p1-bottom-sheet          |
| 1     | p1-content-area            | Main content responsiveness                                 | —                        |
| 2     | p2-product-grid            | Product grid breakpoints                                    | —                        |
| 2     | p2-product-card            | ProductCard touch + animation                               | —                        |
| 2     | p2-skeletons               | Loading skeleton alignment                                  | p2-product-grid          |
| 3     | p3-product-empty           | Product grid empty state                                    | —                        |
| 3     | p3-cart-empty              | Cart empty state                                            | —                        |
| 3     | p3-customer-empty          | No customer state                                           | —                        |
| 4     | p4-inline-validation       | Inline validation                                           | —                        |
| 4     | p4-aria-validation         | ARIA for validation                                         | p4-inline-validation     |
| 5     | p5-typography              | Typography scale                                            | —                        |
| 5     | p5-primary-action          | Primary action emphasis                                     | —                        |
| 6     | p6-step-tabs               | Step tabs enhancement                                       | —                        |
| 7     | p7-focus                   | Modal focus management                                      | —                        |
| 7     | p7-aria                    | ARIA and semantics                                          | —                        |
| 7     | p7-contrast                | Color contrast audit                                        | —                        |
| 8     | p8-transitions             | Transitions                                                 | p1-bottom-sheet          |
| 8     | p8-badge                   | Quantity badge animation                                    | p2-product-card          |
| 9     | p9-rtl                     | RTL logical properties                                      | p1-bottom-sheet          |
| 9     | p9-i18n                    | i18n keys                                                   | p3-*, p4-*, p10-*, p11-* |
| 10    | p10-branch                 | Branch selector prominence                                  | —                        |
| 10    | p10-category               | Category tabs scroll                                        | —                        |
| 11    | p11-unified-panel          | Create PreferencesForSelectedPiecePanel on Select Items tab | —                        |
| 11    | p11-prefs-responsive       | PreferencesTabsSection and panel responsive                 | p11-unified-panel        |
| 11    | p11-prefs-empty            | Empty states for in-context panel                           | p11-unified-panel        |
| 11    | p11-prefs-touch            | Preference controls touch targets                           | —                        |
| 11    | p11-prefs-rtl              | Preferences RTL                                             | —                        |
| 12    | p12-piece-source           | Single source for piece editing                             | —                        |
| 12    | p12-order-details-pieces   | Order Details piece rows UX                                 | —                        |
| 12    | p12-cart-pieces            | PreSubmissionPiecesManager UX                               | —                        |
| 12    | p12-piece-selection        | Piece selection feedback                                    | p11-unified-panel        |
| 12    | p12-add-piece              | Add Piece flow consistency                                  | —                        |
| 12    | p12-progressive-disclosure | Piece cards collapsed/expanded summary                      | p12-cart-pieces          |
| 12    | p12-gripvertical           | Remove GripVertical or add drag-reorder                     | p12-cart-pieces          |
| 12    | p12-empty-piece-state      | Add first piece CTA                                         | p12-cart-pieces          |
| 12    | p12-color-swatch           | Color swatch when piece color set                           | p12-cart-pieces          |
| 12    | p12-keyboard-nav           | Keyboard nav between pieces                                 | p12-piece-selection      |
| Test  | test-responsive            | Responsive + RTL testing                                    | All phases               |
| Test  | test-build                 | Build and i18n check                                        | All phases               |


---

## Implementation Order

**Batch 1 (foundation):** p1-use-breakpoint, p1-content-area, p2-product-grid, p2-product-card

**Batch 2 (layout):** p1-bottom-sheet, p1-responsive-layout, p8-transitions, p9-rtl

**Batch 3 (content):** p2-skeletons, p3-product-empty, p3-cart-empty, p3-customer-empty

**Batch 4 (validation):** p4-inline-validation, p4-aria-validation

**Batch 5 (polish):** p5-typography, p5-primary-action, p6-step-tabs, p8-badge

**Batch 6 (accessibility):** p7-focus, p7-aria, p7-contrast

**Batch 7 (preferences):** p11-unified-panel, p11-prefs-responsive, p11-prefs-empty, p11-prefs-touch, p11-prefs-rtl

**Batch 8 (pieces):** p12-piece-source, p12-order-details-pieces, p12-cart-pieces, p12-piece-selection, p12-add-piece

**Batch 9 (pieces advanced):** p12-progressive-disclosure, p12-gripvertical, p12-empty-piece-state, p12-color-swatch, p12-keyboard-nav

**Batch 10 (final):** p10-branch, p10-category, p9-i18n

**Batch 11 (verification):** test-responsive, test-build
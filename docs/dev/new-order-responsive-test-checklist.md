# New Order Page — Responsive & RTL Test Checklist

Manual testing checklist for the New Order UI/UX enhancements. Test at each breakpoint and in RTL mode.

## Breakpoints to Test

| Width | Breakpoint | Layout |
|-------|------------|--------|
| 320px | Mobile (xs) | 2-col product grid, bottom sheet, minimal padding |
| 768px | Tablet (md) | Bottom sheet, 3–4 col grid |
| 1024px | Desktop (lg) | Sidebar layout, 5+ col grid |
| 1440px | Large desktop (xl) | Full sidebar, 6–7 col grid |

## Test Steps

### 1. Layout & Responsiveness

- [ ] **320px**: Product grid shows 2 columns; branch selector stacks vertically; bottom floating bar visible when items exist
- [ ] **768px**: Bottom sheet opens on "View cart"; category tabs scroll horizontally
- [ ] **1024px**: Right sidebar visible; no bottom sheet; full layout
- [ ] **1440px**: Same as 1024px; product grid up to 7 columns

### 2. Bottom Sheet (Mobile/Tablet)

- [ ] Floating bar shows item count and total
- [ ] "View cart" opens slide-up sheet
- [ ] Backdrop click closes sheet
- [ ] Sheet contains full OrderSummaryPanel content

### 3. Product Grid & Cards

- [ ] Touch targets (Add, +/-) are at least 44px
- [ ] Scale animation on add
- [ ] Quantity badge animates on change
- [ ] Empty state shows when no products

### 4. Cart & Pieces

- [ ] Cart empty state has clear CTA
- [ ] Piece cards: collapsed shows number + color/brand
- [ ] Chevron expands/collapses piece details
- [ ] "Add first piece" CTA when trackByPiece and no pieces
- [ ] Color swatch shows for hex colors

### 5. Preferences Panel

- [ ] PreferencesForSelectedPiecePanel scrolls into view when piece selecteed
- [ ] "Selected for preferences" label on selected piece
- [ ] Panel shows Service Prefs + Conditions + Notes

### 6. RTL (Arabic)

- [ ] Switch locale to Arabic; layout mirrors correctly
- [ ] Sidebar/bottom sheet use logical properties (inset-inline-0)
- [ ] Category tabs, piece cards, preferences align correctly
- [ ] Text alignment follows RTL

### 7. Keyboard & Accessibility

- [ ] Tab order: Branch → Categories → Products → Cart → Submit
- [ ] Modals: focus trap and return focus on close
- [ ] Piece list: Arrow Up/Down between pieces
- [ ] Delete/Backspace removes selected piece
- [ ] Enter on Add Piece button adds piece

### 8. Validation & Feedback

- [ ] Branch banner when missing (multiple branches)
- [ ] Customer/ready-by validation with aria-describedby
- [ ] Error messages have role="alert"

## Quick Test Commands

```bash
# Start web-admin
cd web-admin && npm run dev

# Build verification
cd web-admin && npm run build

# i18n check
cd web-admin && npm run check:i18n
```

## Browser DevTools

Use Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M) to simulate:
- iPhone SE (375px)
- iPad (768px)
- Responsive (custom 320, 1024, 1440)

For RTL: Change `dir` attribute on `<html>` to `rtl` or use locale switcher.

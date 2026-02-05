# Print Layout Customization Guide

Ready-order print (receipt and order-details) header, footer, fonts, and spacing are controlled from **one place** so you can get a better UI without editing multiple components.

## Where to edit

**File:** `web-admin/app/dashboard/ready/[id]/print/[type]/page.tsx`

Find the `<style dangerouslySetInnerHTML={{ __html: \` ... \` }} />`block. All customization is done by changing the **CSS variables** in the`:root` block inside that string.

## Variables you can change

### Fonts

| Variable                 | Purpose                                             | Example values                                         |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| `--print-font-family`    | Body and headings font stack                        | `'Georgia', serif` or `'Noto Sans Arabic', sans-serif` |
| `--print-font-size-base` | Base text size (thermal: 11px, A4: 12px by default) | `12px`, `13px`                                         |
| `--print-line-height`    | Line spacing                                        | `1.4`, `1.5`                                           |

### Header

| Variable                                                       | Purpose                                         |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `--print-header-padding-top` / `--print-header-padding-bottom` | Space above/below header content                |
| `--print-header-margin-bottom`                                 | Space between header and first section          |
| `--print-header-font-size`                                     | Title size (e.g. "CleanMateX", "Order Details") |
| `--print-header-sub-font-size`                                 | Subtitle/tagline size                           |
| `--print-header-border-width`                                  | Bottom border thickness (e.g. `1px`)            |

### Footer

| Variable                      | Purpose                               |
| ----------------------------- | ------------------------------------- |
| `--print-footer-padding-top`  | Space above footer text               |
| `--print-footer-margin-top`   | Space between last section and footer |
| `--print-footer-font-size`    | Footer text size                      |
| `--print-footer-border-width` | Top border (dashed line) thickness    |

### Section spacing

| Variable                        | Purpose                                                     |
| ------------------------------- | ----------------------------------------------------------- |
| `--print-section-margin-bottom` | Space between sections (e.g. Customer, Items, Totals)       |
| `--print-section-inner-spacing` | Space between section title and first row, and between rows |

## Page margins

In the same `<style>` block, the `@page` rule controls paper size and margins:

```css
@page {
  size: 80mm auto; /* thermal */
  margin: 5mm;
}
/* or for A4 */
@page {
  size: A4;
  margin: 10mm;
}
```

Change the `margin` value (e.g. `12mm`, `15mm`) to add or reduce white space around the content.

## Layout-specific values

The variables are set differently for **thermal** (80mm) vs **A4** so that thermal gets tighter spacing and smaller fonts. The code uses `layout === 'thermal' ? '...' : '...'` for each variable. Adjust either the thermal or the A4 side to tune each layout.

## Changing header/footer content (text)

- **Header title** (e.g. "CleanMateX"): edit the components
  - `web-admin/src/features/orders/ui/order-receipt-print.tsx` (receipt)
  - `web-admin/src/features/orders/ui/order-details-print.tsx` (order details)  
    Look for the `<header className="print-header">` block and the `<h1 className="print-title">` or `.print-title` content.
- **Footer text** (e.g. "Thank you for your business!"): same files, `<footer className="print-footer">`. The message key `common.thanks` is used when available; you can change the fallback string or add translations.

## Summary

1. **Fonts and spacing** → Edit the CSS variables in `ready/[id]/print/[type]/page.tsx`.
2. **Page margins** → Edit the `@page` rule in the same file.
3. **Header/footer text** → Edit `order-receipt-print.tsx` and `order-details-print.tsx`.

All print content is wrapped in a `.print-document` container, and sections use `.print-header`, `.print-footer`, and `.print-section` so the variables apply consistently to both receipt and order-details prints.

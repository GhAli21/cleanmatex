# Manual Verification: EN and AR Flows

Step-by-step guide for manually verifying that i18n (English and Arabic) works correctly across the web-admin application.

## Prerequisites

- Web-admin dev server running: `npm run dev` (from `web-admin/` or project root)
- Access to both locale URLs: `/en/...` and `/ar/...`

## 1. Start the Dev Server

```powershell
cd web-admin
npm run dev
```

## 2. URL Structure

- **English:** `http://localhost:3000/en/dashboard/...`
- **Arabic:** `http://localhost:3000/ar/dashboard/...`

Use the language switcher (if present) or change the locale segment in the URL.

---

## 3. Verification Checklist

### Orders

| Area | EN check | AR check |
|------|----------|----------|
| Orders list | Page loads, filters work | Same, RTL layout correct |
| Bulk status update | Select 1 order → "Update status for 1 selected order"; select 2+ → "selected orders" | Same messages in Arabic |
| Order table selection bar | "1 order selected" / "N orders selected" | Arabic plural text |
| Order detail | Public tracking link, status badges | Same in Arabic |

### New Order

| Area | EN check | AR check |
|------|----------|----------|
| Order summary | Submit button shows "X item" / "X items" (plural) | Same in Arabic |
| Ready date picker | Cancel button labeled "Cancel" | Same in Arabic |
| Customer picker | Loading state text | Same in Arabic |

### Catalog

| Area | EN check | AR check |
|------|----------|----------|
| Services page | Import, Clear Filters, Export buttons | Same in Arabic |
| Categories page | Loading, Save Categories | Same in Arabic |
| Pricing page | Create, Loading | Same in Arabic |
| Import modal | Import, Loading, Close | Same in Arabic |
| Price list detail | "X item(s)" in Items tab | Same in Arabic |

### Customers

| Area | EN check | AR check |
|------|----------|----------|
| Customer type badges | Guest, Stub, Full, Walk-in | Same in Arabic |
| Customer detail page | Tabs: Profile, Addresses, Order History, Loyalty | Same in Arabic |
| Type labels in header | Guest, Stub, Full | Same in Arabic |

### Reports

| Area | EN check | AR check |
|------|----------|----------|
| Export CSV | Headers: Order #, Customer, Status, etc. | Same headers in Arabic |
| Export Excel | Same headers | Same in Arabic |
| Print report | Headers, KPI labels, Print/Close buttons | Same in Arabic |

### Billing (Invoices & Payments)

| Area | EN check | AR check |
|------|----------|----------|
| Invoice filters | Clear Filters button | Same in Arabic |
| Payment filters | Clear Filters button | Same in Arabic |
| Modals | Cancel buttons | Same in Arabic |

### Dashboard

| Area | EN check | AR check |
|------|----------|----------|
| Usage widget | "X Warning" / "X Warnings" | Same in Arabic |
| Global filters | Clear Filters | Same in Arabic |

---

## 4. RTL-Specific Checks (Arabic)

- [ ] Forms: labels, inputs, and buttons flow right-to-left
- [ ] Tables: columns align correctly
- [ ] Modals: position and content direction correct
- [ ] Navigation: sidebar/tabs on correct side
- [ ] Icons: direction-aware (e.g. chevrons)
- [ ] No overlapping or truncated text

---

## 5. Common Issues to Watch For

| Symptom | Likely cause |
|---------|---------------|
| Raw key shown (e.g. `orders.bulkStatusUpdate.subtitle`) | Key missing in message file for that locale |
| "undefined" or empty text | Key not found or wrong namespace |
| Wrong plural form (e.g. "1 items") | ICU plural key misconfigured |
| Mixed LTR/RTL in same line | Missing `dir` or RTL class |

---

## 6. Browser DevTools

1. **Console:** Check for next-intl warnings or missing-key errors.
2. **Network:** Confirm `en.json` and `ar.json` load (200).
3. **Elements:** Inspect `html` for `dir="rtl"` when on Arabic.

---

## 7. Parity Check Before Verification

Run the parity check to ensure both locale files have matching keys:

```powershell
cd web-admin
npm run check:i18n
```

Fix any reported mismatches before manual verification.

---

## 8. Quick Smoke Test Paths

Minimum paths to verify in both EN and AR:

1. `/en/dashboard/orders` → `/ar/dashboard/orders`
2. `/en/dashboard/orders/new` → `/ar/dashboard/orders/new`
3. `/en/dashboard/customers` → `/ar/dashboard/customers`
4. `/en/dashboard/catalog/services` → `/ar/dashboard/catalog/services`
5. `/en/dashboard/reports/orders` → `/ar/dashboard/reports/orders`

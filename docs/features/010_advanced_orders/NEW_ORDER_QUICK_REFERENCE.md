# New Order Page - Quick Reference Guide

**For Developers**  
**Last Updated**: 2026-02-20  
**Payment flow**: Server-side calculation (preview + create-with-payment APIs); supports partial payment for CASH/CARD/CHECK

---

## 🚀 Quick Start

### Import Hooks

```typescript
import { useNewOrderStateWithDispatch } from '@/src/features/orders/hooks/use-new-order-state';
import { useOrderTotals } from '@/src/features/orders/hooks/use-order-totals';
import { useOrderValidation } from '@/src/features/orders/hooks/use-order-validation';
```

### Basic Usage

```tsx
function MyComponent() {
  const { state, dispatch } = useNewOrderStateWithDispatch();
  const totals = useOrderTotals();
  
  // Add item
  dispatch({ type: 'ADD_ITEM', payload: newItem });
  
  // Open modal
  dispatch({ type: 'OPEN_MODAL', payload: 'customerPicker' });
}
```

---

## 📦 Key Files

| File | Purpose |
|------|---------|
| `new-order-context.tsx` | Context provider |
| `new-order-reducer.ts` | State reducer |
| `new-order-types.ts` | TypeScript types |
| `use-order-submission.ts` | Order submission via create-with-payment API |
| `use-category-products.ts` | Data fetching |
| `order-defaults.ts` | Constants |
| `payment-modal-enhanced-02.tsx` | Payment modal (server totals) |
| `amount-mismatch-dialog.tsx` | Mismatch diff dialog |

---

## 🔧 Common Tasks

### Add Item to Order

```typescript
const item: OrderItem = {
  productId: 'uuid',
  productName: 'Shirt',
  quantity: 1,
  pricePerUnit: 10.0,
  totalPrice: 10.0,
  // ... other fields
};

dispatch({ type: 'ADD_ITEM', payload: item });
```

### Validate Order

```typescript
const { isValid, errors, warnings } = useOrderValidation();

if (!isValid) {
  console.error('Validation errors:', errors);
}
```

### Sanitize Input

```typescript
import { sanitizeInput, sanitizeOrderNotes } from '@/lib/utils/security-helpers';

const safeName = sanitizeInput(userInput);
const safeNotes = sanitizeOrderNotes(orderNotes);
```

---

## 🎯 Constants

```typescript
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

ORDER_DEFAULTS.LIMITS.QUANTITY_MIN      // 1
ORDER_DEFAULTS.LIMITS.QUANTITY_MAX      // 999
ORDER_DEFAULTS.DEBOUNCE_MS.ESTIMATION   // 400ms
ORDER_DEFAULTS.PRICE.MIN                // 0.001
```

---

## 🧪 Testing

```bash
# Run unit tests
npm test __tests__/features/orders

# Run with coverage
npm run test:coverage -- __tests__/features/orders
```

---

## 📝 Translation Keys

```typescript
// Errors (retail/inventory)
t('newOrder.errors.mixedRetailServices')
t('newOrder.errors.retailPayOnCollection')

// Structure
t('newOrder.title')
t('newOrder.customer.label')
t('newOrder.itemsGrid.addItem')
t('newOrder.orderSummary.total')
t('newOrder.payment.title')
// Partial payment (CASH/CARD/CHECK)
t('newOrder.payment.partialPayment.payInFull')
t('newOrder.payment.partialPayment.payPartial')
t('newOrder.payment.partialPayment.amountToPayNow')
t('newOrder.payment.partialPayment.remainingDue')
t('newOrder.customItem.title')
t('newOrder.photoCapture.title')

// Amount mismatch
t('amountMismatch.title')
t('amountMismatch.message')
t('amountMismatch.yourValue')
t('amountMismatch.serverValue')
t('amountMismatch.refreshPage')
```

---

## 🛒 Retail vs Services

- **Rule**: Orders contain either retail items **or** service items, never both
- **Retail**: `service_category_code === 'RETAIL_ITEMS'`
- **Column**: `org_orders_mst.is_retail` is set at creation for retail-only orders; use for filtering
- **Status**: Retail orders are created with status `closed` (skip workflow)
- **Payment**: Retail orders → Pay-on-Collection disabled; must use Cash or Card
- **Stock**: Retail items auto-deduct inventory on order creation

---

## 📡 Payment APIs (Server-Side Calculation)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/orders/preview-payment` | POST | Fetch server totals (items, discounts, promo, gift card) |
| `/api/v1/orders/create-with-payment` | POST | Create order + invoice + payment in one transaction |

- **Preview**: Used by payment modal to display totals; debounced refetch on input change
- **Create-with-payment**: Single API call; accepts optional `amountToCharge` for partial payment; on `AMOUNT_MISMATCH` (400), shows `AmountMismatchDialog`

---

## 🔒 Security Checklist

- ✅ Sanitize all user inputs
- ✅ Validate UUIDs before submission
- ✅ Check permissions (`orders:create`)
- ✅ Validate CSRF token
- ✅ Rate limit requests

---

## ♿ Accessibility Checklist

- ✅ ARIA labels on all buttons
- ✅ Keyboard navigation support
- ✅ Focus indicators visible
- ✅ Screen reader announcements
- ✅ Color contrast (WCAG AA)

---

## 🐛 Common Issues

**Issue**: Order not submitting
- Check browser console
- Verify CSRF token
- Check permissions

**Issue**: Products not loading
- Check React Query cache
- Verify category selection
- Check network tab

**Issue**: Validation errors
- Ensure customer selected
- Verify items added
- Check product IDs are UUIDs

**Issue**: Insufficient stock (retail orders)
- Check Inventory Stock page for quantities
- Ensure retail items have available stock before creating order

**Issue**: Amount Mismatch
- Server totals differ from client; dialog shows diff
- Refresh page to retry; no order was created
- Ensure pricing/discount inputs haven't changed mid-flow

---

## 📚 More Information

See [NEW_ORDER_PAGE_DOCUMENTATION.md](./NEW_ORDER_PAGE_DOCUMENTATION.md) for complete documentation.


# New Order Page - Quick Reference Guide

**For Developers**

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
| `new-order-context.tsx`` | Context provider |
| `new-order-reducer.ts` | State reducer |
| `new-order-types.ts` | TypeScript types |
| `use-order-submission.ts` | Order submission logic |
| `use-category-products.ts` | Data fetching |
| `order-defaults.ts` | Constants |

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
// Structure
t('newOrder.title')
t('newOrder.customer.label')
t('newOrder.itemsGrid.addItem')
t('newOrder.orderSummary.total')
t('newOrder.payment.title')
t('newOrder.customItem.title')
t('newOrder.photoCapture.title')
```

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

---

## 📚 More Information

See [NEW_ORDER_PAGE_DOCUMENTATION.md](./NEW_ORDER_PAGE_DOCUMENTATION.md) for complete documentation.


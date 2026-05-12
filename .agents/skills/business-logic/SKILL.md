---
name: business-logic
description: Business logic, order lifecycle, workflow states, quality gates, and pricing rules. Use when implementing order features or understanding business workflows.
user-invocable: true
---

# Business Logic & Workflows

## Order Lifecycle

```
NEW → PROCESSING → QA → READY → DELIVERED → COMPLETED
```

## Order States

- **NEW**: Order created, awaiting processing
- **PROCESSING**: Items being cleaned
- **QA**: Quality assurance check
- **READY**: Ready for pickup/delivery
- **DELIVERED**: Delivered to customer
- **COMPLETED**: Payment received, order closed

## Workflow Transitions

```typescript
const validTransitions = {
  NEW: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['QA', 'CANCELLED'],
  QA: ['READY', 'PROCESSING'],  // Can return to processing if fails QA
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};
```

## Pricing Rules

### Base Pricing

- Price per item based on service type
- Weight-based pricing for bulk items
- Express service surcharge (20%)

### Discounts

- Loyalty points redemption
- Bulk order discounts
- Subscription/plan discounts

### Tax Calculation

```typescript
function calculateOrderTotal(items: OrderItem[], customerId: string) {
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);

  const discounts = calculateDiscounts(customerId, subtotal);
  const subtotalAfterDiscount = subtotal - discounts;

  const tax = subtotalAfterDiscount * getTaxRate();
  const total = subtotalAfterDiscount + tax;

  return { subtotal, discounts, tax, total };
}
```

## Quality Gates

### QA Checklist

- [ ] All items cleaned per specifications
- [ ] No damage to items
- [ ] Proper folding/packaging
- [ ] Customer special instructions followed

### Failed QA

If QA fails, order returns to PROCESSING with notes on what needs correction.

## Payment Workflows

### Payment Methods

- Cash on delivery
- Card payment
- Wallet/credit balance
- Multiple payment methods allowed per order

### Payment Recording

```typescript
{
  order_id: 'uuid',
  payment_method: 'CASH' | 'CARD' | 'WALLET',
  amount: 100.00,
  status: 'PENDING' | 'COMPLETED' | 'FAILED',
  payment_date: '2025-01-29T10:00:00Z'
}
```

## Customer Loyalty

### Points Earning

- Earn points on each completed order
- 1 point per OMR spent
- Bonus points for referrals

### Points Redemption

- Redeem points for discounts
- 100 points = 1 OMR discount
- Minimum redemption: 500 points

## Additional Resources

- See [reference.md](./reference.md) for complete business logic documentation

# 09 - Order State Discount/Tax

## Summary

Implemented discount and tax calculation in `useOrderState` hook. Uses a default 5% tax rate; discount is wired for future order-level discount inputs.

## File Affected

- `web-admin/app/dashboard/orders/new/hooks/useOrderState.ts`

## Code Before

```typescript
  useEffect(() => {
    const subtotal = state.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = 0; // TODO: Implement discount logic
    const tax = 0; // TODO: Implement tax logic
    const total = subtotal - discount + tax;
```

## Code After

```typescript
  useEffect(() => {
    const subtotal = state.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const orderDiscount = 0; // Can be extended with state.settings.orderDiscountPercent/Amount
    const afterDiscount = Math.max(0, subtotal - orderDiscount);
    const taxRate = 0.05; // Default 5%; can be fetched from tenant via useTenantSettings
    const tax = afterDiscount * taxRate;
    const total = afterDiscount + tax;
```

## Effects

- Totals now include tax; discount placeholder is ready for order-level discount.
- Future: Fetch tax rate from `useTenantSettings` or `TenantSettingsService.getSettingValue(tenantId, 'TENANT_TAX_RATE')`.
- Future: Add `orderDiscountPercent` / `orderDiscountAmount` to state.settings for manual discounts.

# 14 - Delivery OTP Sending

## Summary

Implemented sending delivery OTP to customer via SMS. After generating OTP, fetches customer phone from order and sends via shared sms-sender (Twilio when configured).

## File(s) Affected

- `web-admin/lib/services/delivery-service.ts`

## Issue

TODO: Send OTP to customer via WhatsApp/SMS - OTP was generated and stored but never sent to the customer.

## Code Before

```typescript
// Create/update POD record with OTP...
// TODO: Send OTP to customer via WhatsApp/SMS
logger.info('OTP generated successfully', ...);
```

## Code After

- After creating/updating POD, query `org_orders_mst` → `org_customers_mst(phone)` for customer phone
- If phone exists, call `sendSMS` from `@/lib/notifications/sms-sender` with delivery OTP message
- If no phone, log warning (OTP still generated; driver can share verbally if needed)

## Effects and Dependencies

- **Uses:** `lib/notifications/sms-sender` (Twilio when configured)
- **Env vars:** Same as doc 13 (TWILIO_*)
- **Message:** "Your CleanMateX delivery OTP is: {code}. Give this code to the driver upon delivery."

## Testing

1. Generate delivery OTP for order with customer phone: should receive SMS
2. Order without customer phone: OTP generated, warning logged, no SMS
3. Without Twilio config: dev mock; production logs warn

## Production Checklist

- [x] Customer phone resolved from order→customer
- [x] OTP sent via shared sms-sender
- [x] Graceful handling when no phone
- [ ] Ensure customer phone is collected for delivery orders

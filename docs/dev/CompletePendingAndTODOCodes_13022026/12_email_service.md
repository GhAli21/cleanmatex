# 12 - Email Service (Receipt)

## Summary

Implemented real email sending for receipts via Resend. When `RESEND_API_KEY` is set, sends emails. Otherwise logs in dev.

## File(s) Affected

- `web-admin/lib/notifications/email-sender.ts` (new)
- `web-admin/lib/services/receipt-service.ts`

## Issue

`sendViaEmail` in ReceiptService was a TODO stub that only logged.

## Code Before

```typescript
private static async sendViaEmail(...): Promise<void> {
  // TODO: Implement email sending
  logger.info('Sending receipt via Email', { tenantId, receiptId });
}
```

## Code After

- Created `lib/notifications/email-sender.ts` with `sendEmail()` using Resend when `RESEND_API_KEY` is set
- `sendViaEmail` fetches recipient email from receipt (recipient_email or order→customer→email), calls `sendEmail`, updates receipt status

## Effects and Dependencies

- **Package:** `resend`
- **Env vars:** `RESEND_API_KEY`, optionally `RESEND_FROM_EMAIL` (default: noreply@cleanmatex.com)
- **Behavior:** Real send when configured; dev mock when not

## Testing

1. Set RESEND_API_KEY, send receipt via email channel: should deliver
2. Without config in dev: should log mock and succeed
3. Without config in production: logs warn and returns false

## Production Checklist

- [x] Resend integration with env-based config
- [x] Recipient email resolved from receipt/order/customer
- [x] Graceful fallback when not configured
- [ ] Set RESEND_API_KEY and verify domain in Resend dashboard

# 13 - OTP Twilio Integration

## Summary

Replaced mock SMS in OTP service with real Twilio integration. When `TWILIO_*` env vars are set, sends real SMS. Otherwise dev mock.

## File(s) Affected

- `web-admin/lib/notifications/sms-sender.ts` (new)
- `web-admin/lib/services/otp.service.ts`

## Issue

`sendSMS` in otp.service.ts was a mock that only logged. TODO: Replace with actual Twilio integration.

## Code Before

```typescript
async function sendSMS(phone: string, message: string): Promise<boolean> {
  // TODO: Replace with actual Twilio integration
  console.log(`[SMS] Sending to ${phone}: ${message}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] OTP Code: ${message}`);
    return true;
  }
  return true; // In production, commented-out Twilio code
}
```

## Code After

- Created `lib/notifications/sms-sender.ts` with shared `sendSMS()` using Twilio when configured
- otp.service.ts imports and uses `sendSMSViaProvider` from sms-sender

## Effects and Dependencies

- **Package:** `twilio`
- **Env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **Shared:** sms-sender is used by otp.service and delivery-service

## Testing

1. Set Twilio env vars, request OTP: should receive real SMS
2. Without config in dev: should log mock and succeed
3. Without config in production: logs warn and returns false

## Production Checklist

- [x] Twilio integration with env-based config
- [x] Shared sms-sender for OTP and delivery
- [ ] Set TWILIO_* env vars in production
- [ ] Verify Twilio phone number is E.164 format

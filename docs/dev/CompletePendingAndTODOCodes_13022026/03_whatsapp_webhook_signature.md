# 03 - WhatsApp Webhook Signature Verification

## Summary

Implemented HMAC-SHA256 verification for WhatsApp webhook requests using `X-Hub-Signature-256` header. Prevents forged webhook calls.

## File(s) Affected

- `web-admin/app/api/v1/receipts/webhooks/whatsapp/route.ts`

## Issue

`verifyWebhookSignature` always returned `true`, allowing any POST to the webhook endpoint to be processed.

## Code Before

```typescript
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // TODO: Implement webhook signature verification
  return true;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const signature = request.headers.get('x-hub-signature-256') || '';
  if (webhookSecret && !verifyWebhookSignature(JSON.stringify(body), signature, webhookSecret)) {
```

## Code After

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature || !signature.startsWith('sha256=')) {
    return false;
  }
  const expectedHex = signature.slice(7);
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== 32) return false;
  const computed = createHmac('sha256', secret).update(payload).digest();
  return timingSafeEqual(computed, expected);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const body = JSON.parse(rawBody) as Record<string, unknown>;
  const signature = request.headers.get('x-hub-signature-256') || '';
  if (webhookSecret && !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
```

## Effects and Dependencies

- **Raw body:** Must read `request.text()` before parsing for correct signature verification (Meta signs exact bytes)
- **Env var:** `WHATSAPP_WEBHOOK_SECRET` (already used)
- **Security:** Uses `timingSafeEqual` to prevent timing attacks

## Testing

1. Send POST with valid Meta signature: should process
2. Send POST with invalid signature: should return 401
3. Send POST without WHATSAPP_WEBHOOK_SECRET: skips verification (no secret)

## Production Checklist

- [x] HMAC-SHA256 verification
- [x] timingSafeEqual for comparison
- [x] Raw body used for verification
- [ ] Ensure WHATSAPP_WEBHOOK_SECRET is set in production

# Production Readiness Checklist

Use this checklist before deploying TODO completion changes.

## Environment Variables

- [ ] `SUPABASE_JWT_SECRET` or `JWT_SECRET` (cmx-api)
- [ ] `WHATSAPP_WEBHOOK_SECRET` (web-admin)
- [ ] `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` (optional, for real storage)

## Security

- [ ] JWT guard verifies signature (cmx-api)
- [ ] WhatsApp webhook verifies X-Hub-Signature-256
- [ ] No hardcoded tenant IDs
- [ ] Tenant isolation on all queries

## Build and Tests

- [ ] `cd web-admin && npm run build` passes
- [ ] `cd cmx-api && npm run build` passes
- [ ] `npm run check:i18n` passes (if translations changed)

## Production setup

- SMS: Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.
- Email: Set RESEND_API_KEY, verify your domain in Resend, optionally set RESEND_FROM_EMAIL.

## Verification

- [ ] Quick Drop creates order under correct tenant
- [ ] Preparation preview uses tenant tax rate
- [ ] QR codes render in receipts
- [ ] Locale respects cookie/header

# Cursor / Claude / Copilot Implementation Prompt - CMX-PRD-019

You are implementing the CleanMateX Notification & Communication Hub based on CMX-PRD-019 Enterprise Edition.

## Non-negotiable rules

1. Do not send WhatsApp, SMS, email, or push directly from business modules.
2. Business modules must emit notification events.
3. NotificationModule is responsible for recipients, templates, preferences, policies, quotas, channel routing, outbox, dispatch, retries, fallback, and logs.
4. All tenant data must include tenant_org_id and comply with RLS.
5. All outbound attempts must be recorded in org_notification_delivery_log.
6. Use idempotency keys to prevent duplicate sends.
7. Enforce marketing consent before marketing messages.
8. Enforce feature flags and plan limits before paid channels.
9. Provider adapters must implement the common NotificationProviderAdapter interface.
10. Add tests for routing, templates, fallback, retries, consent, quota, and tenant isolation.

## First implementation slice

Implement:

- Database migration from 019_notification_schema.sql
- NotificationModule skeleton
- Event create API
- Orchestrator service
- Template renderer
- Channel router
- In-app notification center API
- FCM push adapter stub
- WhatsApp adapter interface stub
- SMS adapter interface stub
- Email adapter interface stub
- BullMQ workers for event and dispatch
- Delivery log repository
- Web Admin notification bell and notification center

Use the PRD, SQL file, OpenAPI file, event catalog, and template JSON included in this package.

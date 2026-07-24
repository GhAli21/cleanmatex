# CleanMateX Order Workflow V1 — Events, Notifications, and Integrations

**Document ID:** CMX-OW-V1-PACK-013  
**Version:** 1.0  
**Status:** Implementation specification

## 1. Principle

Workflow commits business state and outbox records together. Workers deliver notifications/integrations after commit.

## 2. Event envelope

Contains event ID/type/version, time, tenant, order/work group, correlation/causation, actor/source, and payload.

## 3. Core events

- order.confirmed
- order.physical_intake_confirmed
- order.workflow.stage_started/completed
- order.workflow.qa_failed
- order.ready/partially_ready
- order.hold_placed/resolved
- order.outsource.sent/returned/overdue
- order.release.created/verified
- order.collected
- order.delivery.dispatched/out_for_delivery/completed/failed
- order.fulfilment.partial/full
- order.cancelled/closed

## 4. Customer notifications

Order received, approval required, ready, partial fulfilment, remaining items ready, delivery scheduled, out for delivery, delivered, actionable delay, cancellation, return/rework update.

## 5. Staff notifications

QA failure, vendor overdue, missing piece, delivery failure, release blocked, SLA at risk, approval required, projection drift.

## 6. Channels

In-app, email, SMS, WhatsApp Business API, push where supported. Policy controls trigger, channel, language, template, quiet hours, retry, and recipient.

## 7. Localization

English/Arabic templates, variable validation, fallback, RTL-safe formatting, locale currency/date. Do not expose internal status codes to customers.

## 8. Outbox lifecycle

pending → processing → delivered/failed/dead_letter.

Consumers are idempotent, retry with backoff, record provider references, classify errors, and expose metrics/alerts.

## 9. Signed tenant webhooks

Versioned, signed, timestamped, retry-safe, secret rotation, endpoint validation, and delivery log.

## 10. Delivery integration

Provider/driver callbacks do not directly set order state. They invoke verified commands or reconciliation handlers.

## 11. Finance integration

Finance events refresh release and closure eligibility. Workflow never duplicates financial calculations.

## 12. Analytics

Time in stage, ready-by breach, QA failure, vendor turnaround, partial fulfilment, delivery success, blockers, and operator duration. Analytics is not workflow authority.

## 13. Acceptance criteria

- No provider call inside transition transaction.
- Duplicate event delivery is harmless.
- Customer messages use milestone projection.
- Notification failure does not roll back workflow.
- Event schemas are versioned.

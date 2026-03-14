---
version: v1.1.0
last_updated: 2026-03-14
author: CleanMateX Team
---

# B2B Feature Testing Scenarios

## Unit Tests

- **credit-limit-plan-cap.service**: capCreditLimitToPlan — null/zero plan, exceeds cap, within cap
- **dunning.service**: evaluateDunningLevels — below/at/above levels, empty levels, single level
- CreditLimitService: under limit, over limit, zero limit, is_credit_hold (blocks)
- B2BStatementsService.generate: empty invoices, multiple invoices
- B2BContactsService: one primary per customer enforcement

## Integration Tests

- **createWithPaymentRequestSchema**: creditLimitOverride true/false/omitted; B2B fields (b2bContractId, costCenterCode, poNumber)
- Order creation with B2B customer + credit check
- Order creation blocked when is_credit_hold
- Order creation with creditLimitOverride stores override_by/at
- Invoice creation sets invoice_type_cd B2B
- Statement generation links invoices

## E2E Tests (Optional)

- Create B2B customer → add contact → create order → generate statement → record payment
- Overdue statement → run dunning actions → verify email/SMS/hold

## Edge Cases

- B2B customer with no primary contact: dunning email/SMS falls back to customer email/phone
- Credit hold: new order returns B2B_CREDIT_HOLD
- Override in warn mode: order created with credit_limit_override_by/at

## Tenant Isolation

- API with tenant A token cannot access tenant B B2B data

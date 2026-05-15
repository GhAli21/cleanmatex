<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Error Catalog

| Error Code | HTTP | Meaning | Retry |
|---|---:|---|---|
| AMOUNT_MISMATCH | 400 | Client/server totals mismatch | Yes after refresh |
| GIFT_CARD_EXPIRED | 400 | Gift card expired | No |
| GIFT_CARD_SUSPENDED | 400 | Gift card unavailable | No |
| WALLET_INSUFFICIENT_BALANCE | 400 | Wallet insufficient | No |
| CREDIT_LIMIT_EXCEEDED | 400 | Customer credit limit exceeded | Depends |
| TAX_CONFIGURATION_MISSING | 500 | Tax setup missing | No |
| IDEMPOTENCY_CONFLICT | 409 | Same key different request | No |
| PAYMENT_CAPTURE_FAILED | 502 | Payment provider failed | Yes |
| RECONCILIATION_FAILURE | 500 | Financial mismatch | No |
| POSTING_VALIDATION_FAILED | 400 | Accounting mapping invalid | No |

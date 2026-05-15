<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Service Boundaries

## 1. Required Services

| Service | Responsibility |
|---|---|
| `OrderCommandService` | Create/update/confirm/void/close orders |
| `OrderQueryService` | Query order details and summaries |
| `PieceGenerationService` | Generate piece rows from quantity/templates |
| `PieceWorkflowService` | Manage piece stages/statuses |
| `PreferenceCommandService` | Create/confirm preferences |
| `PricingEngineService` | Calculate base item/service amounts |
| `ChargeCalculationService` | Generate charge rows |
| `PromotionEvaluationService` | Evaluate tenant promotions |
| `DiscountCalculationService` | Generate discount rows |
| `TaxCalculationService` | Calculate tax breakdown |
| `SettlementService` | Apply credits/payments and calculate outstanding |
| `PaymentCaptureService` | Record real payment legs |
| `StoredValueApplicationService` | Apply gift card/wallet/credit/advance |
| `GiftCardRedemptionService` | Validate and redeem gift cards |
| `WalletApplicationService` | Apply wallet balances |
| `CustomerCreditApplicationService` | Apply customer credit balances |
| `CustomerAdvanceApplicationService` | Apply advances |
| `LoyaltyService` | Earn/redeem/expire points |
| `InvoiceService` | Create invoice/AR documents |
| `RefundService` | Process refunds and reversals |
| `OrderFinancialRecalculationService` | Recompute summary from details |
| `ReconciliationService` | Detect mismatches |
| `OutboxService` | Write and process domain events |
| `AccountingPostingService` | Create accounting vouchers |
| `AuditTrailService` | Write audit logs |

## 2. Boundary Rules

- Order service must not directly mutate gift card balances.
- Payment service must not record wallet/gift-card as payments.
- Preference service must not directly alter accounting.
- Tax service must not depend on current tax config when reading historical orders.
- Posting service must consume events/facts, not UI requests.

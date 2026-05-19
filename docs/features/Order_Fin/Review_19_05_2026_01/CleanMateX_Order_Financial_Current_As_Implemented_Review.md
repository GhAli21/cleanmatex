# CleanMateX Order Financial Platform — Current As-Implemented Review

## 0. Review Scope and Method

- Directories scanned:
  - `supabase/migrations`
  - `web-admin/prisma/schema.prisma`
  - `web-admin/lib/services`
  - `web-admin/app/api/v1`
  - `web-admin/app/actions`
  - `web-admin/src/features`
  - `web-admin/__tests__`
  - `docs/features/Order_Fin/Review_19_05_2026_01`
- Keyword search strategy used:
  - searched exact expected table names first
  - searched service and API keywords such as `create-with-payment`, `collect-payment`, `payment_nature`, `idempotency_key`, `cash drawer`, `wallet`, `advance`, `credit note`, `gift card`, `loyalty`, `reconciliation`
  - searched for settlement concepts such as `REAL_PAYMENT`, `CREDIT_APPLICATION`, `DEFERRED_SETTLEMENT`, `settlement_leg`, `original_settlement_leg_id`
- Semantic matching strategy used:
  - treated equivalent business behavior as implemented even where names differ
  - mapped service-layer settlement behavior to expected settlement concepts where exact header/leg tables were not found
  - treated `org_order_credit_apps_dtl` as the equivalent of stored-value / credit application detail
  - treated `payment-modal-v3.tsx` and `create-with-payment` as the new-order checkout financial path
- Reference documents used only for structure and expected concepts:
  - `docs/features/Order_Fin/Review_19_05_2026_01/CleanMateX_Order_Financial_Platform_v2_3_LOCKED_FULL_Expanded_Detailed_Specification.md`
  - `docs/features/Order_Fin/Review_19_05_2026_01/CleanMateX_Order_Financial_Platform_v2_4_FINAL_Appendices.md`
  - only headings, section titles, and directly relevant comparison points were read
- Files not scanned in depth due to size or irrelevance:
  - large unrelated feature docs
  - unrelated non-financial UI
  - legacy project-wide files not tied to order financial behavior
  - full reference specification prose
- Limitations:
  - this review is code-and-migration based, not a live database runtime audit
  - no MCP database execution or schema mutation was performed
  - no browser walkthrough was needed
- No assumptions made:
  - anything marked missing was first checked by exact name, synonyms, related behavior, route presence, schema evidence, and UI evidence

## 1. Executive Summary

- Overall implementation status:
  - The Order Financial Platform is substantially implemented in the current codebase, especially for new-order checkout, financial fact tables, stored value, cash drawers, loyalty, promotions, outbox, and reconciliation.
  - The platform is not fully unified. A newer order-financial path coexists with a legacy payment path centered on `org_payments_dtl_tr` and `payment-service.ts`.
- Major implemented areas:
  - financial snapshot columns on `org_orders_mst`
  - immutable-style fact tables for charges, taxes, payments, credit applications, refunds
  - tenant payment method configuration and terminal/drawer configuration
  - new-order server-authoritative pricing and settlement flow
  - stored value ledgers for wallet, advances, credit notes, gift cards
  - loyalty program/account/ledger model
  - promotions with usage tracking and stacking fields
  - outbox and idempotency tables
  - basic reconciliation runs and UI
- Major missing or incomplete areas:
  - no database evidence found for `org_order_settlements_mst`
  - no database evidence found for `org_order_settlement_legs_dtl`
  - no explicit `settlement_id`, `settlement_leg_id`, or `original_settlement_leg_id` linkage model found in current tables
  - no clear `/api/v1/orders/checkout-options` route found
  - no clear `/api/v1/orders/[orderId]/payment-summary` route found
  - no dedicated tax engine service found under the expected name; tax is currently handled inside calculation logic and config APIs
  - no dedicated payment capture service found; capture behavior is split across new settlement flow and legacy `payment-service.ts`
- Major risks:
  - dual-ledger architecture between `org_order_*` financial tables and legacy `org_payments_dtl_tr`
  - settlement behavior exists in code, but settlement header/leg persistence model is absent or not yet implemented
  - gift card is currently treated partly like a discount in `order-calculation.service.ts`
  - some UI/reporting surfaces show only part of the available financial facts
  - at least one payment settings route appears to query a non-existent `branch_id` field on `org_payment_methods_cf`
- Recommended next actions:
  - treat the new `org_order_*` financial path as the current target architecture
  - close the dual-ledger seam before broader finance/reporting expansion
  - decide whether settlement header/leg persistence is required or whether the current service-level leg model is sufficient
  - align gift-card treatment with liability / credit application intent
  - expand reconciliation and test coverage around cross-ledger consistency

## 2. Current Architecture Map

- Modules found:
  - checkout / order pricing: `web-admin/lib/services/order-calculation.service.ts`
  - checkout option grouping: `web-admin/lib/services/checkout-config.service.ts`
  - order settlement: `web-admin/lib/services/order-settlement.service.ts`
  - legacy payment CRUD: `web-admin/lib/services/payment-service.ts`
  - cash drawer: `web-admin/lib/services/cash-drawer.service.ts`
  - stored value: `web-admin/lib/services/stored-value.service.ts`
  - gift cards: `web-admin/lib/services/gift-card-service.ts`
  - loyalty: `web-admin/lib/services/loyalty.service.ts`
  - promotions: `web-admin/lib/services/promotion-engine.service.ts`
  - refunds: `web-admin/lib/services/order-refund.service.ts`
  - outbox: `web-admin/lib/services/outbox.service.ts`
  - reconciliation: `web-admin/lib/services/reconciliation.service.ts`
- Database objects found:
  - order financial snapshot and detail tables in `web-admin/prisma/schema.prisma`
  - payment config and terminal/drawer tables from migrations `0269` to `0293`
  - stored-value, loyalty, promo, tax, outbox, idempotency, reconciliation tables
- APIs found:
  - checkout preview and create-with-payment
  - collect payment
  - cash drawer open/close/movement/summary
  - customer stored value summary and ledgers
  - gift card balance and ledger
  - promotions CRUD and validation
  - tax config CRUD
  - payment settings methods and terminals
  - finance reports and reconciliation
- UI found:
  - new-order payment modal `web-admin/src/features/orders/ui/payment-modal-v3.tsx`
  - order financial tab `web-admin/src/features/orders/ui/orders-financial-tab-rprt.tsx`
  - payment settings tabs `web-admin/src/features/payment-config/ui/*`
  - cashup / cash drawer pages `web-admin/src/features/billing/ui/*`
  - stored value hub and customer tab `web-admin/src/features/customers/ui/*`
  - promotions, loyalty, gift cards `web-admin/src/features/marketing/ui/*`
  - tax settings `web-admin/src/features/settings/tax/ui/tax-setup-client.tsx`
- Tests found:
  - settlement, refund, reconciliation, cash drawer, loyalty, outbox, gift card, legacy payment service
  - integration tests for promo + gift card, multi-payment, gift-card redemption, refund flow, reconciliation
- Semantic mappings found where names differ:
  - Expected settlement logic:
    - Current implemented name: `order-settlement.service.ts`
    - Why equivalent: processes multi-leg payments, routes by `payment_nature`, updates order snapshot
  - Expected checkout options:
    - Current implemented name: `checkout-config.service.ts`
    - Why equivalent: groups methods into payment methods, credit applications, deferred settlement, AR options
  - Expected customer stored-value summary:
    - Current implemented name: `getStoredValueSummary` and `CustomerStoredValueTab`
  - Expected payment summary:
    - Current implemented name: `getOrderFinancialAction` and `OrdersFinancialTabRprt`
    - Difference: server action + UI component, not a dedicated REST payment-summary route

## 3. Database Implementation Review

### Order Core

Status:
- Implemented

Evidence:
- `web-admin/prisma/schema.prisma:865`
- `supabase/migrations/0282_orders_financial_snapshot.sql`

Expected concept:
- `org_orders_mst` with financial snapshot, payment status, outstanding amount, totals

Current implementation:
- `org_orders_mst` includes:
  - `payment_status`
  - `total_charges_amount`
  - `total_discount_amount`
  - `total_tax_amount`
  - `total_credit_applied_amount`
  - `total_paid_amount`
  - `net_receivable_amount`
  - `pay_on_collection_amount`
  - `rounding_adjustment_amount`
  - `change_returned_amount`
  - `outstanding_amount`
  - `idempotency_key`

Equivalent names / semantic mapping:
- same concept and same table name

Gaps:
- `payment_status` DB enum enforcement is weak; the stronger check appears commented out in migration `0282`

Risk:
- inconsistent status strings could slip in if only app-layer enforcement is relied on

Recommended next action:
- preserve the snapshot model; tighten status consistency in a future additive pass if needed

### Order Items

Status:
- Implemented

Evidence:
- `web-admin/prisma/schema.prisma:677`

Expected concept:
- `org_order_items_dtl` or equivalent

Current implementation:
- `org_order_items_dtl` exists and includes pricing-, barcode-, and preference-related item fields

Equivalent names / semantic mapping:
- same concept and same table name

Gaps:
- none material for existence

Risk:
- none significant from reviewed evidence

Recommended next action:
- no action

### Pieces

Status:
- Implemented

Evidence:
- `web-admin/prisma/schema.prisma:5564`
- `web-admin/prisma/schema.prisma:4386`

Expected concept:
- `org_order_item_pieces_dtl`, piece quantity logic, templates, barcode/rack/workflow fields

Current implementation:
- `org_order_item_pieces_dtl` exists with:
  - `piece_seq`
  - `piece_code`
  - `barcode`
  - `piece_status`
  - `piece_stage`
  - `rack_location`
- product template support exists through `sys_service_prod_templates_cd.pieces_per_product`
- workflow template fields exist at order and category settings layers

Equivalent names / semantic mapping:
- same concept and same table name

Gaps:
- none material for structure

Risk:
- piece-level financial linkage is not evident in reviewed code; current pricing remains order/item oriented

Recommended next action:
- no structural change; document current piece-to-finance separation if future reporting depends on it

### Preferences

Status:
- Implemented

Evidence:
- `web-admin/prisma/schema.prisma:751`
- `web-admin/prisma/schema.prisma:768`
- `web-admin/lib/services/order-settlement.service.ts`

Expected concept:
- `org_order_preferences_dtl`, preference levels, extra price, stains/damage/color/packing/notes

Current implementation:
- `org_order_preferences_dtl` exists with polymorphic preference references and `extra_price`
- order item and piece structures also carry stain/damage/color/packing related fields
- `order-settlement.service.ts` writes `org_order_charges_dtl` rows, including preference-type charges

Equivalent names / semantic mapping:
- same concept; charge realization is implemented via `org_order_charges_dtl`

Gaps:
- direct evidence of every preference flavor producing a charge row was not fully enumerated from runtime code

Risk:
- preference metadata and financial charge rows could drift if all surcharge sources are not normalized the same way

Recommended next action:
- preserve current model; add scenario tests around preference surcharge posting

### Charges

Status:
- Implemented

Evidence:
- `supabase/migrations/0280_order_charges_dtl.sql`
- `web-admin/prisma/schema.prisma:6501`
- `web-admin/lib/services/order-settlement.service.ts`

Expected concept:
- `org_order_charges_dtl`

Current implementation:
- immutable-style charge detail table exists
- charge types include `PREFERENCE`, `EXPRESS`, `BULK_SURCHARGE`, `SPECIAL_HANDLING`
- settlement service writes charge facts during order settlement

Equivalent names / semantic mapping:
- same concept and same table name

Gaps:
- no separate adjustments table was found to rebalance or reverse charge facts later

Risk:
- later corrections may be pushed into other mechanisms instead of a clean charge-adjustment ledger

Recommended next action:
- preserve current charge ledger; document correction path before expanding finance operations

### Discounts

Status:
- Implemented Differently

Evidence:
- `web-admin/prisma/schema.prisma:791`
- `web-admin/lib/services/order-calculation.service.ts`
- `web-admin/app/actions/orders/get-order-financial.ts`

Expected concept:
- `org_order_discounts_dtl` with promotion integration

Current implementation:
- `org_order_discounts_dtl` exists
- calculation service produces `discountLines`
- order financial fetch uses `getDiscountLinesForOrder`
- promotions are linked via `promotion_id` after migration `0288`

Equivalent names / semantic mapping:
- same table, but runtime population was inferred through helper flows rather than directly reviewed insert logic

Gaps:
- `order-calculation.service.ts` currently pushes `giftCardApplied` into `discountLines`

Risk:
- this conflicts with expected financial semantics where gift card is a liability / credit application, not a discount

Recommended next action:
- keep the discount ledger; review gift-card mapping before relying on discount reports

### Taxes

Status:
- Implemented

Evidence:
- `supabase/migrations/0281_order_taxes_dtl.sql`
- `web-admin/prisma/schema.prisma:6535`
- `web-admin/lib/services/order-settlement.service.ts`

Expected concept:
- `org_order_taxes_dtl`

Current implementation:
- tax fact table exists with `tax_type`, `rate`, `taxable_amount`, `tax_amount`, `is_compound`
- settlement service writes tax lines

Equivalent names / semantic mapping:
- same concept and same table name

Gaps:
- no separate dedicated tax engine service was found

Risk:
- tax rules are split between config and order calculation logic rather than isolated in a single tax engine module

Recommended next action:
- preserve the tax fact table; document current in-service tax calculation boundaries

### Settlement Header

Status:
- Not Implemented

Evidence:
- exact and semantic searches found no `org_order_settlements_mst` or equivalent persisted header table in migrations or Prisma schema

Expected concept:
- settlement header table

Current implementation:
- not found as a table

Equivalent names / semantic mapping:
- service-layer equivalent behavior exists in `web-admin/lib/services/order-settlement.service.ts`
- no persisted header row equivalent was found

Gaps:
- no DB-level settlement session/header identity for a checkout event

Risk:
- harder auditing of a full multi-leg checkout as a single settlement event

Recommended next action:
- needs business/architecture decision: either accept service-only settlement orchestration or introduce additive persisted header later

### Settlement Legs

Status:
- Partially Implemented

Evidence:
- `web-admin/lib/services/order-settlement.service.ts:54`
- `web-admin/lib/services/checkout-config.service.ts:162`
- no `org_order_settlement_legs_dtl` table found

Expected concept:
- persisted settlement legs / payment split lines

Current implementation:
- settlement legs exist as runtime objects:
  - normalized in `create-with-payment`
  - resolved in `resolveSettlementLeg`
  - processed in `settleOrder`
- no dedicated settlement-leg table found

Equivalent names / semantic mapping:
- implemented under runtime leg arrays rather than a persisted leg table

Gaps:
- no `settlement_leg_id`
- no `target_table` / `target_id` persisted per leg in a central leg ledger

Risk:
- leg-level audit and refund lineage are weaker than the reference model

Recommended next action:
- document current runtime leg model clearly before deciding whether persistence is required

### Payments

Status:
- Implemented

Evidence:
- `supabase/migrations/0271_v1_payment_linking_cols.sql`
- `supabase/migrations/0283_harden_credit_apps_refunds.sql`
- `web-admin/prisma/schema.prisma:6438`

Expected concept:
- `org_order_payments_dtl` real payments only

Current implementation:
- `org_order_payments_dtl` exists with method, terminal, drawer/session, tendered, change, gateway, auth/reference, status, idempotency
- `payment_nature_snapshot` is constrained to `REAL_PAYMENT`

Equivalent names / semantic mapping:
- same concept and same table name

Gaps:
- legacy `org_payments_dtl_tr` remains active elsewhere

Risk:
- same business event may be represented differently depending on path used

Recommended next action:
- preserve `org_order_payments_dtl` as the target ledger and reduce legacy divergence

### Credit Applications

Status:
- Implemented

Evidence:
- `supabase/migrations/0271_v1_payment_linking_cols.sql`
- `supabase/migrations/0283_harden_credit_apps_refunds.sql`
- `web-admin/prisma/schema.prisma:6362`

Expected concept:
- `org_order_credit_apps_dtl` or equivalent

Current implementation:
- separate credit application table exists
- migration comments explicitly state it is not a payment row
- stores balances, reference ids, and idempotency

Equivalent names / semantic mapping:
- same concept and same table name

Gaps:
- no settlement leg linkage columns were found

Risk:
- application-to-leg traceability is weaker than the reference baseline

Recommended next action:
- preserve separation from payments; improve lineage only if reporting requires it

### Refunds

Status:
- Implemented Differently

Evidence:
- `supabase/migrations/0271_v1_payment_linking_cols.sql`
- `supabase/migrations/0283_harden_credit_apps_refunds.sql`
- `web-admin/prisma/schema.prisma:6397`
- `web-admin/lib/services/order-refund.service.ts`

Expected concept:
- `org_order_refunds_dtl` with original settlement-leg reference

Current implementation:
- `org_order_refunds_dtl` exists
- migration `0283` moved refund FK to `org_order_payments_dtl`
- refund workflow service supports `PENDING_APPROVAL -> APPROVED -> PROCESSED`

Equivalent names / semantic mapping:
- same refund table, but linkage is to payment row, not settlement leg

Gaps:
- no `original_settlement_leg_id` found

Risk:
- original-leg refund integrity is weaker for complex split settlements

Recommended next action:
- preserve the refund table; decide whether payment-row linkage is sufficient for current business rules

### Adjustments

Status:
- Not Implemented

Evidence:
- no `org_order_adjustments_dtl` or equivalent adjustment ledger found in schema or migrations

Expected concept:
- order adjustments ledger

Current implementation:
- not found

Equivalent names / semantic mapping:
- no convincing equivalent found

Gaps:
- no explicit additive financial adjustment ledger

Risk:
- future corrections may be encoded through unrelated tables or manual edits

Recommended next action:
- only add if the business truly needs post-settlement corrections distinct from refunds/credits

### Stored Value: Gift Cards

Status:
- Implemented

Evidence:
- `supabase/migrations/0257_gift_card_v1_schema.sql`
- `web-admin/lib/services/gift-card-service.ts`
- `web-admin/app/api/v1/gift-cards/[cardCode]/balance/route.ts`
- `web-admin/app/api/v1/gift-cards/[cardCode]/ledger/route.ts`

Expected concept:
- gift card master and ledger with locking and idempotency

Current implementation:
- `org_gift_cards_mst` and `org_gift_card_txn_dtl` exist
- redemption and refund support idempotency and row-locking behavior
- APIs expose balance and ledger

Equivalent names / semantic mapping:
- same concept and table names

Gaps:
- in order calculation, gift card still bleeds into discount presentation

Risk:
- liability treatment can be obscured in breakdown/report layers

Recommended next action:
- preserve the ledger; align presentation and downstream mapping

### Stored Value: Wallet

Status:
- Implemented

Evidence:
- `supabase/migrations/0284_customer_wallets.sql`
- `web-admin/prisma/schema.prisma:6630`
- `web-admin/lib/services/stored-value.service.ts`
- `web-admin/app/api/v1/customers/[id]/wallet/*`

Expected concept:
- customer wallet master and ledger with balance before/after and locking

Current implementation:
- `org_customer_wallets_mst` and `org_wallet_txn_dtl` exist
- service uses `SELECT FOR UPDATE` semantics in redemption paths
- balance before/after and idempotency key exist

Equivalent names / semantic mapping:
- same concept and table names

Gaps:
- no dedicated reconciliation-by-wallet UI found beyond run issues

Risk:
- operational finance may depend on reconciliation runs rather than direct ledger tools

Recommended next action:
- no structural change; improve operational visibility if needed

### Stored Value: Advances

Status:
- Implemented

Evidence:
- `supabase/migrations/0285_customer_advances.sql`
- `web-admin/prisma/schema.prisma:6691`
- `web-admin/lib/services/stored-value.service.ts`
- `web-admin/app/api/v1/customers/[id]/advance/*`

Expected concept:
- advance master and ledger

Current implementation:
- `org_customer_advances_mst` and `org_advance_txn_dtl` exist with ledger/idempotency pattern

Equivalent names / semantic mapping:
- same concept and table names

Gaps:
- no direct new-order UI evidence found for selecting an advance as a checkout leg

Risk:
- backend capability may exceed current checkout UI exposure

Recommended next action:
- preserve current ledger; clarify whether new-order UI should expose advances now or later

### Stored Value: Credit Notes

Status:
- Implemented

Evidence:
- `supabase/migrations/0286_credit_notes.sql`
- `web-admin/prisma/schema.prisma:6752`
- `web-admin/lib/services/stored-value.service.ts`
- `web-admin/app/api/v1/customers/[id]/credit-note/issue/route.ts`

Expected concept:
- credit note master and ledger

Current implementation:
- `org_credit_notes_mst` and `org_credit_note_txn_dtl` exist
- service supports issue and redeem
- customer APIs and UI support issuance/listing

Equivalent names / semantic mapping:
- same concept and table names

Gaps:
- no direct checkout UI evidence found for selecting a specific credit note in new-order flow

Risk:
- backend credit-application support may not be fully surfaced in checkout

Recommended next action:
- preserve current ledger; map UI rollout intentionally

### Loyalty

Status:
- Implemented

Evidence:
- `supabase/migrations/0287_loyalty.sql`
- `web-admin/prisma/schema.prisma:6880`
- `web-admin/lib/services/loyalty.service.ts`
- `web-admin/app/api/v1/loyalty/config/route.ts`

Expected concept:
- program, tiers, account, ledger, earn/redeem

Current implementation:
- all four table types exist
- service supports account lookup, tier resolution, redemption, earn via outbox queue

Equivalent names / semantic mapping:
- same concept and table names

Gaps:
- no explicit expire worker or bonus campaign review was performed

Risk:
- advanced lifecycle features may exist only partially

Recommended next action:
- preserve core loyalty implementation; document unsupported advanced flows separately

### Promotions

Status:
- Implemented

Evidence:
- `supabase/migrations/0288_extend_promo_tables.sql`
- `web-admin/lib/services/promotion-engine.service.ts`
- `web-admin/app/api/v1/marketing/promotions/*`

Expected concept:
- promotions master, usage, coupon validation, stacking, limits

Current implementation:
- `org_promotions_mst` and `org_promotion_usage_dtl` exist
- supports active dates, usage limits, stackability fields, currency, idempotency
- validation and CRUD routes exist

Equivalent names / semantic mapping:
- `org_promo_codes_mst` legacy concept has been unified into `org_promotions_mst`

Gaps:
- duplicate promo logic concerns remain because both `promotion-engine.service.ts` and older discount logic paths exist

Risk:
- promo behavior can diverge if multiple engines continue evolving separately

Recommended next action:
- preserve current promotion tables; reduce logic duplication over time

### Tax Config

Status:
- Implemented

Evidence:
- `supabase/migrations/0289_tax_config.sql`
- `web-admin/prisma/schema.prisma:6573`
- `web-admin/app/api/v1/settings/tax/*`

Expected concept:
- tax profile and exemption config

Current implementation:
- `org_tax_profiles_cf` and `org_tax_exemptions_cf` exist
- GET/POST routes for profiles exist
- tax setup UI exists

Equivalent names / semantic mapping:
- same concept and table names

Gaps:
- no isolated tax engine module found

Risk:
- config exists, but rule execution is spread across pricing logic

Recommended next action:
- no schema change; document current execution path clearly

### Payment Config

Status:
- Implemented

Evidence:
- `supabase/migrations/0269_v1_payment_config_client.sql`
- `web-admin/prisma/schema.prisma:6101`
- `web-admin/app/api/v1/settings/payments/methods/route.ts`

Expected concept:
- `org_payment_methods_cf` with routing fields and checkout flags

Current implementation:
- `org_payment_methods_cf` contains:
  - `payment_nature`
  - `allowed_for_pay_now`
  - `allowed_for_pay_on_collection`
  - `allowed_for_invoice_payment`
  - `credit_application_type`
  - `requires_cash_drawer`
  - `requires_terminal`
  - gateway and amount-limit fields

Equivalent names / semantic mapping:
- same concept and table name

Gaps:
- GET route filters by `branch_id`, but table definition reviewed in migration `0269` does not show `branch_id`

Risk:
- route/runtime mismatch or latent bug in payment settings retrieval

Recommended next action:
- verify this route against the real Prisma model and intended branch override design

### Gateway Config

Status:
- Implemented

Evidence:
- `supabase/migrations/0269_v1_payment_config_client.sql`
- `web-admin/prisma/schema.prisma:6101`
- `web-admin/prisma/schema.prisma:6210`

Expected concept:
- payment gateway configuration and terminal linkage

Current implementation:
- payment methods and terminals both carry `gateway_code`
- unique combination exists on tenant + method + gateway
- terminal records can carry merchant and serial metadata

Equivalent names / semantic mapping:
- same concept, distributed across method and terminal config tables

Gaps:
- no fully integrated gateway capture engine found in the new-order flow

Risk:
- configured gateway-aware methods may still behave like immediate accepted payments without external capture confirmation

Recommended next action:
- preserve config model; document runtime capture limitations clearly

### Cash Drawer

Status:
- Implemented

Evidence:
- `supabase/migrations/0270_v1_cash_drawer_tables.sql`
- `web-admin/prisma/schema.prisma:6247`
- `web-admin/lib/services/cash-drawer.service.ts`

Expected concept:
- drawer, session, movement, one-open-session, expected cash, over/short

Current implementation:
- drawer, session, and movement tables exist
- partial unique index enforces one open session per drawer
- session tracks `expected_cash_amount`, `counted_cash_amount`, `difference_amount`
- movement table can link to `order_payment_id`

Equivalent names / semantic mapping:
- same concept and table names

Gaps:
- no explicit settlement_id linkage
- service-generated session numbering may not use the DB function from migration

Risk:
- numbering consistency and lineage could diverge from DB-generated expectations

Recommended next action:
- preserve the drawer/session model; verify session numbering strategy

### Currency/Rounding

Status:
- Partially Implemented

Evidence:
- `supabase/migrations/0290_currency_rounding.sql`
- `supabase/migrations/0282_orders_financial_snapshot.sql`
- `web-admin/lib/services/order-calculation.service.ts`

Expected concept:
- currency catalog, rounding rules, tendered and change handling

Current implementation:
- system rounding rules table exists
- orders have `rounding_adjustment_amount`
- new-order calculations round per tenant decimal places
- cash legs support tendered amount and change returned

Equivalent names / semantic mapping:
- same concept, split across orders snapshot and system config

Gaps:
- no strong evidence that `sys_currency_rounding_rules_cd` is actively used by order settlement

Risk:
- rounding behavior may be application-derived rather than centrally rule-driven

Recommended next action:
- preserve current fields; verify whether rounding rules are configuration-active or future-ready only

### Outbox

Status:
- Implemented

Evidence:
- `supabase/migrations/0292_outbox_idempotency.sql`
- `web-admin/prisma/schema.prisma:7006`
- `web-admin/lib/services/outbox.service.ts`

Expected concept:
- domain events outbox with retry handling

Current implementation:
- `org_domain_events_outbox` exists
- service supports emit, claim, process, fail, retry scheduling
- retry columns and max attempts are implemented

Equivalent names / semantic mapping:
- same concept and table name

Gaps:
- no dedicated worker file was reviewed in this pass

Risk:
- if no runtime processor is deployed, events could accumulate

Recommended next action:
- preserve outbox design; confirm deployment/runtime worker ownership

### Idempotency

Status:
- Implemented

Evidence:
- `supabase/migrations/0253_orders_idempotency_key.sql`
- `supabase/migrations/0292_outbox_idempotency.sql`
- `web-admin/app/api/v1/orders/create-with-payment/route.ts`

Expected concept:
- idempotency for financial mutations

Current implementation:
- `org_orders_mst.idempotency_key`
- `org_idempotency_keys`
- idempotency columns and unique constraints on payments, credit apps, refunds, wallet, advance, credit note, loyalty, promo usage, gift card ledger

Equivalent names / semantic mapping:
- same concept, broader than baseline in several ledgers

Gaps:
- the generic `org_idempotency_keys` table existence is strong, but usage was not found across every financial mutation path

Risk:
- some mutations rely on local ledger uniqueness instead of a unified idempotency contract

Recommended next action:
- preserve current additive pattern; document which mutations use generic vs local idempotency

### Reconciliation

Status:
- Implemented Differently

Evidence:
- `supabase/migrations/0293_reconciliation.sql`
- `web-admin/lib/services/reconciliation.service.ts`
- `web-admin/app/api/v1/finance/reconciliation/*`

Expected concept:
- broad financial reconciliation

Current implementation:
- run and issue tables exist
- service currently performs limited checks and writes issues

Equivalent names / semantic mapping:
- same reconciliation concept and tables, but narrower rule catalog than the reference baseline

Gaps:
- current run logic appears to compute only three checks

Risk:
- reconciliation status may imply broader assurance than is actually implemented

Recommended next action:
- preserve the framework; clearly label the current checks and extend only where needed

### Permissions/RBAC

Status:
- Implemented

Evidence:
- route permissions found across:
  - `orders:create`
  - `orders:collect_payment`
  - `cash_drawer:view`
  - `cash_drawer:open_session`
  - `cash_drawer:close_session`
  - `cash_drawer:record_movement`
  - `stored_value:view`
  - `stored_value:top_up_wallet`
  - `stored_value:issue_advance`
  - `stored_value:issue_credit_note`
  - `gift_cards:view`
  - `promotions:view`
  - `promotions:manage`
  - `tax:view_config`
  - `tax:manage_config`
  - `payment_config:view`
  - `payment_config:manage`
  - `finance_reports:view`
  - `reconciliation:view`
  - `reconciliation:run`
  - `reconciliation:acknowledge`

Expected concept:
- settlement / drawer / promo / tax / finance RBAC

Current implementation:
- route-level permission middleware is broadly present

Equivalent names / semantic mapping:
- same concept; enforced through `requirePermission`

Gaps:
- DB permission seed review was outside this pass

Risk:
- code-defined permission usage may outrun seeded permission coverage if migrations were missed elsewhere

Recommended next action:
- verify seed alignment during RBAC review, but no structural issue is evident here

## 4. Service Layer Implementation Review

### Checkout Config / Checkout Options

Status:
- Implemented

Files found:
- `web-admin/lib/services/checkout-config.service.ts`

Methods/functions found:
- `getCheckoutOptions`
- `resolveSettlementLeg`

Equivalent names / semantic mapping:
- same expected service name

Current behavior:
- loads active `org_payment_methods_cf`
- filters unavailable methods
- groups into `paymentMethods`, `creditApplications`, `deferredSettlement`, `arOptions`
- enriches wallet, advance, credit note, and loyalty balances
- resolves leg requirements such as drawer/terminal flags

Gaps:
- no public checkout-options API route found in this pass

Risk:
- service capability may not be exposed to the UI through a stable route yet

Recommended next action:
- preserve service; decide whether the intended consumer is server action only or a missing route

### Order Calculation / Financial Breakdown

Status:
- Implemented

Files found:
- `web-admin/lib/services/order-calculation.service.ts`

Methods/functions found:
- `calculateOrderTotals`
- `toFinancialBreakdownSnapshot`

Equivalent names / semantic mapping:
- same expected concept

Current behavior:
- prices items
- applies manual discount
- selects auto rule
- evaluates promo stacking
- calculates VAT and additional tax
- validates/applies gift card cap
- returns breakdown snapshot fields and discount lines

Gaps:
- gift card is included in `discountLines`

Risk:
- financial classification can drift between calculation output and ledger intent

Recommended next action:
- preserve the pricing flow; fix only the semantic classification path if required

### Order Settlement / Multi-Leg Settlement

Status:
- Implemented Differently

Files found:
- `web-admin/lib/services/order-settlement.service.ts`

Methods/functions found:
- `settleOrder`
- `collectPaymentTx`

Equivalent names / semantic mapping:
- same settlement concept, but persisted header/leg tables not found

Current behavior:
- writes charges, taxes, discounts
- routes legs by `payment_nature`
- posts real payments to `org_order_payments_dtl`
- posts credit applications to `org_order_credit_apps_dtl`
- marks deferred orders as `PENDING_COLLECTION`
- updates order snapshot and emits outbox

Gaps:
- no settlement header/leg DB persistence
- `AR_ALLOCATION` and `INTERNAL_ADJUSTMENT` show no active V1 behavior

Risk:
- auditing and advanced allocation behavior remain incomplete relative to the target model

Recommended next action:
- preserve current service; document unsupported leg natures clearly

### Payment Capture

Status:
- Partially Implemented

Files found:
- `web-admin/lib/services/order-settlement.service.ts`
- `web-admin/lib/services/payment-service.ts`

Methods/functions found:
- new-order posting is embedded in `settleOrder`
- legacy processing in `processPayment`, `recordPaymentTransaction`

Equivalent names / semantic mapping:
- expected capture behavior is split across settlement and legacy payment service

Current behavior:
- cash/check/bank/card method capture is recorded as payment rows
- cash supports tendered/change
- drawer/terminal requirements can be enforced by config resolution
- gateway-oriented legacy methods still appear to be placeholder-complete in legacy service logic

Gaps:
- no dedicated `payment-capture.service.ts`
- no verified external gateway capture completion path in the new-order flow

Risk:
- some non-cash methods may be treated as settled before real external confirmation

Recommended next action:
- preserve current split; document which methods are accounting-complete vs gateway-complete

### Stored Value

Status:
- Implemented

Files found:
- `web-admin/lib/services/stored-value.service.ts`
- `web-admin/lib/services/gift-card-service.ts`

Methods/functions found:
- wallet top-up/redeem
- advance issue/redeem
- credit note issue/redeem
- gift card validate/redeem/refund

Equivalent names / semantic mapping:
- same expected concept, split between generic stored value and gift card service

Current behavior:
- uses ledger rows with before/after balances
- uses idempotency
- redemption paths use locking behavior

Gaps:
- reversal semantics are split across services

Risk:
- cross-stored-value consistency depends on multiple service implementations staying aligned

Recommended next action:
- preserve the services; keep reconciliation coverage strong

### Cash Drawer

Status:
- Implemented

Files found:
- `web-admin/lib/services/cash-drawer.service.ts`

Methods/functions found:
- `getDrawers`
- `openSession`
- `closeSession`
- `recordMovement`
- `getSessionSummary`
- `validateDrawerForCashPayment`

Equivalent names / semantic mapping:
- same expected concept

Current behavior:
- enforces one open session
- opens/closes sessions
- computes expected cash and variance
- supports cash in/out style movements
- validates open drawer before cash settlement

Gaps:
- no settlement id linkage

Risk:
- tracing drawer cash to a settlement event is at payment-row granularity only

Recommended next action:
- preserve current service; improve traceability only if audit requires it

### Promotion Engine

Status:
- Implemented

Files found:
- `web-admin/lib/services/promotion-engine.service.ts`

Methods/functions found:
- `getAutoApplyPromotions`
- `validatePromoCode`
- `calculatePromotionDiscount`
- `applyPromotionTx`
- `listPromotions`
- `createPromotion`
- `togglePromotionActive`

Equivalent names / semantic mapping:
- same concept

Current behavior:
- handles CRUD and validation
- supports auto-apply and code-based promotions

Gaps:
- overlap exists with older discount/promo logic in calculation stack

Risk:
- promotion business rules may drift if duplicated

Recommended next action:
- preserve engine; reduce duplicated rule sources over time

### Tax Engine

Status:
- Not Implemented

Files found:
- no dedicated `tax-engine.service.ts` found

Methods/functions found:
- not found as a dedicated service

Equivalent names / semantic mapping:
- tax behavior is embedded in `order-calculation.service.ts` and tax config routes

Current behavior:
- VAT and additional tax are calculated in order totals flow

Gaps:
- no isolated tax execution service

Risk:
- tax rule complexity may become harder to evolve and test

Recommended next action:
- no redesign needed now; document embedded tax behavior as current implementation

### Loyalty

Status:
- Implemented

Files found:
- `web-admin/lib/services/loyalty.service.ts`

Methods/functions found:
- `getLoyaltyConfig`
- `getLoyaltyAccount`
- `getCustomerTier`
- `redeemPointsTx`
- `queueEarnPoints`

Equivalent names / semantic mapping:
- same concept

Current behavior:
- reads config and account
- redeems points with ledger posting
- queues earn event via outbox

Gaps:
- no broad expiry/bonus workflow review was performed

Risk:
- advanced lifecycle coverage remains unclear

Recommended next action:
- preserve core behavior; review advanced cases only if needed

### Refunds

Status:
- Implemented Differently

Files found:
- `web-admin/lib/services/order-refund.service.ts`
- `web-admin/lib/services/payment-service.ts`

Methods/functions found:
- order refunds: `initiateRefund`, `approveRefund`, `processRefund`, `getOrderRefunds`
- legacy payment refunds: refund/cancel behavior in `payment-service.ts`

Equivalent names / semantic mapping:
- refund capability exists in both new and legacy stacks

Current behavior:
- new refund flow supports approval workflow and outbox emission
- legacy flow handles old payment ledger rows

Gaps:
- refunds are not unified on one ledger model

Risk:
- operations and reports can diverge depending on which payment path created the original transaction

Recommended next action:
- preserve working refund paths; prioritize documenting allowed refund path per payment origin

### Outbox

Status:
- Implemented

Files found:
- `web-admin/lib/services/outbox.service.ts`

Methods/functions found:
- `emitEventTx`
- `claimBatch`
- `markProcessed`
- `markFailed`
- `scheduleRetry`

Equivalent names / semantic mapping:
- same expected concept

Current behavior:
- writes pending events
- supports retry scheduling with bounded attempts

Gaps:
- no processor runtime review in this pass

Risk:
- delivery assurance depends on external worker deployment

Recommended next action:
- preserve current service; validate operations pipeline separately

### Reconciliation

Status:
- Partially Implemented

Files found:
- `web-admin/lib/services/reconciliation.service.ts`

Methods/functions found:
- `runReconciliation`
- `acknowledgeIssue`
- `listReconRuns`
- `getReconRunWithIssues`

Equivalent names / semantic mapping:
- same concept

Current behavior:
- runs checks and writes issues
- status becomes `PASSED`, `FAILED`, or `PARTIAL`
- current implementation appears to count three checks

Gaps:
- limited check catalog versus expected broader finance reconciliation

Risk:
- false confidence if stakeholders assume full-spectrum reconciliation

Recommended next action:
- preserve the framework; describe the current checks explicitly in product docs

## 5. API Implementation Review

### Checkout Options

Status:
- Not Implemented

Routes found:
- not found

Files:
- service exists at `web-admin/lib/services/checkout-config.service.ts`

Equivalent routes / semantic mapping:
- no dedicated `/api/v1/orders/checkout-options` or obvious equivalent route was found

Request/response found:
- not found

Validation:
- not applicable

Permissions:
- not found

Gaps:
- API exposure for checkout options is absent from reviewed routes

Recommended next action:
- clarify whether this is intentionally server-only or still pending route exposure

### Preview Payment

Status:
- Implemented

Routes found:
- `POST /api/v1/orders/preview-payment`

Files:
- `web-admin/app/api/v1/orders/preview-payment/route.ts`

Equivalent routes / semantic mapping:
- same concept

Request/response found:
- request validated by `previewPaymentRequestSchema`
- response returns authoritative totals and optional credit-limit data

Validation:
- Zod schema + CSRF

Permissions:
- `orders:create`

Gaps:
- none material

Recommended next action:
- no action

### Create With Payment

Status:
- Implemented

Routes found:
- `POST /api/v1/orders/create-with-payment`

Files:
- `web-admin/app/api/v1/orders/create-with-payment/route.ts`

Equivalent routes / semantic mapping:
- same concept

Request/response found:
- request validated by `createWithPaymentRequestSchema`
- response includes order id / order number / status

Validation:
- Zod schema + CSRF + server-side total recomputation + split/deferred/check validation + idempotency lookup

Permissions:
- `orders:create`

Gaps:
- no dedicated persisted settlement header/leg is written

Recommended next action:
- preserve route; document its dual-transaction settlement behavior

### Collect Payment

Status:
- Implemented

Routes found:
- `POST /api/v1/orders/[id]/collect-payment`

Files:
- `web-admin/app/api/v1/orders/[id]/collect-payment/route.ts`

Equivalent routes / semantic mapping:
- same concept

Request/response found:
- request includes `paymentLegs[]`, optional drawer session, collector id
- response returns settlement result or business error

Validation:
- Zod + CSRF

Permissions:
- `orders:collect_payment`

Gaps:
- no explicit pay-on-delivery variant route found

Recommended next action:
- preserve current pay-on-collection route and clarify pay-on-delivery semantics separately

### Payment Summary

Status:
- Implemented Differently

Routes found:
- no dedicated REST route found

Files:
- `web-admin/app/actions/orders/get-order-financial.ts`
- `web-admin/src/features/orders/ui/orders-financial-tab-rprt.tsx`

Equivalent routes / semantic mapping:
- server action + component act as the current payment-summary equivalent

Request/response found:
- returns charges, taxes, payments, discounts, refunds

Validation:
- session-driven action, not route-schema based

Permissions:
- resolved through authenticated action context, not explicitly reviewed as route middleware

Gaps:
- no dedicated `/api/v1/orders/[orderId]/payment-summary`

Recommended next action:
- preserve current action-driven approach unless external API consumers require REST

### Cash Drawer

Status:
- Implemented

Routes found:
- `GET /api/v1/cash-drawers`
- `POST /api/v1/cash-drawers/[drawerId]/open-session`
- `POST /api/v1/cash-drawers/[drawerId]/close-session`
- `POST /api/v1/cash-drawers/[drawerId]/cash-movement`
- `GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/summary`

Files:
- `web-admin/app/api/v1/cash-drawers/*`

Equivalent routes / semantic mapping:
- same expected area

Request/response found:
- open and close use small Zod bodies
- movement supports `CASH_IN`, `CASH_OUT`, `PETTY_CASH`

Validation:
- Zod + CSRF for mutations

Permissions:
- `cash_drawer:view`
- `cash_drawer:open_session`
- `cash_drawer:close_session`
- `cash_drawer:record_movement`

Gaps:
- no explicit drop/safe-drop movement type found in reviewed route

Recommended next action:
- preserve current API set; document supported movement types clearly

### Stored Value

Status:
- Implemented

Routes found:
- `GET /api/v1/customers/[id]/stored-value`
- `GET /api/v1/customers/[id]/wallet/ledger`
- `POST /api/v1/customers/[id]/wallet/top-up`
- `GET /api/v1/customers/[id]/advance/ledger`
- `POST /api/v1/customers/[id]/advance/issue`
- `POST /api/v1/customers/[id]/credit-note/issue`
- `GET /api/v1/customers/[id]/credit-notes`

Files:
- `web-admin/app/api/v1/customers/[id]/*`

Equivalent routes / semantic mapping:
- same area

Request/response found:
- summary and ledger responses are straightforward tenant-scoped payloads

Validation:
- Zod on mutation routes

Permissions:
- `stored_value:view`
- `stored_value:top_up_wallet`
- `stored_value:issue_advance`
- `stored_value:issue_credit_note`

Gaps:
- no public redeem routes reviewed; redemption mainly occurs through checkout/service layer

Recommended next action:
- preserve current API split

### Gift Cards

Status:
- Implemented

Routes found:
- `GET /api/v1/gift-cards/[cardCode]/balance`
- `GET /api/v1/gift-cards/[cardCode]/ledger`

Files:
- `web-admin/app/api/v1/gift-cards/*`

Equivalent routes / semantic mapping:
- same area

Request/response found:
- returns card summary or card plus transactions

Validation:
- path parameter only

Permissions:
- `gift_cards:view`

Gaps:
- no direct redeem route reviewed; redemption is embedded in checkout/service layer

Recommended next action:
- no action

### Promotions

Status:
- Implemented

Routes found:
- `GET /api/v1/marketing/promotions`
- `POST /api/v1/marketing/promotions`
- `GET /api/v1/marketing/promotions/[promoId]`
- `PATCH /api/v1/marketing/promotions/[promoId]`
- `DELETE /api/v1/marketing/promotions/[promoId]`
- `POST /api/v1/marketing/promotions/validate`

Files:
- `web-admin/app/api/v1/marketing/promotions/*`

Equivalent routes / semantic mapping:
- same expected area

Request/response found:
- CRUD + validation payloads through Zod

Validation:
- Zod on create/patch/validate

Permissions:
- `promotions:view`
- `promotions:manage`

Gaps:
- none material

Recommended next action:
- no action

### Tax

Status:
- Implemented

Routes found:
- `GET /api/v1/settings/tax/profiles`
- `POST /api/v1/settings/tax/profiles`
- additional tax exemption/profile routes exist under the same folder

Files:
- `web-admin/app/api/v1/settings/tax/*`

Equivalent routes / semantic mapping:
- same expected area

Request/response found:
- profile config CRUD style payloads

Validation:
- Zod on mutations

Permissions:
- `tax:view_config`
- `tax:manage_config`

Gaps:
- tax execution remains outside a dedicated API

Recommended next action:
- no action

### Payment Settings

Status:
- Implemented

Routes found:
- `GET /api/v1/settings/payments/methods`
- `GET /api/v1/settings/payments/terminals`
- `POST /api/v1/settings/payments/terminals`

Files:
- `web-admin/app/api/v1/settings/payments/*`

Equivalent routes / semantic mapping:
- same expected area

Request/response found:
- methods list and terminal CRUD payloads

Validation:
- Zod on terminal create

Permissions:
- `payment_config:view`
- `payment_config:manage`

Gaps:
- branch overrides route was not directly reviewed in this pass
- method GET route likely contains a branch filter issue

Recommended next action:
- verify route/model alignment before depending on branch filtering

### Reports/Reconciliation

Status:
- Implemented

Routes found:
- `GET /api/v1/finance/reports/payments-breakdown`
- `GET /api/v1/finance/reports/tax-report`
- `GET /api/v1/finance/reconciliation/runs`
- `POST /api/v1/finance/reconciliation/runs`
- `GET /api/v1/finance/reconciliation/runs/[runId]`
- `PATCH /api/v1/finance/reconciliation/issues/[issueId]`

Files:
- `web-admin/app/api/v1/finance/*`

Equivalent routes / semantic mapping:
- same expected area

Request/response found:
- tax report supports JSON and CSV
- payments breakdown groups by payment method id
- reconciliation run API supports date range and currency

Validation:
- Zod on reconciliation mutations

Permissions:
- `finance_reports:view`
- `reconciliation:view`
- `reconciliation:run`
- `reconciliation:acknowledge`

Gaps:
- report catalog is still narrower than the full expected finance pack

Recommended next action:
- preserve current reports; prioritize only high-value additions

## 6. UI/UX Implementation Review

### Checkout Financial Summary

Status:
- Implemented

Files/components found:
- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`

Equivalent screens/components / semantic mapping:
- current new-order payment modal

Current behavior:
- shows subtotal, rules discount, manual discount, promo discount, tax, gift card applied, total
- fetches `/api/v1/orders/preview-payment`

Missing behavior:
- no explicit settlement history or persisted leg identity at checkout time

Recommended next action:
- no redesign; keep as the current summary surface

### Payment Methods Section

Status:
- Implemented

Files/components found:
- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`

Equivalent screens/components / semantic mapping:
- current payment-method selection area

Current behavior:
- supports method selection, check details, immediate/deferred logic, split legs

Missing behavior:
- no evidence of dynamic checkout-options service-driven grouping in the UI

Recommended next action:
- clarify whether current hardcoded UI options should remain or later bind to `checkout-config.service.ts`

### Credit Applications Section

Status:
- Partially Implemented

Files/components found:
- `payment-modal-v3.tsx`
- `customer-stored-value-tab.tsx`

Equivalent screens/components / semantic mapping:
- stored value management exists

Current behavior:
- gift card is surfaced in checkout
- customer stored-value management UI exists outside checkout

Missing behavior:
- no clear in-checkout wallet / advance / credit note selection UI was confirmed in this pass

Recommended next action:
- document backend capability vs current checkout exposure

### Deferred Settlement Section

Status:
- Implemented

Files/components found:
- `payment-modal-v3.tsx`

Equivalent screens/components / semantic mapping:
- `PAY_ON_COLLECTION` and `INVOICE` flows in modal

Current behavior:
- supports deferred method selection and related B2B fields

Missing behavior:
- no explicit `PAY_ON_DELIVERY` behavior was confirmed in the new-order UI

Recommended next action:
- document current deferred options exactly as shipped

### Invoice / AR Section

Status:
- Partially Implemented

Files/components found:
- `payment-modal-v3.tsx`
- legacy billing/invoice pages

Equivalent screens/components / semantic mapping:
- invoice/deferred handling exists

Current behavior:
- invoice-related B2B/deferred behavior is handled

Missing behavior:
- no clear AR allocation panel in new-order UI

Recommended next action:
- no redesign; document AR allocation as not surfaced in V1

### Unpaid Remainder Decision Panel

Status:
- Partially Implemented

Files/components found:
- `payment-modal-v3.tsx`

Equivalent screens/components / semantic mapping:
- partial payment and not-paid balance messaging

Current behavior:
- modal computes and displays unpaid remainder implications

Missing behavior:
- no explicit dedicated classification panel beyond method choice and summary state

Recommended next action:
- keep current UX unless business wants a stronger explicit remainder decision step

### Settlement Legs Preview

Status:
- Implemented

Files/components found:
- `payment-modal-v3.tsx`

Equivalent screens/components / semantic mapping:
- multi-leg editor and validation state

Current behavior:
- supports multiple legs, amount parity, validation messages

Missing behavior:
- no persisted settlement leg ids or post-save leg-history preview at checkout

Recommended next action:
- no action

### Order Detail Financial Tab

Status:
- Partially Implemented

Files/components found:
- `web-admin/src/features/orders/ui/orders-financial-tab-rprt.tsx`
- `web-admin/app/actions/orders/get-order-financial.ts`

Equivalent screens/components / semantic mapping:
- current order finance detail surface

Current behavior:
- shows charges, taxes, payment legs, refunds
- server action also fetches discounts

Missing behavior:
- component does not display discounts
- no credit applications table
- no settlement history header/legs view
- no audit timeline

Recommended next action:
- preserve the current tab; fill only the highest-value missing sections

### Cash Drawer Screens

Status:
- Implemented

Files/components found:
- `web-admin/src/features/payment-config/ui/cash-drawers-tab.tsx`
- `web-admin/src/features/billing/ui/cashup-form.tsx`
- `web-admin/src/features/billing/ui/cashup-content.tsx`
- `web-admin/src/features/billing/ui/cash-drawer-detail-client.tsx`

Equivalent screens/components / semantic mapping:
- drawer admin + session/cashup screens

Current behavior:
- list drawers, show open session status, manage session/card views, cashup screens

Missing behavior:
- no explicit settlement-linked audit view reviewed

Recommended next action:
- no action

### Customer Stored Value Tab

Status:
- Implemented

Files/components found:
- `web-admin/src/features/customers/ui/customer-stored-value-tab.tsx`
- `web-admin/src/features/customers/ui/stored-value-hub-client.tsx`

Equivalent screens/components / semantic mapping:
- same expected area

Current behavior:
- shows wallet, advance, credit notes
- supports top-up, issue advance, issue credit note
- hub lists customers with balances

Missing behavior:
- no direct ledger table embedded in the main tab from reviewed portion

Recommended next action:
- no action

### Promotions UI

Status:
- Implemented

Files/components found:
- `web-admin/src/features/marketing/ui/promotions-list-client.tsx`
- `web-admin/app/dashboard/marketing/promotions/page.tsx`

Equivalent screens/components / semantic mapping:
- same expected area

Current behavior:
- list, create, edit, activate/deactivate promotions

Missing behavior:
- no advanced analytics/reporting screen reviewed

Recommended next action:
- no action

### Tax Settings UI

Status:
- Implemented

Files/components found:
- `web-admin/src/features/settings/tax/ui/tax-setup-client.tsx`

Equivalent screens/components / semantic mapping:
- same expected area

Current behavior:
- profile and exemption management via dialogs and tables

Missing behavior:
- no test evidence reviewed for the UI itself

Recommended next action:
- no action

### Payment Settings UI

Status:
- Implemented

Files/components found:
- `web-admin/src/features/payment-config/ui/payment-methods-tab.tsx`
- `web-admin/src/features/payment-config/ui/terminals-tab.tsx`
- `web-admin/src/features/payment-config/ui/branch-overrides-tab.tsx`
- `web-admin/src/features/payment-config/ui/cash-drawers-tab.tsx`

Equivalent screens/components / semantic mapping:
- same expected area

Current behavior:
- method enable/configure/deactivate
- terminal management
- drawer management
- branch override UI files exist

Missing behavior:
- branch overrides were not read deeply in this pass

Recommended next action:
- verify branch override behavior only if it becomes part of rollout scope

### Reports UI

Status:
- Partially Implemented

Files/components found:
- `web-admin/src/features/billing/ui/reconciliation-list-client.tsx`
- `web-admin/src/features/billing/ui/reconciliation-detail-client.tsx`
- `web-admin/src/features/marketing/ui/gift-cards-liability-rprt.tsx`
- cash drawer print/report components

Equivalent screens/components / semantic mapping:
- reconciliation and select finance-related reports exist

Current behavior:
- reconciliation list/detail with run action
- some liability/print report surfaces

Missing behavior:
- no broad finance dashboard covering payment breakdown, tax, stored value liability, and reconciliation in one place

Recommended next action:
- keep current screens; add reports selectively by operational value

## 7. Runtime Flow Review

### Create / Reprice Order

Expected flow summary:
- create order with authoritative server repricing before financial commit

Current implemented flow:
- modal calls preview
- server recalculates totals
- final create route recalculates again before commit

Evidence:
- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`
- `web-admin/app/api/v1/orders/preview-payment/route.ts`
- `web-admin/app/api/v1/orders/create-with-payment/route.ts`

Equivalent implementation names:
- preview-payment + create-with-payment

Missing steps:
- none material

Risk:
- none significant

Recommended next action:
- no action

### Checkout Settlement

Expected flow summary:
- create order, apply discounts/credits, settle payment, update snapshot

Current implemented flow:
- transaction 1 creates order/invoice and applies promo/gift card
- transaction 2 resolves legs and settles financial facts

Evidence:
- `create-with-payment/route.ts`
- `order-settlement.service.ts`

Equivalent implementation names:
- `settleOrder`

Missing steps:
- no persisted settlement header

Risk:
- audit grouping is weaker than expected

Recommended next action:
- preserve flow and document the current two-transaction model

### Multi-Leg Settlement

Expected flow summary:
- split legs validated, persisted, and posted coherently

Current implemented flow:
- legs are validated and processed in runtime arrays
- `CASH + CARD` split is supported

Evidence:
- `checkout-multi-payment.test.ts`
- `create-with-payment/route.ts`
- `order-settlement.service.ts`

Equivalent implementation names:
- `paymentLegs`, `ResolvedSettlementLeg[]`

Missing steps:
- no settlement leg table

Risk:
- weaker lineage and refund targeting

Recommended next action:
- no redesign yet; document current runtime-leg approach

### Partial Payment with Remainder

Expected flow summary:
- partial settlement with explicit outstanding classification

Current implemented flow:
- immediate amounts lower than total produce outstanding and status update

Evidence:
- `payment-modal-v3.tsx`
- `order-settlement.service.ts`

Equivalent implementation names:
- partial payment / unpaid balance

Missing steps:
- no separate remainder decision ledger object

Risk:
- downstream consumers rely on snapshot rather than explicit remainder records

Recommended next action:
- preserve snapshot-based approach unless business needs richer remainder tracking

### Pay on Collection

Expected flow summary:
- create now, collect later

Current implemented flow:
- create route marks deferred
- collect-payment route later posts real payment rows

Evidence:
- `create-with-payment/route.ts`
- `collect-payment/route.ts`
- `order-settlement.service.ts`

Equivalent implementation names:
- `PENDING_COLLECTION`

Missing steps:
- no settlement header/leg lineage

Risk:
- later collection still lacks original-leg structure

Recommended next action:
- no action

### Pay on Delivery

Expected flow summary:
- delivery-specific deferred collection classification

Current implemented flow:
- not clearly found

Evidence:
- no confirmed `PAY_ON_DELIVERY` path in reviewed new-order code

Equivalent implementation names:
- not found

Missing steps:
- delivery-specific deferred settlement behavior

Risk:
- stakeholders may assume delivery handling exists when current new-order default is `PAY_ON_COLLECTION`

Recommended next action:
- needs business clarification if pay-on-delivery is expected now

### Credit Invoice / AR

Expected flow summary:
- B2B credit invoice eligibility and deferred receivable handling

Current implemented flow:
- invoice/deferred methods are supported
- B2B credit-limit checks run in preview/create flow

Evidence:
- `preview-payment/route.ts`
- `create-with-payment/route.ts`

Equivalent implementation names:
- `INVOICE`, credit limit checks

Missing steps:
- no active AR allocation leg behavior in settlement V1

Risk:
- AR sophistication is below the full reference model

Recommended next action:
- preserve current B2B deferred flow; document AR allocation as not active

### Cash Payment

Expected flow summary:
- cash payment with tendered and change, drawer validation

Current implemented flow:
- settlement writes payment rows with tendered/change
- drawer validation exists

Evidence:
- `order-settlement.service.ts`
- `cash-drawer.service.ts`

Equivalent implementation names:
- `REAL_PAYMENT` cash leg

Missing steps:
- no settlement header linkage

Risk:
- none major for core behavior

Recommended next action:
- no action

### Card/Gateway Payment

Expected flow summary:
- card/gateway payment with terminal/gateway references and proper capture

Current implemented flow:
- terminal/gateway config and references exist
- accounting rows can be written for card-style methods

Evidence:
- `org_payment_methods_cf`
- `org_payment_terminals_cf`
- `order-settlement.service.ts`
- `payment-service.ts`

Equivalent implementation names:
- immediate real payment methods

Missing steps:
- no fully verified external gateway capture workflow in new-order path

Risk:
- accounting success can outpace external settlement reality

Recommended next action:
- document which methods are configuration-ready versus gateway-complete

### Gift Card Application

Expected flow summary:
- gift card as stored value liability application

Current implemented flow:
- preview validates and caps usage
- create route redeems in transaction

Evidence:
- `order-calculation.service.ts`
- `gift-card-service.ts`
- `create-with-payment/route.ts`

Equivalent implementation names:
- `giftCardApplied`, `redeemGiftCardTx`

Missing steps:
- no dedicated `org_order_credit_apps_dtl` posting for gift card was confirmed

Risk:
- classification can look like discount rather than liability application

Recommended next action:
- clarify and preserve the intended classification before reporting expansion

### Wallet Application

Expected flow summary:
- wallet redeemed as credit application during checkout

Current implemented flow:
- backend routing exists in settlement service

Evidence:
- `order-settlement.service.ts`
- `stored-value.service.ts`
- `checkout-config.service.ts`

Equivalent implementation names:
- `CREDIT_APPLICATION_TYPES.WALLET`

Missing steps:
- no confirmed checkout UI flow in this pass

Risk:
- backend-ready, UI-unclear functionality

Recommended next action:
- document as implemented in backend, not fully evidenced in checkout UI

### Advance Application

Expected flow summary:
- advance redeemed as credit application

Current implemented flow:
- backend routing exists

Evidence:
- `order-settlement.service.ts`
- `stored-value.service.ts`

Equivalent implementation names:
- `CREDIT_APPLICATION_TYPES.ADVANCE`

Missing steps:
- no confirmed checkout UI flow

Risk:
- same as wallet

Recommended next action:
- same as wallet

### Credit Note Application

Expected flow summary:
- credit note redeemed as credit application

Current implemented flow:
- backend routing exists

Evidence:
- `order-settlement.service.ts`
- `stored-value.service.ts`

Equivalent implementation names:
- `CREDIT_APPLICATION_TYPES.CREDIT_NOTE`

Missing steps:
- no confirmed checkout UI flow

Risk:
- same as wallet/advance

Recommended next action:
- same as wallet/advance

### Loyalty Redemption

Expected flow summary:
- loyalty redeemed at checkout and earned after settlement

Current implemented flow:
- backend credit application and earn outbox behavior exist

Evidence:
- `order-settlement.service.ts`
- `loyalty.service.ts`

Equivalent implementation names:
- `CREDIT_APPLICATION_TYPES.LOYALTY_POINTS`

Missing steps:
- no confirmed checkout UI flow

Risk:
- same backend/UI exposure mismatch possibility

Recommended next action:
- document backend readiness vs UI exposure

### Refund by Original Leg

Expected flow summary:
- refund should reference original settlement leg

Current implemented flow:
- refund references payment row, not settlement leg

Evidence:
- `0283_harden_credit_apps_refunds.sql`
- `order-refund.service.ts`

Equivalent implementation names:
- refund by original payment row

Missing steps:
- no `original_settlement_leg_id`

Risk:
- split-payment refund precision is weaker

Recommended next action:
- business decision: confirm whether payment-row reference is acceptable for current scope

### Cash Drawer Open/Close

Expected flow summary:
- open session, transact, close session, compute over/short

Current implemented flow:
- fully implemented with open/close APIs and variance computation

Evidence:
- `cash-drawer.service.ts`
- `cash-drawer.service.test.ts`
- cash drawer API routes

Equivalent implementation names:
- same concept

Missing steps:
- none material

Risk:
- low

Recommended next action:
- no action

## 8. Business Rules Review

### `org_payment_methods_cf` as checkout settlement options

Status:
- Implemented

Evidence:
- `checkout-config.service.ts`

Gap:
- route exposure not found

Risk:
- UI may not fully consume the config service

Recommendation:
- preserve the table-driven service; verify consumer path

### `payment_nature` routing

Status:
- Implemented

Evidence:
- `order-settlement.service.ts`

Gap:
- no persisted leg header/table

Risk:
- routing is runtime-only

Recommendation:
- no action unless audit needs stronger persistence

### `REAL_PAYMENT` only in `org_order_payments_dtl`

Status:
- Implemented

Evidence:
- `0283_harden_credit_apps_refunds.sql`
- `payment_nature_snapshot = 'REAL_PAYMENT'`

Gap:
- none material

Risk:
- low

Recommendation:
- no action

### Credit applications not stored as payments

Status:
- Implemented

Evidence:
- `0271_v1_payment_linking_cols.sql` comments and separate `org_order_credit_apps_dtl`

Gap:
- no settlement leg linkage

Risk:
- low for classification, medium for traceability

Recommendation:
- no structural change

### Promotion/coupon not stored as payment

Status:
- Implemented

Evidence:
- promotion tables and discount lines, not payment rows

Gap:
- none material

Risk:
- low

Recommendation:
- no action

### Gift card not treated as payment

Status:
- Partially Implemented

Evidence:
- gift card uses dedicated ledger and transactional redemption
- but `order-calculation.service.ts` adds `giftCardApplied` into `discountLines`

Gap:
- semantic classification conflict

Risk:
- reporting and business interpretation drift

Recommendation:
- clarify and normalize presentation/ledger mapping in a future additive pass

### Tax before settlement

Status:
- Implemented

Evidence:
- `order-calculation.service.ts`
- `order-settlement.service.ts`

Gap:
- no separate engine

Risk:
- low

Recommendation:
- no action

### Cash drawer retained cash, not tendered amount

Status:
- Partially Implemented

Evidence:
- drawer session computes expected cash
- payment rows store tendered and change

Gap:
- detailed net-retained-cash logic was not fully traced line by line in this pass

Risk:
- subtle overcount risk if retained cash logic differs from tendered/change interpretation

Recommendation:
- add explicit tests for retained cash vs tendered/change

### Unpaid remainder must be classified

Status:
- Implemented

Evidence:
- order snapshot fields and status updates in settlement service

Gap:
- no separate remainder decision ledger object

Risk:
- low

Recommendation:
- no action

### Retail default `PAY_ON_COLLECTION`

Status:
- Not Implemented

Evidence:
- `payment-modal-v3.tsx:208` sets retail-only default to `CASH`

Gap:
- differs from expected rule

Risk:
- if the locked baseline expects retail deferred default, current UX/behavior conflicts

Recommendation:
- needs business decision before changing; do not assume this is a bug without confirmation

### Delivery default `PAY_ON_DELIVERY`

Status:
- Not Implemented

Evidence:
- no confirmed `PAY_ON_DELIVERY` default or flow in reviewed new-order code

Gap:
- delivery default rule not found

Risk:
- expectation mismatch for delivery orders

Recommendation:
- needs business decision / confirmation

### B2B credit invoice eligibility

Status:
- Implemented

Evidence:
- credit limit / hold checks in preview and create routes

Gap:
- no AR allocation V1 behavior

Risk:
- low for basic credit-invoice eligibility

Recommendation:
- no action

### Refunds reference original settlement leg

Status:
- Not Implemented

Evidence:
- refunds reference payment rows; no `original_settlement_leg_id` found

Gap:
- settlement-leg lineage absent

Risk:
- medium

Recommendation:
- needs explicit business acceptance or future enhancement

### Idempotency for financial mutations

Status:
- Implemented

Evidence:
- idempotency columns, unique constraints, `org_idempotency_keys`, create-with-payment lookup

Gap:
- not every mutation was verified against the generic store

Risk:
- low to medium

Recommendation:
- no action beyond documentation

### Tenant isolation

Status:
- Implemented

Evidence:
- tenant filters present in Prisma queries
- RLS enabled in reviewed migrations for financial tables

Gap:
- no live RLS runtime verification performed

Risk:
- low from reviewed evidence

Recommendation:
- no action

## 9. Reports and Reconciliation Review

- Reports found:
  - payment breakdown: `web-admin/app/api/v1/finance/reports/payments-breakdown/route.ts`
  - tax report: `web-admin/app/api/v1/finance/reports/tax-report/route.ts`
  - gift-card liability report UI: `web-admin/src/features/marketing/ui/gift-cards-liability-rprt.tsx`
  - cash drawer print/report UI: `web-admin/src/features/billing/ui/cash-drawer-session-print-rprt.tsx`
- Reconciliation logic found:
  - run and issue framework in `reconciliation.service.ts`
  - UI in `reconciliation-list-client.tsx` and `reconciliation-detail-client.tsx`
- Equivalent report names:
  - payment breakdown is the current equivalent of payment mix reporting
  - tax report is the current equivalent of order tax summary reporting
- Missing reports:
  - no broad order financial summary report spanning payments + credits + discounts + taxes in one place
  - no explicit stored-value liability consolidated report for wallet/advance/credit note was confirmed
  - no explicit reconciliation report for settlement-leg target matching because settlement-leg persistence is absent
- Missing reconciliation checks:
  - settlement-leg target match
  - cash drawer expected-vs-retained deeper audit
  - payment-vs-invoice-vs-order cross-ledger unification check
  - credit application linkage completeness
- Recommended report priorities:
  - cross-ledger consistency between `org_order_*` and `org_payments_dtl_tr`
  - stored-value liability summary
  - cash drawer net retained cash audit
  - order financial full breakdown report

## 10. Tests Review

- Test files found:
  - `web-admin/__tests__/services/settlement.service.test.ts`
  - `web-admin/__tests__/services/cash-drawer.service.test.ts`
  - `web-admin/__tests__/services/reconciliation.service.test.ts`
  - `web-admin/__tests__/services/gift-card-service.test.ts`
  - `web-admin/__tests__/services/loyalty.service.test.ts`
  - `web-admin/__tests__/services/outbox.service.test.ts`
  - `web-admin/__tests__/services/payment-service.test.ts`
  - `web-admin/__tests__/integration/create-with-payment-promo-gift.integration.test.ts`
  - `web-admin/__tests__/integration/checkout-multi-payment.test.ts`
  - `web-admin/__tests__/integration/gift-card-redemption.test.ts`
  - `web-admin/__tests__/integration/refund-flow.test.ts`
  - `web-admin/__tests__/integration/reconciliation-run.test.ts`
- Scenarios covered:
  - charge/tax/discount fact row creation
  - cash payment leg creation
  - wallet leg routing
  - outbox emission
  - cash drawer open/close/movement
  - promo + gift-card atomicity and locking
  - concurrent promo guard
  - gift-card idempotent retry
  - multi-leg validation for cash/card and deferred isolation
  - gift-card redemption, currency mismatch, locking
  - refund lifecycle approval/process
  - loyalty redemption and earn event
  - reconciliation statuses and issue creation
- Missing critical tests:
  - multiple card legs with gateway distinctions
  - wallet + card end-to-end checkout
  - advance + pay-on-collection
  - credit note + cash end-to-end checkout
  - explicit retained-cash vs tendered/change accounting
  - order financial tab coverage for discounts/credit apps
  - cross-ledger reconciliation between new and legacy payment systems
  - pay-on-delivery behavior
- Recommended test priorities:
  - dual-ledger consistency
  - stored-value checkout combinations
  - refund precision for split payments
  - cash retention math

## 11. Gap Matrix

| Area | Expected | Current | Equivalent Name? | Status | Risk | Recommended Action | Blocking? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Order snapshot | Financial snapshot on order | Present on `org_orders_mst` | Yes | Implemented | Low | No action | No |
| Charges ledger | `org_order_charges_dtl` | Present and used | Yes | Implemented | Low | No action | No |
| Discounts ledger | Discounts separate from credits | Present, but gift card enters discount lines | Yes | Implemented Differently | High | Clarify gift-card classification | No |
| Taxes ledger | `org_order_taxes_dtl` | Present and used | Yes | Implemented | Low | No action | No |
| Settlement header | `org_order_settlements_mst` | Not found | No | Not Implemented | High | Business decision on need | No |
| Settlement legs | `org_order_settlement_legs_dtl` | Runtime legs only | Runtime equivalent | Partially Implemented | High | Document runtime model | No |
| Payments | Real payments only ledger | `org_order_payments_dtl` with `REAL_PAYMENT` snapshot | Yes | Implemented | Medium | Reduce legacy divergence | No |
| Credit applications | Separate from payments | `org_order_credit_apps_dtl` | Yes | Implemented | Medium | Improve lineage only if needed | No |
| Refund lineage | Original settlement leg | Original payment row only | Partial | Implemented Differently | Medium | Confirm business acceptance | No |
| Adjustments | Explicit adjustments ledger | Not found | No | Not Implemented | Medium | Add only if needed | No |
| Gift cards | Liability application | Ledger exists, but discount presentation conflict | Yes | Partially Implemented | High | Normalize classification | No |
| Wallet/advance/credit note | Stored value ledgers | Implemented | Yes | Implemented | Medium | Improve checkout exposure clarity | No |
| Loyalty | Earn/redeem ledger | Implemented | Yes | Implemented | Medium | Review advanced lifecycle later | No |
| Promotions | Rules, usage, stacking | Implemented | Yes | Implemented | Medium | Reduce duplicated promo logic | No |
| Tax engine | Dedicated engine | Embedded in calc logic | Semantic | Implemented Differently | Medium | Document current execution path | No |
| Checkout options API | Route exposure | Service exists, route not found | Partial | Not Implemented | Medium | Clarify intended access path | No |
| Payment summary API | REST route | Server action + UI | Yes | Implemented Differently | Low | No action unless external API needed | No |
| Cash drawer | Drawer/session/movement | Implemented | Yes | Implemented | Low | No action | No |
| Outbox | Retryable event outbox | Implemented | Yes | Implemented | Medium | Confirm worker operations | No |
| Reconciliation | Broad finance checks | Framework exists with limited checks | Yes | Partially Implemented | Medium | Expand only highest-value checks | No |
| Legacy/new ledger unification | One finance source of truth | Dual paths remain | No | Partially Implemented | Critical | Prioritize unification strategy | Yes |

## 12. Risk Register

| Risk | Area | Severity | Impact | Suggested Mitigation |
| --- | --- | --- | --- | --- |
| Dual-ledger coexistence between `org_order_*` and `org_payments_dtl_tr` | Architecture | Critical | Reports, refunds, and reconciliation can diverge by payment path | Define the operational source of truth and add cross-ledger checks before wider rollout |
| No persisted settlement header/legs | Settlement | High | Weak end-to-end auditability for split settlements | Explicitly document runtime-only leg model or add persistence later |
| Gift card appears in discount lines | Classification | High | Liability can be misreported as discount | Align breakdown classification before finance reporting depends on it |
| Payment settings route may query non-existent `branch_id` on methods table | Payment Config API | High | Route failure or hidden logic bug | Verify route against schema/model before relying on branch filtering |
| Gateway-configured methods may be accounting-complete before external capture is truly complete | Payment Capture | High | Settlement status may overstate real-world payment success | Document method readiness and avoid overstating gateway completeness |
| Refunds link to payment row, not original settlement leg | Refunds | Medium | Split-payment refund precision is limited | Confirm business acceptance or plan additive lineage later |
| Reconciliation scope is narrower than stakeholders may assume | Reconciliation | Medium | False confidence in financial integrity | Publish current check catalog clearly |
| Backend credit-application capabilities may exceed checkout UI exposure | UI/Services | Medium | Hidden functionality or inconsistent operator expectations | Document exposed vs backend-ready capabilities |
| Cash retained vs tendered math not explicitly evidenced by dedicated tests | Cash Drawer / Settlement | Medium | Potential drawer variance confusion | Add targeted tests |

## 13. Recommended Next Actions

### Must fix before production

- Resolve the source-of-truth tension between new `org_order_*` financial tables and legacy `org_payments_dtl_tr` in operations, reporting, and refunds.
- Verify the `payment methods` settings route against the actual schema because the reviewed route filters by `branch_id` on `org_payment_methods_cf`.
- Confirm and document whether gateway-oriented methods are truly externally captured or only internally posted.

### Should fix soon

- Decide and document the intended financial classification of gift-card application.
- Publish a clear statement that settlement headers/legs are currently runtime constructs, not persisted financial tables.
- Expand reconciliation to include at least cross-ledger consistency and retained-cash checks.
- Fill the order financial tab gaps for discounts and credit applications if users depend on that screen.

### Nice to have

- Expose checkout options through a dedicated API if external or dynamic consumers need it.
- Add richer finance reports for stored-value liability and full order-financial breakdown.
- Add deeper tests for split refunds, wallet/card mixed checkout, and advance/credit-note checkout flows.

### Needs business decision

- Whether retail should default to `PAY_ON_COLLECTION` or the current `CASH`
- Whether delivery should support a distinct `PAY_ON_DELIVERY` default/path
- Whether refund lineage must reference original settlement legs, or original payment rows are acceptable
- Whether persisted settlement headers/legs are required for audit and reconciliation

### Already implemented / no action

- financial snapshot fields on orders
- charge, tax, payment, credit application, refund tables
- stored-value ledgers
- cash drawer sessions and movement model
- promotion master/usage tables
- tax config tables and APIs
- outbox and idempotency framework

## 14. Notes for Future Implementation

- Do not rebuild already working parts.
- Do not create duplicate tables.
- Prefer additive migrations.
- Preserve existing implementation where it matches the business intent.
- If names differ but business behavior matches, document the mapping.
- Ask clarification only when current implementation conflicts with the locked baseline or business rules.
- Keep architecture stable.

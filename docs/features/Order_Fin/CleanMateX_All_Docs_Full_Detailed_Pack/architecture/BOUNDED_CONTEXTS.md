<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Bounded Contexts

## Order Core Context

Owns order identity, order status, order item lines, and financial summary snapshots.

## Piece Tracking Context

Owns physical garment rows, generated from item quantity or compound templates.

## Preference Context

Owns selected/observed order, item, and piece preferences.

## Pricing and Charge Context

Owns billable additions and base commercial pricing effects.

## Promotion Context

Owns tenant-specific campaigns, coupons, eligibility, and reward logic.

## Tax Context

Owns tax rules, tax rates, and historical tax snapshots.

## Settlement Context

Owns real payment rows, stored-value applications, refunds, adjustments, and outstanding amount.

## Stored Value Context

Owns gift card, wallet, customer credit, and advance balances and ledgers.

## Loyalty Context

Owns points balances, tier state, expiry, and redemption.

## Invoice / AR Context

Owns legal invoices, AR balances, invoice payments, and credit notes.

## Accounting Context

Owns accounting event mapping, voucher generation, posting, and reversal.

## Reconciliation Context

Owns proof that summary/detail/ledger/posting values match.

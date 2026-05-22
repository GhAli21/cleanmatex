# AR Invoice — Test Guide

**Audience:** QA, finance UAT users, support, implementers  
**Last Updated:** 2026-05-22

## Goal

This guide explains how to test AR Invoice safely and consistently in a real environment.

Use this with:

- [TEST_MATRIX.md](./TEST_MATRIX.md)
- [UAT_AND_ROLLOUT_RUNBOOK.md](./UAT_AND_ROLLOUT_RUNBOOK.md)

## Test Environment Rules

1. Use a non-production tenant first.
2. Use test customers and test orders where possible.
3. Never use live finance data for first-time V2 operational testing.
4. Record invoice numbers, customer IDs, and payment IDs during each run.

## Required Test Accounts

Prepare at least:

- one finance admin with all AR permissions
- one operator with limited AR permissions
- one user without V2 AR permissions for negative-access checks

## Test Data You Should Prepare

- retail customer
- B2B customer
- draft invoice
- open invoice
- partially paid invoice
- overdue invoice
- overpayment scenario
- one order that uses `PAY_ON_COLLECTION`

## How To Test By Area

### 1. Invoice creation

Test:

1. Open `/dashboard/internal_fin/invoices/new`
2. Create a manual AR invoice with one line
3. Create a second manual AR invoice with multiple lines
4. Create an invoice from one order
5. Create an invoice from multiple orders

Verify:

- invoice is created
- totals are correct
- status starts as draft
- invoice appears in invoice hub

### 2. Invoice issuance

Test:

1. Open draft invoice detail
2. Issue invoice

Verify:

- status changes from `DRAFT`
- AR ledger impact appears
- history tab records the transition

### 3. Payment allocation

Test:

1. Allocate a partial payment
2. Allocate remaining payment
3. Reverse one allocation

Verify:

- outstanding amount decreases correctly
- `PARTIALLY_PAID` and `PAID` behavior is correct
- reversal restores the outstanding amount correctly
- history and ledger remain explainable

### 4. Overpayment credit

Test:

1. Allocate payment above invoice balance
2. Open `/dashboard/internal_fin/ar/credits`
3. Apply the available credit to another invoice
4. Reverse the credit application

Verify:

- unapplied credit appears in credits page
- credit reduces the target invoice outstanding amount
- reversal restores both invoice balance and credit availability

### 5. Sensitive actions

Test:

1. Create credit memo
2. Create debit note
3. Create write-off
4. Void invoice

Verify:

- approval-required actions do not bypass approval control
- approved actions produce expected invoice/ledger outcome
- detail tabs show resulting adjustments/history

### 6. Disputes

Test:

1. Open `/dashboard/internal_fin/ar/disputes`
2. Create a dispute against an open invoice
3. Resolve it

Verify:

- dispute row is created
- invoice becomes `DISPUTED`
- resolution closes the case
- invoice status is recalculated correctly after resolution

### 7. Dunning

Test:

1. Open `/dashboard/internal_fin/ar/dunning`
2. Run an email reminder
3. Run an SMS or note action
4. Run a hold action

Verify:

- dunning run row is created
- status reflects sent/failed/skipped outcome
- hold action puts customer on credit hold

### 8. Statement cycles

Test:

1. Open `/dashboard/internal_fin/ar/cycles`
2. Create a cycle
3. Preview a cycle

Verify:

- cycle appears in table
- preview returns matching customers
- preview does not mutate invoice state

### 9. Statements and print

Test:

1. Open AR customer statement
2. Open statement print page
3. Open invoice print page

Verify:

- opening/closing balances look correct
- print pages render correctly
- Arabic layout is acceptable in RTL mode

### 10. Permissions

Test with a lower-permission user:

1. Try opening credits page
2. Try opening disputes page
3. Try running dunning
4. Try creating statement cycle

Verify:

- unauthorized users are blocked appropriately
- permitted users can continue normally

## Negative Tests

Run these intentionally:

- try creating AR from `PAY_ON_COLLECTION`
- try applying more credit than available
- try applying more payment than allowed without overpayment handling
- try resolving dispute with invalid status payload
- try opening V2 pages without required permission

## Evidence To Capture

For each tested scenario, capture:

- route used
- user role used
- IDs involved
- expected result
- actual result
- screenshot if UI-related
- API error text if failed

## Defect Reporting Template

Use this format:

```md
Title: AR credit reversal restores wrong outstanding amount
Date: 2026-05-22
Environment: UAT
User Role: Finance Admin
Route: /dashboard/internal_fin/ar/credits
Scenario: Reverse AR credit application
Steps:
1. ...
2. ...
Expected:
Invoice outstanding returns to pre-application value
Actual:
Outstanding amount is lower than expected
Evidence:
Invoice ID, credit application ID, screenshot, console/API response
```

## Recommended Test Order

Run in this sequence:

1. create and issue invoices
2. allocate payments
3. test overpayment credit
4. test sensitive actions
5. test disputes
6. test dunning
7. test statement cycles
8. test permissions
9. test Arabic and print views

## Exit Rule

Testing is complete when:

- all critical finance scenarios pass
- no tenant-access issue is found
- no balance inconsistency is found
- pilot users sign off on the core workflow

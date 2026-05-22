# AR Invoice — UAT Checklist And Rollout Runbook

**Feature:** AR Invoice v1 / v1.5 / v2  
**Last Updated:** 2026-05-22

## Purpose

This runbook is for:

- business UAT
- pilot rollout
- production release coordination
- early-life support after go-live

## UAT Entry Criteria

Before UAT begins:

- AR migrations are already applied in the target environment
- generated DB types are refreshed
- target tenant has required permissions seeded to at least one test role
- at least one B2B customer and one standard customer exist
- test orders and test payment records exist or can be created
- email/SMS infrastructure is configured if dunning delivery is being validated

## UAT Roles Needed

- Finance lead
- Operations lead
- Branch/cashier user
- Tenant admin or support admin
- QA observer or implementation owner

## UAT Data Setup

Prepare:

1. One retail customer
2. One B2B customer with credit terms
3. One `PAY_ON_COLLECTION` order
4. One eligible credit-invoice order
5. One partially paid invoice candidate
6. One overpayment scenario
7. One dispute scenario invoice
8. One overdue invoice for dunning checks

## UAT Checklist

### A. Core invoice lifecycle

- [ ] Create manual AR invoice
- [ ] Create AR invoice from one order
- [ ] Create AR invoice from multiple orders
- [ ] Confirm `PAY_ON_COLLECTION` order is rejected from AR creation
- [ ] Issue draft invoice
- [ ] Confirm ledger/history records are visible

### B. Allocation and credit handling

- [ ] Allocate partial payment
- [ ] Allocate exact payment
- [ ] Reverse allocation
- [ ] Create overpayment and confirm unapplied credit appears
- [ ] Apply AR credit to invoice
- [ ] Reverse AR credit application

### C. Sensitive actions

- [ ] Create credit memo request
- [ ] Approve sensitive action
- [ ] Create debit note request
- [ ] Create write-off request
- [ ] Void approved invoice

### D. Customer AR views

- [ ] Open AR customers page
- [ ] Open ledger for customer
- [ ] Open statement for customer
- [ ] Open invoice print view
- [ ] Open customer statement print view

### E. V2 operations

- [ ] Open disputes page and create dispute
- [ ] Resolve dispute and verify invoice status re-derives correctly
- [ ] Run dunning email action
- [ ] Run dunning SMS or note action
- [ ] Run hold action and verify customer credit hold
- [ ] Create statement cycle
- [ ] Preview statement cycle

### F. Security and permissions

- [ ] Confirm non-authorized user cannot access credits page
- [ ] Confirm non-authorized user cannot access disputes page
- [ ] Confirm non-authorized user cannot run dunning
- [ ] Confirm non-authorized user cannot create statement cycle

### G. Localization

- [ ] Validate major V1 and V2 screens in English
- [ ] Validate major V1 and V2 screens in Arabic
- [ ] Validate RTL layout on AR print and operations pages

## Expected Outcomes

UAT is considered passed when:

- finance users can complete end-to-end AR flows without manual DB intervention
- balances and statuses stay internally consistent
- overpayment credit is reusable and reversible
- disputes and dunning are auditable
- no tenant leakage or permission bypass is observed

## Release Steps

### 1. Pre-release

- confirm migration state in target environment
- confirm generated types match deployed schema
- confirm pilot tenant users and permissions
- confirm support team has this runbook and test guide

### 2. Deployment

- deploy app build
- verify `/dashboard/internal_fin/invoices`
- verify `/dashboard/internal_fin/ar/credits`
- verify `/dashboard/internal_fin/ar/disputes`
- verify `/dashboard/internal_fin/ar/dunning`
- verify `/dashboard/internal_fin/ar/cycles`

### 3. Smoke test after deploy

- login as authorized finance user
- open invoice hub
- load one invoice detail page
- load AR customers page
- load AR credits page
- perform one non-destructive statement-cycle preview

### 4. Pilot window

Recommended pilot duration:

- 3 to 5 business days

Monitor:

- invoice issue errors
- allocation reversal volume
- credit application failures
- dispute creation/resolution failures
- dunning delivery failures

## Rollback Strategy

Because schema is already applied, rollback should be application-behavior oriented:

1. Restrict AR V2 operational permissions if needed.
2. Hide pilot-user access through roles while triaging issues.
3. Stop using dispute/dunning/cycle operational screens if a targeted bug appears.
4. Patch forward rather than trying to undo applied schema.

## Hypercare Plan

For the first week after release:

- review support issues daily
- review finance exceptions daily
- monitor first successful uses of:
  - credit application
  - dispute resolution
  - dunning execution
  - cycle preview

## Exit Criteria

Move from pilot to full usage when:

- no critical financial correctness defects are found
- no tenant-access issues are found
- finance users confirm statement, credit, and dispute behavior is acceptable
- production monitoring stays stable for the pilot window

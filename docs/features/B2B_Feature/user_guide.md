---
version: v1.1.0
last_updated: 2026-03-14
author: CleanMateX Team
---

# B2B Feature User Guide

## Creating a B2B Customer

1. Go to Customers → Create Customer (or New Order → customer select)
2. Select customer type **B2B**
3. Enter company name, tax ID, credit limit, payment terms
4. Save (credit limit is capped by your plan)

## Managing Contacts

1. Open a B2B customer detail page
2. Go to the **Contacts** tab
3. Add contacts (billing, delivery, primary)
4. Mark one as primary for statements (used for dunning email/SMS)

## Creating a Contract

1. Go to B2B → Contracts → New Contract
2. Select B2B customer
3. Set effective dates and pricing terms
4. Save

## Generating a Statement

1. Go to B2B → Statements
2. Click Generate Statement
3. Select customer and period
4. Review unpaid invoices, confirm
5. Issue statement (PDF sent to primary contact)

## Credit Limit

When creating an order for a B2B customer, the system shows credit usage. If limit exceeded:
- **Warn mode**: You can override by checking the override box (recorded for audit)
- **Block mode**: Order is blocked until payment received

## Credit Hold

If a B2B customer has overdue statements past the configured dunning level, the system may place them on **credit hold**. New orders are blocked until the hold is released. Contact your admin to release the hold after payment.

## FAQs

**Q: Why can't I create an order for a B2B customer?**  
A: Either the credit limit is exceeded (check mode: warn vs block) or the customer is on credit hold due to overdue statements.

**Q: What does "Override credit limit" mean?**  
A: In warn mode, an admin can allow the order despite exceeding the limit. The override is recorded for audit.

**Q: How do I release a credit hold?**  
A: An admin must clear `is_credit_hold` on the customer (e.g. via customer edit or a dedicated action) after payment is received.

**Q: Where are overdue statements shown?**  
A: B2B → Statements, or the Overdue Statements section. Dunning levels (email, sms, hold) are configured in Tenant Settings.

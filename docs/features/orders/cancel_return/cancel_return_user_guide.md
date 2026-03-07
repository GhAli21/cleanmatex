# Cancel Order and Return Order — User Guide

**Last updated:** 2026-03-06

This guide explains how to **cancel an order** or **process a customer return** in CleanMateX.

---

## Cancel Order

**When to use:** The customer has not yet received their items. The order is still at your facility (draft, in preparation, ready, out for delivery, etc.).

### Steps

1. Open the order from **Dashboard → Orders** or the order detail page.
2. In the **Actions** panel on the right, click **Cancel Order**.
3. In the dialog:
   - **Cancellation reason** (required) — Enter at least 10 characters. Example: "Customer requested cancellation" or "Wrong address provided."
   - **Reason code** (optional) — Select a code if applicable:
     - Customer request
     - Duplicate order
     - Wrong address
     - Out of stock
     - Other
4. Click **Cancel Order** to confirm.

### What happens

- The order status changes to **Cancelled**.
- If the order had payments, they are **cancelled** and the invoice/order balance is reversed.
- The cancellation is recorded with your user ID and timestamp for audit.

---

## Customer Return

**When to use:** The customer has **already received** their items (delivered or picked up) and now comes to your facility to return them. They bring the items back.

### Steps

1. Open the order from **Dashboard → Orders** or the order detail page.
2. In the **Actions** panel, click **Customer Return**.
3. In the dialog:
   - **Return reason** (required) — Enter at least 10 characters. Example: "Customer changed mind" or "Quality issue with finishing."
   - **Reason code** (optional) — Select a code if applicable:
     - Changed mind
     - Quality issue
     - Wrong items
     - Damaged
     - Other
4. Click **Process Return** to confirm.

### What happens

- The order status changes to **Cancelled**.
- If the customer had paid, a **refund** is processed for each payment.
- The return is recorded with your user ID and timestamp for audit.

---

## When each button appears

| Button | When visible |
|--------|--------------|
| **Cancel Order** | Order status is draft, intake, preparation, processing, assembly, qa, packing, ready, or out for delivery |
| **Customer Return** | Order status is delivered or closed |

---

## Permissions

- **Cancel Order** requires the `orders:cancel` permission.
- **Customer Return** requires the `orders:return` permission.

If you do not see these buttons, contact your administrator to assign the correct role or permissions.

---

## FAQ

**Q: Can I cancel an order that is already delivered?**  
A: No. Use **Customer Return** instead when the customer brings items back after delivery.

**Q: What if the cancel or return fails?**  
A: Check that you entered a reason of at least 10 characters. If the error persists, refresh the page and try again, or contact support.

**Q: Are refunds automatic?**  
A: Yes. When you process a Customer Return, any payments linked to the order are automatically refunded.

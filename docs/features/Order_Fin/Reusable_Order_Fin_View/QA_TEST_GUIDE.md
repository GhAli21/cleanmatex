# Reusable Order Financial View — QA test guide

Owner-runnable scenarios for every screen that shows the Order Financial View.
Run each in **English and Arabic** (language switch in the top bar), and at
**phone width (360 px), tablet and desktop**. Figures must never be computed in
the browser: every amount is the server's.

Sample order for most scenarios: create a New Order with two items, one paid
extra (for example starch), a delivery charge and a manual discount; pay part in
cash and part with the customer's wallet; leave the rest **pay on collection**.

---

## 1. Order detail → header strip and Financial summary (P6-01)

**Path:** Sidebar → Orders → open the sample order → `/dashboard/orders/{id}`.

1. The strip above the tabs shows **Balance** with a word ("Due at collection"), plus Total, Paid, Credits. No more than three figures beside the balance.
2. Tab **Financial summary**: the statement reads top-down — *Order value* (Items & extras, Charges, Discounts, Tax, then **Total**) and *Settlement* (Payments, Credits, then the balance word and amount).
3. Badges at the top: payment status ("Partially paid"), settlement type ("Pay on collection"), **Reconciled**.
4. **Detailed / Full** switch (top-end): choose Full, reload the page → Full is remembered. Open `…?fin=detailed` → the URL wins.
5. Click a row (for example Discounts) → it expands; **Expand all / Collapse all** work. Keyboard: Tab to a row, Enter/Space toggles it.
6. An extra inside the item price shows as **"Extras (included)"** under Items, in the text, not in the amount column.
7. Right column still offers **AR collection** and **Issue tax document** (unchanged actions).

## 2. Order detail → Financial details tab and the full page (P6-02)

**Paths:** the order's **Financial details** tab; and **Full view** (`/dashboard/orders/{id}/full`, tab Financial).

1. Shows the **Full** statement (records too: tax documents, vouchers, order changes, timeline). The full page also offers **Full / Audit**.
2. **Void a charge** (user with `orders:manual_charge`): the "Charges" panel under the statement lists active charges with **Void charge**. Void one → the dialog asks for a reason → after saving, the statement refreshes on its own: the charge shows struck with "Voided · not counted", the total and balance drop.

## 3. Money writes refresh the view (P6-08)

On the order detail, do each and check the statement updates **without reloading the page**:
- record a payment (Order actions → Collect payment), verify a pending payment, refund a payment, void a charge, issue a tax document, collect on the AR invoice.

## 4. Collect-payment modal (P6-05)

**Path:** order → **Collect payment**. Under the title a small pill shows **Balance 2.475 · Due at collection**. Pay it fully → after saving, the order's statement shows **Settled**.

## 5. Order workspace, ready detail, delivery detail (P6-04, P6-06)

- **Workspace** (`/dashboard/orders/{id}/workspace`): the *Financial snapshot* card shows the statement totals (no hand-added figures).
- **Ready** (`/dashboard/ready/{id}`): the *Payment* box shows the totals view; **Collect payment** still appears when money is due.
- **Delivery order detail**: a totals card above the handover card.

## 6. AR invoice detail (P6-07)

**Path:** Finance → AR invoices → open an invoice → tab **Orders**. Column **Order balance** shows each linked order's balance and word, loaded in **one** request for the whole list (browser network tab: one `financial-headers` call).

## 7. Prints (P6-03)

**Path:** Ready → order → print **Payments report** or **Invoices & payments report**. Under the report, the **Financial summary** prints with every row open, all lines, black on white, one column (A4 preview).

## 8. New Order → payment modal summary (P6-09)

**Path:** New Order → add items → **Submit** → payment modal. Button **Financial summary** (header). It opens a read-only statement marked **"Preview — not yet saved"** (dashed outline) with the quote's figures and the legs you entered. Close it → every amount you typed in the modal is unchanged.

## 9. Order Edit live card (P6-13, owner request D20)

**Path:** order → **Edit**.

1. Change only the **notes** → the card says **"No money change"** and shows the saved total; no request is sent (network tab: no `changes/quote`).
2. Change a **quantity** → after half a second the card shows **New total**, **Was** + difference, **Balance after change** and a chip ("To collect"). While it updates, the old figures stay dimmed with **"Updating…"**; typing is never blocked.
3. Remove a line so a recorded **promo** no longer applies → **Details** shows the promo struck at zero (was → now).
4. Click **Review** → the Review dialog's totals are the card's totals. The review-status message no longer repeats totals as plain text.
5. Apply → back on the order, the statement shows the new figures at once.

## 10. Public tracking link (P6-11)

**Path:** order → copy the public tracking link → open it in a private window. Below the status, the customer statement shows Items, Charges, Discounts, Tax, Total, Payments (**per method only**, no card numbers or references), Credits and the balance. Nothing else (no warnings, no staff or IDs). The pay-on-collection notice uses the same balance. A revoked or expired link shows "not found" with no statement.

## 11. Customer app (P6-12)

**Path:** customer app → sign in → Orders → open an order. Card **Payment summary**: lines to the total, paid by method, credits, and the balance with its word. With a wallet credit, the balance is total − paid − credits as the **server** states it (the old screen showed total − paid).

## 12. Edge states

- An order whose snapshot is being recalculated: yellow bar **"Figures are being recalculated."** and badge **Recalculating**.
- A cancelled order: info bar **"This order is cancelled…"**, no live balance prompt.
- An order with no snapshot: **"Financial data unavailable"**, never zeros.
- Tax-inclusive order: tax row reads **"Tax (included in prices)"** and is not added to the total.

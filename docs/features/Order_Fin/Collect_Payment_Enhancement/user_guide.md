# Collect Payment — User Guide

Records a payment against an order that still has a balance. Available in three places:

| Where | How to get there |
|---|---|
| Ready details | **Orders → Ready** → open an order → **Collect Payment** (Payment card), or **Collect remaining payment** (Customer pickup card) |
| Delivery | **Orders → Delivery** → a row with an outstanding balance |
| Order Financial tab | **Orders → All Orders** → open an order → **Financial** tab → Receivable Collection |

Requires the **`orders:collect_payment`** permission. Without it the button is visibly inactive and tells you what is missing when clicked.

Only orders whose payment type is **Pay on Collection** with a balance above zero can be collected here. Invoice/on-account balances go through **Customers → Account Receipt** instead.

## Filling it in

**Outstanding** is re-read from the server each time you open the dialog, so it reflects any payment another till took in the meantime. If it changed since the screen behind you was loaded, a warning says so:

- If you had not yet typed an amount, the amount is updated for you and the notice says so.
- If you had already typed one, **your figure is kept** and the notice tells you the new balance so you can decide.

Money is never changed behind your back.

**Payment Method** — methods configured for collection at your branch. If none are configured you get an explanation rather than an empty list. If methods fail to load, an error appears with **Retry**.

**Amount** — defaults to the full outstanding. **Full outstanding** refills it. Partial collection is allowed; when you enter less than the balance, a **Remaining after this payment** line shows what the order will still owe.

**Cash Tendered** (cash only) — what the customer handed over. Tap a **quick-tender chip** instead of typing: the chips are the sensible round-ups and notes for your currency. **Change due** then shows in large type. Tendering less than the amount is blocked with a message.

**Reference / Check fields** (non-cash) — a check asks for number, issuing bank, and date; other non-cash methods ask for a single reference. If the method requires one, you cannot collect until it is filled. Without it the payment cannot be matched to a bank statement later.

**Notes** — optional free text kept with the payment ("paid by spouse", "partial — rest on delivery").

**Cash Drawer** (when the method requires one) — the payment must be attached to an open drawer session. Pick one, **Refresh**, or **Open Session** in place. Collection is blocked until a session is bound.

**Customer is paying extra** — turn on to accept more than the balance, then choose where the excess goes (change, wallet, advance, credit note, or allocation). Requires the overpayment permission.

Some methods record the payment as **pending until verified** (bank transfers, for example). When that applies, a notice says so before you collect — the order will not be marked fully paid yet.

## Collecting

Press **Collect**, or just press **Enter**. The button is inactive while anything is unresolved, and the dialog will not close while a collection is in flight.

If it fails, the reason stays on screen (it does not vanish like a toast) and the balance is re-read, so a "the balance changed" rejection tells you the new figure.

On the Ready screen, when you opened the dialog from the pickup card the button reads **Collect & release order**, and a receipt preview opens automatically once the payment is recorded.

## Arabic / RTL

Fully supported. All labels, messages, and layout mirror in Arabic.

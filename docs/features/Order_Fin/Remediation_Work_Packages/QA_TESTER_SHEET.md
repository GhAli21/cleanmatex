# CleanMateX — Testing Sheet

**Thank you for helping test!** 🙏

You do **not** need any technical knowledge. You just use the app like a normal shop employee would, and write down whether each thing worked.

---

## Before you start — please read this (2 minutes)

**1. Nothing here is real.** This is a practice system with fake customers and fake money. You cannot break anything, you cannot lose real money, and you cannot upset a real customer. Please click freely.

**2. There are no wrong answers.** If something confuses you, that *is* the finding — write it down. "I didn't understand what this button meant" is genuinely useful.

**3. Money amounts matter most.** The most valuable thing you can spot is a **number that looks wrong** — a total that doesn't add up, a price that changes when it shouldn't, or two screens showing different amounts for the same order. Please look closely at numbers.

**4. Screenshots help a lot.** See the naming rules below — please follow them, it saves us a lot of time.

**5. This is long — that's expected.** There are 17 parts. **Please do them in order, and feel free to stop and continue another day.** Each part is self-contained, and finishing a part is genuinely useful even if you never reach the end. Tick the "Part complete" box at the end of each one.

**6. If you get stuck or can't find something,** mark it "Couldn't test", write what you looked for, and move on. Don't lose time hunting.

---

## How to fill this in

Under each test there is a line like this:

```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

Put an **x** inside the brackets of the one that applies, like `(x) Worked`, and type anything you noticed on the NOTES line.

- **Worked** — it did what the test said it should
- **Problem** — it did something different, looked wrong, or gave an error
- **Couldn't test** — the button was missing, you didn't have access, or you got stuck

If you choose **Problem**, please write *what you saw* instead. Even one sentence is enough.

---

## 📸 Screenshots — how to take and name them

**Windows:** press **Windows key + Shift + S** → drag a box → open **Paint** → **Ctrl + V** → save.
**Mac:** press **Shift + Command + 4**, then drag a box. It saves to your Desktop.

**Name every screenshot after the test number:**

```
Test-10.png          (one picture for test 10)
Test-10-a.png        (several pictures for test 10)
Test-10-b.png
General-1.png        (something odd, not tied to a test)
```

> ✅ Good: `Test-13.png`
> ❌ Please avoid: `Screenshot 2026-08-15 at 14.32.11.png`, `IMG_0042.png`, `photo.png`
>
> The number tells us instantly which test it belongs to. Without it we have to guess.

Put them all in **one folder** called `CleanMateX-Screenshots` and send it back with this file. `.png` or `.jpg` both fine.

---

## Your login details

*(the person who gave you this file will fill these in)*

| | |
|---|---|
| Website address | ......................................................... |
| **Main** username / password | ......................................................... |
| **Limited** username / password *(fewer permissions)* | ......................................................... |
| **View-only** username / password *(optional)* | ......................................................... |
| Currency you should see | ......................................................... |

> Several tests ask you to log in as the **Limited** user to check that the app correctly *stops* someone who isn't allowed to do something. Those are clearly marked. If you weren't given that login, mark them **Couldn't test**.

---

## Quick summary — please fill this in at the end

| | Number |
|---|---|
| Tests that **Worked** | ......... |
| Tests with a **Problem** | ......... |
| Tests you **Couldn't test** | ......... |
| Parts you completed (out of 17) | ......... |

**Your overall impression** (what felt slow, confusing, or good):

.................................................................................................

.................................................................................................

---
---

# Part 1 — Getting started

### Test 1 — Log in
**Do:** Open the website and log in with the **Main** account.
**Should happen:** You reach the dashboard, no error.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 2 — Look around
**Do:** Click through several left-menu items (Orders, Customers, Internal Finance, Reports).
**Should happen:** Pages open normally — no error boxes, no blank white screens.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 1 complete**

---

# Part 2 — Creating and paying for orders

### Test 3 — Create a simple order
**Do:** **Orders → New Order** → choose a customer → add 2–3 items → look at the **Total**.
**Should happen:** Total matches the item prices; every amount shows the correct currency.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 4 — Pay with cash and get change
**Do:** Click the green payment button → choose **Cash** → type more than the total (total 3.300 → type 5) → complete.
**Should happen:** Correct change shown (1.700), order created.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 5 — The saved order matches
**Do:** **Orders → All Orders** → open the order you just made.
**Should happen:** Shows as paid; total identical to what you saw at payment.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 6 — Pay only part
**Do:** New order → at payment, pay **less** than the total (total 10 → pay 4) → save → reopen it.
**Should happen:** Shows money still owed, and the remaining amount is right (6).
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 7 — Tax appears correctly
**Do:** Create an order and look at the tax line before paying.
**Should happen:** A tax amount is shown and looks consistent with the item prices (not zero if tax is set up, not a random number).
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Tax shown: ............
```

### Test 8 — Receipt matches the screen
**Do:** Open a paid order → print/preview its receipt.
**Should happen:** Receipt totals match the order screen exactly.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 2 complete**

---

# Part 3 — Extra options that cost money

### Test 9 — Find the Preferences button
**Do:** New Order → add an item → look at the bar across the top.
**Should happen:** A **"Preferences"** button is there, and stays visible as you move between the numbered steps.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 10 — Add a paid extra
**Do:** Click **Preferences** → pick one that has a **price** (e.g. +0.500) → watch the Total.
**Should happen:** Total rises by exactly that amount, immediately.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 11 — The button shows a count
**Do:** Close the window, move to another step, look at the Preferences button again.
**Should happen:** It shows a small number badge (how many extras are applied).
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 12 — Remove the extra
**Do:** Reopen Preferences → remove the extra with its **×**.
**Should happen:** Total drops back by exactly the same amount; badge disappears.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 13 — Per-item options
**Do:** Go to step **"2) Order Items"** → Preferences tab → look at an item's own card.
**Should happen:** The item offers **both** service preferences and packing choices. There is **no** "Whole Order" section here (that moved to the top-bar button).
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 14 — The extra shows in the payment window  ⭐
**Do:** With a paid extra applied, open the payment window and look for a line showing it.
**Should happen:** The extra appears as its own line, and the payment total **matches** the order page total.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Order page total: ............   Payment window total: ............
```

### Test 15 — Paying with the extra works
**Do:** Complete that payment.
**Should happen:** Order submits with **no** warning about amounts not matching.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 16 — Plain order still shows a breakdown
**Do:** Create an order with **no** extras and **no** discount → open the payment window.
**Should happen:** A breakdown (at least a "Subtotal" line) still shows above the total.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 3 complete**

---

# Part 4 — Do the numbers agree everywhere?  ⭐ *most important*

### Test 17 — Same order, three screens  ⭐
**Do:** Take a **partly paid** order. Write down the amount still owed shown on: (1) the order's page, (2) its printed receipt, (3) **Reports**.
**Should happen:** All three are the same.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Order page: ............  Receipt: ............  Reports: ............
```

### Test 18 — Totals add up
**Do:** On a paid order, look at the money summary.
**Should happen:** Paid + still-owed matches the total. Nothing double-counted.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 19 — An unfinished payment isn't counted as paid
**Do:** Create an order using a payment method that stays **pending** (ask the owner which one — often Cheque or Bank Transfer). Open the order.
**Should happen:** The pending amount is shown separately and is **not** counted as paid. The order is not flagged as having a problem.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 20 — Store credit counts once
**Do:** Find or create an order where customer credit / wallet money was used.
**Should happen:** The credit reduces what's owed **once** — not counted twice (e.g. as both a discount and a payment).
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 4 complete**

---

# Part 5 — Changing an order after it's paid

### Test 21 — Editing a paid order asks for a reason
**Do:** Open a **paid** order → **Edit** → add an item so the total rises → **Save**.
**Should happen:** A window appears asking for a **reason**.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 22 — A too-short reason is refused
**Do:** Type only 2–3 letters and try to confirm.
**Should happen:** It won't let you save.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 23 — Save with a proper reason
**Do:** Type a real sentence and confirm.
**Should happen:** Saves, then shows the **old total**, **new total**, and the **difference**, with guidance about the money.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Old: ............  New: ............  Difference: ............
```

### Test 24 — Making an order cheaper
**Do:** Edit a paid order, **remove** an item so the total falls, save with a reason.
**Should happen:** The message says money is owed **back to the customer**.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 25 — A change with no price effect stays quiet  ⭐
**Do:** Edit a paid order and change something with **no** price impact (a note, a phone number). Save.
**Should happen:** Saves **silently** — no reason asked, no money message.
> ⭐ If it asks for a reason here, that's a problem.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 26 — The reason is recorded
**Do:** On an order you edited, find its history / audit trail.
**Should happen:** The reason you typed appears, with the before and after totals.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 5 complete**

---

# Part 6 — Refunds

### Test 27 — Start a refund
**Do:** Open a **paid** order → refund action → refund **part** of it (e.g. 2 of 10).
**Should happen:** Accepted and recorded.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 28 — Can't refund more than was paid
**Do:** Try to refund more than the customer paid.
**Should happen:** Blocked — you can't exceed the limit.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 29 — A refund doesn't create a new debt  ⭐
**Do:** After the refund, look at the order.
**Should happen:** The refund shows, and the amount the customer **owes has NOT gone up**.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 30 — It appears in the refunds list
**Do:** **Internal Finance And Operations → Refunds**.
**Should happen:** Your refund is listed, waiting for approval.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 31 — Approve your own refund  ⭐
**Do:** Click **Approve** on the refund **you** created.
**Should happen:** It approves.
> ⭐ **Deliberate — don't report as a bug.** One person may request *and* approve, if they have permission.
> ❌ A problem: blocked with *"you cannot approve your own refund"* / *"a different user must approve"*.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 32 — Process it
**Do:** Click **Process**.
**Should happen:** Completes; the order reflects it.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 33 — Refund to wallet / store credit
**Do:** Do another refund, choosing **wallet** or **store credit** as the destination.
**Should happen:** The customer's wallet/credit balance rises by that amount (check **Customer Management → Stored Value**). What they owe is unchanged.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 34 — Someone without permission can't approve  *(Limited login)*
**Do:** Create a refund as **Main**, then log in as **Limited** and open **Refunds**.
**Should happen:** No Approve button, or a clear "no permission" message.
**Should NOT happen:** a message about approving your own request.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 35 — Cancel a paid order
**Do:** Cancel an order that has been paid → choose the **refund** option in the cancel dialog.
**Should happen:** Cancels, and refund records are created. The money side is handled, not left stranded.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 6 complete**

---

# Part 7 — Cash drawers

### Test 36 — Open and close a drawer
**Do:** **Internal Finance And Operations → Cash Drawers** → open a session → close it.
**Should happen:** Works; you see an expected-cash figure.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 37 — A cash sale counts once  ⭐
**Do:** Open a session → make **one** cash sale of a known amount (e.g. 5) → close.
**Should happen:** Expected cash rises by **5 only** — not 10.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Sale amount: ......   Expected cash rose by: ......
```

### Test 38 — Money added by hand
**Do:** Use **Add movement → Cash In** for an amount → close.
**Should happen:** Expected cash increases by that amount.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 39 — Money taken out by hand
**Do:** **Add movement → Cash Out** for an amount.
**Should happen:** Expected cash decreases by that amount.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 40 — Three screens agree  ⭐
**Do:** Compare expected cash on: the **POS Sessions** close preview, the actual close result, and the **Cash Drawers** session detail.
**Should happen:** All three the same.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Preview: ......  Close: ......  Detail: ......
```

### Test 41 — A sale that gives change
**Do:** Make a cash sale where change is given back → close.
**Should happen:** The change is counted once — the figure isn't over- or under-stated.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 42 — Small difference needs no approval
**Do:** Close a session where your counted cash is very close to expected.
**Should happen:** Closes normally, no approval prompt.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 43 — Big difference asks for approval
**Do:** Close a session with a clearly **different** counted amount.
**Should happen:** Closes, but is flagged as needing approval.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 44 — Approve your own difference  ⭐
**Do:** On that session, click **Approve** — as yourself, the same person who closed it — and type a reason.
**Should happen:** Approves normally.
> ⭐ Same rule as Test 31 — the same person is allowed.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 45 — A reason is required
**Do:** Try approving a difference with the reason box **empty**.
**Should happen:** Refused until you type a reason.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 46 — Can't approve twice
**Do:** Click Approve again on an already-approved session.
**Should happen:** Refused — already approved.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 47 — No permission, no approval  *(Limited login)*
**Do:** As **Limited**, open a session that needs approval.
**Should happen:** No Approve option.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 7 complete**

---

# Part 8 — Customer money (wallet, advances, gift cards)

### Test 48 — Top up a wallet
**Do:** **Customer Management → Stored Value** → a customer → **Top up wallet** → amount → confirm.
**Should happen:** Balance rises by exactly that amount, correct currency.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 49 — Paying by cash for the top-up
**Do:** Another top-up → choose **Cash** → type a cash amount larger than the top-up.
**Should happen:** Shows **change due**; balance rises by the top-up value, not the cash handed over.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 50 — Double-click doesn't double-charge  ⭐
**Do:** Start a top-up and click confirm **twice, quickly**.
**Should happen:** Balance rises **once**.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Before: ............  After: ............
```

### Test 51 — The top-up reaches the drawer
**Do:** After a **cash** top-up with an open drawer session, check that drawer session.
**Should happen:** Its expected cash increased by the top-up amount.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 52 — Issue an advance
**Do:** Same screen → **Issue advance** → amount → confirm.
**Should happen:** Advance created in the correct currency; balance rises once.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 53 — Sell a gift card
**Do:** **Marketing → Gift Cards → Sell Card** → fill in → complete.
**Should happen:** Card created, code shown, and a payment step (method + cash/change) appeared during the sale.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 54 — Wallet for a brand-new customer
**Do:** Top up a customer who has **never** had a wallet.
**Should happen:** Wallet is created in the correct currency (not some other currency), balance = amount.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 55 — No permission, no top-up  *(Limited login)*
**Do:** As **Limited**, try **Top up wallet**, **Issue advance**, **Issue credit note**.
**Should happen:** All refused with a permission message.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 8 complete**

---

# Part 9 — Payments that are waiting (pending)

*Needs a payment method that stays "pending" — ask the owner which one.*

### Test 56 — A pending payment appears in the worklist
**Do:** Create an order paid with the pending method → **Internal Finance And Operations → Pending Payments**.
**Should happen:** That payment is listed.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 57 — Confirm it arrived
**Do:** Click **Verify** on it.
**Should happen:** It becomes completed, leaves the list, and the order's owed amount updates.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 58 — Marking one as failed needs details
**Do:** On another pending payment click **Mark Failed/Bounced** → try to submit with nothing filled in.
**Should happen:** Submit stays disabled until you give a reason **and** choose what happens next.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 59 — Mark it failed properly
**Do:** Fill reason ("cheque bounced") + choose **collect on delivery/pickup** → submit.
**Should happen:** Marked failed; the order switches to collecting later.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 60 — Cancel a pending payment
**Do:** On a third one, **Cancel** it with a reason + "needs manual review".
**Should happen:** Cancelled; the order reflects it.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 61 — Same actions on the order page
**Do:** Open an order with a pending payment → its **Payments** tab.
**Should happen:** **Verify**, **Mark Failed**, **Cancel** all available there too.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 62 — Completed payments have no such buttons
**Do:** Look at a normal completed cash payment.
**Should happen:** No Verify/Cancel/Fail options for it anywhere.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 63 — Double-click is safe
**Do:** Submit a Cancel or Fail twice quickly.
**Should happen:** Only applied once.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 64 — No permission, no worklist  *(Limited login)*
**Do:** As **Limited**, try to open **Pending Payments**.
**Should happen:** Not reachable.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 9 complete**

---

# Part 10 — Collecting money later

### Test 65 — Collect the balance
**Do:** Open an order marked "pay on collection" with money owed → **Collect Payment** → pay it all in **cash** (drawer session open) → submit.
**Should happen:** Succeeds; the order shows nothing owed.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 66 — It reached the drawer
**Do:** Check that drawer session's detail.
**Should happen:** A cash movement exists for exactly that amount.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 67 — A receipt record exists
**Do:** Open **Business Vouchers** (Finance area) and find the receipt created by Test 65.
**Should happen:** It exists, is posted, and links to the order.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 68 — Collect in two parts
**Do:** On another such order, collect **part** now, then the rest in a second action.
**Should happen:** Both recorded; owed amount reaches zero.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 69 — Double-click is safe
**Do:** Submit a collection twice quickly.
**Should happen:** Charged once only.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 10 complete**

---

# Part 11 — Background processing monitor

*Skip this whole part if the Outbox Monitor menu item isn't visible.*

### Test 70 — Loyalty points arrive
**Do:** Complete an order for a customer on a loyalty programme → wait 1–2 minutes → check their points.
**Should happen:** Points increased.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 71 — The monitor shows it processed
**Do:** **Internal Finance And Operations → Outbox Monitor**.
**Should happen:** The loyalty event for that order shows **Processed**, not stuck pending.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 72 — Filters work
**Do:** Use the status filter (Failed / Dead-lettered).
**Should happen:** The list narrows correctly.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 73 — Retry a failed one
**Do:** If any failed row exists, click **Retry**.
**Should happen:** Goes back to pending and leaves the failed filter.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 74 — View-only user has no Retry  *(View-only login)*
**Do:** Log in as the **View-only** account → open the monitor.
**Should happen:** Can see the list, but **no Retry buttons**.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 75 — No permission, no monitor  *(Limited login)*
**Do:** As **Limited**, look for Outbox Monitor.
**Should happen:** Not in the menu, and not reachable directly.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 11 complete**

---

# Part 12 — Permissions in general  *(Limited login)*

### Test 76 — Price override blocked
**Do:** As **Limited**, open an order and try to change an item's price.
**Should happen:** Refused with a permission message.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 77 — Price override allowed for the right role
**Do:** As **Main**, do the same.
**Should happen:** Allowed, and the change is recorded.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 78 — Denial messages are clear
**Do:** Think back over every "denied" message you saw as **Limited**.
**Should happen:** Each said clearly that permission was missing — not a code or a blank screen.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  (list any unclear ones)
```

**▢ Part 12 complete**

---

# Part 13 — Reversing a payment

### Test 79 — Void a payment that never completed
**Do:** Find a pending/unconfirmed payment → use **Void**.
**Should happen:** Marked void; no money movement recorded.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 80 — Reverse a completed cash payment
**Do:** On a completed **cash** payment, use **Reverse** (drawer session open).
**Should happen:** Reversed, and the drawer shows a matching cash-out movement.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 81 — The order updates
**Do:** Look at the order after Test 80.
**Should happen:** The owed amount went back up by the reversed amount.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 82 — Can't reverse twice
**Do:** Try to reverse the same payment again.
**Should happen:** Refused.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 13 complete**

---

# Part 14 — Loyalty points

### Test 83 — Loyalty appears at payment
**Do:** For a customer with points, open the payment window.
**Should happen:** A loyalty/points payment option is offered.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 84 — Redeeming points reduces the total
**Do:** Use points as part of the payment.
**Should happen:** The amount to pay drops sensibly, and the points balance falls by the right amount.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Points before: ......  after: ......  Money reduced by: ......
```

### Test 85 — Loyalty settings screen
**Do:** Open the loyalty settings (Marketing/Settings area).
**Should happen:** It opens, shows readable labels (not raw text like `marketing.loyalty.title`), and saves changes.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 14 complete**

---

# Part 15 — Reconciliation (the finance check)

### Test 86 — Run a check
**Do:** **Internal Finance And Operations → Reconciliation** → run it for today's date/branch.
**Should happen:** It completes without errors.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 87 — It looks healthy
**Do:** Open the completed run's detail.
**Should happen:** Checks are listed and the orders you created in this session don't raise problems.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  Number of checks shown: ............   Any failures? ............
```

**▢ Part 15 complete**

---

# Part 16 — Arabic

### Test 88 — Switch to Arabic
**Do:** Use the language switch in the header.
**Should happen:** Text becomes Arabic and the layout flips right-to-left.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 89 — Main screens in Arabic
**Do:** In Arabic, visit New Order, an order's page, Refunds, Cash Drawers, Stored Value.
**Should happen:** All translated, nothing cut off or overlapping, no leftover English.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  (note any screen that looked wrong)
```

### Test 90 — A full order in Arabic
**Do:** Create and pay for an order entirely in Arabic.
**Should happen:** Works as in English; numbers display correctly.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

### Test 91 — Dialogs in Arabic
**Do:** In Arabic, open the edit-reason window and a refund window.
**Should happen:** Text is right-aligned, buttons mirrored, nothing broken.
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:
```

**▢ Part 16 complete**

---

# Part 17 — Anything else

### Test 92 — Error messages
**Question:** Were all error messages you saw understandable (not codes)?
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  (list any confusing ones, or "none")
```

### Test 93 — Speed
**Question:** Did anything feel unusually slow?
```
RESULT:  ( ) Worked    ( ) Problem    ( ) Couldn't test
NOTES:  (which screen?)
```

### Test 94 — Confusing bits
**Question:** Any button, label, or screen where you weren't sure what it meant?
```
NOTES:
```

**▢ Part 17 complete**

---
---

## A note for whoever collects this sheet

*(not for the tester)*

Transcribe results into [`QA_TEST_GUIDE.md`](QA_TEST_GUIDE.md) using its **§0.1b** mapping table. Before handing this sheet out, complete [`QA_TESTER_SHEET_OWNER_SETUP.md`](QA_TESTER_SHEET_OWNER_SETUP.md) — flags, config, and logins — otherwise many parts will come back "Couldn't test".

This sheet now covers the **UI-reachable** scenarios across all packages. The residual owner-only items (raw SQL, direct API calls, locale sweeps) are listed in the setup file's section E. A package reaches `VERIFIED` when both halves are done and approval is recorded.

---

## You're finished — thank you! 🎉

Please:
1. Fill in the **Quick summary** table near the top.
2. Save this file.
3. Send it back with your **`CleanMateX-Screenshots`** folder.

**Screenshot names** should look like `Test-14.png`, `Test-14-a.png`, or `General-1.png`. If any are still named like `Screenshot 2026-08-15 at 14.32.png`, please rename them first — it makes a big difference on our side.

# User guide

This program changes how times are shown and how the business day is chosen. It does not change prices, order status, or who can open a screen.

## What you should see

- Each action uses the clock of the place that owns it: the branch that received the order, the branch that will do the work, the till, or the delivery place. When that place has no clock of its own, the action uses the organization's clock.
- The clock is named on a mixed list and on printed documents. The label matches the instant on that row, including the offset in effect on that date.
- "Today" on a till and on a day report is that clock's calendar day. An order taken at 00:30 in Muscat belongs to that Muscat date even though UTC is still on the previous date.
- A ready time you type as 17:00 is 17:00 at the shop that owns that promise. A laptop set to another country does not move it. If that local hour does not exist, or happens twice, the form asks you to pick a valid time.
- "Try again in 15 minutes" means 15 minutes.

## When the clock is not set

The screen does not guess. Opening a till, saving a ready time, or numbering a document asks for the branch or organization time zone first. A list does not show a wrong hour while it waits.

## What does not move

Changing the organization or branch time zone later does not renumber orders already issued and does not move a business day that was already closed. New work uses the new clock. Old rows keep the day they were given.

## If a time looks wrong

Note the screen, the order number, and whether a print shows a different hour from the list. Those two surfaces must match after Phase 1 and Phase 3. A four-hour gap is the defect this program is removing, not a second clock you should learn.

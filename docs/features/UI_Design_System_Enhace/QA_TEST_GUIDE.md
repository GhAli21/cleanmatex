# UI Design System and Theming — QA Test Guide

Manual checks for the owner, one section per package. Package state lives in `STATUS.md`.

## PR-01 — Tokens, fonts, RTL and accessibility (implemented 2026-11-16)

**Setup:** `cd web-admin && npm run dev`, then sign in.

| # | Where | What to do | What to expect |
|---|---|---|---|
| 1 | Any dashboard page, English | Look around: buttons, links, cards, tables | Same layout as before. Primary buttons are aqua with dark text. Links and focus outlines are a deeper aqua. Nothing is unstyled, and no area that used to have a colour is now plain grey. |
| 2 | Same page | Press Tab through the controls | Every focused control shows a visible deep-aqua outline. |
| 3 | Switch language to Arabic | Look at text, the sidebar, inputs | The Arabic font (Noto Sans Arabic) loads. Sidebar section chevrons point down when a section is open, not up. Icons in search inputs sit on the start (right) side. Long names truncate with `…` at the end of the line. |
| 4 | Any list page with a table (Orders, Customers) | Open the page; open the page-size picker; hover the pagination buttons | 10 rows per page by default. The picker still offers 5/10/20/30/50/100. Pagination buttons have names (tooltip or screen reader) in both languages, and in Arabic the arrows point the right way. |
| 5 | Any page with an info message (blue banner) | Read it | Title and text are clearly readable (deep aqua on light blue). |
| 6 | Any delete or confirm action (for example delete a row) | Open the confirm; press Tab several times; press Escape | The dialog is centred above everything else. Tab stays inside it. Escape closes it and nothing is deleted. |
| 7 | Same confirm | Click Confirm on an action that takes a moment, then press Escape at once | The dialog stays open until the action finishes; Escape does not cancel it halfway. |
| 8 | A confirm inside another dialog (for example a delete inside a voucher or processing dialog) | Open and dismiss the confirm, then scroll the mouse wheel | The page behind the outer dialog still does not scroll. |
| 9 | An order or report page | Print preview (Ctrl+P) | White background, black text. |
| 10 | Browser DevTools → Network, filter `fonts.googleapis` | Reload a page in Arabic | No requests. |
| 11 | Storybook (`npm run storybook`) | Use the new Mode and Density toolbars | Dark turns surfaces dark and text light. Compact makes controls shorter. |
| 12 | Any page with Cmx buttons, inputs and cards | Look for controls with odd padding, size or colour | Nothing looks different from #1. Screens that pass their own spacing or colour to a Cmx component now get it applied exactly (class merge). Report anything that shrank or lost its colour, with the page. |

**Known, not a failure in this package:** in Storybook dark mode the red delete button's white text is low contrast, and pagination still shows English "of", "Rows per page:" and "No items". Both are scheduled for later packages (`PLAN_PR-01.md` → Final review).

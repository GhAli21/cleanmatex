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

## PR-02 — Badges, select, shared components, class clean-up (implemented 2026-11-17)

Run each check in English and in Arabic. Where it says "dark", switch the mode in Storybook (`npm run storybook`, Mode toolbar); the app itself gets dark mode in PR-07.

| # | Where | What to do | What to expect |
|---|---|---|---|
| 1 | Orders list, an order's page | Look at the status badges | Every status uses one of 5 colours (grey, blue, amber, green, red) and no other. Statuses that were teal, violet, indigo and so on are now blue; orange ones are amber. Icons are unchanged, so stages stay distinguishable. Text is readable. |
| 2 | Order workspace header | Open orders in different statuses | The header badge colour follows the order status (it used to be always blue). |
| 3 | Vouchers list (ERP Lite) | Look at status badges | Draft grey, Posted green, Cancelled red, Reversed and Partially reversed amber. |
| 4 | Processing → an order's pieces | Look at piece status badges | Intake grey, processing blue, QA amber, ready green. |
| 5 | Any form with a dropdown inside a dialog (for example new customer, voucher line) | Open the dropdown, then press Escape | Only the dropdown closes; the dialog stays open. Press Escape again: now the dialog closes. |
| 6 | Same, with the dropdown near the bottom of the screen | Open it | The list opens upward or scrolls, and is never hidden behind the dialog. Keyboard: arrows move, Enter picks, typing a letter jumps. In Arabic the list and the check mark sit on the right. |
| 7 | A dropdown that offers "none" or "all" | Pick it, save, reopen | The choice is kept (the empty value works). |
| 8 | Top bar (any dashboard page) | Look at it | Page title on the start side; scan, permissions, sessions, notifications, language, Organization name and the user menu on the end side. The old search box is gone (it did nothing). |
| 9 | Top bar user menu | Open it with the mouse, then with Tab + Enter; use arrow keys; press Escape; click outside | It opens and closes in all these ways. Profile, Account security and Settings open their pages; Sign out (in red) signs out. In Arabic the menu aligns to the left edge of the button. |
| 10 | B2B customers, contracts, statements; Processing pages | Use the buttons, inputs and cards | They look like the other Cmx screens. The "Mark order ready" button shows its loading text while saving. The back arrow points the right way in Arabic. |
| 11 | Sidebar on a phone-width window | Open the menu | The page behind is dimmed, not solid black, and tapping it closes the menu. |
| 12 | Sidebar, top bar, tables, dialogs, checkbox, keypad | Look at colours | Same look as before, from theme colours. Checked checkboxes show a dark tick on aqua. The keypad CLEAR key is solid red with white text. The processing timeline's completed steps are light green with a green icon (they were solid green). |
| 13 | Same, in Arabic | Look at paddings, search icons, clear buttons, table fades | Everything mirrors: icons and clear buttons on the correct side, nothing overlapping the text. |
| 14 | Any table with pagination, in Arabic | Look at the footer | "صفوف لكل صفحة" and "1-10 من 25"; an empty table says "لا توجد بيانات". |
| 15 | Order issues dialog | Look at the order-number pill | Dark text on aqua, readable. |
| 16 | Any list page (Orders, Customers), in Arabic | Look at the table header and the # column | Headers line up with their cells on the right. The row number column sits at the start (right) side. |
| 17 | Any dialog, in Arabic | Look at the close X | It is at the top-left corner, not over the title. |
| 18 | Top bar user menu, in Arabic | Open it | Items read right to left, icons on the right, and the menu lines up with the button. |
| 19 | A page with brand-coloured (aqua) badges | Look at them | They have a light aqua fill, not just an outline. |
| 20 | A dropdown inside a clickable table row or card (if one exists), on a tablet or in touch emulation | Pick an option | Only the value changes; the row or card does not open. |
| 21 | Storybook → Feedback / CmxStatusBadge, Forms / CmxSelectDropdown | Switch Mode (light/dark), Direction, Density | Badges readable in both modes; the select story "In dialog near bottom" behaves as #5–#6. |

## PR-07 tasks 1–11 — Organization themes, sign-in brand, appearance (implemented 2026-11-17)

**Setup:** migrations 0752, 0753, 0754, 0757 and 0759 applied; `cd web-admin && npm run dev`. You need two Organizations: one on PRO or ENTERPRISE (custom branding), and one on a lower plan. You also need one user with `settings:branding` and one without it.

| # | Where | What to do | What to expect |
|---|---|---|---|
| 1 | Any page, Organization with no saved theme | Look around | Same look as before PR-07 (CleanMateX aqua). View the page source: there is no `<style id="cmx-theme">`. |
| 2 | Settings → Branding | Open it | Logos card (main logo, dark logo, browser icon) and a Themes card that says the Organization uses the CleanMateX theme. |
| 3 | Same, PRO Organization | New theme → name "Ocean", starting theme Ocean → Save; then **Use this theme** | "Theme saved", then "Theme is now in use". After the page reloads, buttons and links are blue. Hard-reload (Ctrl+F5): no flash of aqua first. |
| 4 | Same | Edit "Ocean": primary colour `#FACC15` (yellow) | Under the field: "This colour is hard to read as text, so links and text use a darker shade…". The preview shows yellow buttons with dark text and a darker yellow link. Save: the app uses it. |
| 5 | Same | Edit: Corners → Sharp, Save | Buttons, cards and inputs get square corners on the next page. |
| 6 | Same | Try to delete the theme in use | There is no Delete button on it. Make another theme active, then delete the old one: "Theme deleted". |
| 7 | Lower-plan Organization | New theme | The colours, corners and font block is disabled and says the plan does not include it. The app-name block is disabled too. Picking a starting theme and a default density still works. |
| 8 | ENTERPRISE Organization | Edit the theme in use: app name "Sparkle" / "سباركل" | Sidebar and browser tab say "Sparkle" (Arabic: "سباركل") instead of CleanMateX. |
| 9 | Settings → Branding, upload a main logo | Look at the sidebar | The logo replaces the "C" square. |
| 10 | Sign out on that device | Look at the sign-in page | It shows that Organization's logo (and app name, if white-label) in its colours, not CleanMateX. On a different browser (first visit) it shows CleanMateX. |
| 11 | User without `settings:branding` | Open Settings → Branding | Read-only: no New, Edit, Use or Delete buttons; logos can be viewed but not changed. |
| 12 | User menu (top bar) → Appearance | Set density Compact and text size Large → Save | "Appearance saved"; the page becomes denser and the text larger. Reload: it stays. |
| 13 | Same user on another browser or device | Sign in | Same Compact / Large (stored on the user, not the device). |
| 14 | Shared tablet: user A (Large, Organization with its own colours and logo) signs out, user B (Medium, another Organization) signs in | Look at the sign-in page, then the first page after sign-in, without reloading | Sign-in page: A's brand at most, in normal text size. After sign-in: B's text size, colours, logo and app name, never A's. |
| 19 | PRO Organization with its own colours and app name, moved to a lower plan | Rename its theme, Save; move it back to the higher plan | The rename saves. After the move back, the theme has its colours and app name again. |
| 15 | Appearance → density "Same as the Organization"; Organization theme default density Compact | Reload | Compact. |
| 16 | Customer mobile app / public order page | Open an Organization | Its brand colour matches its theme (blue for Ocean). |
| 17 | An order receipt or tax invoice while the theme is Ocean | Print or preview | Prints in light colours with the main logo. |
| 18 | Arabic | Repeat #3, #4, #7 and #12 | All texts in Arabic and laid out right to left; colour codes stay left to right. |

**Not in this section:** dark mode (PR-07 task 6, after PR-05) and the HQ catalog screens (`cleanmatexsaas/docs/features/UI_Theme_Catalogs/`).

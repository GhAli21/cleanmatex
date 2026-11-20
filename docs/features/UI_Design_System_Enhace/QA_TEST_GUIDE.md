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

**Not in this section:** dark mode (PR-07 task 6, after PR-05).

## PR-07 HQ — Appearance catalogs in HQ (implemented 2026-11-19)

In HQ (the SaaS Backoffice), signed in with `catalog.view` and `catalog.manage`. Page: Products & Items Config (`/products-items-config`).

| # | Where | Do | Expected |
|---|---|---|---|
| H1 | Hub | Scroll down | An "Appearance" section with three cards: Themes (10 active of 10), Corner styles (4 of 4), Fonts (1 of 1). |
| H2 | Themes | Open the list | Colour columns show a swatch and the `#RRGGBB` code. Corner style shows its name and code. Default: Yes on STANDARD only. |
| H3 | Themes → New theme | Code `TEST_SKY`, name, colours `#1E88E5` / `#0D47A1`, corner `SOFT`, font `STANDARD` → Create | Created. In the tenant app, Settings → Branding → New theme lists "TEST_SKY" as a starting theme. |
| H4 | Themes → TEST_SKY | Turn on Default → Save | Refused next to Default: "Another theme is already the default." |
| H5 | Corner styles → SOFT | Open Small corners | A list of sizes (0px … 2rem); no typing. Pick 0.25rem → Save: saved. |
| H5b | Themes → New theme | Code `1SKY`, then `S` | Error at the Code field, in the screen language: start with a letter, 2 to 30 characters. |
| H6 | Fonts | Look at the list | No "New" button. Opening `/products-items-config/ui-font-pairs/new` says "Cannot be added here". The English and Arabic font fields are read-only. |
| H7 | Any of the three → STANDARD | Look at the actions | No Deactivate button; the "Platform-owned" badge shows. |
| H8 | Themes → OCEAN (after one Organization saved a theme on Ocean in the tenant app) | Deactivate | The prompt says "1 organization uses it now…". Confirm: that Organization's pages still show Ocean; editing its theme there says the theme is no longer offered until it picks another. |
| H9 | Themes → TEST_SKY | Deactivate | The prompt says "No organization uses it now." |
| H10 | Arabic | Repeat H1, H5, H8 | Section "المظهر"; field labels and messages in Arabic; colour codes and lengths stay left to right. |

## PR-04 — POS counter ergonomics and keyboard shortcuts (implemented 2026-11-19)

In the tenant app, as a counter user with an open POS session, unless a row says otherwise. Pages: New Order (`/dashboard/orders/new`), Order Edit (Order Workspace), All Orders (`/dashboard/orders`).

| # | Where | Do | Expected |
|---|---|---|---|
| K1 | New Order | Press `?` (focus not in a field) | The "Keyboard shortcuts" list opens: `/`, F2, F9, Ctrl+Enter / Ctrl+S, Alt+1 … Alt+5, `?`. Escape closes it. |
| K2 | New Order | Press `/` | The item search box gets focus; no `/` is typed. |
| K3 | New Order → item search or the order notes box | Type `/` and `?` | The characters are typed; focus does not move and the list does not open. |
| K4 | New Order | Press F2 (also from inside the item search) | The customer picker opens with focus in its search box. |
| K5 | New Order, customer and items chosen | Press F9, and separately Ctrl+Enter | The payment view opens, the same as clicking Submit. |
| K6 | New Order, no items | Press F9, Ctrl+S | The message "add items" shows; the payment view does not open; the browser's Save Page does not appear. |
| K7 | New Order, POS session closed | Press F9 | The same warning as the locked gate, and focus moves to the POS session button. No payment view. |
| K7b | New Order, customer and items chosen, ready-by cleared or in the past | Press F9 | "Ready by date is required" (or "…must be in the future"). No payment view. |
| K8 | Payment view open | Press F2, Enter, Ctrl+Enter | They keep their payment meaning (pay). Press F9 and Ctrl+S: nothing happens underneath the view, and the browser's Save Page does not open. |
| K9 | Customer picker, discount or preferences dialog open | Press `/`, `?`, F9 | Nothing happens on the page behind the dialog. |
| K10 | Order Workspace (Edit) | Press F2, F9 | Nothing happens. Ctrl+Enter or Ctrl+S → Review, the same as the Review button. |
| K11 | Arabic, Arabic keyboard layout | Press the keys that type `/` and `?` (on that layout) | They work as in K1 and K2. The list reads right to left; the key names stay left to right. |
| T1 | New Order, tablet or touch screen | Tap the Quick Drop − and +, the customer buttons and the two ready-by buttons | Each target is at least 44px; on a desktop with a mouse they stay compact. |
| T2 | New Order | Quick Drop: tap + from 0, then − | It turns on at 1 and off at 0. The screen reader names the buttons "Add one Quick Drop item" and "Remove one Quick Drop item" (Arabic: in Arabic). |
| T3 | New Order | Notes "Save" switch | It is a switch: on shows the notes box, off hides it. In Arabic the knob moves the right way. |
| T4 | New Order | Submit button | It follows the Organization theme colour (no longer fixed green). Disabled until a customer and items are chosen. |
| T5 | New Order, Arabic | Look at the summary panel | Rows read right to left without a double flip (labels on the right, values on the left). Pieces, bags, the ready-by date and the time do not jumble. |
| P1 | Customer picker | Type 2+ letters | While it searches, 5 grey placeholder rows show instead of a spinner. |
| P2 | Customer picker with results | Arrow Down, Arrow Up, Enter | The highlight moves; Enter picks that customer. |
| P3 | Customer picker | Escape (also with no results) | Only the picker closes; focus returns to the button that opened it. |
| P4 | Customer picker → a global or other-Organization customer | Click it, then the confirm prompt | The link prompt shows on top, centred; Escape in it does not close the picker. "Create new customer" opens on top and works. |
| P5 | Customer picker, Arabic | Look at a result | The phone number shows with "+" in front and the digits in order. |
| L1 | All Orders, more than one page | Click Next, a page number, Previous | The URL `?page=` changes and other filters in the URL stay. There is no rows-per-page box. |
| L2 | All Orders, Arabic | Look at phone, items and total | Numbers line up in columns and do not reorder; the stats cards line up too. |

## PR-05 — Colour tokens, logical direction, workspace shell (implemented 2026-11-19)

Every feature and page changed its classes in one pass, so check broadly. For each row, check **EN and AR** (switch language) and **light and dark** (in the browser console run `document.documentElement.dataset.mode = 'DARK'`, back with `'LIGHT'`). Dark mode is not offered to users yet. In Arabic, "mirrored" means the layout is the left-right mirror of English: nothing sits on the same side as in English unless it is a number or a code.

| # | Where | Do | Expected |
|---|---|---|---|
| D1 | Dashboard, any page (AR) | Look at the sidebar and the content | The sidebar is on the right with its border on the left (towards the content), the content is padded from the right, and nav rows read right to left. Collapse and expand: the width changes and nothing jumps sides. Mobile width: the menu slides in from the right. |
| D2 | Dashboard top bar and any dropdown menu (AR) | Open the user menu and a table's row menu; use the arrow keys | Menus align to the right edge; Up and Down move through items; sub-menus open to the left. |
| D3 | Any page with tabs (AR), e.g. Settings | Focus a tab, press Left and Right | The arrows move in the reading direction (Left = next in Arabic). |
| D4 | All Orders `/dashboard/orders` (AR and EN) | Look at the header, cards, filters and table | Title and actions in one row (actions at the end), the KPI cards, then one framed filter bar, then the table. Text columns align at the start (right in Arabic); numbers stay readable left to right. |
| D5 | Customers `/dashboard/customers` | Same as D4; click Export CSV | Same frame. Export shows a spinner in the button while it runs. |
| D6 | ERP Lite → General Ledger | Same as D4 | "ERP-Lite" above the title, then title, KPI strip, framed filters, table. |
| D7 | Order details → Payments / Invoices / Receipts tabs, AR invoice detail, voucher detail and linked effects (AR) | Look at ID and code cells | They align at the start (right in Arabic). Before PR-05 they were left-aligned in Arabic. |
| D8 | Any form with labels and inputs (AR) | Look at labels, inputs, error text | All right-aligned; money and phone inputs that are left to right stay left to right. Buttons with centred text stay centred. |
| D9 | Any modal (customer create, user create, …) | Open it | The page behind is dimmed (dark, see-through), not covered by solid gray. |
| D10 | Banners: wrong password at login, settings load error, subscription warnings | Trigger one | Coloured banner with icon: red for errors, amber for warnings, blue for info, green for success. Readable in dark mode. |
| D11 | Links in tables (e.g. order number), light and dark | Hover | The link colour changes on hover (it did not before for many links). |
| D12 | Status chips and badges (orders, invoices, vouchers) in dark mode | Look | Every chip has readable text on its tint; nothing is white on white or black on black. |
| D13 | Catalog → product form → unit | Open the unit list in AR and EN | "Per Item" / "لكل عنصر" comes from translations like the other units. |
| D14 | Payment view (New Order → pay) in AR | Look at the summary bar, quick tender chips, change row | Order mirrors English; amounts stay left to right. |
| D15 | Language switcher (top bar), in EN and in AR | Open it | "English" row: label left, tick right. "العربية" row: label right, tick left. Same in both page languages. |
| D16 | Amber buttons and icons: Packing → an order (warning button), order details error page, Customers stats cards, stain toggles on New Order; light and dark | Look | Text and icons on amber are dark and readable, not white. |
| D17 | AR: voucher detail and new voucher, AR invoice detail, AR aging and balances tables, any data grid toolbar | Look at icon + text rows and toolbars | They read right to left like the rest of the page; an icon that sits before its text in English sits before it (on the right) in Arabic. |
| D18 | Desktop (wide window), EN and AR; then a phone-width window | Look at the sidebar; on phone width open and close it with the menu button. Then New Order → pay on a wide screen | Desktop: the sidebar is visible on the left (EN) / right (AR), collapse works. Phone: hidden until the menu button, slides in from the start side. Wide payment view: the receipt rail is visible beside the form. |

## PR-07 task 6 — Dark mode for users (in progress 2026-11-19)

Set the mode on **Account → Appearance → "Light or dark"** (no console trick needed any more). Check **EN and AR** for the walk rows (M5–M9).

| # | Where | Do | Expected |
|---|---|---|---|
| M1 | Account → Appearance | Change "Light or dark" to Dark, Save | Save is enabled only after a change. After saving, the page turns dark without a manual reload; reload keeps it dark. |
| M2 | Same, choose "Same as this device" | Switch the computer's own light/dark setting | The app follows the device without saving again (may need a reload in some browsers). |
| M3 | Sign out (in Dark) | Look at the login page | It follows the device setting, not the last person's choice. |
| M4 | Two people on one device: A = Dark, B = Light | A signs out, B signs in | B sees Light from the first page. Then A signs in again and sees Dark. |
| M5 | Dashboard, sidebar, top bar, any dropdown and dialog, toasts (`cmxMessage`) | Look in Dark | Text readable everywhere; cards and dialogs separated by borders; nothing white on white or black on black. |
| M6 | Orders list, order details (all tabs), New Order and the payment view, POS | Look in Dark | Same as M5; amounts, chips and badges readable; amber buttons have dark text. |
| M7 | Reports with charts (Orders, Payments, Invoices, Revenue, Customers) and the dashboard "Top services" and "Payment mix" widgets | Hover a bar or line | Tooltip box is dark with readable text; grid lines and axis labels are visible but quiet. |
| M8 | Customers, Catalog, Settings (Branding, Users, Roles), ERP Lite pages, File attachments panel | Look in Dark | Same as M5. Inputs, selects and date pickers are dark with light text. |
| M9 | Login, register, forgot password | Look in Dark (device set to dark, signed out) | Same as M5. |
| M10 | Order → Tax documents → Print; order receipt / details print; AR invoice and statement print; cash drawer session print; POS shift report; Reports → Print; Cash variance print — all with the screen in **Dark** | Open the print page | The paper is white with dark text on screen; the area around it may be dark. |
| M11 | Same pages, Dark, and a non-STANDARD theme in use | Press Print (or print preview) | Paper is white: no dark backgrounds, no dark brand or status tints; the main logo is shown. |
| M12 | Settings → Branding with a **dark logo** uploaded (after Task 6) | Look at the sidebar in Dark, then in Light | Dark: the dark logo. Light and paper: the main logo. |
| M13 | Settings → Branding with **only** a dark logo (no main logo) | Look at the sidebar in Light and Dark | The dark logo shows in both modes (not the initial letter). |
| M14 | Sign-in page with the device in **Dark**, signed out | Look at the top-start corner, the language switch, the card and both inputs | No white glare or white borders; text and inputs readable. Repeat in Light: looks as before, borders now grey instead of white. |
| M15 | Processing → a piece marked **rejected**, with the reject colour set to a light colour (e.g. yellow) in settings | Look at the "Rejected" badge | Dark text on the light fill; with a dark colour (e.g. dark red) the text is white. |
| M16 | Settings → User Preferences | Look at the "Appearance" card; click "Open Appearance" | No Theme or Display Density dropdowns any more; the link opens Account → Appearance. EN and AR. |
| M17 | Any page in **Dark** | Do something that shows a toast (e.g. save Appearance) | The toast is dark with readable text; in Light it is light; with "Same as this device" it follows the device. |
| M18 | Account → Appearance in **Arabic** | Look at the browser tab title | "المظهر" (not "Appearance"). |
| M19 | Sign in once with an Organization that has a main and a dark logo, sign out, open the sign-in page. Set Appearance to Dark (or the device to dark) and reload it | Look at the logo above the sign-in form | The main logo in light, the dark logo in dark. With only a main logo, the same logo shows in both. |
| M20 | Settings → Branding. Make a theme the one in use in two browser tabs and press "Make active" at the same moment | Look at the message in the tab that lost | A message "Another theme was made active at the same moment. Try again." (Arabic: "تم تفعيل سمة أخرى في اللحظة نفسها. حاول مرة أخرى.") and not a generic save error. The list still shows one theme in use. |
| M21 | Open a dashboard page with a chart legend (for example the dashboard sales chart) in Dark | Look at the legend words | The words are readable light text. The small swatch keeps the series colour. |
| M22 | Settings → Label printing (or Catalog → edit a product) in Dark, then in Light | Look at the bar with Save / Cancel at the bottom of the form, and the faint colour wash at the top of each form section | Dark: the bar is dark like the cards (not a white strip). The section wash follows the theme colour (green for a complete section). Light: same look as before. |

## Financial_Expert_Tester Results

**Round 1 — 2026-11-19.** Tester: Financial_Expert_Tester (Grok Bot). Environment: remote only — tenant https://cmx.cleanmatex.com (Demo Laundry, admin; viewer for read-only checks) and HQ https://hqsaas.cleanmatex.com (SUPER_ADMIN, Incognito). Times are Asia/Muscat (UTC+4). Credentials: see the credentials file, none recorded here. Screenshots: `C:\Users\JHNLP\qa-20261119\shots\` (names in Evidence).

### PR-01 — Tokens, fonts, RTL and accessibility

| # | Result | Evidence |
|---|---|---|
| PR-01 #1 | PARTIAL | Tenant already on the Ocean theme (blue), so deep-aqua primary buttons could not be checked. Dashboard and Orders are styled (white cards, blue links, tinted stat cards). Orders list status column shows plain text "Processing" with no colour (see PR-02 #1). U01a-dashboard.png, U01b-orders-list.png |
| PR-01 #2 | PASS | Tab through the header shows a rounded blue (theme colour) focus outline; the search box gets a ring. U02-focus-header.png, U02-focus-search.png. Selects and order-number pills were not screenshotted one by one. |
| PR-01 #3 | PARTIAL | Arabic sidebar: closed section chevron "<", open section "v" (correct). Customers search icon sits at the LEFT edge while text is right-aligned (wrong side). Arabic font and `…` truncation not verified. PR01-3-arabic-sidebar-order.webp, PR01-arabic-customers-under-sidebar.webp |
| PR-01 #4 | PARTIAL | Orders list (7 orders) has no pager. Vouchers pager: "Rows per page" select offers only "20"; buttons have titles "First page" / "Previous page" / "Next page" / "Last page"; Arabic first/last arrows point the right way. Customers: "Showing 1 to 5 of 5 results", no page-size picker. 10-per-page default and 5/10/20/30/50/100 not seen. U04-vouchers-pager.png, U04-customers-list-pager.webp, PR01-4-arabic-vouchers-pager.png |
| PR-01 #5 | PASS | New Order → "PAYMENT MODAL VERSION" box and the dashboard "Current Tenant" box: pale-blue background, dark-blue title, readable body. U05-payment-modal-banner.png, U05-neworder.png |
| PR-01 #6 | PARTIAL | File delete confirm on an order ("Delete file? Delete "image.png"? This cannot be undone."): centred, Tab x4 stays inside, Escape closes, nothing deleted, focus returns to the trash button. But Quick Add Customer dialog: Escape does NOT close it, and Tab leaves it (focus goes behind the overlay to the site logo, Collapse sidebar, Dashboard link). PR02-5-after-2nd-escape-dialog-open.webp |
| PR-01 #7 | NOT RUN | No slow confirm action to time (Confirm then Escape at once). |
| PR-01 #8 | NOT RUN | No confirm nested inside another dialog was reached (processing page errors, no voucher dialog opened). |
| PR-01 #9 | PASS | Order page print preview: white background, black text. Extra: the "Back to Orders" link, action buttons and hamburger icon also print (P3, see findings). |
| PR-01 #10 | PASS | Arabic reload of tenant pages: no requests to fonts.googleapis. |
| PR-01 #11 | NOT RUN | Storybook is not part of the remote apps; not run. |
| PR-01 #12 | PARTIAL | Spot check only: dashboard, orders, customers, vouchers, New Order look consistent. Orders list status/prep status are plain text; processing page could not render. Customers badges Walk-in grey, Stub yellow, Full Profile green. |

### PR-02 — Badges, select, shared components, class clean-up

| # | Result | Evidence |
|---|---|---|
| PR-02 #1 | FAIL | Orders list shows status as plain text "Processing" on all 7 orders (no colour badge, no icon); order header is an amber badge. U01b-orders-list.png, PR02-4a-order-view-header.png |
| PR-02 #2 | PARTIAL | Order header badge for status Processing is amber (light-yellow background, amber text). All 7 orders are Processing, so other statuses were not compared. PR02-4a-order-view-header.png |
| PR-02 #3 | PARTIAL | Vouchers: Posted = green, Direction IN = blue, OUT = amber. Draft / Cancelled / Reversed colours not viewed. PR02-3-vouchers.png |
| PR-02 #4 | FAIL | /dashboard/processing shows a red banner "permission denied for table sys_order_sources_cd" after ~10 s, then "No orders in processing queue". Piece badges not observable. PR02-4-processing.png |
| PR-02 #5 | PARTIAL | Quick Add Customer, Customer Category select: Escape #1 closes only the dropdown (PASS), dialog stays. Escape #2 and #3 do NOT close the dialog (FAIL). PR02-5-dropdown-open.webp, PR02-5-after-2nd-escape-dialog-open.webp |
| PR-02 #6 | PARTIAL | Keyboard on the (native) select works: Alt+Down opens, Down + Enter picks "Stub". Near-bottom placement and the Arabic check mark were not tested. |
| PR-02 #7 | NOT RUN | No dropdown offering "none" / "all" tested. |
| PR-02 #8 | PASS | Top bar has Scan, icon buttons, notifications, language, "Demo Laundry LLC" and the user menu; no search box. T02-dashboard.png |
| PR-02 #9 | PASS | User menu opens by mouse and by Enter; Down arrow highlights Profile; Escape closes with focus back on the button; outside click closes. Items: Profile, Account security, Appearance, Settings, Sign Out (red). Sign Out not clicked. PR02-9-usermenu-open.webp |
| PR-02 #10 | NOT RUN | B2B pages not opened; Processing pages fail with the permission error (see #4). |
| PR-02 #11 | PASS | Phone width via 400% zoom: hamburger opens the sidebar, backdrop is semi-transparent grey, clicking it closes the menu. Cosmetic: sidebar opens beneath the header bar. PR02-11-mobile-sidebar-open.webp |
| PR-02 #12 | NOT RUN | Checkbox, keypad and processing timeline not reached. |
| PR-02 #13 | FAIL | Arabic: content slides under the right sidebar on /dashboard/orders, /issues, /internal_fin/vouchers, /customers (title, search, pager cut); search icon on the wrong side. PR01-arabic-orders-under-sidebar.png, PR01-arabic-customers-under-sidebar.webp, T03-arabic-orders.png |
| PR-02 #14 | FAIL | Arabic vouchers footer stays English: "1–20 of 20", "Rows per page 20", "Page 1 of 1", "Go to page", "Go". Customers footer "عرض 1 إلى 5 من 5 نتائج" (not "1-10 من 25"). Empty Issues table says "لا توجد مشكلات بعد", not "لا توجد بيانات". PR02-14-arabic-issues-empty.png, PR01-4-arabic-vouchers-pager.png |
| PR-02 #15 | NOT RUN | Order issues dialog not reachable (no Issues tab or Report issue control; /dashboard/issues has 0 issues). PR02-14-issues-en.png |
| PR-02 #16 | PARTIAL | Customers and Vouchers: headers right-aligned and first column on the right. Orders list: "رقم الطلب" header cut under the sidebar; no # column exists. |
| PR-02 #17 | FAIL | Arabic Quick Add Customer ("إضافة عميل سريعة"): close X stays at the top-RIGHT. Category label/select still English ("Customer Category", "Select category (optional)", "Stub"); layout shifts when the select loads late. PR02-17-arabic-dialog-X-right.webp |
| PR-02 #18 | PASS | Arabic user menu: items right-aligned, icons on the right, panel aligned to the button edge. PR02-18-arabic-usermenu.webp, T03-arabic-usermenu.png |
| PR-02 #19 | NOT RUN | No aqua brand badges identified (tenant is on Ocean). |
| PR-02 #20 | NOT RUN | No dropdown inside a clickable row or card found; touch emulation not used. |
| PR-02 #21 | NOT RUN | Storybook is not part of the remote apps; not run. |

### PR-07 tasks 1–19 — Organization themes, sign-in brand, appearance

| # | Result | Evidence |
|---|---|---|
| PR-07 #1 | PASS | Before any saved theme: no `<style id="cmx-theme">` in the page source; look is CleanMateX aqua. T02-dashboard.png |
| PR-07 #2 | PARTIAL | Themes card: "No saved theme yet. Your Organization uses the CleanMateX theme." + New theme (PASS). Logos card shows "The request was not valid." with Retry instead of the logo area. T06-branding.png |
| PR-07 #3 | PASS | Ocean saved: toast "Theme saved"; "Use this theme": toast "Theme is now in use. Pages show it on their next load." Row "Ocean [In use]". After reload and Ctrl+Shift+R buttons, links, logo tile are blue; one frame sample showed no aqua flash. `<style id="cmx-theme">` present in source. P701_theme_saved.webp, P702_in_use.webp, P703_view_source.webp |
| PR-07 #4 | BLOCKED | Colour fields are disabled: "Your plan does not include your own colours, corners and font." The sidebar says "Current Plan: Enterprise" (see FET-UIDS-Nov19-PlanFlagsMismatch). #FACC15 not set. P704_edit_disabled.webp |
| PR-07 #5 | BLOCKED | Corners control disabled by the same plan message. Sharp not set. P704_edit_disabled.webp |
| PR-07 #6 | PARTIAL | In-use Ocean row has only an Edit button, no Delete (PASS). The second half (activate another theme, then delete) was not run, and there is no way to activate CleanMateX again (see FET-UIDS-Nov19-NoRevertToDefaultTheme). P702_in_use.webp |
| PR-07 #7 | PARTIAL | New theme on Demo Laundry: colours/corners/font block disabled and "Your plan does not include your own app name."; picking a starting theme (preview button turns blue for Ocean) and default density (Comfortable / Compact) works. No lower-plan Organization was available, so this is the Enterprise tenant behaving like a lower plan. T06-new-theme.png |
| PR-07 #8 | BLOCKED | App name block disabled: "Your plan does not include your own app name." on an Enterprise tenant. Sparkle / سباركل not set. |
| PR-07 #9 | FAIL | Logo upload (qa_logo.png as Logo): row "qa_logo.png — The request was not valid.", nothing saved, sidebar still shows "C". Retry gives the same error (see FET-UIDS-Nov19-TenantLogoInvalidRequest). T06-branding.png |
| PR-07 #10 | NOT RUN | Sign-in page brand was not examined after sign-out. |
| PR-07 #11 | PARTIAL | Viewer: Branding opens read-only with no New, Edit, Use or Delete buttons and no file picker (PASS). But the Themes card shows a red "Could not load the themes." with Retry, and Logos shows "The request was not valid." P709_viewer_branding.webp |
| PR-07 #12 | PARTIAL | Compact + Large → toast "Appearance saved". After reload text is larger (row pitch 29.5 → 32.5 px) and the choice persists; the page was not visibly denser. P705_appearance_compact_large_reload.webp, T07-appearance-density.png |
| PR-07 #13 | NOT RUN | Needs a second browser or device; not run. |
| PR-07 #14 | NOT RUN | Needs two users on two Organizations on one tablet; not run. |
| PR-07 #19 | NOT RUN | Needs a plan downgrade and upgrade of an Organization; not run. |
| PR-07 #15 | PARTIAL | Appearance "Same as the Organization" with the theme default density Compact: after reload the layout metrics (sidebar row pitch ~29.5 px, card padding ~13 px) were identical to Comfortable. No visible Compact look detected. |
| PR-07 #16 | NOT RUN | Customer mobile app / public order page not available to this run. |
| PR-07 #17 | NOT RUN | Receipt / tax invoice preview with the Ocean theme not run. |
| PR-07 #18 | PARTIAL | Arabic Appearance page: "المظهر", "الكثافة" = "مضغوطة", "حجم النص" = "كبير", RTL OK. Edit theme dialog in Arabic OK, colour codes stay LTR, plan messages in Arabic. But Branding page content is clipped under the sidebar in Arabic. #3 and #4 not repeated in Arabic. P706_ar_appearance.webp, P707_ar_branding_overflow.webp, P708_ar_edit_dialog.webp |

### PR-07 HQ — Appearance catalogs in HQ

| # | Result | Evidence |
|---|---|---|
| H1 | PASS | Hub /en/products-items-config: section "Appearance" with Themes "10 active of 10", Corner styles "4 active of 4", Fonts "1 active of 1". H01-hub-appearance.webp |
| H2 | PASS | Themes list: swatch + #RRGGBB (STANDARD #0AB6D8 / #0E2A47 …), corner style shows "Standard" over code "STANDARD", Default "Yes" only on STANDARD. H02-themes-list.webp |
| H3 | PARTIAL | TEST_SKY created (#1E88E5 / #0D47A1, Soft, Standard font); redirected to /ui-themes/TEST_SKY with Active badge; success toast not caught. Not rechecked in the tenant New theme list afterwards (it was absent before creating). The Arabic name saved as "سما" (tool typing dropped the last letter). H10-TEST_SKY-created.webp, H10a-new-theme-filled.webp |
| H4 | PASS | Default on → Save Changes: after ~9–10 s a red toast "Another theme is already the default." Nothing saved; list still shows Yes only on STANDARD. The message is a toast, not next to the Default field (P3). Earlier attempts missed the toast (reload). H15-default-refused-toast.webp |
| H5 | PASS | SOFT → Small corners is a list (0px, 0.125rem … 2rem), no typing. 0.25rem saved; set back to 0.5rem: toast "Changes saved successfully" (~8 s per save). H13-soft-restored-toast.webp, H14-soft-small-corners-list.webp |
| H5b | PASS | Code "1SKY" and "S" → on Create: banner "Fix 6 fields" and under Code "Start with a capital letter; 2 to 30 capital letters, digits or _". No error on tab-out, only after Create. H08-code-1SKY-error.webp, H09-code-S-error.webp |
| H6 | PASS | Fonts list has no New button; /ui-font-pairs/new says "Cannot be added here"; English font "System UI" and Arabic font "Noto Sans Arabic" are read-only boxes. H06-fonts-list.webp, H07-font-new-blocked.webp |
| H7 | PASS | STANDARD in Themes, Corner styles and Fonts: "Active" + "Platform-owned" badges, "This code is owned by the platform: it can be edited but not deactivated.", no Deactivate button. H03-theme-STANDARD.webp, H04-radius-STANDARD.webp, H05-font-STANDARD.webp |
| H8 | PARTIAL | OCEAN → Deactivate prompt: "It stays in organizations that already use it, but can no longer be picked for new ones. You can reactivate it later. 1 organization uses it now. Its pages keep showing it, but it cannot save theme changes until it picks another." Confirmed (badge Inactive), then Reactivate (toast "Reactivated"); OCEAN ends Active. The tenant side (pages still blue, edit message) was not re-checked while it was inactive. H18-deactivate-OCEAN-prompt.webp, H19-OCEAN-inactive.webp, H20-OCEAN-reactivated.webp |
| H9 | PASS | TEST_SKY Deactivate prompt ends "No organization uses it now."; after confirm: badge Inactive, button Reactivate. H16-deactivate-TEST_SKY-prompt.webp, H17-TEST_SKY-inactive.webp |
| H10 | PASS | Arabic: section "المظهر", cards "السمات" "10 نشط من 11" / "أنماط الزوايا" / "الخطوط"; SOFT and OCEAN pages fully translated, RTL, colour codes and rem values stay LTR. Minor: the Font box shows "STANDARD · قياسي" (bidi order flipped). H21-ar-hub-appearance.webp, H22-ar-SOFT.webp, H23-ar-OCEAN-display.webp, H24-ar-OCEAN-top.webp |

### Findings (Financial_Expert_Tester, 2026-11-19)

- **P1 FET-UIDS-Nov19-RtlContentUnderSidebar** — In Arabic, page content slides under the right sidebar on Orders, Issues, Vouchers, Customers and tenant Branding (titles, search, first column and buttons clipped and unclickable). Order detail `/full` is fine. Evidence: PR01-arabic-orders-under-sidebar.png, PR01-arabic-customers-under-sidebar.webp, P707_ar_branding_overflow.webp, T03-arabic-orders.png. Fix: the main area keeps its left padding/margin in RTL; use logical `ps-*`/`ms-*` (or `margin-inline-start`) for the sidebar offset.
- **P1 FET-UIDS-Nov19-PlanFlagsMismatch** — Demo Laundry shows "Current Plan: Enterprise" but Branding says "Your plan does not include your own colours, corners and font" and "…your own app name". This blocks PR-07 #4, #5 and #8. Evidence: P704_edit_disabled.webp, T06-new-theme.png. Fix: set the custom-branding and white-label plan flags for the Enterprise plan (or the Demo subscription) in the plan data.
- **P1 FET-UIDS-Nov19-TenantLogoInvalidRequest** — Branding Logos card fails to load on every visit ("The request was not valid." + Retry), and uploading a logo gives the same error; no TENANT_LOGO row is written. Also hits the viewer. Evidence: T06-branding.png, P709_viewer_branding.webp. Read-only DB: TENANT_LOGO category has max_files_per_entity=2 against 4 purposes. Fix: log the 400 validation error for the list and init calls and fix the request shape.
- **P1 FET-UIDS-Nov19-ProcessingPermissionDenied** — `/dashboard/processing` shows "permission denied for table sys_order_sources_cd" after ~10 s and an empty queue, so processing pieces, badges (PR-02 #4, #10) cannot be used. Evidence: PR02-4-processing.png. Fix: grant SELECT on `sys_order_sources_cd` to the app role, as for the other `sys_*_cd` lookup tables.
- **P2 FET-UIDS-Nov19-DialogEscapeFocusTrap** — Quick Add Customer dialog: Escape does not close it, and Tab moves focus out to the page behind the overlay. The confirm dialog for deleting a file behaves correctly. Evidence: PR02-5-after-2nd-escape-dialog-open.webp. Fix: use the shared dialog primitive that handles Escape and traps focus.
- **P2 FET-UIDS-Nov19-NoRevertToDefaultTheme** — Once a theme is "In use" there is no control to go back to CleanMateX, and the in-use theme cannot be deleted. Ocean is still on Demo Laundry. Evidence: P702_in_use.webp. Fix: add "Use CleanMateX theme" next to the Themes card.
- **P2 FET-UIDS-Nov19-OrdersListNoStatusBadge** — Orders list shows status and prep status as plain text (no PR-02 badge), while the order page header has an amber badge. Evidence: U01b-orders-list.png, PR02-4a-order-view-header.png. Fix: use CmxStatusBadge in the list status cell.
- **P2 FET-UIDS-Nov19-ArabicTableFooterEnglish** — Arabic vouchers footer shows "1–20 of 20", "Rows per page 20", "Page 1 of 1", "Go to page", "Go" in English, plus a second Arabic pager line. Customers footer uses a different wording than the guide. Evidence: PR01-4-arabic-vouchers-pager.png.
- **P2 FET-UIDS-Nov19-VouchersPagerMismatch** — Vouchers list: header "Total: 31", footer "1–20 of 20" with only "20" in the page-size select, and a second line "Page 1 of 2". Two pagers disagree. Evidence: U04-vouchers-pager.png.
- **P2 FET-UIDS-Nov19-ViewerThemesListFails** — A viewer opening Settings → Branding sees "Could not load the themes." (and the logo error), so read-only users cannot see which theme is in use. Evidence: P709_viewer_branding.webp. Fix: let `settings:branding` read access (or a plain read) load themes.
- **P2 FET-UIDS-Nov19-DensityNotVisible** — Compact density (Organization default and user Appearance) gives no visibly denser layout (same row pitch and padding); Large text just scales spacing. PR-07 #12, #15. Evidence: P705_appearance_compact_large_reload.webp.
- **P2 FET-UIDS-Nov19-ProductsDeepLink500** — Opening `https://hqsaas.cleanmatex.com/products-items-config` while signed out gives "HTTP ERROR 500" instead of the sign-in page (the root redirects to /ar/login, in Arabic). Evidence: observation H-appearance, Login.
- **P2 FET-UIDS-Nov19-HqSaveSlow** — HQ catalog saves and screen loads are slow: Create theme ~10 s, deactivate/save ~8 s, page loads 3–8 s; the result appears only at the end as a toast, and Default refusal text is easy to miss. Evidence: H11-default-save-toast-fleeting.webp.
- **P3 FET-UIDS-Nov19-ArabicDialogXAndLabels** — Arabic dialog close X stays top-right (PR-02 #17); Customer Category label and options stay English; layout shifts when the select loads late. Evidence: PR02-17-arabic-dialog-X-right.webp.
- **P3 FET-UIDS-Nov19-ArabicSearchIconSide** — Arabic Customers search icon at the left edge while text is right-aligned (PR-01 #3, PR-02 #13). Evidence: PR01-arabic-customers-under-sidebar.webp.
- **P3 FET-UIDS-Nov19-LangSwitchMixedState** — Switching Arabic → English without reload shows an LTR layout with Arabic text until reload. Evidence: PR01-switch-back-mixed-state.webp.
- **P3 FET-UIDS-Nov19-PrintChrome** — Order print preview includes the "Back to Orders" link, action buttons and hamburger icon (PR-01 #9).
- **P3 FET-UIDS-Nov19-ArabicLeftovers** — Arabic order page: phone shown with the "+" after the digits, "points 0" and statuses "Pending", "Processing", "POS (counter)" untranslated on the Orders list; HQ Font box bidi "STANDARD · قياسي".
- **P3 FET-UIDS-Nov19-HqDefaultRefusalAsToast** — H4 refusal "Another theme is already the default." shows as a toast, not next to Default as the guide says; code errors show only after Create, not on blur.
- **P3 FET-UIDS-Nov19-MobileSidebarUnderHeader** — Phone-width sidebar opens beneath the header bar (cosmetic). Evidence: PR02-11-mobile-sidebar-open.webp.
- **P3 FET-UIDS-Nov19-OrderFilesTabMissingInFullView** — The "View full details" page has no Files tab; Files is only reachable from All Orders → View. (Also affects the File Util guide.)

### Recount, caveats and test data

**Recount (UIDS, 63 rows):** PASS 19 / FAIL 6 / PARTIAL 19 / BLOCKED 3 / NOT RUN 16 (total 63). By section: PR-01 PASS 4 / FAIL 0 / PARTIAL 5 / BLOCKED 0 / NOT RUN 3 (total 12); PR-02 PASS 4 / FAIL 5 / PARTIAL 5 / BLOCKED 0 / NOT RUN 7 (total 21); PR-07 tasks PASS 2 / FAIL 1 / PARTIAL 7 / BLOCKED 3 / NOT RUN 6 (total 19); HQ PASS 9 / FAIL 0 / PARTIAL 2 / BLOCKED 0 / NOT RUN 0 (total 11).

**Caveats:** some text fills and file uploads used the browser tool's `fill` / `setInputFiles` fallback (the native file dialog and xdotool typing did not register on the box); other actions used the real mouse and keyboard. No camera on the box. No HQ viewer account. Screens in the tenant ran on the Ocean theme, so aqua colours could not be checked. Storybook rows were not run (remote only).

**Test data left behind (UIDS):**
- Demo Laundry: theme "Ocean" (Arabic name أوشن, starts from Ocean, default density Comfortable) is IN USE, with no UI way back to CleanMateX. Admin Appearance restored to "Same as the Organization" / Medium; language English.
- HQ: theme TEST_SKY exists and is Inactive (not default). SOFT Small corners restored to 0.5rem. OCEAN was deactivated and reactivated (Active now).

### Retest r2 2026-11-19 — UI Design System

**Retest r2 — 2026-11-19, 16:14 to 20:29 Asia/Muscat (UTC+4).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: the owner deployed new updates at 16:14 and asked to retest the FAILED, BLOCKED and PENDING (PARTIAL / NOT RUN) rows of this guide and the other QA guide. Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch; admin, plus viewer and operator for the role rows) and HQ https://hqsaas.cleanmatex.com (Incognito). Real mouse and keyboard, no direct API calls, no page scripts, no Jest. Credentials: see the credentials file, none recorded here. Screenshots: `C:\Users\JHNLP\qa-20261119\retest2\shots\` (names in the Shot column; the Round 1 shots stay in `C:\Users\JHNLP\qa-20261119\shots\`). Notes: Round 1 text above is untouched. Rows needing a write the owner has not approved, and the HIGH-IMPACT rows, were not run and are marked NOT RUN, or BLOCKED where a missing screen is the reason. No order was paid or submitted in r2.

**Guide changes found while writing back.** The guide I tested from (45,356 B, 11:26) was edited again by the owner at 17:56 during the retest: new row PR-05 D18 and new rows PR-07 task 6 M13 to M18 (7 rows). They are listed below as NOT RUN. Only text above this section changed in that edit; Round 1 results and all other rows are unchanged, and there are no Dev notes.

#### Retest r2 results

Columns: r1 = Round 1 result (or "- (new row)"), r2 = this retest. Rows that passed in Round 1 and were not re-run keep PASS.

| Row | r1 | r2 | Evidence | Shot |
|---|---|---|---|---|
| PR-01 #1 | PARTIAL | PARTIAL | Saudi Demo Add Customer button is aqua with dark text. Links and focus outline colours not recorded. | T3-F-PR01-customers |
| PR-01 #2 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-01 #3 | PARTIAL | PARTIAL | Arabic search icon is on the right (start) and sidebar chevrons are correct. Font and the end-of-line ellipsis not verified. A stray "JWT Test" sidebar item is visible. | T1-PR01-03, T1-PR01-03-sidebar-ar |
| PR-01 #4 | PARTIAL | FAIL | Orders (12 rows) has no pager. Customers has no page-size picker and its arrows are reversed in Arabic. Vouchers picker offers only 20; header "Total 43" vs footer "1-20 of 20" vs "Page 1 of 3"; tooltips English. | T1-PR01-04-orders, T1-PR01-04-customers-en, T1-PR01-04-customers-ar, T1-PR01-04-vouchers, T1-PR01-04-vouchers-en |
| PR-01 #5 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-01 #6 | PARTIAL | FAIL | Quick Add Customer dialog: Tab still escapes to the search box and browser chrome, Escape does not close it (see FET-UIDS-Nov19-DialogEscapeFocusTrap). | T1-PR01-06-tab-en, T1-PR01-06-tab-ar |
| PR-01 #7 | NOT RUN | FAIL | Under 3G throttling the confirm dialog closed at once while the action was still running; the tile lingered. | - |
| PR-01 #8 | NOT RUN | NOT RUN | Adding a voucher line needs "Next: Add Lines", which saves a draft voucher. Not done. | - |
| PR-01 #9 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-01 #10 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-01 #11 | NOT RUN | NOT RUN | Storybook is not part of the remote apps (remote-only rule). | - |
| PR-01 #12 | PARTIAL | PARTIAL | B2B screens are plain tables with outline View buttons and a duplicate heading; Roles has an empty Actions column; native selects; inactive chip is grey. | T1-PR01-12-b2b-contracts, T1-PR01-12-b2b-customers, T1-PR01-12-b2b-statements, T1-PR01-12-roles, T1-PR01-12-users, T1-PR01-12-dashboard, T1-PR01-12-orders, T1-PR01-12-customers, T1-PR01-12-neworder |
| PR-02 #1 | FAIL | FAIL | Orders list still shows status and prep status as plain text; only the order page header has the amber pill. | T1-PR02-01, T1-PR02-01b-orderheader, T1-PR02-01c-orders-en-playwright |
| PR-02 #2 | PARTIAL | NOT RUN | Needs orders in three or more statuses; that depends on the T5/T6 state changes (awaiting owner approval). Only Processing orders exist. | - |
| PR-02 #3 | PARTIAL | PARTIAL | Vouchers "Posted" is green on light green. The status filter is a text match over the 20 loaded of 43 rows; Draft/Cancelled/Reversed not confirmed. | - |
| PR-02 #4 | FAIL | PARTIAL | FIXED gate: /dashboard/processing now loads (about 10 s), no sys_order_sources_cd error. ORD-20261119-00004: item badge "processing" blue; no per-piece status badge visible. | T4-PR02-12b |
| PR-02 #5 | PARTIAL | FAIL | Dropdown Escape closes the dropdown only (PASS), but the second Escape does not close the dialog. | T1-PR02-05-6-escape-en |
| PR-02 #6 | PARTIAL | PARTIAL | The list is a native select. Near-bottom placement and arrow/typing keys were not tested. | T1-PR02-05-6-escape-en |
| PR-02 #7 | NOT RUN | PARTIAL | "All" works as a filter choice; the choice is not kept after a reload. | T1-PR02-07-dropdown-en, T1-PR02-07-dropdown-ar |
| PR-02 #8 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-02 #9 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-02 #10 | NOT RUN | FAIL | B2B and Processing screens look consistent. In Arabic the back link on Processing details has its chevron pointing left on the start side (wrong way) and "التفاصيل" uses a right arrow. "Mark order ready" loading text not run (needs NEW approval). | T4-PR02-10b |
| PR-02 #11 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-02 #12 | NOT RUN | PARTIAL | "No Bleach" checkbox is a blue (theme) box with a white tick. Keypad CLEAR not reachable without paying. Processing timeline has no completed step to judge (clicking a step changes data). | T4-PR02-12, T4-PR02-12b, T4-PR02-12-remove |
| PR-02 #13 | FAIL | PARTIAL | FIXED part: in Arabic the content no longer slides under the right sidebar (Customers, Orders, Issues, Vouchers, New Order, Branding). Still wrong: page titles stay English, Vouchers search icon is missing. | T1-PR02-13-customers-ar, T1-PR02-13-orders-ar, T1-PR02-13-vouchers-ar, T1-PR02-13-issues-ar |
| PR-02 #14 | FAIL | FAIL | Arabic Vouchers footer still English ("Rows per page", "Go to page", "Page 1 of 1") and mirrored "of 20 20-1"; Customers pager says Previous/Next in English. Issues empty state is Arabic. | T1-PR02-14-vouchers-footer-ar, T1-PR02-14-customers-footer-ar, T1-PR02-14-issues-empty-ar |
| PR-02 #15 | NOT RUN | BLOCKED | Issues dialog unreachable: no Issues tab on the order and no Report issue control (FU D1). | - |
| PR-02 #16 | PARTIAL | PARTIAL | Arabic Customers has no # column, Contact header is offset, phone shows "96896662624+" (plus at the end), Orders cells stay English. | T1-PR02-16-customers-ar, T1-PR02-16-orders-ar, T1-PR02-16-vouchers-ar |
| PR-02 #17 | FAIL | PARTIAL | Arabic dialog X is now top-left (PASS). Quick Add "Customer Category" and option "Stub" stay English; New Theme dialog footer is clipped. | T1-PR02-17-dialog-ar, T1-PR02-17-dialog2-newtheme-ar |
| PR-02 #18 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-02 #19 | NOT RUN | PARTIAL | "Stub" badge seen; its fill was not judged against the aqua reference. | - |
| PR-02 #20 | NOT RUN | NOT PRESENT | No dropdown inside a clickable row or card on New Order, Edit or Order details; no touch emulation used. | - |
| PR-02 #21 | NOT RUN | NOT RUN | Storybook is not part of the remote apps (remote-only rule). | - |
| PR-07 #1 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-07 #2 | PARTIAL | FAIL | Branding Logos card still shows "The request was not valid." (Retry does not help). | T2-1 |
| PR-07 #3 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-07 #4 | BLOCKED | BLOCKED | Ocean edit: colour fields still disabled with "Your plan does not include your own colours, corners and font." Root cause found in HQ: plan ENTERPRISE but custom_branding, white_label, branded_emails, branded_receipts, receipt_branding_enabled are all false (Source: Plan). Colour picker shows #6366f1 while the text box shows the #2563EB placeholder. | T3-PR07-04, H3-flags-demo |
| PR-07 #5 | BLOCKED | BLOCKED | Corners control still disabled by the same plan-flag gap. | T3-PR07-05, H3-flags-demo |
| PR-07 #6 | PARTIAL | PASS | In-use Ocean has no Delete. Created QA-Alt, made it In use: Ocean then had Delete; switched back to Ocean and deleted QA-Alt ("Theme deleted" 17:26). Still no control to go back to CleanMateX (FET-UIDS-Nov19-NoRevertToDefaultTheme open). | T3-A, T3-Ocean-original |
| PR-07 #7 | PARTIAL | PASS | Saudi Demo (Free Trial): New theme colour, corner, font and app name are disabled with plan messages; starting theme and density enabled. | T3-F-PR07-7 |
| PR-07 #8 | BLOCKED | BLOCKED | App name field still disabled on Enterprise (plan-flag gap, see #4). | T3-PR07-08, H3-flags-demo |
| PR-07 #9 | FAIL | FAIL | qa_logo.png upload fails with HTTP 400 "The request was not valid."; sidebar still shows the initial "C". | T2-2 |
| PR-07 #10 | NOT RUN | PASS | Adapted: sign-in page (normal and Incognito) shows the CleanMateX brand because no tenant logo exists. | T2-5-signin, T2-5-incognito |
| PR-07 #11 | PARTIAL | FAIL | Viewer and operator on /dashboard/settings/branding: Logos card "The request was not valid." and Themes "Could not load the themes." with only Retry. Read-only behaviour cannot be confirmed. | T12-PR07-11 |
| PR-07 #12 | PARTIAL | PARTIAL | New URL /dashboard/account/appearance works. Compact + Large saved ("Appearance saved"); a visibly denser row pitch was not measured. | T3-B, T3-B-toast |
| PR-07 #13 | NOT RUN | PASS | Incognito sign-in page shows Compact + Large for that user. Appearance restored to Same as the Organization / Medium at 17:33. | T3-C, T3-D |
| PR-07 #14 | NOT RUN | PASS | Saudi sign-in page and first page free of Demo branding/size. After sign-out the page kept a teal (Saudi) tint, which the guide allows. | T3-F14-login, T3-F14-dashboard |
| PR-07 #19 | NOT RUN | NOT RUN | HIGH-IMPACT: needs an HQ plan downgrade/upgrade of an organization. Awaiting an explicit owner yes. | - |
| PR-07 #15 | PARTIAL | NOT RUN | Ocean default-density edit not run (theme edit fields are plan-gated). | - |
| PR-07 #16 | NOT RUN | PARTIAL | Public tracking page in Incognito: neutral "We could not find this order" with no brand colour. Customer mobile app not available. | T3-E |
| PR-07 #17 | NOT RUN | BLOCKED | No tenant logo can be saved (upload 400), so no receipt or invoice preview with the tenant brand. | - |
| PR-07 #18 | PARTIAL | PARTIAL | Arabic Branding is still offset; Files shows "Invalid request. Retry"; dialog footers clipped; swatches do not match their codes; /settings/preferences shows "Failed to fetch effective settings". | T1-PR07-18-branding-ar, T1-PR07-18-appearance-ar, T1-PR07-18-edittheme-ar, T1-PR07-18-newtheme-ar |
| HQ H1 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| HQ H2 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| HQ H3 | PARTIAL | PASS | HQ Themes: TEST_SKY (Test Sky / سما, #1E88E5 / #0D47A1, Soft) reactivated about 20:27; it is listed in the tenant Settings > Branding > New theme starting-theme list (CleanMateX, Ocean, Emerald, Teal, Royal, Rose, Sunset, Gold, Slate, Graphite, Test Sky). Deactivated again afterwards (no organization uses it). | H4-HQH3 |
| HQ H4 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| HQ H5 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| HQ H5b | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| HQ H6 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| HQ H7 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| HQ H8 | PARTIAL | PARTIAL | HQ prompt is correct: "...1 organization uses it now. Its pages keep showing it, but it cannot save theme changes until it picks another." Ocean deactivated 20:28:42 and reactivated about 20:29:00 (about 18 s). Tenant after Ctrl+Shift+R still listed Ocean In use; its edit dialog showed no "no longer offered until another is picked" message. Tenant screenshot not captured (screen lag). | H4-HQH8-prompt |
| HQ H9 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| HQ H10 | PASS | PASS | Round 1 PASS stands; not re-run in r2. | - |
| PR-04 K1 | NOT RUN (new) | PASS | "?" outside a field opens the Keyboard shortcuts list (/, F2, F9, Ctrl+Enter / Ctrl+S, Alt+1..Alt+5, ?); Escape closes it. | T7-K1 |
| PR-04 K2 | NOT RUN (new) | PASS | "/" focuses the item search, nothing typed. | T7-K3a |
| PR-04 K3 | NOT RUN (new) | PASS | Typing "/" and "?" in item search and in order notes types them; focus stays, list does not open. | T7-K3a, T7-K3b |
| PR-04 K4 | NOT RUN (new) | PASS | F2 from the page and from inside item search opens Select Customer with focus in its search box. | T7-K4a, T7-K4b |
| PR-04 K5 | NOT RUN (new) | PASS | With customer + Blouse + Ready by 20/11/2026 05:00 PM: F9 and, separately, Ctrl+Enter open the payment view (Pay later pre-applied, Submit blue). Not paid. | T7-K5-F9, T7-K5-ctrlenter |
| PR-04 K6 | NOT RUN (new) | PASS | No customer: toast "Please select a customer before submitting the order." With customer and no items: "Please add at least one item to the order." for F9 and Ctrl+S; no payment view, no browser Save dialog. Toasts stay until closed. | T7-K6-nocust, T7-K6 |
| PR-04 K7 | NOT RUN (new) | NOT RUN | Needs a closed-session fixture (NEW approval). Awaiting owner approval. | - |
| PR-04 K7b | NOT RUN (new) | PASS | Customer + Blouse, Ready by empty: F9 gives toast "Ready by date is required", no payment view. The "must be in the future" variant: Ready-by dialog showed "Date must be in the future" with Apply disabled for a past time. | T7-K7b, T7-K7b-dialog-past |
| PR-04 K8 | NOT RUN (new) | PARTIAL | First half PASS: with the payment view open, F9 and Ctrl+S change nothing and open no second view or Save dialog. Second half (F2, Enter, Ctrl+Enter inside the payment view) NOT RUN: needs Pay approval (HIGH). | T7-K8 |
| PR-04 K9 | NOT RUN (new) | PASS | Customer picker, Line discount dialog and Whole Order preferences dialog: "/", "?" and F9 do nothing behind the dialog (in the picker they type into the search field). | T7-K9-customer, T7-K9-discount, T7-K9-prefs |
| PR-04 K10 | NOT RUN (new) | PASS | Limited: on Order Edit (opened via Edit) F2 and F9 do nothing. Ctrl+Enter and Ctrl+S show "No changes to save", same as the Review button with 0 changes; no Review screen without an edit. | T8-K10-F2F9, T8-K10-review |
| PR-04 K11 | NOT RUN (new) | NOT RUN | Needs an Arabic keyboard layout and real typing on the box (OS limit). | - |
| PR-04 T1 | NOT RUN (new) | NOT RUN | No touch emulation (real input only). Visual: Quick Drop minus/plus are about 16 px with the mouse. | - |
| PR-04 T2 | NOT RUN (new) | FAIL | Quick Drop + and - give no visible change (no count, Pieces and Bags unchanged, no toast), with and without an item in the cart. Accessible names exist in EN and AR. First load had 5 HTTP 504 (categories, service-preferences, packing-preferences, navigation) which may explain it. | T8-T4-submit-disabled-noitems |
| PR-04 T3 | NOT RUN (new) | PASS | Notes "Save" switch: ON shows the notes box, OFF hides it, typed text is kept; knob moves correctly in EN and AR. | T8-T3-on-en, T8-T3-EN-off, T8-T5-AR-summary |
| PR-04 T4 | NOT RUN (new) | PASS | No items: Submit faded and disabled. Customer + Blouse: Submit is solid theme blue with "Ready to submit". Add and Apply buttons are still fixed green (noted). | T8-T4-submit-disabled-noitems, T8-T4-submit-enabled |
| PR-04 T5 | NOT RUN (new) | PASS | Arabic summary panel is RTL: labels right, values left; Pieces, Bags, date 20/11/2026 and time "05:00 م" not jumbled. Toast "Ready by date is required" stays English and does not close. | T8-T5-AR-summary |
| PR-04 P1 | NOT RUN (new) | PASS | Typing "jh": 5 grey skeleton rows (no spinner). A "No customers found / Create New Customer" flash appears just before the skeleton. | T9-P1 |
| PR-04 P2 | NOT RUN (new) | PASS | Arrow Down and Up move the highlight, Enter picks "Jh Test dev21" and closes the dialog. | T9-P2, T9-P2-results |
| PR-04 P3 | NOT RUN (new) | PASS | Escape closes only the dialog (with results and with "No customers found"); focus returns to Select Customer. | T9-P3, T9-P3-noresults |
| PR-04 P4 | NOT RUN (new) | NOT PRESENT | No global or other-organization customer or link prompt appeared for "jh", "am", "te", "glob". | T9-P4 |
| PR-04 P5 | NOT RUN (new) | PASS | Arabic results show "+" in front with digits in order. Extra defect: the Quick Select recent-customer card shows "96896662624+" (plus at the end). | T9-P5 |
| PR-04 L1 | NOT RUN (new) | NOT RUN | Orders is a single page: 12 rows, Total Orders 12, no pager and no rows-per-page box, so Next/page/Previous cannot be used. | L1 |
| PR-04 L2 | NOT RUN (new) | PASS | Arabic Orders table: Order # rightmost, customer name + phone ("+" in front), status, items and total in the same relative order as English mirrored; 7 KPI cards in one row. | T9-L2 |
| PR-05 D1 | NOT RUN (new) | PASS | Arabic: sidebar on the right with a divider on its left; collapse keeps an icon rail on the right. At about 400% zoom the hamburger opens a right-docked drawer (slide direction inferred from the final position). Header title stays English. | T9-D1, D1-desktop, D1-collapsed, D1-mobile-first |
| PR-05 D2 | NOT RUN (new) | PARTIAL | User menu PASS: flush with the trigger, right-aligned, Up/Down work. Row menu NOT PRESENT: Orders and Customers tables have no row menu, only inline links. | T9-D2-usermenu, T9-D2-rowmenu |
| PR-05 D3 | NOT RUN (new) | PASS | Settings tabs in Arabic: ArrowLeft moves to the next tab to the left (Tenant Settings to Branch Settings). Extra: red English toast "Failed to fetch effective settings" and "Loading settings..." stuck. | T9-D3, T9-D3-before |
| PR-05 D4 | NOT RUN (new) | PASS | Orders in EN and AR: title and actions in one row, 7 KPI cards, one framed filter bar, then the table; text columns start-aligned, numbers right. | D4-en, T9-D4-ar |
| PR-05 D5 | NOT RUN (new) | FAIL | Customers frame is right, but "CSV تصدير": no spinner seen, red English toast "Insufficient permissions. Only admins can export customer data." for a super_admin, and no download. Phones show "96896662624+" in Arabic. | T9-D5 |
| PR-05 D6 | NOT RUN (new) | BLOCKED | ERP Lite module is not enabled for Demo Laundry (plan policy message at /dashboard/erp-lite/gl). | T10-D6-en |
| PR-05 D7 | NOT RUN (new) | PASS | Arabic Payments, Receipts and voucher detail: ID and code cells align at the start (right). AR invoice detail not reachable (no AR invoice). Bugs: raw keys orders.detailFull.cardBrand, cardLastFour, paidAmount; CASH, COMPLETED, POSTED etc. untranslated. | T10-D7-payments-ar, T10-D7-receipts-ar, T10-D7-voucher-ar |
| PR-05 D8 | NOT RUN (new) | PARTIAL | Arabic Quick Add: labels, inputs and placeholders right-aligned, email LTR, buttons centred. Phone prefix box reads "968+" (bidi); "Customer Category" untranslated; validation is a native English browser tooltip. | T10-D8-quickadd-ar |
| PR-05 D9 | NOT RUN (new) | PASS | Arabic Quick Add and customer picker: page behind is dimmed but see-through, not solid grey. | T10-D9-modal-dim |
| PR-05 D10 | NOT RUN (new) | PARTIAL | Info banner (Aging), success toast ("Appearance saved"), amber warning banner and dark error toast look right. The settings load error appears as a toast, not a banner. Wrong-password banner not triggered. | T10-D10-info-banner-ar, T10-D10-toast-ar, T11-D10-dark-error |
| PR-05 D11 | NOT RUN (new) | PARTIAL | Order number is a copy-button chip, not a link; the "View" link hover is only a subtle shade change in light and dark. | T10-D11-light, T11-D11-orders-dark |
| PR-05 D12 | NOT RUN (new) | PARTIAL | Dark: order header Processing (amber), Posted (green), IN (blue), OUT (amber) chips readable. Invoice chips NOT RUN (no invoices exist). | T11-D12-vouchers-chips-dark, T11-D12-vouchers-list-dark |
| PR-05 D13 | NOT RUN (new) | PASS | Unit list reads Per Piece / Per Kg / Per Item in EN and لكل قطعة / لكل كيلوغرام / لكل عنصر in AR. Closed without saving. Minor: raw "mdi-" text in the product image preview. | T10-D13-unit-en, T10-D13-unit-ar |
| PR-05 D14 | NOT RUN (new) | PASS | Arabic payment view mirrors English (panel order, quick tender chips 3/5/20/50, Cash Tendered and Change Returned row); amounts stay LTR. Cancelled, not paid. | T11-D14-payment-ar, T11-D14-payment-en |
| PR-05 D15 | NOT RUN (new) | PASS | English row: label left, tick right; العربية row: label right, tick left, on both English and Arabic pages. | T10-D15-en, T10-D15-ar |
| PR-05 D16 | NOT RUN (new) | FAIL | New Order stain toggles: the amber "Damage" toggle has white text and icon on orange in light and dark (Stains red, others also white). Orders KPI "Pending Prep" amber is dark text and OK. Packing queue empty, Customers has no stats cards. | T10-D16-stain-en-light, T10-D16-stain-toggles-ar-light, T11-D16-stain-dark |
| PR-05 D17 | NOT RUN (new) | PARTIAL | Arabic voucher detail, new voucher, Aging and Balances read right to left. Voucher grid toolbar ("Reset filters", "Columns", "Density", "Go to page", "Rows per page") is English; topbar titles English. AR invoice detail NOT RUN. | T11-D17-vouchers-grid-ar, T11-D17-newvoucher-ar, T11-D17-balances-ar |
| PR-05 D18 | - (new row) | NOT RUN | Row added to the guide at 17:56, after the retest plan was built. Related: Arabic desktop sidebar and phone drawer seen in D1. | - |
| PR-07 task 6 M1 | NOT RUN (new) | PASS | Save disabled until a change. Dark + Save: toast "Appearance saved", the page turned dark in about 5 s without a reload; F5 kept dark. | T11-M1-dark-applied, T11-M1-reload |
| PR-07 task 6 M2 | NOT RUN (new) | PARTIAL | Same as this device + Save switched to light at once (device is light). Following a dark device not tested (no DevTools emulation). | T11-M2-restored |
| PR-07 task 6 M3 | NOT RUN (new) | PASS | After sign-out the login page follows the device (light), not the last session (dark). | T11-M3-login-light |
| PR-07 task 6 M4 | NOT RUN (new) | NOT RUN | NEW approval: two people on a shared Demo device. Awaiting owner approval. | - |
| PR-07 task 6 M5 | NOT RUN (new) | PASS | Dark dashboard, sidebar, top bar, user dropdown, dialogs and toasts readable; borders quiet; amber warning alert readable. | T11-M5-dashboard-dropdown, T11-M5-dialog-dark, T11-M5-toast-dark |
| PR-07 task 6 M6 | NOT RUN (new) | PASS | Dark orders list, order details tabs, New Order and the payment view readable; amber buttons have dark text. Green Add buttons are bright with white text (low contrast). | T11-D11-orders-dark, T11-M6-neworder-dark, T11-M6-payment-dark |
| PR-07 task 6 M7 | NOT RUN (new) | FAIL | Dark Reports > Orders: "Orders by Status" bars are black on the dark card, tooltip "Count : 11" is dark text on dark. Dashboard Payment Mix tooltip "Cash : 100.0%" is dark text on dark. Top Services tooltip and the Payments, Revenue and Customers charts are readable. | T11-M7-orders-report, T11-M7-paymentmix-tooltip-BUG, T11-M7-topservices-tooltip, T11-M7-customers-report |
| PR-07 task 6 M8 | NOT RUN (new) | PASS | Dark Customers (+ Quick Add), Catalog list and Edit Product, Users (+ Invite), Roles, Branding, date picker, order Files panel: inputs, selects and pickers dark and readable. ERP Lite pages not reached (module disabled). | T11-M8-customers-dialog, T11-M8-catalog-list, T11-M8-catalog-form, T11-M8-users-invite, T11-M8-roles, T11-M8-branding, T11-M8-datepicker-dark, T11-M8-order-files |
| PR-07 task 6 M9 | NOT RUN (new) | PASS | Signed out with Appearance = Same as device (device light): /login, /register and /forgot-password are light and readable. Dark device not tested. | T11-M9-register-light, T11-M9-forgot-light |
| PR-07 task 6 M10 | NOT RUN (new) | PARTIAL | Cash drawer session print is white paper with dark text. /dashboard/reports/print (no params) spins for more than 20 s. Order receipt, AR statement, POS shift report, variance and tax-document print pages could not be reached (no data; "Issue tax document" creates data). | T11-M10-cashdrawer-print, T11-M10-reports-print-spinner |
| PR-07 task 6 M11 | NOT RUN (new) | PARTIAL | Print preview of order page, cash drawer and label: white paper, dark text, no tints. The printed page has the mobile header with the text "CleanMateX" and no main logo. | T11-M11-orderpage-preview, T11-M11-cashdrawer-preview, T11-M11-label-preview |
| PR-07 task 6 M12 | NOT RUN (new) | BLOCKED | Logo upload is still refused (400), so no dark logo can be uploaded. | - |
| PR-07 task 6 M13 | - (new row) | NOT RUN | Row added to the guide at 17:56, after the retest plan was built; needs a logo upload (blocked, see M12). | - |
| PR-07 task 6 M14 | - (new row) | NOT RUN | Row added to the guide at 17:56, after the retest plan was built; needs a signed-out Dark device. | - |
| PR-07 task 6 M15 | - (new row) | NOT RUN | Row added to the guide at 17:56, after the retest plan was built; needs a rejected piece and a light reject colour. | - |
| PR-07 task 6 M16 | - (new row) | NOT RUN | Row added to the guide at 17:56, after the retest plan was built; not opened since the row was added. | - |
| PR-07 task 6 M17 | - (new row) | NOT RUN | Row added to the guide at 17:56, after the retest plan was built; not specifically run; a dark error toast was readable in M5/D10. | - |
| PR-07 task 6 M18 | - (new row) | NOT RUN | Row added to the guide at 17:56, after the retest plan was built; not checked. | - |

#### Retest r2 — prior findings

Each Round 1 finding is kept as written above; this is its status after the 16:14 deploy.

- **FET-UIDS-Nov19-RtlContentUnderSidebar** — Retest r2 2026-11-19: **FIXED.** In Arabic the content no longer slides under the right sidebar on Customers, Orders, Issues, Vouchers, New Order or Branding (PR-02 #13, PR-05 D1). T1-PR02-13-customers-ar, T9-D1.
- **FET-UIDS-Nov19-PlanFlagsMismatch** — Retest r2 2026-11-19: **STILL BROKEN (root cause found).** Branding colour, corner, font and app-name fields are still disabled on Demo Laundry. HQ shows the tenant is on ENTERPRISE (Active) but custom_branding, white_label, branded_emails, branded_receipts and receipt_branding_enabled are all false with Source "Plan". Blocks PR-07 #4, #5, #8, #15, #17. One-line fix: turn those flags on for the ENTERPRISE plan (or map them to it). H3-flags-demo.
- **FET-UIDS-Nov19-TenantLogoInvalidRequest** — Retest r2 2026-11-19: **STILL BROKEN.** Logos card still shows "The request was not valid." on every visit and the upload returns HTTP 400. Admin, viewer and operator all affected. Blocks PR-07 #9, #17, M12, M13, FU C9. T2-1, T2-2, T12-PR07-11.
- **FET-UIDS-Nov19-ProcessingPermissionDenied** — Retest r2 2026-11-19: **FIXED.** /dashboard/processing loads (about 10 s) with no "permission denied for table sys_order_sources_cd"; order pages open. T4-PR02-12b, T4-PR02-10b.
- **FET-UIDS-Nov19-DialogEscapeFocusTrap** — Retest r2 2026-11-19: **STILL BROKEN.** Quick Add Customer: Escape does not close it and Tab leaves it; the dropdown-in-dialog case needs a second Escape that still does not close the dialog (PR-01 #6, PR-02 #5). T1-PR01-06-tab-en, T1-PR02-05-6-escape-en.
- **FET-UIDS-Nov19-NoRevertToDefaultTheme** — Retest r2 2026-11-19: **STILL BROKEN.** No control to go back to the CleanMateX theme; the in-use theme has no Delete. T3-A.
- **FET-UIDS-Nov19-OrdersListNoStatusBadge** — Retest r2 2026-11-19: **STILL BROKEN.** Orders list status and prep status are still plain text; the pill appears only on the order header (PR-02 #1). T1-PR02-01.
- **FET-UIDS-Nov19-ArabicTableFooterEnglish** — Retest r2 2026-11-19: **STILL BROKEN.** Arabic Vouchers footer still English ("Rows per page", "Go to page", "Page 1 of 1") with mirrored "of 20 20-1"; Customers pager Previous/Next English (PR-02 #14). T1-PR02-14-vouchers-footer-ar.
- **FET-UIDS-Nov19-VouchersPagerMismatch** — Retest r2 2026-11-19: **STILL BROKEN.** Header "Total 43", footer "1-20 of 20" and "Page 1 of 3"; page-size picker offers only 20 (PR-01 #4). T1-PR01-04-vouchers.
- **FET-UIDS-Nov19-ViewerThemesListFails** — Retest r2 2026-11-19: **STILL BROKEN.** Viewer and also operator see "Could not load the themes." and the logo error on Branding (PR-07 #11). T12-PR07-11.
- **FET-UIDS-Nov19-DensityNotVisible** — Retest r2 2026-11-19: **NOT RE-VERIFIED.** Compact + Large save, show on the Incognito sign-in page and restore, but a visibly denser row pitch was not measured (PR-07 #12). T3-B, T3-C.
- **FET-UIDS-Nov19-ProductsDeepLink500** — Retest r2 2026-11-19: **NOT RE-CHECKED.** The signed-out HQ deep link was not opened in r2.
- **FET-UIDS-Nov19-HqSaveSlow** — Retest r2 2026-11-19: **NOT RE-MEASURED.** HQ screens were slow to repaint again (screen capture lagged during the Ocean check); not timed.
- **FET-UIDS-Nov19-ArabicDialogXAndLabels** — Retest r2 2026-11-19: **PARTLY FIXED.** Dialog X is now top-left (PR-02 #17). Customer Category label, the "Stub" option and the New Theme dialog footer are still English or clipped. T1-PR02-17-dialog-ar.
- **FET-UIDS-Nov19-ArabicSearchIconSide** — Retest r2 2026-11-19: **PARTLY FIXED.** Customers search icon is now on the right (start). The Vouchers search icon is missing. T1-PR02-13-customers-ar, T1-PR02-13-vouchers-ar.
- **FET-UIDS-Nov19-LangSwitchMixedState** — Retest r2 2026-11-19: **NOT RE-CHECKED.** Language switch took about 8 s to translate; after Arabic to English the stepper shows reversed parentheses (see FET-UIDS-Nov19-StepperParensReversed).
- **FET-UIDS-Nov19-PrintChrome** — Retest r2 2026-11-19: **STILL BROKEN.** Order page print preview is white with dark text, but still prints the app mobile header (hamburger and the text "CleanMateX", no main logo). T11-M11-orderpage-preview.
- **FET-UIDS-Nov19-ArabicLeftovers** — Retest r2 2026-11-19: **STILL BROKEN.** Arabic phone numbers still show the plus at the end ("96896662624+") on Customers, Processing details and the Quick Select card; statuses and dates English. T9-D5, T9-P5.
- **FET-UIDS-Nov19-HqDefaultRefusalAsToast** — Retest r2 2026-11-19: **NOT RE-CHECKED.** Not repeated in r2.
- **FET-UIDS-Nov19-MobileSidebarUnderHeader** — Retest r2 2026-11-19: **NOT RE-CHECKED.** Only the Arabic drawer at about 400% zoom was seen (T9-D1); the English phone-width case was not repeated.
- **FET-UIDS-Nov19-OrderFilesTabMissingInFullView** — Retest r2 2026-11-19: **NOT RE-CHECKED.** Not repeated in r2.

#### Retest r2 — new findings (Financial_Expert_Tester, 2026-11-19)

Code locations were not inspected (remote-only run); fixes are the likely place to look.

- **P2 FET-UIDS-Nov19-DarkChartsUnreadable** — Dark mode: Reports > Orders "Orders by Status" bars are black on the dark card and the tooltip "Count : 11" is dark text on dark; the dashboard Payment Mix tooltip "Cash : 100.0%" is dark on dark (M7). Evidence: T11-M7-orders-report, T11-M7-paymentmix-tooltip-BUG. Fix: give chart bar fills and tooltip text the theme tokens instead of fixed dark values.
- **P2 FET-UIDS-Nov19-AmberToggleWhiteText** — New Order stain toggle "Damage" (amber) has white text and icon in light and dark; Stains (red) and others also white (D16). Evidence: T10-D16-stain-en-light, T11-D16-stain-dark. Fix: use the dark-on-amber foreground token for the amber toggles.
- **P2 FET-UIDS-Nov19-QuickDropNoChange** — Quick Drop + and - show no visible change (no count, Pieces and Bags unchanged, no toast), with an empty cart and with an item (PR-04 T2). Accessible names exist in EN and AR. Likely linked to the first-load 504s. Evidence: T8-T4-submit-disabled-noitems. Fix: show the count and on/off state and report any failed call.
- **P2 FET-UIDS-Nov19-Api504OnFirstLoad** — POS first load returned HTTP 504 on /api/v1/categories, service-preferences, packing-preferences and /api/navigation (5 calls); categories and products took about 30 s to appear after Ctrl+Shift+R. Fix: look at the cold-start or timeout cause on those routes and show a retry state.
- **P2 FET-UIDS-Nov19-CustomerExportDenied** — Customers "CSV تصدير" as a super_admin shows the red English toast "Insufficient permissions. Only admins can export customer data." and no download; no spinner (PR-05 D5). Evidence: T9-D5. Fix: align the export permission check with super_admin and translate the message.
- **P2 FET-UIDS-Nov19-ArabicRawTranslationKeys** — Arabic order details show raw keys orders.detailFull.cardBrand, orders.detailFull.cardLastFour and orders.detailFull.paidAmount; CASH, COMPLETED, POSTED, RECEIPT_VOUCHER, IN/OUT stay untranslated; tax shows "0" then OMR 0.088 (PR-05 D7). Evidence: T10-D7-payments-ar, T10-D7-receipts-ar. Fix: add the missing keys and map status codes to labels.
- **P2 FET-UIDS-Nov19-ProcessingCustomerMismatch** — Order ORD-20261119-00004: Processing details shows customer "Test Customer2 Mohammed Ahmed" while All Orders lists "Jh Test dev21". Two pages disagree on the customer of one order (data or lookup bug). Evidence: T4-PR02-10b. Fix: check which customer id each page reads.
- **P2 FET-UIDS-Nov19-EffectiveSettingsFetchFails** — Settings screens show the red English toast "Failed to fetch effective settings" (Settings tabs, /settings/preferences, Branch settings ~15 s) and a table stuck on "Loading settings..." (D3, D10, PR-07 #18). Evidence: T9-D3, T10-D10-toast-ar. Fix: find the failing effective-settings call and show a banner with Retry.
- **P2 FET-UIDS-Nov19-ReportsPrintSpinner** — /dashboard/reports/print (no parameters) spins for more than 20 s with no report and no message (M10). Evidence: T11-M10-reports-print-spinner. Fix: show "choose a report" or an error when parameters are missing.
- **P2 FET-UIDS-Nov19-SlowPages** — Slow screens in r2: sign-in over 10 s, Orders in Arabic 13.8 s, Issues 22.7 s, Branch settings about 15 s, Customer Balances 15-18 s, Processing about 10 s, POS about 30 s after a hard reload. Several have no skeleton. Observation only, no lab.
- **P2 FET-UIDS-Nov19-InputLagDropsKeys** — Typing lags 1-3 s and drops or reorders characters (sign-in email typed into the wrong field, first character lost in the customer picker and HQ forms, Ctrl+A does not select in fields). Slows every form test and would frustrate counter staff.
- **P2 FET-UIDS-Nov19-HqOceanDeactivateTenantNotice** — HQ deactivating Ocean warns that one organization uses it, but the tenant (after Ctrl+Shift+R) still lists Ocean In use and its edit dialog shows no "no longer offered until another is picked" message (HQ H8). Evidence: H4-HQH8-prompt. Fix: show the notice in the tenant theme editor when its theme is inactive.
- **P3 FET-UIDS-Nov19-StickyEnglishToasts** — Toasts never close on their own (a "select a customer" toast stayed over 60 s) and stay in English in Arabic ("Ready by date is required", "Failed to fetch effective settings"). Evidence: T7-K6, T8-T5-AR-summary.
- **P3 FET-UIDS-Nov19-StepperParensReversed** — New Order step tabs show "Order Items) 1(" and "Edit Items Preferences )1(" in English too (bidi residue after switching language).
- **P3 FET-UIDS-Nov19-ArabicBackArrowWrong** — Arabic Processing details: the back link "العودة إلى المعالجة" has its chevron pointing left on the start side, and "التفاصيل" uses a right arrow (PR-02 #10). Evidence: T4-PR02-10b. Fix: flip the arrow icons in RTL.
- **P3 FET-UIDS-Nov19-ArabicTopbarTitlesEnglish** — Top bar titles stay English in Arabic (New Order, Processing Details, Business Vouchers, AR Aging, Catalog Service Details, Customers); Settings tab labels also English (D3). Evidence: T9-D1, T10-D7-voucher-ar.
- **P3 FET-UIDS-Nov19-PrintHeaderNoLogo** — Print previews (order page, cash drawer, label) carry the mobile header with the text "CleanMateX" and no main logo (M11). Evidence: T11-M11-orderpage-preview. Fix: render the tenant logo in the print header.
- **P3 FET-UIDS-Nov19-ReadyByDateFieldStale** — Ready-by dialog: the typed date field stays "11/19/2026" while the calendar shows 20 until Apply; the default (today 5:00 PM) is already past in the evening, so the dialog opens with an error. Evidence: T7-K7b-dialog-past.
- **P3 FET-UIDS-Nov19-PickerEmptyFlash** — Customer picker flashes "No customers found / Create New Customer" for a moment before the skeleton rows (PR-04 P1). Evidence: T9-P1.
- **P3 FET-UIDS-Nov19-GreenAddButtonsFixed** — Add buttons and the Ready-by Apply button on New Order are still fixed bright green with white text (low contrast) and do not follow the theme (PR-04 T4, M6). Evidence: T8-T4-submit-enabled, T11-M6-neworder-dark.
- **P3 FET-UIDS-Nov19-ErpLiteOffForDemo** — ERP Lite is not enabled for Demo Laundry, so ERP Lite pages (PR-05 D6, M8) cannot be QA-checked. Fix: enable the module for the Demo tenant. Evidence: T10-D6-en.
- **P3 FET-UIDS-Nov19-ProductImagePreviewRawText** — Catalog product form: the image preview shows raw "mdi-" text. Evidence: T11-M8-catalog-form.

#### Retest r2 — recount, leftovers, caveats

**Recount r2 (UI Design System, 116 rows of Round 1/the 2026-11-19 pull):** PASS 56 / FAIL 14 / PARTIAL 26 / BLOCKED 7 / NOT RUN 11 / NOT PRESENT 2 (total 116).

**Including the 7 rows the owner added after the pull (123 rows now):** PASS 56 / FAIL 14 / PARTIAL 26 / BLOCKED 7 / NOT RUN 18 / NOT PRESENT 2 (total 123).

**By section (PASS / FAIL / PARTIAL / BLOCKED / NOT RUN / NOT PRESENT, incl. new rows):** PR-01: 4/3/3/0/2/0; PR-02: 4/4/9/1/2/1; PR-07 tasks 1–11: 7/3/3/4/2/0; PR-07 HQ: 10/0/1/0/0/0; PR-04: 17/1/1/0/4/1; PR-05: 8/2/6/1/1/0; PR-07 task 6: 6/1/3/1/7/0.

**Round 1 for comparison:** PASS 19 / FAIL 6 / PARTIAL 19 / BLOCKED 3 / NOT RUN 16 (63 rows); the 53 rows the owner added between Round 1 and the deploy started as NOT RUN.

**Caveats:** one browser run at a time; several runs were interrupted and were recovered from run notes and screenshots (T3 at the QA-Alt delete, T4, H1). Input lag dropped characters, so fields were re-checked before saving. No camera, no touch emulation, no DevTools, no Arabic keyboard layout on the box. A dark device setting was not tested. Rows marked "awaiting owner approval" are writes that were not on the morning approval list; the owner-approved items (HQ H8 Ocean deactivate and re-activate for about 18 s, E7 read-only re-check) were run.

**Test data left behind (r2):**
- Demo Laundry: theme Ocean is still IN USE, with no UI way back to CleanMateX. A QA-Alt theme was created from Ocean and deleted again at 17:26. Admin Appearance was changed (Compact + Large, then Dark) and restored to the originals: Same as this device / Same as the Organization / Medium; confirmed after a hard reload. Viewer, operator and admin sessions were signed out and back in; the only failed sign-in was one HQ attempt (typo from input lag, second attempt worked), so no account was near lockout.
- HQ: OCEAN was deactivated at 20:28:42 and reactivated at about 20:29:00 (Active now). TEST_SKY was reactivated at about 20:27 for the New theme list check and deactivated again (Inactive, not default).
- Orders: nothing was paid or submitted and no status was changed; carts were emptied and customers cleared. ORD-20261119-00005 (Jh Test dev21, Processing, 2 pieces, OMR 4.708, created 07:39, partly paid) is not from this tester.

### Retest r3 (2026-11-19 20:56–22:30 Asia/Muscat) — UI Design System

**Retest r3 (2026-11-19 20:56–22:30 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: on 2026-11-19 at 20:47 the owner answered "Yes for all those" to the writes and high-impact items held back in Retest r2 (order-flow writes, F21, F22, F23, F29, H2, H6, F10, K8, B3, PR-07 #19) and the rows the owner added since. Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch; admin and operator) and HQ https://hqsaas.cleanmatex.com (Incognito). Real mouse and keyboard, no direct API calls, no page scripts, no Jest. Credentials: see the credentials file, none recorded here. Screenshots: `C:\Users\JHNLP\qa-20261119\retest3\shots\` (file names in the Shot column, all `.webp`). Notes: Round 1 and Retest r2 text above is untouched. The last cmx sign-in attempt ended at 22:35 (the 22:30 end of the window is the label given for this round). Only rows with r3 evidence are listed; every other row keeps its r2 status.

**Guide changes found while writing back.** The guide was edited again by the owner or a developer at 21:05:07 (86,317 B after my r2 write at 20:38:41; 87,625 B now, +1,308 B). The change is above my sections, in the PR-07 task 6 table: four new rows M19, M20, M21 and M22. They are listed below as NOT RUN. My Round 1 and Retest r2 sections are byte-identical (the r2 section at the end still hashes to 0502BBC9…). There are no Dev notes. This section is appended after the existing text.

#### Retest r3 results

Columns: r2 = Retest r2 result, r3 = this retest. Only rows touched in r3 are listed; all other rows keep their r2 result.

| Row | r2 | r3 | Evidence | Shot |
|---|---|---|---|---|
| PR-02 #10 | FAIL | FAIL | r3 sub-results: "Mark Order Ready" shows "Processing…" (greyed with a spinner) and then the toast "Order transitioned successfully": PASS. B2B screens (Customers, Contracts, Statements and the customer detail) match the rest of the app (white cards, blue primary and outline secondary buttons; Arabic flips RTL with breadcrumb reversed and sidebar on the right): PASS. The back arrow is not testable: B2B pages have no back-arrow button, only the breadcrumb "B2B / B2B Customers / B2B_Company_Customer1". The row stays FAIL because the Assembly queue still shows 0 (Pending 0, In Progress 0, QA Pending 0, "No orders in assembly") while Processing shows 12 orders. | O-5.webp, O-6.webp |
| PR-04 K7 | NOT RUN | BLOCKED | The operator's POS session was open (header chip "Session Hub Open" on /dashboard/orders/new), so the closed-session case could not be seen. The session was not closed and F9 was not pressed; the operator signed out. | O-1.webp |
| PR-04 K8 | PARTIAL | PARTIAL | Half 1 PASS: on the payment view F9 and Ctrl+S do nothing and open no Save dialog. Half 2 PARTIAL: with Cash chosen, F2 and Enter open the "Confirm & Submit" dialog; one click on it created exactly one order (ORD-20261119-00006). Ctrl+Enter was not tested. | O-1.webp |
| PR-05 D18 | NOT RUN | PARTIAL | Desktop 1280 px EN: sidebar on the left; "Collapse sidebar" folds it to an icon rail. AR: sidebar on the right; collapse and icon rail work on the right. Phone width (about 512 px, AR): sidebar hidden, only "CleanMateX" and a hamburger at top-right; the hamburger opens the drawer from the right (the start side in RTL) with an X that replaces the hamburger. PASS for those. Not checked: the payment-view receipt rail, and the English phone width. Note: the collapse state persisted across the language switch. | 0-D18-en-expanded.webp, 1-D18-en-collapsed.webp, 2-D18-ar-expanded.webp, 3-D18-ar-collapsed.webp, 4-D18-ar-mobile-drawer.webp, 5-D18-ar-mobile-closed.webp |
| PR-07 #19 | NOT RUN | NOT RUN | HIGH-IMPACT HQ plan change: the owner has not named the organization and plan, so it was not run. | - |
| PR-07 task 6 M4 | NOT RUN | PARTIAL | Not a clean test: both the admin and the operator appearance were on "Same as this device" (not Dark and Light), and the device rendered Light. The operator was set to "Light" at 21:59 ("Appearance saved") and restored to "Same as this device" at 22:03. After signing the admin back in, the dashboard rendered Light as expected for that setting; the Dark case was not observed. | J-4.webp, J-5.webp |
| PR-07 task 6 M13 | NOT RUN | NOT RUN | Not run: needs a logo upload (still blocked, see M12) and cmx was unreachable after 22:09 (Cloudflare 524; admin sign-in failed twice). | 8-signin-fail2.webp |
| PR-07 task 6 M14 | NOT RUN | PARTIAL | Dark (Chrome Mode set to Dark in a separate window, restored to Device afterwards): the sign-in card is dark and readable, but the logo sits in a white square tile and the mascot illustration has a white background (white glare), and the EN / عربي pill is top-right, not top-start. The submit button read "Signing in…" (greyed) on load. Light: white card with grey borders on the inputs and card, readable text, button "Sign in". (FET-UIDS-Nov19-SignInDarkWhiteTiles) | 6-M14-login-dark.webp, 7-M14-login-light.webp |
| PR-07 task 6 M15 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09 and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`; stopped per the 2-attempt rule. | 8-signin-fail2.webp |
| PR-07 task 6 M16 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09 and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`; stopped per the 2-attempt rule. | 8-signin-fail2.webp |
| PR-07 task 6 M17 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09 and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`; stopped per the 2-attempt rule. | 8-signin-fail2.webp |
| PR-07 task 6 M18 | NOT RUN | NOT RUN | Not run: cmx returned Cloudflare 524 timeouts from 22:09 and admin sign-in failed twice with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`; stopped per the 2-attempt rule. | 8-signin-fail2.webp |
| PR-07 task 6 M19 | - (new row) | NOT RUN | Row added by the owner at 21:05, after the r2 write-back; not run in r3 (cmx unreachable after 22:09). | - |
| PR-07 task 6 M20 | - (new row) | NOT RUN | Row added by the owner at 21:05, after the r2 write-back; not run in r3 (cmx unreachable after 22:09). | - |
| PR-07 task 6 M21 | - (new row) | NOT RUN | Row added by the owner at 21:05, after the r2 write-back; not run in r3 (cmx unreachable after 22:09). | - |
| PR-07 task 6 M22 | - (new row) | NOT RUN | Row added by the owner at 21:05, after the r2 write-back; not run in r3 (cmx unreachable after 22:09). | - |

#### Retest r3 — prior findings

- **FET-UIDS-Nov19-ArabicBackArrowWrong** — Retest r3 2026-11-19: **NOT RE-VERIFIED.** B2B pages have no back-arrow button; only the breadcrumb flips correctly in Arabic (PR-02 #10).
- **FET-UIDS-Nov19-TenantLogoInvalidRequest** — Retest r3 2026-11-19: **NOT RE-CHECKED.** No logo upload was tried; M13 is NOT RUN.
- **FET-UIDS-Nov19-ArabicLeftovers** — Retest r3 2026-11-19: **STILL SEEN.** In Arabic some dashboard strings stay English (D18 pass, 4-D18-ar-expanded).

#### Retest r3 — new findings (Financial_Expert_Tester, 2026-11-19)

- **P3 FET-UIDS-Nov19-SignInDarkWhiteTiles** — In Dark the sign-in logo sits in a white square tile and the mascot illustration has a white background (white glare); the EN / عربي pill is top-right instead of top-start; the submit button read "Signing in…" (greyed) while idle on load (M14). Evidence: 6-M14-login-dark, 7-M14-login-light. Fix: use the dark logo and a transparent mascot in Dark.
- **P1 FET-FU-Nov19-Cmx524SignInHtml** — (Same finding as in the File Util guide.) From 22:09 cmx hung with Cloudflare 524 for about 9 minutes and two admin sign-ins ended in `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`; M13 and M15 to M18 could not be run. Evidence: 8-signin-fail2.
- **P3 FET-UIDS-Nov19-PosSessionCheckFirstLoad** — The first load of New Order showed "POS session could not be checked / Refresh the Session Hub, then start or resume an open POS session before creating an order." (PR-04). After a hard refresh it behaved normally.

#### Retest r3 — recount, leftovers, caveats

**Recount r3 (UI Design System, 127 rows now, including the 4 rows the owner added at 21:05; r3 status changes applied on top of the r2 counts):** PASS 56 / FAIL 14 / PARTIAL 29 / BLOCKED 8 / NOT RUN 18 / NOT PRESENT 2 (total 127).

**Changes from r2 (123 rows: PASS 56 / FAIL 14 / PARTIAL 26 / BLOCKED 7 / NOT RUN 18 / NOT PRESENT 2):** NOT RUN to PARTIAL: PR-05 D18, PR-07 task 6 M4, M14 (3 rows); NOT RUN to BLOCKED: PR-04 K7 (1 row); 4 new rows M19 to M22 added as NOT RUN. Unchanged: PR-02 #10 stays FAIL, PR-04 K8 stays PARTIAL, PR-07 #19 and M13, M15 to M18 stay NOT RUN. The r2 by-section table was not re-tallied.

**Caveats:** one browser run at a time; site input lag dropped characters. The device was Light throughout, so no dark device setting was available except Chrome's own appearance mode, which I set to Dark for M14 and restored to Device. The D18 phone case used browser zoom 250% (about 512 px wide), not a real phone. cmx stopped answering from 22:09 (Cloudflare 524), so M13 and M15 to M18 were not run.

**Test data left behind (r3):**
- Demo Laundry: QA order ORD-20261119-00006 (Jh Test dev21, 1.070 OMR paid in cash) is READY on rack QA-A1 with 2 QA files; it was not handed over. Operator Appearance was changed to Light and restored to "Same as this device" (confirmed by the "Appearance saved" toast). Admin Appearance was not changed.
- Chrome appearance mode (M14) was restored to Device.
- HQ: file-util settings and the purge job were changed and restored in the File Util part of this round (see the File Util guide); nothing in the UI Design System HQ catalogs was changed.
- Sign-ins: admin had 2 failed attempts at 22:25 to 22:35 (HTML 524 response) and is not signed in; the operator signed in OK.

## Design system rules (2026-11-19)

| # | Where | What to do | Expected |
|---|---|---|---|
| R1 | Terminal in `web-admin` | Run `npm run check:ui` | It lists the changed files and ends with "N files checked: 0 errors" for this work (warnings are allowed) |
| R2 | Terminal in `web-admin` | Put `<button>x</button>` in any feature screen, run `npm run check:ui`, then remove it | It reports `UI001 error` on that line and exits with an error. After the removal it is clean again |
| R3 | Claude Code chat | Type `/cmx-ui-design-review src/features/catalog/ui/product-form.tsx` | A report with Tools / Critical / Important / Minor / Debt seen / Not checked / Verdict, each finding with file:line and a fix. No file is changed |
| R4 | Cursor chat | Run `/cmx-ui-design-review` on the same file | The same kind of report (it loads `.cursor/skills/cmx-ui-design-review/SKILL.md`) |
| R5 | Codex and Antigravity | Ask "review product-form.tsx with the cmx-ui-design-review skill" | The skill is found and the same kind of report comes back |
| R6 | Cursor | Open any SQL migration | The old "Grandfathered Objects" rule is no longer listed among the applied rules |
| R7 | Settings → Label printing (or Catalog → edit a product) | Do the QA row M22 | As in M22 |

## PR-08 — Feature Convergence, Modal Hygiene, Extra Config & GCC Digits (2026-11-20)

**Setup:** migrations `0775` and `0776` applied; `cd web-admin && npm run dev`. Test in EN and AR RTL, Light and Dark mode.

| # | Where | Do | Expected |
|---|---|---|---|
| P1 | Switch interface to Arabic (`ar`) on Dashboard, Orders, B2B, Invoices | Check currency amounts, KPI counts, pagination, and dates | Western `123` digits render by default (`12.500 OMR`, not `١٢.٥٠٠`) alongside Arabic labels and months; `<bdi dir="ltr">` keeps `+968` phone numbers, `ORD-*` codes, and emails un-flipped |
| P2 | Settings → **Display & Formatting** (`/dashboard/settings/extra-config`) | Open page as admin (`settings:read` + `settings:update`) | Grouped sections load with **Live GCC Formatting Preview**, System Default/Custom Override badges, radio cards (2–3 options), dropdown lists (`CmxSelectDropdown`, 4+ options), and switches (`CmxSwitch`); no free-typing needed for list fields |
| P3 | Extra Config → Currency & Number Digits | Switch from `LATN` (`123`) to `ARAB` (`١٢٣`) → Save | Live preview updates immediately before save; after Save toast (`cmxMessage.success`), page refreshes and Arabic monetary figures render Eastern digits |
| P4 | Same setting → Click **Reset to default** (or **Reset all to defaults**) | Confirm reset | Override is removed, `System Default` badge returns, and Arabic digits revert cleanly to `123` (`LATN`) |
| P5 | Extra Config → Organization Table Density | Switch `INHERIT` → `COMPACT` → Save; open Orders or GL Inquiry table | `html[data-density="COMPACT"]` activates and `--cmx-row-h`/`--cmx-cell-px` visibly tighten row height & cell padding in `CmxDataTable` / `CmxDataGrid` |
| P6 | Extra Config → Default Table Rows Per Page | Change `10` → `20` → Save; open a `CmxDataTable` screen without explicit override | Table defaults to `20` rows/page; Reset returns to `10` (`CMX_DEFAULT_PAGE_SIZE`) |
| P7 | Extra Config → POS Counter Touch Target Mode | Set `ALWAYS_TOUCH_44` → Save; open `/dashboard/orders/new` on desktop | Quick Drop `-`/`+` and pagination steppers expand to `44px` minimum even with mouse pointer |
| P8 | Feature modals (Permissions, Roles, Assembly Task, Ready Date, Customer Create/Edit, User Modal, Subscription, Bottom Sheet) | Open, Tab cycle, press Escape, switch Light/Dark & EN/AR | Focus stays trapped inside dialog; Escape closes modal and restores focus to opener; close `X` sits on top-end without overlapping title; body scroll stays locked while open |
| P9 | User without `settings:update` opens `/dashboard/settings/extra-config` | Inspect controls | Read-only notice displayed; dropdowns/switches disabled and Save/Reset actions hidden |
| P10 | HQ Console (`/products-items-config/extra-config`) → Edit `NUMBER_SCRIPT` or add an option in the Option List Builder → Save | Open Organization `/dashboard/settings/extra-config` on next request | HQ catalog row updates immediately, org override count badge + usage modal list active overriding organizations, Deactivate confirms with active org count, and the tenant settings dropdown shows the new HQ option without redeploy |

### Retest r4 (2026-11-20 00:52–01:12 Asia/Muscat) — UI Design System

**Retest r4 (2026-11-20 00:52–01:12 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: at 00:51 the owner said "try now" after the cmx outage that stopped Retest r3 (Cloudflare 524 from 22:09). This round runs the rows Retest r3 could not reach. Environment: remote only, https://cmx.cleanmatex.com (Demo Laundry, Main Branch, admin). Signed in on the first attempt; no 524 errors. Real mouse and keyboard, no direct API calls, no page scripts, no Jest. Credentials: none recorded here. Screenshots: `C:\Users\JHNLP\qa-20261119\retest4\shots\` (`.webp`). Writes in this round: one photo (qa_photo2.jpg, note "QA r4 note") added to QA order ORD-20261119-00006; Appearance set to Dark and Light and restored to its original "Same as this device" / "Same as the Organization" / "Medium"; a New Order cart opened to the payment view and cancelled without paying (no order created). Branding, settings and other orders were not changed. Earlier rounds above are untouched.

**Guide changes found while writing back.** The guide was edited by the owner or a developer after my Retest r3 write (97,655 B, SHA EF983BBC…, 22:40:13). Re-pulled at 01:15 it is 101,663 B (SHA ECEE6377…): two new sections were appended after my Retest r3 section, "Design system rules (2026-11-19)" (rows R1–R7) and "PR-08 — Feature Convergence, Modal Hygiene, Extra Config & GCC Digits (2026-11-20)" (rows P1–P9). They were not run in r4 and are listed as NOT RUN at the end of this section (R1–R6 are local terminal or editor checks, outside the remote-only scope). My Round 1, r2 and r3 sections are byte-identical. There are no Dev notes. This section is appended after the existing text.

#### Retest r4 results

Columns: r3 = Retest r3 result, r4 = this retest. Only rows touched in r4 are listed.

| Row | r3 | r4 | Evidence | Shot |
|---|---|---|---|---|
| D18 | PARTIAL | PASS | Payment-rail half now run. Wide window, New Order with a test customer and Fitness Leggings (1.000 OMR); Submit stayed disabled until a Ready By date was set, then F9 opened the payment view. A "Receipt" rail sits beside the form: Gross Value, Taxes (VAT 5.00% 0.050, Municipal Fee 2% 0.020), Order Total OMR 1.070, Remaining Balance OMR 1.070. Cancelled without paying, cart cleared, no order created. With the r3 sidebar checks, the row passes. | R4-D18-1.webp |
| PR-07 task 6 M13 | NOT RUN | NOT RUN | Not run: needs the main logo removed in Branding (a branding change). Read-only look at Settings → Branding: active theme "Ocean – In use"; the Logos area shows "The request was not valid." with Retry (retried once, same), so it is not visible whether a main or dark logo is set (FET-UIDS-Nov20-BrandingLogosInvalidRequest). | - |
| PR-07 task 6 M15 | NOT RUN | BLOCKED | No rejected piece exists: 11 orders in Processing, 6 details and the pieces of ORD-20261119-00003 opened, no "Rejected" badge. Not created, to avoid changing real orders. | - |
| PR-07 task 6 M16 | NOT RUN | BLOCKED | Settings → User Preferences shows "Error Loading Preferences – Failed to fetch effective settings" in English and Arabic; the console shows HTTP 500 on `/api/settings/tenants/me/effective?userId=me`, repeated over about 15 minutes. The Appearance card and "Open Appearance" could not be checked (FET-UIDS-Nov20-EffectiveSettings500). | - |
| PR-07 task 6 M17 | NOT RUN | PASS | Account → Appearance. Dark save: dark-green toast with light-green "Appearance saved", readable. Light save: light-green toast with dark-green text, readable. Minor: for about a second after saving Light the toast kept the dark style, because the page switches theme after the toast appears (P3 FET-UIDS-Nov20-ToastThemeLag). "Same as this device" case not separately observed. Restored afterwards. | - |
| PR-07 task 6 M18 | NOT RUN | PASS | Arabic tab title "المظهر — CleanMateX" (h1 "المظهر", page RTL), same suffix pattern as English "Appearance — CleanMateX". | - |
| PR-07 task 6 M19 | NOT RUN | FAIL | Signed out while Appearance was Dark: the sign-in page rendered fully Light with the main navy/green "CleanMateX" logo on a light card, not the dark logo. The sign-in page does not follow the saved Dark preference (FET-UIDS-Nov20-SignInIgnoresDarkPref). Whether a dark logo is set is unknown (Logos list fails, see M13). | R4-M19-1-signin-after-dark-signout.webp |
| PR-07 task 6 M20 | NOT RUN | NOT RUN | Not run: needs two tabs pressing "Make active" on a theme at the same moment (a live branding change). Owner approval and a QA theme needed. | - |
| PR-07 task 6 M21 | NOT RUN | PARTIAL | The dashboard has no sales chart legend; charts are Payment Mix (pie) and Top Services (bar, no legend). Payment Mix legend Dark: green swatch with white "Cash" "100.0%", readable; Light: dark text, readable. The "View detailed report" link goes to `/reports/services`, which returns 404 (P3 FET-UIDS-Nov20-ServicesReport404). | R4-M21-1-dark.webp, R4-M21-2-light.webp |
| PR-07 task 6 M22 | NOT RUN | PASS | Settings → Labels & Tags (nothing saved). Dark: the bottom bar "Discard changes" / "Save" is dark, not a white strip. Light: near-white as before. Section cards "Order label" and "Piece tag" show a faint blue wash at the top in both themes. | R4-M22-1-dark.webp, R4-M22-2-light.webp |

**New findings in r4**

- **P2 FET-UIDS-Nov20-EffectiveSettings500** — `/api/settings/tenants/me/effective?userId=me` returns HTTP 500, so Settings → User Preferences shows "Error Loading Preferences" (M16).
- **P3 FET-UIDS-Nov20-SignInIgnoresDarkPref** — The sign-in page renders Light after signing out with Appearance Dark, so the dark logo is never shown (M19).
- **P3 FET-UIDS-Nov20-BrandingLogosInvalidRequest** — Settings → Branding Logos shows "The request was not valid." (M13).
- **P3 FET-UIDS-Nov20-ServicesReport404** — Dashboard "View detailed report" opens `/reports/services`, a 404 (M21).
- **P3 FET-UIDS-Nov20-ToastThemeLag** — After saving Light, the toast keeps the dark style for about a second (M17).

**r4 tally for the rows above:** PASS 4 (D18, M17, M18, M22) · FAIL 1 (M19) · PARTIAL 1 (M21) · BLOCKED 2 (M15, M16) · NOT RUN 2 (M13, M20).

**New rows added since r3, not run in r4:** Design system rules R1–R7 (R1–R6 are local terminal, Claude Code, Cursor, Codex checks, outside the remote-only scope; R7 is the same as M22, PASS above) and PR-08 P1–P9 (need migrations 0775/0776 on cmx and Extra Config writes; to run in a later round).

## Financial_Expert_Tester Results — Retest r5 2026-11-20 (post-deploy observe pass)

**Retest r5 (2026-11-20 21:55–22:31 Asia/Muscat).** Tester: Financial_Expert_Tester (Grok Bot). Trigger: owner t160u — new evening deploy; redo all QA files, not only UIDS and File_Util. This round is an **observe-only** post-deploy pass: owner approval for writes is still pending, so write-gated rows are **NOT RUN (awaiting approval)**. Nothing was saved, applied, paid, published, assigned, or confirmed. Appearance (temporarily set to Dark for M19, then restored) and language (Arabic used for locale checks, then restored to English) were put back. Earlier rounds above are untouched.

Environment: remote only. Tenant https://cmx.cleanmatex.com (Demo Laundry, Main Branch) and HQ https://hqsaas.cleanmatex.com (Incognito). Accounts used: Demo Laundry admin `admin@demo-laundry.example`, operator `operator@demo-laundry.example` (`U000001`), viewer `viewer@demo-laundry.example`; HQ SAAS Admin `admin@cleanmatex.com`. Credentials: see `F:\JhApps_doc\CleanMateX_Jh\Testing_Jh\GrokBot_HQ_Test\CREDENTIALS_AND_ENVIRONMENTS.md` — none recorded here. Real mouse and keyboard; no direct API calls; no page scripts that change data; no Jest. Hard-reload (Ctrl+Shift+R) after the deploy. Screenshots: `C:\Users\JHNLP\qa-20261120\r5\shots\`.

UIDS rows below were run on cmx (21:55–22:03 and 22:27–22:30 Asia/Muscat) and HQ (P10, 22:14–22:18 Asia/Muscat). Only rows touched in r5 are listed; parent scenario counts are unchanged.

| # | Result | Evidence |
|---|---|---|
| M16 | FAIL | 21:56 Asia/Muscat. Sidebar and direct `https://cmx.cleanmatex.com/dashboard/settings/preferences` show "Loading preferences..." for ~7 s, then "Error Loading Preferences / Failed to fetch effective settings / Try Again." Still broken after the deploy (r4 was BLOCKED/FAIL with the same error). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-M16.png`. |
| P2 | PASS | 21:56 Asia/Muscat. `https://cmx.cleanmatex.com/dashboard/settings/extra-config` loads "Display & Formatting Preferences" with "Live GCC Formatting Preview" showing `1,234.500 OMR`, `November 19, 2026`, `+968 9123 4567 · ORD-2026-0042`, and `10 rows/page · INHERIT · 32/44px`. Badges: System Default / Default / Live preview. Radio cards, select, and switches (Show currency code, BiDi isolation) are present. Load ~9 s. No Save/Reset pressed. Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P2.png`. |
| P1 | PASS (with note) | 21:58 Asia/Muscat. Arabic digits are Western as expected: Dashboard "OMR 75.948" and ORD-20261119-00006; Orders phone `+96896662624` LTR; B2B `+96891234567`; Invoices `0.0000`. Note (not a digit fail): untranslated English remains in AR for dates, status words Ready/Processing/Pending, and header titles Dashboard/Orders/Invoices/B2B Customers (prior FET-UIDS-Nov19-ArabicTopbarTitlesEnglish / FET-UIDS-Nov19-ArabicLeftovers still open). Shots: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P1-dashboard-AR.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P1-orders-AR.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P1-b2b-AR.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P1-invoices-AR.png`. |
| P8 | PASS | 22:00 Asia/Muscat. New order → Select Customer → Create New Customer opens "Quick Add Customer / Create a quick customer profile for POS". 14 Tabs stay inside the dialog. Escape #1 closes the country dropdown only; Escape #2 closes Quick Add only (the customer picker stays). Close X is top-right in EN and top-left in AR (title "إضافة عميل سريعة"). Body scroll stayed locked while open. Minor: country select accessible name is the raw key `customers.countryCode`. Shots: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P8-quickadd-EN.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P8-dropdown-open-EN.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P8-after-2nd-escape.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-P8-quickadd-AR.png`. |
| PR-01 #6 | PASS | Same evidence as P8: Tab no longer escapes the Quick Add dialog (r4/r3 FAIL is not reproduced). Shots as P8. |
| PR-02 #5 | PASS | Same evidence as P8: first Escape closes the dropdown only; second Escape closes the dialog and leaves the picker open (r4/r3 FAIL is not reproduced). Shots as P8. |
| PR-02 #17 | PASS | Same evidence as P8: Arabic dialog X is top-left; Quick Add EN/AR layout is clean in this check. (Stub / category leftovers from earlier rounds were not re-judged.) Shots as P8. |
| PR-01 #4 | FAIL | 21:58–21:59 Asia/Muscat. Customers pager: "Showing 1 to 5 of 5 results" with ‹ 1 › and no page-size picker (PARTIAL vs full expected). Orders: 13 rows, no pager and no page-size control (FAIL). Still broken. Shots: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-PR01-4-customers-EN.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-PR01-4-orders-EN.png`. |
| PR-02 #1 | FAIL | 21:59 Asia/Muscat. Orders list STATUS (Ready/Processing) and PREP STATUS (Pending) are still plain text; only "POS (counter)" is a grey chip. Still broken (FET-UIDS-Nov19-OrdersListNoStatusBadge). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-PR02-1-orders-badges-EN.png`. |
| PR-02 #14 | FAIL | 21:58 Asia/Muscat. Arabic Vouchers footer is still English: "1–20 of 20", "Rows per page", "Page 1 of 1", "Go to page", "Go". A second Arabic pager ("السابق / التالي", "صفحة 1 من 3") disagrees with the English footer and with the header total 44. Still broken (FET-UIDS-Nov19-ArabicTableFooterEnglish / FET-UIDS-Nov19-VouchersPagerMismatch). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-PR02-14-vouchers-AR.png`. |
| PR-02 #16 | PARTIAL | 21:58 Asia/Muscat. Arabic Customers phone is now `+96896662624` (the reversed `968…+` form is **not reproduced**). Still: no # column (checkbox is first); "الاتصال" header is right-aligned vs the cell left-aligned. Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-PR02-16-customers-AR.png`. |
| PR-07 #2 (M13 observe) | FAIL | 22:00 Asia/Muscat. Settings → Branding Logos card still shows "The request was not valid." plus Retry. Page load ~8–10 s. No logo was uploaded or removed (high-impact write not approved). Still broken (FET-UIDS-Nov20-BrandingLogosInvalidRequest). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-PR07-2-branding.png`. |
| Services report (M21 link) | FAIL | 22:01 Asia/Muscat. Dashboard "View detailed report" goes to `https://cmx.cleanmatex.com/reports/services` and shows "404 / This page could not be found." Direct `/dashboard/reports/services` is also 404. Still broken (FET-UIDS-Nov20-ServicesReport404). Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-services-report-404.png`. |
| M19 | FAIL | 22:02 Asia/Muscat. Appearance saved as Dark (toast "Appearance saved"); sign out lands on `https://cmx.cleanmatex.com/login?redirect=/dashboard/account/appearance` fully light, with the dark-navy logo. Restored afterwards to "Same as this device" / "Same as the Organization" / "Medium" and verified after reload. Still broken (FET-UIDS-Nov20-SignInIgnoresDarkPref). Shots: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-M19-original.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-M19-dark-saved.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-M19-signin-after-dark.png`, `C:\Users\JHNLP\qa-20261120\r5\shots\b1-M19-restored.png`. |
| P9 | FAIL | 22:30 Asia/Muscat. Viewer at `https://cmx.cleanmatex.com/dashboard/settings/extra-config` shows "Could not load configuration / Unable to load display and formatting preferences. Please try again." Operator sees the same. There is no read-only notice and no disabled controls — the page errors instead of the expected read-only view. Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b5-UIDS-P9.png` (also `C:\Users\JHNLP\qa-20261120\r5\shots\b5-Q9-T4-extra.png`). |
| P10 | PARTIAL | 22:14–22:18 Asia/Muscat, HQ Incognito. `https://hqsaas.cleanmatex.com/en/products-items-config/extra-config` opens "Extra Organization Config Catalog" (not in the sidebar; reached via Products & Catalogs Hub "Extra organization config"). 8 keys in categories Numbers & Dates / Tables & Density / POS Ergonomics / Accessibility. Page 2 includes BDI_ISOLATION_ENABLED, NUMBER_SCRIPT, DATE_DIGITS, NUMBER_GROUPING_LOCALE, POS_STEPPER_MIN_TARGET, all "0 ORG OVERRIDES". "New config key" and "Audit History" are present. HQ→cmx propagation was not exercised (adding/editing a key is a write, awaiting approval). No dedicated shot file; observed in the HQ batch with b3 shots for the same session. |
| Other (B2B index) | FAIL (new) | 21:58 Asia/Muscat. `https://cmx.cleanmatex.com/dashboard/b2b` returns 404; `/dashboard/b2b/customers` is OK. Shot: `C:\Users\JHNLP\qa-20261120\r5\shots\b1-misc-b2b-route404.png`. |

**Prior findings — Retest r5 2026-11-20**

- **FET-UIDS-Nov20-EffectiveSettings500** (also FET-UIDS-Nov19-EffectiveSettingsFetchFails) — **STILL BROKEN.** M16 still shows "Failed to fetch effective settings."
- **FET-UIDS-Nov20-SignInIgnoresDarkPref** — **STILL BROKEN.** Sign-in stays light after Dark is saved (M19).
- **FET-UIDS-Nov20-BrandingLogosInvalidRequest** — **STILL BROKEN.** Logos card "The request was not valid."
- **FET-UIDS-Nov20-ServicesReport404** — **STILL BROKEN.** `/reports/services` and `/dashboard/reports/services` are 404.
- **FET-UIDS-Nov19-OrdersListNoStatusBadge** — **STILL BROKEN.** PR-02 #1.
- **FET-UIDS-Nov19-ArabicTableFooterEnglish** / **FET-UIDS-Nov19-VouchersPagerMismatch** — **STILL BROKEN.** PR-02 #14.
- **FET-UIDS-Nov19-DialogEscapeFocusTrap** / Quick Add Tab leak (PR-01 #6, PR-02 #5) — **FIXED / not reproduced** in r5 (see P8).
- **FET-UIDS-Nov19-LangSwitchMixedState** — **STILL SEEN.** After switching back to EN, mixed AR/EN remains until reload. Arabic dashboard recent-order statuses stay English ("ready"/"processing").
- **FET-UIDS-Nov19-ArabicTopbarTitlesEnglish** / **FET-UIDS-Nov19-ArabicLeftovers** — **STILL OPEN** on P1 AR chrome (titles, dates, status words).
- **FET-UIDS-Nov19-SlowPages** — **STILL SEEN.** Sidebar empty 1–2 s on some pages; Extra Config ~9 s; Branding ~8–10 s.

**New findings — Financial_Expert_Tester, Retest r5 2026-11-20**

- **P2 FET-UIDS-Nov20-P9NoReadOnlyView:** Viewer and operator opening `/dashboard/settings/extra-config` get "Could not load configuration / Unable to load display and formatting preferences. Please try again." instead of a read-only view with disabled controls and hidden Save/Reset. Suggested fix: authorize `settings:read` (or equivalent) for a read-only extra-config page; do not require `settings:update` to fetch the catalog. Code location not checked.
- **P3 FET-UIDS-Nov20-B2BIndex404:** `/dashboard/b2b` is 404 while `/dashboard/b2b/customers` works. Suggested fix: add a redirect or hub route, or point nav at the working customers path. Code location not checked.
- **P3 FET-UIDS-Nov20-CountryCodeRawKey:** Quick Add country select accessible name is the raw key `customers.countryCode`. Suggested fix: wire the existing translation key. Code location not checked.
- **P3 FET-UIDS-Nov20-P10CatalogNotInSidebar:** HQ Extra Config catalog is reachable from the Products & Catalogs Hub but is not in the sidebar, so testers/operators may miss it. Suggested fix: add a sidebar entry under Products & Catalogs (or Platform Config). Code location not checked.

**r5 tally for the rows above (parent counts unchanged):** PASS 6 (P1, P2, P8, PR-01 #6, PR-02 #5, PR-02 #17) · FAIL 8 (M16, PR-01 #4, PR-02 #1, PR-02 #14, PR-07 #2, Services report, M19, P9) · PARTIAL 2 (PR-02 #16, P10) · plus the new B2B index FAIL logged under Other.

**Rows not run in r5:** P3–P7 Extra Config Save/Reset (write-gated, awaiting approval); M12 / M13 remove-logo / M20 Make-active (branding high-impact, awaiting approval — Logos error was observed only); R1–R6 local-only (`npm run check:ui`, Claude/Cursor/Codex, SQL grandfathered rule); R7 (same as M22, already PASS in r4, not rechecked); remaining PR-01/PR-02/PR-07 FAIL/PARTIAL sample rows not in this observe batch (including Saudi Demo and 3G-throttle cases).

**Test data left behind:** nothing new was created in r5. Shared leftover from earlier rounds (unchanged): `ORD-20261119-00006` is READY on rack QA-A1, paid 1.070 OMR cash, with 3 photos including `qa_photo2.jpg` (note "QA r4 note"). Appearance and language were restored. No branding, settings, users, or other orders were changed.

**Retest plan:** After owner approval, run P3–P7 (Extra Config writes + restore) and branding M12/M13/M20 on a disposable QA theme. Recheck M16/M19/Logos/Services 404 after the next deploy. Keep R1–R6 for a local tools pass. Recheck P9 once a read-only path ships; finish P10 by creating a throwaway HQ option and confirming it appears on cmx without redeploy.

## Financial_Expert_Tester Results — Retest r6 2026-11-20 (22:49–23:05 Asia/Muscat)

**Scope.** This round re-ran the r4 findings the owner listed first (M19, M16, M13, M21/M17), then the PR-08 rows not run in r5 (P3–P7 Extra Config Save/Reset with restore, P10 HQ override count), the rest of P8 (other feature modals), and Design-system rule R7. The guide was unchanged since my r5 write (121,367 B, SHA E7D652C5…, 22:39:23). Environment: deployed `https://cmx.cleanmatex.com`, Demo Laundry (OMR, 3 decimals), admin@demo-laundry.example; HQ `https://hqsaas.cleanmatex.com` in Incognito as the HQ admin (observe only). Driven through the browser UI as a user. Screenshots are copied in time order to `C:\Users\JHNLP\qa-20261120\r6\shots_uids\r6-UIDS-01.webp` … `r6-UIDS-49.webp` (file names are sequence numbers, not row ids; P5 and P7 have no dedicated before/after shots).

**Extra Config baseline and restore.** At start, all 8 keys on `/dashboard/settings/extra-config` showed "System Default" (10 rows/page, INHERIT density, 32/44px, LATN). At the end, after a reload, 8 of 8 showed "System Default" again. NUMBER_SCRIPT, Default Table Rows Per Page, Organization Table Density and POS Counter Touch Target Mode were changed and reset. DATE_DIGITS, NUMBER_GROUPING_LOCALE, Show Currency Code in Tables and BiDi Code & Phone Isolation were never touched. User Appearance was set to Dark for M19 and M17, then restored to Light or dark "Same as this device", Density "Same as the Organization" and Text size "Medium" (confirmed after a reload).

### Retest r6 — r4 findings (owner priority)

| Row | Retest r6 | Evidence |
|---|---|---|
| M19 | FAIL (still) | 22:58. With user Appearance saved as Dark, I signed out. The sign-in page first painted dark, then switched to the light theme with the light CleanMateX wordmark. The `?redirect=` parameter was also dropped from the sign-in URL. After sign-in the dashboard was dark. FET-UIDS-Nov19 dark sign-in finding stays open. |
| M16 | FAIL (changed symptom) | `https://cmx.cleanmatex.com/dashboard/settings/preferences` stays on "Loading preferences..." for more than 30 s, and the same after a hard reload. No "Failed to fetch effective settings" text is shown and no 4xx was seen in the UI. `/dashboard/settings/user-preferences` is a 404. The r4 symptom (HTTP 500 on `GET /api/settings/tenants/me/effective?userId=me`) has become an endless loader. |
| M13 | FAIL (still) | Settings → Branding, Logos section: "The request was not valid." with a Retry button. Observe only; nothing was uploaded or saved. |
| M21 | PASS (link removed) | `/dashboard/reports/services` still returns "404 This page could not be found.", but the Reports tabs are now Orders & Sales, Payments, Invoices, Revenue, Customers. The Services link is gone, so a user can no longer reach the 404 from the UI. |
| M17 toast lag | PASS | Switching Light ↔ Dark showed the "Appearance saved" toast at about 1 s with the theme already applied. No lag seen. |

### Retest r6 — PR-08 rows

| Row | Retest r6 | Evidence |
|---|---|---|
| P3 | PARTIAL | 22:51. Switching Currency & Number Digits LATN → ARAB updated the Live GCC Formatting Preview at once: `1,234.500 OMR` → `١٬٢٣٤٫٥٠٠ OMR`. Save toast: "Display & formatting settings saved". In Arabic, the Dashboard showed Eastern digits only on "إيرادات اليوم ٠٫٠٠٠ OMR"; other Dashboard figures stayed Western ("OMR 0.000", "OMR 75.948", counts). On Orders, totals stayed Western (`‏1.070 ر.ع.‏`), and so did the counts. |
| P4 | PASS (with note) | "Reset to default" applied immediately; there is no confirm step (the guide says "Confirm reset"). The "System Default" badge returned, the preview went back to `1,234.500 OMR`, and the Arabic Dashboard showed `0.000 OMR`. |
| P5 | FAIL | INHERIT → COMPACT → Save. On Orders the row pitch was about 36.7 px both before and after; only the header sat about 5 px higher. Rows are not visibly tighter. GL Inquiry not checked: `/dashboard/finance/gl-inquiry` is a 404 and no other route was found. Reset restored "System Default". |
| P6 | BLOCKED (with FAIL signal) | Saved 20 rows per page. Customers has only 5 rows. Orders has 13 rows and showed all 13 both before and after, so Orders does not page at 10 to begin with (see r5 PR-01 #4, Orders has no pager). Vouchers was not tested. Reset restored 10. |
| P7 | PASS | With ALWAYS_TOUCH_44 saved, on `/dashboard/orders/new` the Quick Drop −/+ buttons measured 44×44 px with a mouse, and so did Select Customer, Edit and Calculate Ready By. After Reset the + button was 32×32. No order was created. |
| P10 | PASS (override count part) | HQ `/en/products-items-config/extra-config`, observe only. While NUMBER_SCRIPT=ARAB was saved on Demo Laundry (22:52), the NUMBER_SCRIPT row showed count 1 with a person icon under the ORG OVERRIDES column, and the usage list read "1 active organization override(s) currently stored." with Demo Laundry LLC, `demo-laundry`, ARAB. After the P4 reset (22:54) the count was 0. Not run: editing NUMBER_SCRIPT or adding an HQ option and seeing it on the tenant (a platform catalog write that affects all tenants; not approved for this round). |
| P8 (other modals) | PARTIAL | Edit user (Settings → Users → Actions → Edit), EN and AR: Tab stays inside; Escape closes; focus does not return to the opener (nothing focused; the opener is an Actions menu item); body overflow hidden. Customer Edit: EN PASS (trap, Escape, focus back to "Edit", scroll locked); AR: the "Edit" button label stays English, and after tabbing into fields Escape did not close the dialog (closing on Escape worked only right after open). Ready date on New order: EN and AR trap and Escape PASS, X at top-end (left in RTL), but focus does not return to the opener. Roles/Permissions: BLOCKED — `/dashboard/settings/roles` is a read-only list with no dialog; title "Roles Management" is English in AR. Assembly Task, Subscription, Bottom Sheet not reached (no assembly tasks on Demo Laundry). |

### Retest r6 — Design system rule R7

| Row | Retest r6 | Evidence |
|---|---|---|
| R7 | FAIL | `/dashboard/settings/labels` (Labels & Tags): 9 native `<select>` elements and no design-system select or switch. Readable in Light. Dark not checked on this form. Nothing saved. |

### Retest r6 — new findings (Financial_Expert_Tester, 2026-11-20)

- **FET-UIDS-Nov20-PrefsInfiniteLoader (P1).** Settings → User Preferences (`/dashboard/settings/preferences`) never leaves "Loading preferences..." (M16). Likely cause: the effective-settings request (`/api/settings/tenants/me/effective?userId=me`, the r4 500) now fails or never resolves and the page has no error or timeout state. Fix: return the effective settings for the signed-in user without needing `userId=me` to be resolved server-side, and show an error with Retry when the request fails. Code location not checked (no repo access in this run). Retest: open the page, expect values within 5 s, or an error with Retry.
- **FET-UIDS-Nov20-SignInLosesRedirect (P2).** With Dark saved, the sign-in page paints dark and then switches to light and the light logo (M19), and the `?redirect=` parameter is dropped. Fix: read the theme from a cookie on the server before the first paint; keep `redirect` when the sign-in page re-renders. Retest: save Dark, sign out, open a deep link; expect a dark sign-in page with the dark logo and a return to the deep link after sign-in.
- **FET-UIDS-Nov20-ArabDigitsPartial (P2).** NUMBER_SCRIPT=ARAB changes only one Dashboard tile and none of the Orders amounts or counts (P3). Fix: route every money and count display through the shared number formatter that reads the org NUMBER_SCRIPT. Retest: set ARAB, check Dashboard KPIs, Orders totals and counts, Invoices in AR.
- **FET-UIDS-Nov20-CompactDensityNoEffect (P2).** COMPACT density does not change the Orders table row height (P5). Fix: make the Orders list use `CmxDataTable`/`CmxDataGrid` row tokens (`--cmx-row-h`, `--cmx-cell-px`) under `html[data-density]`. Retest: set COMPACT and compare row pitch.
- **FET-UIDS-Nov20-OrdersIgnoresPageSize (P3).** Orders shows all 13 rows with page size 10 or 20 (P6; also r5 PR-01 #4). Fix: give the Orders list server paging that defaults to the org rows-per-page. Retest: with more than 20 orders, expect 10 by default, 20 after setting 20.
- **FET-UIDS-Nov20-ModalFocusReturn (P3).** Edit user and Ready date dialogs do not return focus to the opener on close; in AR, Escape inside Customer Edit fields does not close the dialog (P8). Fix: pass the opener (or the menu trigger for menu items) as the return-focus target; stop inputs from swallowing Escape. Retest: Tab into a field, press Escape, expect close and focus on the opener.
- **FET-UIDS-Nov20-ResetNoConfirm (P3).** "Reset to default" applies at once without a confirmation (P4 expects a confirm). Decide whether a confirm is wanted for "Reset all to defaults" at least.
- **FET-UIDS-Nov20-LabelsNativeSelects (P3).** Labels & Tags form uses 9 native `<select>` (R7). Fix: replace with `CmxSelectDropdown`. Retest R7 in Light and Dark.
- **FET-UIDS-Nov20-ReportsDarkBars (P3).** On Reports in Dark, the "Orders by Status" bars render black on the dark background and cannot be read. Fix: use chart colour tokens that change with the theme.
- **FET-UIDS-Nov20-ArabicLeftovers (P3).** Still English in AR: "Roles Management" page title, "Edit" button on Customers. After switching AR → EN, parts of the page body stay Arabic until a reload.

### Retest r6 — recount, leftovers, caveats

- Recount for r6 rows: PASS 4 (M21, M17, P7, P10 count part) + P4 PASS with note; PARTIAL 2 (P3, P8); FAIL 5 (M19, M16, M13, P5, R7); BLOCKED 1 (P6).
- Leftovers: none. No order, file or HQ change was made. All Extra Config keys and the admin's Appearance were restored (verified after reload).
- Caveats: Times are from the on-screen clock. Not run: P10 HQ→tenant option propagation (needs a catalog write, not approved), GL Inquiry (route not found), Vouchers for P6, Dark check on R7, Assembly Task / Subscription / Bottom Sheet modals. R1–R6 are local terminal/editor checks, outside the remote-only scope.
- Retest plan: after fixes, re-run M16, M19, P3, P5, P6 (with 25+ orders), P8 focus return, R7, and P10 propagation if the owner approves an HQ catalog edit.

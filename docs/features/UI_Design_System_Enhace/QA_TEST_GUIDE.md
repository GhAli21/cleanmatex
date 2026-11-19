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

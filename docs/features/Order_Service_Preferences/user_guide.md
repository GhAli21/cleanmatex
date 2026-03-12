---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Order Service Preferences — User Guide

## Overview

Service Preferences let you specify how laundry items should be processed (e.g., starch, perfume, delicate) and packed (e.g., hang, fold, box). These choices affect the order total and appear on receipts and in the processing workflow.

## User Workflows

### 1. Adding Preferences on New Order

1. Go to **New Order**.
2. Add items to the order (customer, products, quantities).
3. In the **Order Details** tab, for each item:
   - **Service preferences:** Click the preferences field and select one or more options (e.g., Light Starch, Perfume, Delicate).
   - **Packing preference:** Choose how the item should be packed (Hang, Fold, Box, etc.).
4. If your plan supports **Care Packages**, you can apply a bundle to an item for a discounted set of preferences.
5. If **Repeat Last Order** is enabled, you can apply the customer’s last order preferences with one click.
6. The **Additional Services** charge appears in the order summary when service preferences have a price.
7. Submit the order.

### 2. Editing Preferences on Existing Order

1. Open the order in **Edit** mode.
2. In the Order Details section, change service or packing preferences per item.
3. Add or remove preferences; the order total updates automatically.
4. Save the order.

### 3. Per-Piece Preferences (Enterprise)

When per-piece preferences are enabled:

1. In the order details, expand the item to see individual pieces.
2. For each piece, you can set:
   - **Packing preference** (override item default)
   - **Service preferences** (override item default)
3. Use **Apply default to all** to copy the item default to all pieces.

### 4. Processing Screen

1. In **Processing**, each piece shows its service and packing preferences.
2. If a piece’s packing differs from the item default, an **Override** badge is shown.
3. If **Processing Confirmation** is enabled, confirm preferences per piece before moving to assembly.

### 5. Admin — Preferences Catalog

1. Go to **Dashboard → Catalog → Preferences**.
2. View service and packing preferences enabled for your tenant.
3. Under **Care Packages**, add, edit, or delete bundles (when your plan allows).

### 6. Customer Standing Preferences

1. Open a customer record.
2. In the **Preferences** tab (when available), add or remove standing preferences.
3. These are applied automatically to new orders when **Auto-apply customer prefs** is enabled.

## FAQs

**Q: Why don’t I see the preferences options?**  
A: Your tenant plan and feature flags control visibility. Contact your admin if service or packing preferences are not enabled.

**Q: Can I mix incompatible preferences (e.g., Delicate + Heavy Starch)?**  
A: If **Enforce compatibility** is on, incompatible combinations are blocked. Otherwise, a warning is shown.

**Q: Where does the Additional Services charge appear?**  
A: In the order summary (Items + Additional Services = Total) and on receipts when `{{service_pref_charge}}` is used.

**Q: How do I apply a Care Package?**  
A: Select the bundle from the Care Packages section for an item; it applies the bundle’s preferences and discount.

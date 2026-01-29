# Pricing Feature User Guide

## Overview

This guide is for end users and administrators who need to configure and manage pricing in CleanMateX. It covers common tasks, best practices, and troubleshooting.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Managing Price Lists](#managing-price-lists)
3. [Setting Up Products](#setting-up-products)
4. [Configuring Tax](#configuring-tax)
5. [Bulk Operations](#bulk-operations)
6. [Price Overrides](#price-overrides)
7. [Viewing Price History](#viewing-price-history)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [FAQs](#faqs)

## Getting Started

### Understanding Price Lists

Price lists are collections of product prices organized by type:

- **Standard Pricing** - Regular customer pricing
- **Express Pricing** - Faster service pricing (typically higher)
- **B2B Pricing** - Business-to-business pricing (typically lower)
- **VIP Pricing** - Premium customer pricing
- **Seasonal Pricing** - Time-limited promotional pricing
- **Promotional Pricing** - Special offer pricing

### Accessing Pricing Features

1. Navigate to **Catalog** > **Pricing** in the main menu
2. You'll see a list of all price lists
3. Click on a price list to view and edit items

## Managing Price Lists

### Creating a Price List

1. Go to **Catalog** > **Pricing**
2. Click **New Price List** button
3. Fill in the details:
   - **Name** (English and Arabic)
   - **Price List Type** (Standard, Express, B2B, VIP, etc.)
   - **Priority** (Higher priority lists are checked first)
   - **Effective Dates** (Optional - when the list is active)
4. Click **Save**

### Adding Products to a Price List

#### Method 1: Individual Addition

1. Open the price list
2. Click **Add Item** button
3. Search for the product
4. Enter:
   - **Price** (e.g., 5.500 OMR)
   - **Discount %** (Optional - e.g., 10 for 10% off)
   - **Quantity Tiers** (Optional):
     - **Min Quantity** (e.g., 1)
     - **Max Quantity** (e.g., 10 for 1-10 items)
5. Click **Save**

#### Method 2: Bulk Import

1. Open the price list
2. Click **Bulk Import** button
3. Download the template CSV file
4. Fill in the template:
   ```
   product_code,price,discount_percent,min_quantity,max_quantity
   SHIRT-001,5.500,10.0,1,10 
   PANTS-001,8.000,0.0,1,
   ```
5. Upload the filled CSV file
6. Review the preview
7. Click **Import**

### Editing Price List Items

1. Open the price list
2. Find the item in the list
3. Click the **Edit** icon
4. Modify the price, discount, or quantity tiers
5. Click **Save**

**Note:** All price changes are automatically logged in the price history.

### Deleting Price List Items

1. Open the price list
2. Find the item
3. Click the **Delete** icon
4. Confirm deletion

**Note:** Deleting an item removes it from the price list but doesn't delete the product itself.

### Setting Price List Priority

When multiple price lists of the same type are active, the system uses the one with the highest priority:

1. Open the price list
2. Click **Settings** tab
3. Adjust the **Priority** value (higher = checked first)
4. Click **Save**

**Example:**
- Standard Pricing List A: Priority 10
- Standard Pricing List B: Priority 5
- System will use List A first

## Setting Up Products

### Default Product Prices

Every product should have default prices set:

1. Go to **Catalog** > **Products**
2. Open a product
3. Set:
   - **Default Sell Price** (used when no price list applies)
   - **Default Express Sell Price** (for express orders)
4. Save

**Important:** Default prices are used as fallback when no price list price is found.

### Quantity Tiers

You can set different prices based on quantity:

**Example:**
- 1-10 items: 5.500 OMR each
- 11-50 items: 5.000 OMR each (10% discount)
- 51+ items: 4.500 OMR each (20% discount)

**To set up:**
1. Add multiple items for the same product
2. Set different `min_quantity` and `max_quantity` values
3. Set different prices for each tier

## Configuring Tax

### Setting Tax Rate

1. Navigate to **Settings** > **Finance**
2. You'll see the current tax rate displayed
3. Enter the new tax rate as a decimal:
   - **5% VAT** = 0.05
   - **10% Sales Tax** = 0.10
   - **15% GST** = 0.15
4. Select the **Tax Type** (VAT, Sales Tax, GST, etc.)
5. Click **Save Tax Settings**

**Note:** Changes take effect immediately for new orders. Existing orders keep their original tax rate.

### Tax Exemptions

Currently, tax exemptions are configured at the system level. Contact your administrator to set up:
- Product-level exemptions
- Customer-level exemptions
- Category-level exemptions

## Bulk Operations

### Exporting Price Lists

1. Open the price list
2. Click **Export** button
3. Choose export format (CSV)
4. Download the file

**Use cases:**
- Backup price data
- Share prices with team
- Prepare for bulk updates

### Importing Price Lists

1. Open the price list
2. Click **Bulk Import** button
3. Download the template (if needed)
4. Fill in the template with your data
5. Upload the CSV file
6. Review the preview:
   - ✅ Green = Valid, will be imported
   - ⚠️ Yellow = Warning, review carefully
   - ❌ Red = Error, will be skipped
7. Click **Import** to proceed

**Template Format:**
```csv
product_code,price,discount_percent,min_quantity,max_quantity
SHIRT-001,5.500,10.0,1,10
PANTS-001,8.000,0.0,1,
JACKET-001,12.000,15.0,1,5
```

**Tips:**
- Use product codes (not names) for accuracy
- Leave `max_quantity` empty for unlimited
- Use decimal format for prices (5.500 not 5,500)
- Discount is percentage (10.0 = 10%)

## Price Overrides

### When to Use Price Overrides

Price overrides allow you to manually adjust prices for specific order items:

- **Special customer discounts**
- **Promotional offers**
- **Price negotiations**
- **Error corrections**

### Overriding a Price

**Note:** You need the `pricing:override` permission to use this feature.

1. While creating an order, add items as usual
2. Find the item in the cart
3. Click the **Edit** icon (pencil)
4. The Price Override modal opens
5. You'll see:
   - **Calculated Price** (read-only) - The system-calculated price
   - **Override Price** - Enter your custom price
   - **Reason** - Explain why you're overriding (required, min 10 characters)
6. Click **Apply Override**

**Important:**
- Overrides are logged in the audit trail
- Tax is recalculated based on the override price
- Override applies only to that specific item in that order

### Viewing Override History

1. Open the order
2. View order items
3. Items with overrides show an **"Override"** badge
4. Hover over the badge to see the override reason

## Viewing Price History

### Accessing Price History

1. Open a price list
2. Click the **History** tab
3. You'll see a timeline of all price changes

### Understanding the Timeline

Each entry shows:
- **Date & Time** - When the change was made
- **User** - Who made the change
- **Old Price** → **New Price** - The price change
- **Discount Change** - If discount was modified
- **Reason** - Why the change was made (if provided)

### Filtering History

Use the filters to narrow down results:
- **From Date / To Date** - Date range
- **Entity Type** - Price list item or product default
- **User** - Filter by who made changes

### Exporting History

1. Apply filters (optional)
2. Click **Export CSV**
3. Download the file

**Use cases:**
- Audit trail
- Price change reports
- Compliance documentation

## Best Practices

### 1. Organize Price Lists by Type

Create separate price lists for different scenarios:
- Standard pricing for regular customers
- Express pricing for rush orders
- B2B pricing for business customers
- VIP pricing for premium members

### 2. Use Quantity Tiers

Set up quantity-based pricing to encourage bulk orders:
- Lower prices for higher quantities
- Clear tier boundaries (1-10, 11-50, 51+)

### 3. Set Effective Dates

Use effective dates for:
- Seasonal promotions
- Limited-time offers
- Price change schedules

**Example:**
- Set "Summer Sale" price list: June 1 - August 31
- System automatically uses it during that period

### 4. Regular Price Reviews

- Review prices monthly or quarterly
- Check price history for trends
- Update prices based on costs and market conditions

### 5. Document Price Changes

Always provide a reason when changing prices:
- "Cost increase from supplier"
- "Seasonal adjustment"
- "Competitive pricing update"

This helps with:
- Audit trails
- Understanding price history
- Compliance requirements

### 6. Test Before Going Live

- Create a test price list
- Test with sample orders
- Verify calculations are correct
- Check tax application

### 7. Backup Price Data

Regularly export price lists:
- Before major changes
- Monthly backups
- Before system updates

## Troubleshooting

### Prices Not Showing in Orders

**Problem:** Items show 0.000 or incorrect prices in orders

**Solutions:**
1. Check if the price list is **Active**
2. Verify the **Effective Dates** include today
3. Ensure the product is in the price list
4. Check if quantity falls within tier range
5. Verify product has default price set

### Tax Not Applied

**Problem:** Orders show 0.000 for tax

**Solutions:**
1. Go to **Settings** > **Finance**
2. Verify tax rate is set (should be > 0)
3. Check tax rate format (0.05 for 5%, not 5)
4. Ensure tax rate is between 0 and 1

### Can't Override Price

**Problem:** Price override button doesn't work or shows permission error

**Solutions:**
1. Contact your administrator
2. Request `pricing:override` permission
3. Ensure you're logged in with correct account
4. Try refreshing the page

### Bulk Import Fails

**Problem:** CSV import shows errors

**Solutions:**
1. Check CSV format matches template exactly
2. Verify product codes exist in system
3. Ensure prices are valid numbers (use decimal format)
4. Check for empty required fields
5. Review error messages in preview

**Common errors:**
- `Product not found` - Product code doesn't exist
- `Invalid price` - Price format is wrong (use 5.500 not 5,500)
- `Invalid discount` - Discount must be 0-100

### Price History Not Showing

**Problem:** History timeline is empty

**Solutions:**
1. Verify price changes were actually saved
2. Check date filters aren't excluding results
3. Ensure you have permission to view history
4. Try clearing filters and refreshing

### Wrong Price List Used

**Problem:** System uses wrong price list

**Solutions:**
1. Check price list **Priority** (higher = used first)
2. Verify price list is **Active**
3. Check **Effective Dates** include today
4. Ensure price list type matches order type:
   - Express orders use Express price lists
   - B2B customers use B2B price lists
   - VIP customers use VIP price lists

## FAQs

### Q: Can I have multiple price lists of the same type?

**A:** Yes! Use priority to control which one is used first. Higher priority = checked first.

### Q: What happens if a product isn't in any price list?

**A:** The system uses the product's default price from the product settings.

### Q: Can I set different prices for the same product in different price lists?

**A:** Yes! Each price list can have its own price for the same product.

### Q: How do quantity tiers work?

**A:** When quantity matches a tier (e.g., 15 items matches 11-50 tier), that tier's price is used. The system finds the best matching tier.

### Q: Can I change prices for existing orders?

**A:** No, prices are locked when the order is created. You can only override prices while creating a new order.

### Q: How often should I update prices?

**A:** It depends on your business, but monthly or quarterly reviews are recommended. Update immediately if costs change significantly.

### Q: Can I delete a price list?

**A:** Yes, but it's recommended to deactivate it first. Deleted price lists can't be recovered, but deactivated ones can be reactivated.

### Q: What's the difference between discount in price list and price override?

**A:** 
- **Discount in price list:** Applied automatically to all orders using that price list
- **Price override:** Manual adjustment for a specific item in a specific order

### Q: How do I set up seasonal pricing?

**A:** 
1. Create a new price list
2. Set **Effective From** and **Effective To** dates
3. Add products with seasonal prices
4. System automatically uses it during that period

### Q: Can I export all price lists at once?

**A:** Currently, you export one price list at a time. Contact support if you need bulk export of all price lists.

## Getting Help

If you need assistance:

1. **Check this guide** - Most common issues are covered here
2. **Review price history** - See what changed and when
3. **Contact your administrator** - For permission issues
4. **Contact support** - For technical problems

## Additional Resources

- [README.md](./README.md) - Technical overview
- [MIGRATION.md](./MIGRATION.md) - For system administrators
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - For developers


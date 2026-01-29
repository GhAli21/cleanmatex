# Pricing Feature Test Guide

## Overview

This guide provides comprehensive test scenarios and step-by-step instructions for testing the pricing feature. Use this guide for QA testing, user acceptance testing, and regression testing.

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Test Scenarios](#test-scenarios)
3. [Step-by-Step Test Cases](#step-by-step-test-cases)
4. [Edge Cases](#edge-cases)
5. [Integration Tests](#integration-tests)
6. [Performance Tests](#performance-tests)
7. [Regression Tests](#regression-tests)
8. [Test Checklist](#test-checklist)

## Test Environment Setup

### Prerequisites

1. **Test Tenant Created**
   - Create a test tenant or use existing test tenant
   - Ensure tenant has proper permissions

2. **Test Data Prepared**
   - At least 5 test products
   - Test customer (regular, B2B, VIP)
   - Test users with different permissions

3. **Test Permissions**
   - User with `pricing:override` permission
   - User without `pricing:override` permission
   - Admin user

### Test Data Setup

**Create Test Products:**
```
Product 1: SHIRT-001, Default Price: 5.500 OMR, Express: 7.000 OMR
Product 2: PANTS-001, Default Price: 8.000 OMR, Express: 10.000 OMR
Product 3: JACKET-001, Default Price: 12.000 OMR, Express: 15.000 OMR
Product 4: DRESS-001, Default Price: 10.000 OMR, Express: 12.000 OMR
Product 5: SUIT-001, Default Price: 20.000 OMR, Express: 25.000 OMR
```

**Create Test Customers:**
```
Customer 1: Regular customer (type: regular)
Customer 2: B2B customer (type: b2b)
Customer 3: VIP customer (type: vip)
```

## Test Scenarios

### Scenario 1: Basic Price List Management

**Objective:** Verify price list creation, editing, and deletion

**Priority:** High

**Test Steps:**
1. Navigate to Catalog > Pricing
2. Create a new price list
3. Add products to the price list
4. Edit product prices
5. Delete products from price list
6. Delete the price list

**Expected Results:**
- Price list created successfully
- Products added with correct prices
- Prices updated correctly
- Products removed successfully
- Price list deleted successfully

### Scenario 2: Price Calculation - Standard Pricing

**Objective:** Verify price calculation for standard orders

**Priority:** High

**Test Steps:**
1. Create a standard price list
2. Add products with prices
3. Create a new order
4. Select regular customer
5. Add items to order
6. Verify prices are calculated correctly
7. Verify tax is applied
8. Verify totals are correct

**Expected Results:**
- Prices match price list prices
- Tax calculated correctly (e.g., 5% on subtotal)
- Subtotal = sum of item prices
- Total = subtotal + tax

### Scenario 3: Price Calculation - Express Pricing

**Objective:** Verify express pricing is used for express orders

**Priority:** High

**Test Steps:**
1. Create an express price list
2. Add products with express prices
3. Create a new order
4. Toggle "Express Service" ON
5. Add items to order
6. Verify express prices are used
7. Verify tax is calculated on express prices

**Expected Results:**
- Express prices are used (not standard)
- Prices match express price list
- Tax calculated on express prices
- Totals are correct

### Scenario 4: Price Calculation - B2B Pricing

**Objective:** Verify B2B customers get B2B pricing

**Priority:** High

**Test Steps:**
1. Create a B2B price list
2. Add products with B2B prices (lower than standard)
3. Create a new order
4. Select B2B customer
5. Add items to order
6. Verify B2B prices are used
7. Verify standard prices are NOT used

**Expected Results:**
- B2B prices are applied automatically
- Prices match B2B price list
- Standard prices are not used

### Scenario 5: Price Calculation - VIP Pricing

**Objective:** Verify VIP customers get VIP pricing

**Priority:** High

**Test Steps:**
1. Create a VIP price list
2. Add products with VIP prices
3. Create a new order
4. Select VIP customer
5. Add items to order
6. Verify VIP prices are used

**Expected Results:**
- VIP prices are applied automatically
- Prices match VIP price list

### Scenario 6: Quantity Tier Pricing

**Objective:** Verify different prices based on quantity

**Priority:** Medium

**Test Steps:**
1. Create a price list
2. Add product with quantity tiers:
   - 1-10 items: 5.500 OMR
   - 11-50 items: 5.000 OMR
   - 51+ items: 4.500 OMR
3. Create order
4. Add 5 items → Verify price is 5.500
5. Change to 15 items → Verify price is 5.000
6. Change to 60 items → Verify price is 4.500

**Expected Results:**
- Correct tier price is used for each quantity
- Price updates when quantity changes
- Total = price × quantity

### Scenario 7: Discount Application

**Objective:** Verify discounts are applied correctly

**Priority:** Medium

**Test Steps:**
1. Create a price list
2. Add product with:
   - Price: 10.000 OMR
   - Discount: 15%
3. Create order
4. Add 1 item
5. Verify:
   - Base price: 10.000
   - Discount: 15% (1.500)
   - Final price: 8.500

**Expected Results:**
- Discount calculated correctly
- Final price = base price × (1 - discount/100)
- Tax calculated on final price

### Scenario 8: Price Override - With Permission

**Objective:** Verify price override works for authorized users

**Priority:** High

**Test Steps:**
1. Login as user with `pricing:override` permission
2. Create a new order
3. Add an item (price: 5.500 OMR)
4. Click Edit icon on the item
5. Price Override modal opens
6. Enter override price: 4.000 OMR
7. Enter reason: "Special customer discount - 10+ year customer"
8. Click Apply Override
9. Verify:
   - Item shows "Override" badge
   - Price is 4.000 OMR
   - Tax recalculated on 4.000
   - Total updated

**Expected Results:**
- Modal opens successfully
- Override price accepted
- Badge displayed on item
- Tax recalculated
- Reason saved

### Scenario 9: Price Override - Without Permission

**Objective:** Verify price override is blocked for unauthorized users

**Priority:** High

**Test Steps:**
1. Login as user WITHOUT `pricing:override` permission
2. Create a new order
3. Add an item
4. Click Edit icon on the item
5. Verify modal shows permission denied message
6. Verify override cannot be applied

**Expected Results:**
- Permission denied message displayed
- Override cannot be saved
- User informed to contact administrator

### Scenario 10: Tax Configuration

**Objective:** Verify tax rate configuration

**Priority:** High

**Test Steps:**
1. Navigate to Settings > Finance
2. View current tax rate
3. Change tax rate to 0.10 (10%)
4. Save
5. Create a new order
6. Add items (subtotal: 100.000 OMR)
7. Verify tax is 10.000 OMR (10%)
8. Verify total is 110.000 OMR

**Expected Results:**
- Tax rate saved successfully
- Tax calculated correctly on new orders
- Existing orders keep old tax rate

### Scenario 11: Bulk Import - Valid Data

**Objective:** Verify CSV import works with valid data

**Priority:** Medium

**Test Steps:**
1. Create a price list
2. Click Bulk Import
3. Download template
4. Fill template:
   ```
   product_code,price,discount_percent,min_quantity,max_quantity
   SHIRT-001,5.500,10.0,1,10
   PANTS-001,8.000,0.0,1,
   JACKET-001,12.000,15.0,1,5
   ```
5. Upload CSV
6. Review preview (should show all green)
7. Click Import
8. Verify products added to price list

**Expected Results:**
- Template downloads correctly
- Preview shows valid items
- Import succeeds
- Products appear in price list with correct prices

### Scenario 12: Bulk Import - Invalid Data

**Objective:** Verify CSV import handles errors correctly

**Priority:** Medium

**Test Steps:**
1. Create a price list
2. Click Bulk Import
3. Upload CSV with errors:
   ```
   product_code,price,discount_percent,min_quantity,max_quantity
   INVALID-CODE,5.500,10.0,1,10  # Product doesn't exist
   PANTS-001,invalid,0.0,1,       # Invalid price
   JACKET-001,12.000,150.0,1,5    # Invalid discount (>100)
   ```
4. Review preview
5. Verify errors are shown
6. Verify invalid rows are skipped
7. Import valid rows only

**Expected Results:**
- Errors clearly displayed
- Invalid rows marked in red
- Valid rows can be imported
- Error messages are helpful

### Scenario 13: Bulk Export

**Objective:** Verify CSV export works correctly

**Priority:** Low

**Test Steps:**
1. Create a price list with 5+ products
2. Click Export
3. Download CSV file
4. Open CSV in spreadsheet
5. Verify:
   - All products included
   - Prices are correct
   - Format matches template
   - Can be re-imported

**Expected Results:**
- CSV downloads successfully
- All data included
- Format is correct
- Can be re-imported without errors

### Scenario 14: Price History - View Changes

**Objective:** Verify price history tracking

**Priority:** Medium

**Test Steps:**
1. Create a price list
2. Add a product (price: 5.500 OMR)
3. Open price list > History tab
4. Verify no history yet (or initial entry)
5. Edit product price to 6.000 OMR
6. Save
7. Refresh History tab
8. Verify:
   - New entry appears
   - Shows old price: 5.500
   - Shows new price: 6.000
   - Shows user who made change
   - Shows timestamp

**Expected Results:**
- History entry created automatically
- Old and new prices shown
- User information displayed
- Timestamp accurate

### Scenario 15: Price History - Filters

**Objective:** Verify price history filtering

**Priority:** Low

**Test Steps:**
1. Open price list with history
2. Go to History tab
3. Set date filter: Last 30 days
4. Verify only recent changes shown
5. Set entity type filter: Price List Item
6. Verify only price list changes shown
7. Clear filters
8. Verify all history shown

**Expected Results:**
- Filters work correctly
- Results update when filters change
- Clear filters resets view

### Scenario 16: Fallback to Default Price

**Objective:** Verify system uses default price when no price list price exists

**Priority:** High

**Test Steps:**
1. Create a product with default price: 10.000 OMR
2. Do NOT add it to any price list
3. Create a new order
4. Add the product
5. Verify price is 10.000 OMR (default)
6. Verify source shows "Product Default"

**Expected Results:**
- Default price is used
- No errors occur
- Price source indicator shows correctly

### Scenario 17: Multiple Price Lists - Priority

**Objective:** Verify priority system works

**Priority:** Medium

**Test Steps:**
1. Create two standard price lists:
   - List A: Priority 10, Product price: 5.000 OMR
   - List B: Priority 5, Product price: 6.000 OMR
2. Both active, both include same product
3. Create order
4. Add product
5. Verify price is 5.000 OMR (from List A - higher priority)

**Expected Results:**
- Higher priority list is used
- Lower priority list is ignored
- Price matches higher priority list

### Scenario 18: Effective Date Range

**Objective:** Verify price lists respect effective dates

**Priority:** Medium

**Test Steps:**
1. Create price list:
   - Effective From: Tomorrow
   - Effective To: Next week
2. Create order today
3. Add product from this price list
4. Verify default price is used (list not yet active)
5. Change system date to tomorrow (or wait)
6. Create new order
7. Add same product
8. Verify price list price is used

**Expected Results:**
- Inactive price lists are not used
- Active price lists are used
- Date ranges work correctly

### Scenario 19: Price List Deactivation

**Objective:** Verify deactivated price lists are not used

**Priority:** Medium

**Test Steps:**
1. Create active price list with products
2. Create order, verify prices work
3. Deactivate price list
4. Create new order
5. Add same products
6. Verify default prices are used (list inactive)

**Expected Results:**
- Deactivated lists are not used
- System falls back to defaults
- No errors occur

### Scenario 20: Order Total Calculation

**Objective:** Verify order totals are calculated correctly

**Priority:** High

**Test Steps:**
1. Create order
2. Add items:
   - Item 1: 5.500 OMR × 2 = 11.000 OMR
   - Item 2: 8.000 OMR × 1 = 8.000 OMR
   - Item 3: 10.000 OMR × 3 = 30.000 OMR (with 10% discount = 27.000)
3. Verify:
   - Subtotal: 11.000 + 8.000 + 27.000 = 46.000 OMR
   - Tax (5%): 2.300 OMR
   - Total: 48.300 OMR

**Expected Results:**
- Subtotal calculated correctly
- Tax calculated on subtotal
- Total = subtotal + tax
- All calculations accurate

## Step-by-Step Test Cases

### Test Case 1: Complete Order Flow with Pricing

**Objective:** End-to-end test of order creation with pricing

**Steps:**

1. **Setup**
   - Login as admin
   - Create test products (if not exists)
   - Create standard price list
   - Add products to price list

2. **Create Order**
   - Navigate to Orders > New Order
   - Select customer
   - Add items:
     - Product 1: Quantity 2
     - Product 2: Quantity 1
     - Product 3: Quantity 3

3. **Verify Pricing**
   - Check each item price matches price list
   - Verify subtotal = sum of item totals
   - Verify tax = subtotal × tax rate
   - Verify total = subtotal + tax

4. **Submit Order**
   - Click Submit Order
   - Complete payment
   - Verify order created successfully

5. **Verify Order Details**
   - Open created order
   - Verify prices match what was shown
   - Verify tax amount is correct
   - Verify total is correct

**Expected Results:**
- All prices correct
- Tax calculated correctly
- Order created successfully
- Order details match creation screen

### Test Case 2: Price Override Flow

**Objective:** Test complete price override workflow

**Steps:**

1. **Setup**
   - Login as user with override permission
   - Create order with items

2. **Override Price**
   - Click Edit on an item
   - Note calculated price (e.g., 5.500 OMR)
   - Enter override price: 4.000 OMR
   - Enter reason: "Special discount for loyal customer"
   - Click Apply Override

3. **Verify Override**
   - Item shows "Override" badge
   - Price shows 4.000 OMR
   - Hover badge shows reason
   - Tax recalculated on 4.000
   - Total updated

4. **Submit Order**
   - Complete order
   - Verify override saved in order

5. **Verify Audit Trail**
   - Open order details
   - Verify override price is stored
   - Verify override reason is stored
   - Verify override_by user is stored

**Expected Results:**
- Override applied successfully
- Badge displayed
- Tax recalculated
- Audit trail complete

### Test Case 3: Bulk Import Workflow

**Objective:** Test complete bulk import process

**Steps:**

1. **Prepare Data**
   - Create price list
   - Prepare CSV file with 10 products

2. **Import**
   - Click Bulk Import
   - Download template (verify format)
   - Fill template with test data
   - Upload CSV

3. **Review Preview**
   - Check all items show green (valid)
   - Verify prices are correct
   - Check for any warnings

4. **Import**
   - Click Import
   - Wait for completion
   - Verify success message

5. **Verify Results**
   - Check price list items
   - Verify all products added
   - Verify prices are correct
   - Verify quantity tiers (if any)

**Expected Results:**
- Import succeeds
- All products added
- Prices correct
- No data loss

## Edge Cases

### Edge Case 1: Zero Price

**Test:** Product with 0.000 OMR price

**Steps:**
1. Add product to price list with price: 0.000
2. Create order
3. Add product
4. Verify system handles 0 price correctly

**Expected:** System accepts 0 price, tax is 0, total is 0

### Edge Case 2: Very High Price

**Test:** Product with very high price (100,000+ OMR)

**Steps:**
1. Add product with price: 100,000.000 OMR
2. Create order
3. Add product
4. Verify calculations work correctly

**Expected:** System handles large numbers, calculations accurate

### Edge Case 3: Negative Quantity

**Test:** Attempt to set negative quantity

**Steps:**
1. Create order
2. Try to set quantity to -1
3. Verify system prevents negative quantity

**Expected:** System rejects negative quantity, shows error

### Edge Case 4: Decimal Precision

**Test:** Prices with many decimal places

**Steps:**
1. Add product with price: 5.123456 OMR
2. Create order
3. Verify price displays correctly (rounded to 3 decimals)

**Expected:** Price rounded to 3 decimal places (5.123)

### Edge Case 5: Override to Zero

**Test:** Override price to 0.000 OMR

**Steps:**
1. Create order with item
2. Override price to 0.000
3. Enter reason
4. Apply override
5. Verify system accepts 0 override

**Expected:** System accepts 0 override, tax is 0

### Edge Case 6: Override Higher Than Calculated

**Test:** Override price higher than calculated price

**Steps:**
1. Create order with item (price: 5.500)
2. Override to 10.000
3. Verify system accepts higher override

**Expected:** System accepts higher override, shows increase percentage

### Edge Case 7: Multiple Overrides

**Test:** Override same item multiple times

**Steps:**
1. Create order with item
2. Override price (first time)
3. Override price again (second time)
4. Verify latest override is used

**Expected:** Latest override replaces previous, history shows all changes

### Edge Case 8: Price List Without Products

**Test:** Create order when price list has no products

**Steps:**
1. Create empty price list
2. Create order
3. Add product not in any price list
4. Verify default price is used

**Expected:** System uses default price, no errors

### Edge Case 9: Concurrent Price Updates

**Test:** Two users update same price simultaneously

**Steps:**
1. User A opens price list item for editing
2. User B opens same item for editing
3. User A saves price: 5.500
4. User B saves price: 6.000
5. Verify both changes are saved
6. Verify history shows both changes

**Expected:** Last save wins, both changes in history

### Edge Case 10: Special Characters in Reason

**Test:** Override reason with special characters

**Steps:**
1. Create order
2. Override price
3. Enter reason: "Special discount - 10% off! Customer #123"
4. Save
5. Verify reason saved correctly

**Expected:** Special characters handled correctly, reason displays properly

## Integration Tests

### Integration Test 1: Pricing + Order Creation

**Objective:** Verify pricing integrates correctly with order creation

**Steps:**
1. Create order via API
2. Add items with prices
3. Verify prices calculated correctly
4. Submit order
5. Verify order saved with correct prices

**Expected:** Order created with correct pricing

### Integration Test 2: Pricing + Payment

**Objective:** Verify pricing integrates with payment processing

**Steps:**
1. Create order with items
2. Calculate total
3. Process payment
4. Verify payment amount matches order total
5. Verify payment recorded correctly

**Expected:** Payment amount matches order total

### Integration Test 3: Pricing + Reporting

**Objective:** Verify pricing data available in reports

**Steps:**
1. Create multiple orders with different prices
2. Generate sales report
3. Verify prices included in report
4. Verify totals match orders

**Expected:** Reports show correct pricing data

## Performance Tests

### Performance Test 1: Large Price List

**Test:** Price list with 1000+ products

**Steps:**
1. Create price list
2. Import 1000 products via CSV
3. Measure import time
4. Create order
5. Add products
6. Measure price lookup time

**Expected:** 
- Import completes in < 30 seconds
- Price lookup < 100ms per product

### Performance Test 2: Multiple Price Lists

**Test:** System with 50+ active price lists

**Steps:**
1. Create 50 price lists
2. Create order
3. Measure time to determine price list
4. Verify performance acceptable

**Expected:** Price list determination < 200ms

### Performance Test 3: Price History Query

**Test:** Price history with 10,000+ entries

**Steps:**
1. Generate 10,000 price history entries
2. Query price history with filters
3. Measure query time
4. Verify results returned quickly

**Expected:** Query completes in < 2 seconds

## Regression Tests

### Regression Test 1: Existing Orders

**Test:** Verify existing orders not affected by price changes

**Steps:**
1. Create and submit order (price: 5.500)
2. Change price list price to 6.000
3. Open existing order
4. Verify price still 5.500 (unchanged)

**Expected:** Existing orders keep original prices

### Regression Test 2: Price List Changes

**Test:** Verify price changes don't break existing functionality

**Steps:**
1. Create order with items
2. Change prices in price list
3. Create new order
4. Verify new prices used
5. Verify old order unchanged

**Expected:** New orders use new prices, old orders unchanged

## Test Checklist

### Pre-Release Checklist

- [ ] All high-priority scenarios tested
- [ ] All medium-priority scenarios tested
- [ ] Edge cases tested
- [ ] Integration tests passed
- [ ] Performance tests passed
- [ ] Regression tests passed
- [ ] No critical bugs found
- [ ] Documentation reviewed
- [ ] User acceptance testing completed

### Feature-Specific Checklist

**Price Lists:**
- [ ] Create price list
- [ ] Edit price list
- [ ] Delete price list
- [ ] Add products to price list
- [ ] Remove products from price list
- [ ] Set price list priority
- [ ] Set effective dates

**Price Calculation:**
- [ ] Standard pricing
- [ ] Express pricing
- [ ] B2B pricing
- [ ] VIP pricing
- [ ] Quantity tiers
- [ ] Discounts
- [ ] Tax calculation
- [ ] Fallback to default

**Price Override:**
- [ ] Override with permission
- [ ] Override without permission
- [ ] Override validation
- [ ] Override audit trail

**Bulk Operations:**
- [ ] CSV import (valid data)
- [ ] CSV import (invalid data)
- [ ] CSV export
- [ ] Template download

**Price History:**
- [ ] History tracking
- [ ] History filters
- [ ] History export
- [ ] User name resolution

**Tax Configuration:**
- [ ] Set tax rate
- [ ] Change tax rate
- [ ] Tax calculation
- [ ] Tax on new orders

## Test Data Templates

### CSV Import Template

```csv
product_code,price,discount_percent,min_quantity,max_quantity
SHIRT-001,5.500,10.0,1,10
PANTS-001,8.000,0.0,1,
JACKET-001,12.000,15.0,1,5
DRESS-001,10.000,5.0,1,
SUIT-001,20.000,20.0,1,3
```

### Test Order Template

```json
{
  "customerId": "customer-uuid",
  "items": [
    {
      "productId": "product-1-uuid",
      "quantity": 2
    },
    {
      "productId": "product-2-uuid",
      "quantity": 1
    }
  ],
  "express": false,
  "notes": "Test order"
}
```

## Reporting Issues

When reporting bugs, include:

1. **Test Scenario:** Which scenario failed
2. **Steps to Reproduce:** Exact steps taken
3. **Expected Result:** What should happen
4. **Actual Result:** What actually happened
5. **Screenshots:** If applicable
6. **Browser/Environment:** Browser, OS, user role
7. **Test Data:** Products, customers used

## Test Environment

- **URL:** [Test environment URL]
- **Test Tenant:** [Tenant name/ID]
- **Test Users:** [List of test users with roles]
- **Test Products:** [List of test products]

## Additional Resources

- [User Guide](./USER_GUIDE.md) - For user-facing features
- [Developer Guide](./DEVELOPER_GUIDE.md) - For technical details
- [README.md](./README.md) - Feature overview


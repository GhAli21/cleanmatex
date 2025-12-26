# PRD-003: Customer Management - User Guide

Quick reference for using the customer management system.

---

## Accessing Customer Management

Navigate to: **Dashboard > Customers** or `/dashboard/customers`

---

## Quick Customer Creation (POS)

**For walk-in customers at the counter:**

1. Click **"Add Customer"** button
2. Select **"Stub"** type (recommended for POS)
3. Enter customer name
4. Enter phone number (e.g., 90123456)
5. Click **"Create Customer"**
6. ✅ Done in < 30 seconds!

**Customer Types:**
- **Guest**: No contact info (one-time use)
- **Stub**: Name + Phone (quick POS, can upgrade later)
- **Full**: Complete profile with app access (requires OTP)

---

## Finding Customers

### Search Bar
- Type name, phone, email, or customer number
- Results update automatically (300ms delay)
- Clear with ✕ button

### Filters
- **Type**: Guest / Stub / Full
- **Status**: Active / Inactive
- **Sort**: Newest, Name, Recent Order, Most Orders

### Statistics Cards
View at-a-glance metrics:
- Total customers
- Full profiles
- Stub profiles
- New this month

---

## Customer Details

Click **"View"** on any customer to see:

### Profile Tab
- Basic information
- Contact details
- Customer type badge
- Edit profile inline
- **Upgrade button** (for stub customers)

### Addresses Tab
- All saved addresses
- Add new address
- Edit/delete existing
- Set default address

### Orders Tab
- Order history
- Order status
- Total spent
- Last order date

### Loyalty Tab
- Points balance
- Points history
- Rewards available

---

## Managing Addresses

### Add Address
1. Go to customer detail > Addresses tab
2. Click **"Add Address"**
3. Fill form:
   - Type: Home / Work / Other
   - Building, Street, Area, City
   - Optional: GPS coordinates
   - Delivery notes
4. Set as default (optional)
5. Save

### Edit/Delete
- Click pencil icon to edit
- Click trash icon to delete
- Confirm action

---

## Upgrading Profiles

**Convert Stub → Full Profile:**

1. Open customer detail
2. Click **"Upgrade to Full Profile"**
3. System sends OTP to customer's phone
4. Enter 6-digit code
5. Add email (optional)
6. Click **"Upgrade Profile"**

**Benefits:**
- Mobile app access
- Loyalty points
- Saved preferences
- Order notifications

---

## Exporting Data

1. Click **"Export CSV"** button
2. File downloads with current filters applied
3. Open in Excel/Google Sheets

**Exported Fields:**
- Customer number
- Name
- Contact info
- Type, status
- Loyalty points
- Total orders
- Last order date

---

## Admin Features

### Merge Duplicate Customers

**When needed:** Same person has multiple profiles

1. Find both customer records
2. Note IDs of source and target
3. Use merge API endpoint (admin only)
4. All orders and points transferred
5. Source customer deactivated

### Deactivate Customer

**Caution:** Cannot be undone

1. Open customer detail
2. Admin actions > Deactivate
3. Confirm action
4. Customer marked inactive (soft delete)

---

## Tips & Best Practices

✅ **Use Stub for POS** - Fastest checkout
✅ **Search before creating** - Avoid duplicates
✅ **Encourage Full profiles** - Better retention
✅ **Keep addresses updated** - Accurate delivery
✅ **Export regularly** - Backup customer data

❌ **Don't create duplicates** - Use search first
❌ **Don't delete addresses** - Customer may need history
❌ **Don't share phone numbers** - Privacy compliance

---

## Common Issues

**"Customer already exists"**
→ Search for existing customer instead

**"Invalid phone number"**
→ Use format: +968 90123456

**"OTP expired"**
→ Request new code (60s cooldown)

**"Access denied"**
→ Check user permissions (admin features)

---

## Keyboard Shortcuts

- **/** - Focus search
- **Esc** - Close modal
- **Enter** - Submit form

---

## Support

For technical issues, see `API_TESTING.md` or contact support.

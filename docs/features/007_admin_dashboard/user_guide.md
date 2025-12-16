---
version: v1.0.0
last_updated: 2025-10-31
author: CleanMateX Development Team
---

# User Guide - PRD-007 Admin Dashboard

## Welcome to CleanMateX Admin Dashboard

This guide will help you navigate and use the CleanMateX Admin Dashboard effectively. Whether you're a business owner, manager, or staff member, this guide covers all the features you need.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Home](#dashboard-home)
3. [Quick Actions](#quick-actions)
4. [Managing Orders](#managing-orders)
5. [Managing Customers](#managing-customers)
6. [Settings](#settings)
7. [Reports & Analytics](#reports--analytics)
8. [Language & Interface](#language--interface)
9. [Tips & Shortcuts](#tips--shortcuts)
10. [FAQ](#faq)

---

## Getting Started

### Logging In

1. Navigate to the CleanMateX admin portal
2. Enter your email and password
3. Click "Sign In"
4. You'll be directed to the Dashboard

### First Time Setup

After logging in for the first time:

1. Complete your business profile in **Settings → General**
2. Upload your logo in **Settings → Branding**
3. Set your business hours in **Settings → General**
4. Invite team members in **Settings → Users**

---

## Dashboard Home

### Overview

The dashboard provides a real-time view of your business:

```
┌─────────────────────────────────────────────────┐
│  🏠 Dashboard                          EN | عربي │
├─────────────────────────────────────────────────┤
│                                                  │
│  📊 Today's Orders: 45    💰 Revenue: $1,250    │
│  🚚 Out for Delivery: 12  ⏱️  Avg TAT: 48h     │
│                                                  │
│  📈 Revenue Chart      📋 Order Status          │
│  📦 Top Services       ⚠️  Alerts               │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Widgets Explained

#### 1. Orders Today
- Shows total orders received today
- Green arrow: increase from yesterday
- Red arrow: decrease from yesterday
- Click to view all today's orders

#### 2. Order Status
- **In Process**: Orders being worked on
- **Ready**: Orders ready for pickup/delivery
- **Out for Delivery**: Orders with drivers

#### 3. Revenue Widget
- Today's revenue
- Month-to-date revenue
- Last 30 days revenue
- Trend chart

#### 4. Turnaround Time
- Average time from intake to ready
- On-time delivery percentage
- Click for detailed report

#### 5. Delivery Rate
- Successful deliveries
- Pending deliveries
- Failed deliveries

#### 6. Issues Tracker
- Open issues requiring attention
- Critical issues highlighted in red
- Click to view details

#### 7. Payment Mix
- Cash payments
- Online payments
- Card payments
- Distribution pie chart

#### 8. Driver Utilization
- Drivers currently active
- Average deliveries per driver
- Utilization rate

#### 9. Top Services
- Most popular services
- Bar chart showing volume
- Helps with inventory planning

#### 10. System Alerts
- Important notifications
- Overdue orders
- Low inventory alerts
- System messages

---

## Quick Actions

Located at the top of most pages, Quick Actions provide fast access to common tasks:

### New Order
Click to create a new order quickly:
1. Enter customer phone number
2. System finds or creates customer
3. Add service items
4. Set pickup/delivery details
5. Generate invoice

### Quick Search
Search across:
- Order numbers
- Customer names
- Phone numbers
- Invoices

Type and press Enter to see results.

### Other Quick Actions
- **Orders**: View all orders
- **Customers**: Access customer list
- **Reports**: Open reports dashboard
- **Settings**: Configure system

---

## Managing Orders

### Viewing Orders

**Navigation**: Dashboard → Orders

#### Filter Orders
Use the filters bar to narrow down orders:

1. **Date Range**: Select from/to dates
2. **Branch**: Filter by specific branch
3. **Status**: Multiple status selection
   - Pending
   - Processing
   - Ready
   - Delivered
4. **Priority**: Normal, Urgent, Express

Click "Clear Filters" to reset.

#### Order List View

Each order shows:
- Order number (e.g., #ORD-2024-001)
- Customer name
- Status badge (color-coded)
- Total amount
- Ready by date
- Actions menu

### Creating an Order

**Path**: Dashboard → Orders → New Order

**Step-by-Step**:

1. **Customer Selection**
   - Enter phone number
   - Select existing customer or create new
   - Verify customer details

2. **Add Services**
   - Click "Add Item"
   - Select service type (Wash & Iron, Dry Clean, etc.)
   - Choose garment type (Shirt, Pants, Dress, etc.)
   - Enter quantity
   - System calculates price automatically

3. **Additional Details**
   - Mark as Express (if rush service)
   - Add special instructions
   - Upload photos (optional)
   - Add customer notes

4. **Pricing & Payment**
   - Review subtotal
   - Apply discount (if applicable)
   - Add tax
   - Select payment method
   - Collect payment

5. **Finalize**
   - Click "Create Order"
   - Print receipt
   - Print item labels
   - Give receipt to customer

### Order Details

Click any order to view complete details:

#### Tabs Available:
- **Overview**: Order summary, customer info
- **Items**: List of all items with status
- **Timeline**: Order progress tracking
- **Payments**: Payment history
- **Notes**: Customer and internal notes
- **Photos**: Item photos

#### Actions Available:
- Update status
- Add/remove items
- Modify pricing
- Schedule delivery
- Print labels
- Send notifications
- Cancel order

### Order Status Workflow

```
Intake → Preparation → Processing → Ready → Out for Delivery → Delivered
```

**Status Descriptions**:
- **Intake**: Order received, items logged
- **Preparation**: Items being sorted and tagged
- **Processing**: Items being washed/cleaned
- **Ready**: Items complete, waiting for pickup
- **Out for Delivery**: Driver has items
- **Delivered**: Customer received items

---

## Managing Customers

### Customer List

**Navigation**: Dashboard → Customers

#### Customer View Options
- **List View**: Table with key details
- **Stats Cards**: Total customers, active, new

#### Filter Customers
- Search by name, phone, or email
- Filter by customer type (Guest, Stub, Full Profile)
- Filter by status (Active/Inactive)

### Customer Details

Click a customer to view:

#### Profile Tab
- Personal information
- Contact details
- Phone verification status
- Language preference
- Account status

#### Addresses Tab
- Delivery addresses
- Set default address
- Add new address
- Edit existing address

#### Orders Tab
- Order history
- Total orders count
- Total amount spent
- Last order date

#### Loyalty Tab
- Current points balance
- Points earned/redeemed
- Transaction history

### Adding a Customer

**Path**: Dashboard → Customers → Add Customer

**Quick Add**:
1. Phone number (required)
2. First name
3. Last name
4. Email (optional)

**Full Profile**:
Additional fields:
- Language preference
- Folding preference
- Fragrance preference
- Delivery notes

### Customer Types

1. **Guest**
   - One-time customer
   - Minimal information
   - No account access

2. **Stub Profile**
   - Phone number only
   - Can track orders
   - No app access

3. **Full Profile**
   - Complete information
   - App access
   - Loyalty points
   - Order history

### Upgrading Customer Profiles

**Stub → Full Profile**:
1. Open customer details
2. Click "Upgrade to Full"
3. Complete missing information
4. Send invitation to app

---

## Settings

### General Settings

**Path**: Dashboard → Settings → General

#### Business Information
- Business name (English & Arabic)
- Email address
- Phone number
- Physical address
- City and country

#### Business Hours
Configure operating hours for each day:

1. Click on a day
2. Set opening time
3. Set closing time
4. Check "Closed" for days off
5. Use "Copy to All" to apply to all days

**Example**:
- Monday-Friday: 9:00 AM - 6:00 PM
- Saturday: 9:00 AM - 2:00 PM
- Sunday: Closed

#### Regional Settings
- **Timezone**: Asia/Muscat (GMT+4)
- **Currency**: OMR (Omani Rial)
- **Language**: English or Arabic

Click "Save Changes" when done.

### Branding Settings

**Path**: Dashboard → Settings → Branding

#### Logo Upload
1. Click "Choose File"
2. Select logo image (PNG or JPG)
3. Max size: 2MB
4. Recommended: 400x400px
5. Preview appears immediately

#### Brand Colors
Customize your brand colors:

1. **Primary Color**
   - Main interface color
   - Buttons, links, highlights
   - Click color box to choose

2. **Secondary Color**
   - Supporting elements
   - Badges, tags

3. **Accent Color**
   - Special highlights
   - Calls to action

**Live Preview**:
See how colors look before saving:
- Button previews
- Card previews
- Text examples

### Users & Team Management

**Path**: Dashboard → Settings → Users

#### Team Member List

View all team members:
- Name and email
- Role (Owner, Manager, Staff)
- Status (Active, Pending, Inactive)
- Join date

#### Inviting Users

**Steps**:
1. Click "Invite User"
2. Enter email address
3. Select role:
   - **Owner**: Full access, billing
   - **Manager**: Operations, reports, settings
   - **Staff**: Orders and customers only
4. Click "Send Invite"
5. User receives email invitation

#### Managing Team Members

**Actions Available**:
- Change role
- Deactivate user
- Resend invitation
- Remove user

**Role Permissions**:

| Feature | Owner | Manager | Staff |
|---------|-------|---------|-------|
| Dashboard | ✅ | ✅ | ✅ |
| Orders | ✅ | ✅ | ✅ |
| Customers | ✅ | ✅ | ✅ |
| Settings | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Users | ✅ | ❌ | ❌ |
| Billing | ✅ | ❌ | ❌ |

### Subscription Management

**Path**: Dashboard → Settings → Subscription

#### Current Plan Display
View your active subscription:
- Plan name (Starter, Growth, Professional)
- Monthly cost
- Next billing date
- Payment method

#### Usage Statistics

Monitor your usage:

1. **Orders This Month**
   - Current count
   - Plan limit
   - Usage percentage
   - Progress bar

2. **Active Users**
   - Current team size
   - Plan limit
   - Available seats

3. **Branches**
   - Active locations
   - Plan limit

#### Available Plans

Compare and upgrade:

**Starter Plan** ($29/month)
- 500 orders/month
- 3 users
- 1 branch
- Basic reports
- Email support

**Growth Plan** ($79/month)
- 2,000 orders/month
- 10 users
- 3 branches
- Advanced reports
- Priority support
- WhatsApp integration

**Professional Plan** ($199/month)
- Unlimited orders
- Unlimited users
- 10 branches
- Custom reports
- 24/7 support
- API access
- White label

#### Upgrading Your Plan

1. Review available plans
2. Click "Upgrade" on desired plan
3. Review changes
4. Confirm upgrade
5. Billing adjusts automatically

---

## Reports & Analytics

**Path**: Dashboard → Reports

### Revenue Report

View financial performance:

**Chart Display**:
- 7-day revenue trend (line chart)
- Day-by-day breakdown
- Hover for exact amounts

**Key Metrics**:
- Total revenue (period)
- Average order value
- Growth percentage

**Date Range Selection**:
- Today
- Last 7 days
- Last 30 days
- Custom range

### Orders Report

Track order metrics:

**Chart Display**:
- Orders by status (bar chart)
- Completed, processing, pending, cancelled

**Statistics**:
- Total orders
- Completion rate
- Average processing time
- Cancellation rate

### SLA (Service Level Agreement) Report

Monitor service quality:

**Metrics**:

1. **Average Turnaround Time**
   - Time from intake to ready
   - Target: 48 hours
   - Current performance

2. **On-Time Delivery**
   - Percentage delivered on time
   - Target: 95%
   - Current performance

3. **Average Response Time**
   - Time to respond to inquiries
   - Target: 2 hours
   - Current performance

### Exporting Reports

**Options**:
1. **Export CSV**
   - Opens in Excel
   - All data included
   - For further analysis

2. **Export PDF**
   - Professional format
   - Ready to share
   - Includes charts

**Steps**:
1. Select date range
2. Click "Export CSV" or "Export PDF"
3. Choose save location
4. File downloads automatically

---

## Language & Interface

### Switching Languages

**Two Languages Available**:
- English (EN)
- Arabic (العربية)

**How to Switch**:
1. Click language selector in top bar
2. Choose your language
3. Page reloads in selected language
4. Preference is saved

### RTL (Right-to-Left) Support

**For Arabic Users**:
- Interface automatically mirrors
- Text aligns to the right
- Navigation on the right side
- All buttons and forms adapt

**Arabic Features**:
- Native Arabic fonts
- Proper number formatting
- Date formatting (Arabic calendar)
- Currency display (Arabic numerals)

---

## Tips & Shortcuts

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl + N | New Order |
| Ctrl + F | Quick Search |
| Ctrl + S | Save (in forms) |
| Esc | Close modal |

### Time-Saving Tips

1. **Use Quick Search**
   - Fastest way to find orders
   - Works from any page

2. **Favorite Common Filters**
   - Save time on repeated searches
   - Use URL bookmarks

3. **Bulk Operations**
   - Select multiple orders
   - Update status at once

4. **Print in Batches**
   - Print multiple labels together
   - Print multiple receipts

5. **Use Templates**
   - Create customer templates
   - Save common service packages

### Best Practices

1. **Daily Routine**
   - Check dashboard first
   - Review overdue orders
   - Check alerts
   - Plan deliveries

2. **Customer Service**
   - Always verify customer details
   - Add notes for special requests
   - Take photos of items
   - Communicate delivery times

3. **Order Management**
   - Update status promptly
   - Use preparation screen
   - Print labels immediately
   - Scan items at each stage

4. **End of Day**
   - Review revenue
   - Check pending payments
   - Schedule next day deliveries
   - Review alerts

---

## FAQ

### General Questions

**Q: How do I reset my password?**
A: Click "Forgot Password" on login page, enter email, follow reset link.

**Q: Can I access the dashboard on mobile?**
A: Yes, the interface is fully responsive and works on tablets and phones.

**Q: How do I change my language preference?**
A: Click the language selector (EN/AR) in the top right corner.

### Order Management

**Q: Can I edit an order after creation?**
A: Yes, open the order and click "Edit". You can modify items, pricing, and details.

**Q: How do I cancel an order?**
A: Open the order, click "Actions" → "Cancel Order", provide reason, confirm.

**Q: Can I split an order?**
A: Currently not supported. Create a new order for additional items.

**Q: How do I handle lost items?**
A: Mark item as "Lost" in order details, add note, notify customer, process refund.

### Customer Management

**Q: Can customers have multiple addresses?**
A: Yes, add multiple addresses in customer profile. Set one as default.

**Q: How do loyalty points work?**
A: Customers earn points on each order. Points can be redeemed for discounts.

**Q: Can I merge duplicate customers?**
A: Contact support for customer merge requests.

### Payments & Billing

**Q: What payment methods are supported?**
A: Cash, credit/debit cards, online payments, and account credit.

**Q: How do I issue a refund?**
A: Open order → Payments tab → Click "Refund" → Enter amount → Confirm.

**Q: Can I offer discounts?**
A: Yes, apply discounts during order creation or edit existing orders.

### Reports & Analytics

**Q: Can I schedule automated reports?**
A: Currently not available. Export reports manually as needed.

**Q: How accurate are the analytics?**
A: Real-time data, updated continuously. Slight delays (< 5 minutes) during high load.

**Q: Can I export data for accounting?**
A: Yes, export orders and payments as CSV for accounting software.

### Technical Issues

**Q: Dashboard not loading?**
A: Check internet connection, clear browser cache, try different browser.

**Q: Translations missing?**
A: Report to support. Language files are updated regularly.

**Q: Print not working?**
A: Check printer connection, browser print settings, try PDF export first.

**Q: Can't upload logo?**
A: Check file size (max 2MB), format (PNG/JPG), try compressing image.

---

## Getting Help

### Support Channels

1. **Documentation**
   - This user guide
   - Video tutorials (coming soon)
   - Knowledge base

2. **Email Support**
   - support@cleanmatex.com
   - Response time: 24 hours

3. **In-App Help**
   - Click "?" icon
   - Context-sensitive help
   - Search help articles

4. **Training**
   - Request staff training
   - One-on-one sessions available
   - Group training for teams

### Reporting Issues

When reporting a problem, include:
- What you were trying to do
- What happened instead
- Screenshots if possible
- Your browser and device
- Date and time of issue

---

## Appendix

### Glossary

- **TAT**: Turnaround Time
- **SLA**: Service Level Agreement
- **RLS**: Row Level Security
- **RBAC**: Role-Based Access Control
- **RTL**: Right-to-Left (for Arabic)

### Quick Reference Card

**Common Tasks**:
- New Order: Dashboard → Orders → New Order
- Find Customer: Quick Search → Type phone
- Update Status: Order Details → Change Status
- Add User: Settings → Users → Invite User
- View Reports: Dashboard → Reports
- Change Language: Click EN/AR in top bar

---

**Version**: v1.0.0
**Last Updated**: 2025-10-31
**For Support**: support@cleanmatex.com
**Maintained By**: CleanMateX Development Team

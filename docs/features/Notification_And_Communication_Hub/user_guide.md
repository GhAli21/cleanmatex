# CMX-PRD-019 — Notification Hub: User Guide

**Last Updated:** 2026-06-12  
**Audience:** End users (staff, managers, admins) using the CleanMateX web admin  
**Status:** Phases 1–3 + Frontend Track A complete

---

## Overview

The Notification Hub delivers real-time alerts about orders, payments, deliveries, and system events directly in the web admin. Notifications appear in the bell icon in the header and can be managed from the Notification Center.

---

## 1. The Notification Bell

The bell icon (🔔) in the top navigation bar shows the number of unread notifications as a red badge.

**What it shows:**
- Badge count — total unread notifications
- Dropdown — last 20 notifications (compact view)

**How to use:**
1. Click the bell icon to open the dropdown
2. Each row shows: category icon, title (in your language), and relative time
3. Unread items appear with a blue background and a dot on the left
4. Click a notification to mark it as read and navigate to the related page (if applicable)
5. Press **Escape** to close the dropdown
6. Click **"Mark all as read"** to clear all unread at once
7. Click **"View all"** to go to the full Notification Center

**Real-time updates:**  
The bell updates automatically (no page refresh needed) when new notifications arrive. Powered by Supabase Realtime.

---

## 2. Notification Center

**Route:** `/dashboard/notifications`

The full notification history page with filtering and pagination.

### Tabs

| Tab | Shows |
|-----|-------|
| All | All notifications |
| Unread | Only unread notifications |
| Orders | Order-related events (created, ready, cancelled, delayed) |
| Payments | Payment events (received, failed, reminder) |
| System | System alerts and maintenance messages |

### Actions

- **Mark as read** — click the link next to any unread notification
- **Mark all read** — button at the top right
- **Pagination** — navigate between pages of notification history

### Notification Detail

Each notification shows:
- **Icon** — category indicator (shopping bag for orders, credit card for payments, etc.)
- **Title** — in your current language (EN or AR)
- **Body** — descriptive text (on the full page view)
- **Relative time** — "just now", "5 minutes ago", "2 hours ago", etc.
- **Action link** — when available, a link to the related page (e.g., the order detail)

---

## 3. Notification Settings

**Route:** `/dashboard/notifications/settings`

Manage how you receive notifications.

### My Preferences Tab

Available to all users. For each channel:

| Setting | Description |
|---------|-------------|
| Enable channel | Turn on/off all notifications for this channel |
| Marketing consent | Opt in/out of promotional messages (non-transactional) |

**Channels:**
- **In-App** — Alerts inside the web admin (always recommended on)
- **Email** — Sent to your account email address
- **SMS** — Sent to your registered phone number
- **WhatsApp** — Sent to your WhatsApp number
- **Push** — Browser/device push notifications (requires browser permission)

> **Note:** Turning off a channel only affects your own notifications. Transactional alerts (e.g., order confirmations) may override your channel preference depending on tenant settings.

### Channel Settings Tab (Admins only)

Requires `notifications:configure` permission. Manages tenant-wide channel behavior:

- **Enable/Disable channel** — turns a channel on or off for all users in the tenant
- **Quiet Hours** — block non-urgent notifications between set times (e.g., 10 PM to 8 AM)
  - Notifications queued during quiet hours are delivered at quiet hours end
  - URGENT and CRITICAL priority notifications always bypass quiet hours

---

## 4. Delivery Log

**Route:** `/dashboard/notifications/delivery-log`  
**Requires:** `notifications:view_log` permission (admin+)

A table showing the status of every notification sent through any channel.

### Columns

| Column | Description |
|--------|-------------|
| Event | The event code that triggered the notification |
| Channel | IN_APP, EMAIL, SMS, WHATSAPP, or PUSH |
| Recipient | Email / phone / user ID |
| Status | QUEUED, SENT, FAILED, SKIPPED, etc. |
| Retries | How many send attempts were made |
| Date | When the notification was first created |
| Error | Error message or skip reason if not delivered |

### Filter

Use the Channel and Status dropdowns to filter by delivery channel or delivery status.

### Status Legend

| Status | Meaning |
|--------|---------|
| QUEUED | Scheduled, not yet processed |
| PROCESSING | Currently being sent |
| SENT | Successfully delivered |
| FAILED_TEMPORARY | Failed, will retry automatically |
| FAILED_PERMANENT | Failed, will not retry (invalid address, blocked) |
| SKIPPED | Not sent (consent not given, channel disabled, quota exceeded) |
| CANCELLED | Manually cancelled |

---

## 5. Notification Types by Event

| Event | Channel | Who Receives |
|-------|---------|-------------|
| order.created | IN_APP | Staff who created the order, branch manager |
| order.ready | IN_APP + EMAIL | Customer, assigned driver |
| order.cancelled | IN_APP + EMAIL | Customer, branch manager |
| order.delayed | IN_APP + EMAIL | Customer |
| payment.received | IN_APP | Order creator, branch manager |
| payment.failed | IN_APP + EMAIL | Order creator, billing admin |
| system alerts | IN_APP | Admins |

---

## 6. Language Support

All notifications are delivered in your current language setting:
- **English (LTR)** — default
- **Arabic (RTL)** — when the app locale is set to Arabic

The notification bell, center, and settings pages all support RTL layout in Arabic mode.

---

## 7. Frequently Asked Questions

**Q: Why did I not receive an email notification?**  
Check: (1) the EMAIL channel is enabled in your preferences, (2) the tenant admin has EMAIL enabled globally, (3) the delivery log shows the status for your notification.

**Q: Why are some notifications delayed?**  
If quiet hours are configured by your admin, non-urgent notifications sent during quiet hours will be held until quiet hours end.

**Q: What is "marketing consent"?**  
Some notifications (like promotions and campaigns) require your explicit consent to receive. Toggle the "Marketing Consent" switch per channel to opt in or out.

**Q: I turned on Push notifications but they're not arriving.**  
Check: (1) your browser granted notification permission, (2) the push provider is active (admin must configure it), (3) your browser supports Web Push.

**Q: How do I know if a notification was successfully delivered?**  
Admins can check the Delivery Log at `/dashboard/notifications/delivery-log` to see exact delivery status per channel.

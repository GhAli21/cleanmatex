# Test Credentials for Development

## Demo Admin User

**Created:** 2025-10-23
**Purpose:** Development and testing of the CleanMateX web admin interface

### Login Credentials

**Primary (Recommended):**
```
Email:    admin@demo-laundry.example
Password: Admin123
```

**Legacy (Also Works):**
```
Email:    admin@demo-laundry.local
Password: Admin123
```

### Tenant Information

```
Tenant ID:   11111111-1111-1111-1111-111111111111
Tenant Name: Demo Laundry Services
Plan:        Free (Trial)
```

### Access URLs

- **Login:** http://localhost:3000/login
- **Dashboard:** http://localhost:3000/dashboard
- **Supabase Studio:** http://127.0.0.1:54323

---

## Creating Additional Test Users

To create more test users, use the script:

```bash
cd web-admin
node ../scripts/create-test-user.js
```

Or create manually via Supabase Studio:
1. Open http://127.0.0.1:54323
2. Navigate to Authentication > Users
3. Click "Add User"
4. Enter email and password
5. Link to tenant using:

```sql
SELECT create_tenant_admin(
  '<user_id_from_auth_users>',
  '11111111-1111-1111-1111-111111111111',
  'User Display Name'
);
```

---

## Security Notes

⚠️ **IMPORTANT**: These credentials are for **DEVELOPMENT ONLY**

- Do NOT use these credentials in production
- Do NOT commit production credentials to git
- Change all passwords before deploying to production
- Use strong, unique passwords for each environment

---

## Troubleshooting

### "Invalid login credentials" Error

If you get this error:
1. Verify Supabase is running: `supabase status`
2. Check user exists in Supabase Studio > Authentication > Users
3. Verify email is confirmed
4. Check user is linked to tenant in `org_users_mst` table

### User Not Linked to Tenant

Run this query in Supabase Studio SQL Editor:

```sql
SELECT * FROM org_users_mst
WHERE user_id = '<your_user_id>';
```

If no results, link manually:

```sql
INSERT INTO org_users_mst (
  user_id,
  tenant_org_id,
  display_name,
  role,
  is_active
) VALUES (
  '<your_user_id>',
  '11111111-1111-1111-1111-111111111111',
  'Your Name',
  'admin',
  true
);
```

---

## Additional Test Scenarios

### Staff User (Non-Admin)

Create a staff user for testing role-based access:

```bash
# TODO: Create script for staff user creation
# Email: staff@demo-laundry.local
# Password: Staff123!@#
# Role: staff
```

### Manager User

Create a manager user for testing:

```bash
# TODO: Create script for manager user creation
# Email: manager@demo-laundry.local
# Password: Manager123!@#
# Role: manager
```

---

## See Also

- [Authentication Implementation](../../web-admin/lib/auth/README.md)
- [Multi-Tenancy Guide](../../.claude/docs/multitenancy.md)
- [Database Seed Data](../../supabase/migrations/0006_seed_auth_demo.sql)

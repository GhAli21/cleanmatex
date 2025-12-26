# Dynamic Navigation System - Testing Checklist

## Pre-Testing Setup

1. **Run Database Migration**

   ```bash
   # Apply migration
   supabase migration up
   # Or if using Supabase CLI locally
   supabase db reset
   ```

2. **Run Seed Script**

   ```bash
   # Seed navigation data
   psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seeds/0058_navigation_seed.sql
   # Or use Supabase CLI
   supabase db seed
   ```

3. **Verify Database**

   ```sql
   -- Check if table exists
   SELECT COUNT(*) FROM sys_components_cd;

   -- Should return at least 10+ rows
   SELECT comp_code, label, main_permission_code FROM sys_components_cd ORDER BY display_order;
   ```

## Testing Scenarios

### 1. Basic Navigation Loading

- [ ] Login as admin user
- [ ] Verify sidebar loads navigation items
- [ ] Check that navigation items match user permissions
- [ ] Verify icons are displayed correctly
- [ ] Check that navigation is cached (check localStorage)

### 2. Permission-Based Filtering

- [ ] Login as user with limited permissions (e.g., only `orders:read`)
- [ ] Verify only items with matching `main_permission_code` are shown
- [ ] Verify parent items are automatically included (e.g., "Orders" parent shown even if only child has permission)
- [ ] Test with user having no permissions (should see minimal navigation)

### 3. Role-Based Filtering

- [ ] Login as `admin` - verify all admin items visible
- [ ] Login as `operator` - verify operator items visible, admin-only items hidden
- [ ] Login as `viewer` - verify minimal navigation

### 4. Feature Flag Filtering

- [ ] Enable `driver_app` feature flag for tenant
- [ ] Verify "Drivers & Routes" section appears
- [ ] Disable `driver_app` feature flag
- [ ] Verify "Drivers & Routes" section disappears
- [ ] Test with `advanced_analytics` feature flag for Reports

### 5. Parent Chain Building

- [ ] Login as user with `orders:read` permission
- [ ] Verify "Orders" parent section is shown
- [ ] Verify "All Orders" child is shown
- [ ] Verify "Dashboard" (if it's a parent) is shown
- [ ] Test nested hierarchy (Settings > General, etc.)

### 6. Caching Behavior

- [ ] Load navigation (check Network tab - should fetch from API)
- [ ] Refresh page
- [ ] Verify navigation loads from cache (no API call)
- [ ] Wait 15+ minutes or clear cache
- [ ] Verify navigation fetches fresh from API

### 7. Error Handling & Fallback

- [ ] Stop database connection
- [ ] Verify fallback to hardcoded `NAVIGATION_SECTIONS`
- [ ] Check console for error messages
- [ ] Restore database connection
- [ ] Verify navigation switches back to database

### 8. API Endpoint Testing

- [ ] Test `/api/navigation` endpoint directly
- [ ] Verify response structure: `{ sections: [...], cached: boolean, source: string }`
- [ ] Test with different user roles
- [ ] Test with different permission sets
- [ ] Verify unauthorized users get fallback navigation

### 9. Navigation Structure

- [ ] Verify all main sections appear in correct order
- [ ] Verify children are nested correctly
- [ ] Check that `display_order` is respected
- [ ] Verify paths are correct
- [ ] Test navigation links work

### 10. Performance

- [ ] Check initial load time
- [ ] Verify caching improves subsequent loads
- [ ] Test with large permission sets
- [ ] Monitor database query performance

## Expected Behavior

### Admin User (with all permissions)

Should see:

- Dashboard
- Orders (with all children)
- Assembly
- Drivers & Routes (if feature flag enabled)
- Customers
- Catalog & Pricing (with children)
- Invoices & Payments (with children)
- Reports & Analytics (if feature flag enabled)
- Inventory & Machines (with children)
- Settings (with all children)
- Help
- JWT Test

### Operator User (with limited permissions)

Should see:

- Dashboard
- Orders (with children they have permission for)
- Assembly
- Customers
- Invoices & Payments
- Inventory & Machines (limited children)
- Help

### Viewer User (minimal permissions)

Should see:

- Dashboard
- Help (if no permission required)

## Troubleshooting

### Navigation Not Loading

1. Check browser console for errors
2. Verify database migration ran successfully
3. Check seed data exists: `SELECT * FROM sys_components_cd LIMIT 10;`
4. Verify RLS policies allow read access
5. Check API endpoint: `/api/navigation` returns data

### Wrong Items Showing

1. Verify user permissions: Check `get_user_permissions()` RPC
2. Verify user role: Check `get_user_tenants()` RPC
3. Check feature flags: Verify tenant feature flags
4. Check `main_permission_code` values in database

### Cache Issues

1. Clear localStorage: `localStorage.clear()`
2. Check cache key matches permissions hash
3. Verify cache TTL (15 minutes)

### Database Function Issues

1. Test function directly:
   ```sql
   SELECT * FROM get_navigation_with_parents(
     ARRAY['orders:read', 'customers:read']::TEXT[],
     'admin',
     '["driver_app"]'::jsonb
   );
   ```
2. Check function exists: `\df get_navigation_with_parents`
3. Verify function permissions

## Success Criteria

✅ Navigation loads from database  
✅ Items filtered by permissions correctly  
✅ Parent chain built automatically  
✅ Feature flags work correctly  
✅ Caching works as expected  
✅ Fallback to hardcoded navigation on error  
✅ Performance is acceptable  
✅ No console errors

## Notes

- Navigation is cached for 15 minutes client-side
- Database function uses recursive CTE for parent chain
- Fallback to hardcoded navigation ensures app always works
- Icons are mapped from database strings to Lucide components

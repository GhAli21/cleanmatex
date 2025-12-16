---
name: Dynamic Navigation System
overview: Load navigation items from sys_components_cd table based on user permissions. If user has main_permission_code, display the item and all its parent items. System-only (no tenant customization).
todos:
  - id: "1"
    content: Create database migration for sys_components_cd table with RLS policies
    status: completed
  - id: "2"
    content: Create seed script to populate sys_components_cd from NAVIGATION_SECTIONS
    status: completed
  - id: "3"
    content: Create navigation service to fetch and filter by main_permission_code
    status: completed
  - id: "4"
    content: Create GET /api/navigation endpoint with permission-based filtering
    status: completed
  - id: "5"
    content: Create useNavigation hook for client-side fetching and caching
    status: completed
  - id: "6"
    content: Update Sidebar component to use API instead of hardcoded config
    status: completed
  - id: "7"
    content: Add client-side navigation caching utilities
    status: completed
---

# Dynamic Navigation System Implementation Plan

## Overview

Load navigation items from `sys_components_cd` table based on user permissions:

- If user has `main_permission_code`, display the item
- Automatically include all parent items (build full path to root)
- System-only navigation (no tenant customization)
- Fallback to hardcoded `NAVIGATION_SECTIONS` if database fails

## Database Schema

### Table: `sys_components_cd`

**Location**: `supabase/migrations/XXXX_sys_components_cd.sql`

Uses the provided table structure:

```sql
CREATE TABLE sys_components_cd (
   comp_id              UUID                 NOT NULL DEFAULT gen_random_uuid(),
   parent_comp_id       UUID                 NULL,
   comp_code            TEXT                 NOT NULL,
   parent_comp_code     TEXT                 NULL,
   label                TEXT                 NULL,
   label2               TEXT                 NULL,
   description          TEXT                 NULL,
   description2         TEXT                 NULL,
   comp_level           INTEGER              NULL,
   comp_path            TEXT                 NULL,
   feature_code         TEXT                 NULL,
   main_permission_code TEXT                 NULL, -- Permission required to display
   role_code            TEXT                 NULL,
   screen_code          TEXT                 NULL,
   badge                TEXT                 NULL,
   display_order        INTEGER              NULL,
   is_leaf              BOOLEAN              NULL DEFAULT true,
   is_navigable         BOOLEAN              NULL DEFAULT true,
   is_active            BOOLEAN              NULL DEFAULT true,
   is_system            BOOLEAN              NULL DEFAULT true,
   is_for_tenant_use    BOOLEAN              NULL DEFAULT true,
   roles                JSONB                NULL DEFAULT '[]',
   permissions          JSONB                NULL DEFAULT '[]',
   require_all_permissions BOOLEAN              NULL DEFAULT false,
   feature_flag         JSONB                NULL DEFAULT '[]',
   metadata             JSONB                NULL DEFAULT '[]',
   comp_value1          TEXT                 NULL,
   comp_value2          TEXT                 NULL,
   comp_value3          TEXT                 NULL,
   comp_value4          TEXT                 NULL,
   comp_value5          TEXT                 NULL,
   color1               VARCHAR(60)          NULL,
   color2               VARCHAR(60)          NULL,
   color3               VARCHAR(60)          NULL,
   comp_icon            VARCHAR(120)         NULL,
   comp_image           VARCHAR(120)         NULL,
   rec_order            INTEGER              NULL,
   rec_notes            TEXT                 NULL,
   rec_status           SMALLINT             NULL DEFAULT 1,
   created_at           TIMESTAMP            NOT NULL DEFAULT CURRENT_TIMESTAMP,
   created_by           TEXT                 NULL,
   created_info         TEXT                 NULL,
   updated_at           TIMESTAMP            NULL,
   updated_by           TEXT                 NULL,
   updated_info         TEXT                 NULL,
   CONSTRAINT PK_SYS_COMPONENTS_CD PRIMARY KEY (comp_id),
   CONSTRAINT AK_SYS_COMP_CODE UNIQUE (comp_code)
);

-- Foreign key for parent relationship
ALTER TABLE sys_components_cd
  ADD CONSTRAINT FK_COMP_PARENT
  FOREIGN KEY (parent_comp_id)
  REFERENCES sys_components_cd(comp_id)
  ON DELETE CASCADE;

-- Indexes
CREATE INDEX idx_comp_parent ON sys_components_cd(parent_comp_id);
CREATE INDEX idx_comp_code ON sys_components_cd(comp_code);
CREATE INDEX idx_comp_active ON sys_components_cd(is_active, display_order) WHERE is_active = true;
CREATE INDEX idx_comp_permission ON sys_components_cd(main_permission_code) WHERE main_permission_code IS NOT NULL;
CREATE INDEX idx_comp_navigable ON sys_components_cd(is_navigable, is_active) WHERE is_navigable = true AND is_active = true;
```

### RLS Policies

- All authenticated users can read active navigation items
- Only system admins can modify (if needed in future)
```sql
-- Enable RLS
ALTER TABLE sys_components_cd ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read active navigation items
CREATE POLICY navigation_read_policy ON sys_components_cd
  FOR SELECT
  TO authenticated
  USING (is_active = true AND is_navigable = true);
```


## Display Logic

### Permission-Based Display Algorithm

1. **Fetch all active navigation items** from `sys_components_cd`
2. **Filter by user permissions**:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If item has `main_permission_code`:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Check if user has that permission
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If yes, include item
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If item has no `main_permission_code`:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Include if it has children that are included (parent of visible items)

3. **Build parent chain**:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - For each included item, recursively include all parents
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Ensures full navigation path is visible

4. **Additional filters**:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Check `roles` JSONB array (if specified)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Check `feature_flag` JSONB array (if specified)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Check `is_active = true`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Check `is_navigable = true`

### Example

```
Navigation Tree:
- Dashboard (no permission)
 - Orders (orders:read)
  - All Orders (orders:read)
  - New Order (orders:create)

User has: ['orders:read', 'orders:create']

Result:
- Dashboard (included - parent of Orders)
 - Orders (included - has orders:read)
  - All Orders (included - has orders:read)
  - New Order (included - has orders:create)
```

## API Endpoints

### GET `/api/navigation`

**File**: `web-admin/app/api/navigation/route.ts`

**Purpose**: Fetch navigation items filtered by user permissions

**Logic**:

1. Get current user's permissions from auth context
2. Fetch all active navigation items from `sys_components_cd`
3. Filter items where user has `main_permission_code`
4. Build parent chain (include all parents of visible items)
5. Apply additional filters (roles, feature flags)
6. Transform to `NavigationSection[]` format
7. Return filtered navigation

**Response**:

```typescript
{
  sections: NavigationSection[],
  cached: boolean
}
```

**Caching**:

- Server-side: Redis (5 min TTL)
- Client-side: localStorage (15 min TTL)

## Service Layer

### Navigation Service

**File**: `web-admin/lib/services/navigation.service.ts`

**Functions**:

1. `getNavigationFromDatabase(userPermissions, userRole, featureFlags)`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Fetches from `sys_components_cd`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Filters by `main_permission_code`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Builds parent chain
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns tree structure

2. `buildParentChain(items, visibleItemIds)`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Recursively includes all parents of visible items
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns complete navigation tree

3. `transformToNavigationSections(dbItems)`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Converts database records to `NavigationSection[]` format
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Maps `comp_icon` to LucideIcon components
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Handles children hierarchy

4. `filterByAdditionalRules(items, userRole, featureFlags)`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Filters by `roles` JSONB array
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Filters by `feature_flag` JSONB array
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Applies `require_all_permissions` logic

5. `getSystemNavigationFallback()`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns hardcoded `NAVIGATION_SECTIONS` as fallback

**Icon Mapping**:

- Map `comp_icon` string to LucideIcon component
- Use icon registry (same as before)
- Fallback to default icon if not found

## Frontend Changes

### 1. Update Sidebar Component

**File**: `web-admin/components/layout/Sidebar.tsx`

**Changes**:

- Fetch navigation from `/api/navigation` instead of importing `NAVIGATION_SECTIONS`
- Add loading state while fetching
- Fallback to hardcoded `NAVIGATION_SECTIONS` if API fails
- Cache navigation data (similar to feature flags)

### 2. Navigation Hook

**File**: `web-admin/lib/hooks/use-navigation.ts`

**Purpose**: Custom hook to fetch and cache navigation

```typescript
export function useNavigation() {
  const { permissions, userRole } = useAuth();
  const [navigation, setNavigation] = useState<NavigationSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch from API with caching
  // Fallback to hardcoded if needed
}
```

## Data Flow

```
1. Sidebar mounts
   ↓
2. Check cache (localStorage)
   ↓
3. If cached & valid → use cache
   ↓
4. If not cached → fetch from /api/navigation
   ↓
5. API fetches from sys_components_cd
   ↓
6. Filters by main_permission_code
   ↓
7. Builds parent chain
   ↓
8. Applies role/feature flag filters
   ↓
9. Transforms to NavigationSection[]
   ↓
10. Returns filtered navigation
   ↓
11. Cache result
   ↓
12. Render in Sidebar
```

## Icon Handling

**Challenge**: Lucide icons are React components, not strings

**Solution**:

1. Store icon name as string in `comp_icon` (e.g., "Home", "PackageSearch")
2. Create icon registry mapping:
   ```typescript
   const ICON_REGISTRY: Record<string, LucideIcon> = {
     Home: Home,
     PackageSearch: PackageSearch,
     // ... all icons from navigation.ts
   };
   ```

3. Transform in service: `icon: ICON_REGISTRY[item.comp_icon] || Home`
4. Validate icon names when seeding data

## Seed Script

**File**: `supabase/seeds/XXXX_navigation_seed.sql` or migration

**Purpose**: Populate `sys_components_cd` from current `NAVIGATION_SECTIONS`

**Process**:

1. Read `NAVIGATION_SECTIONS` structure
2. Insert each section as a row
3. Insert children with `parent_comp_id` reference
4. Map fields:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `comp_code` = section.key
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `label` = section.label
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `comp_path` = section.path
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `comp_icon` = icon name (extract from import)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `main_permission_code` = derive from permissions or roles
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `roles` = JSONB array of section.roles
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `permissions` = JSONB array of section.permissions
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `feature_flag` = JSONB array (if section.featureFlag)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `display_order` = array index
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `is_system` = true
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `is_active` = true
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `is_navigable` = true

## Caching Strategy

**Client-side**:

- Cache navigation in localStorage (15 min TTL)
- Cache key: `navigation:${permissionsHash}` (hash of user permissions)
- Invalidate on permission change or logout

**Server-side**:

- Redis cache for navigation (5 min TTL)
- Cache key: `nav:${userId}:${permissionsHash}`
- Invalidate on navigation item update (if admin UI added later)

## Error Handling

- API failures → Fallback to hardcoded `NAVIGATION_SECTIONS`
- Invalid icon names → Use default icon (Home)
- Missing permissions → Hide item (expected behavior)
- Cache errors → Fetch fresh from API
- Database errors → Log and use fallback

## Files to Create/Modify

**New Files**:

1. `supabase/migrations/XXXX_sys_components_cd.sql` - Table creation
2. `supabase/seeds/XXXX_navigation_seed.sql` - Seed data from NAVIGATION_SECTIONS
3. `web-admin/app/api/navigation/route.ts` - API endpoint
4. `web-admin/lib/services/navigation.service.ts` - Service layer
5. `web-admin/lib/hooks/use-navigation.ts` - Client hook
6. `web-admin/lib/utils/icon-registry.ts` - Icon mapping utility

**Modified Files**:

1. `web-admin/components/layout/Sidebar.tsx` - Use API instead of import
2. `web-admin/config/navigation.ts` - Keep as fallback, add helper functions
3. `web-admin/lib/cache/permission-cache-client.ts` - Add navigation caching

## Security Considerations

- RLS policies for read access
- Validate all inputs (paths, permissions)
- Prevent XSS in labels/paths
- Permission-based filtering (server-side)
- Cache invalidation on permission changes

## Performance Optimizations

- Cache navigation aggressively (changes infrequently)
- Build parent chain efficiently (single query with recursive CTE)
- Lazy load icon components
- Optimize icon registry (tree-shake unused icons)
- Index on `main_permission_code` for fast filtering

## Database Query Optimization

Use recursive CTE to build parent chain efficiently:

```sql
WITH RECURSIVE visible_items AS (
  -- Base: Items user has permission for
  SELECT comp_id, parent_comp_id, comp_code, comp_level
  FROM sys_components_cd
  WHERE is_active = true
    AND is_navigable = true
    AND main_permission_code = ANY($1::text[]) -- User permissions
    AND (roles IS NULL OR roles @> $2::jsonb) -- Role check
    AND (feature_flag IS NULL OR feature_flag <@ $3::jsonb) -- Feature flags

  UNION

  -- Recursive: Include all parents
  SELECT p.comp_id, p.parent_comp_id, p.comp_code, p.comp_level
  FROM sys_components_cd p
  INNER JOIN visible_items v ON p.comp_id = v.parent_comp_id
  WHERE p.is_active = true
)
SELECT * FROM visible_items
ORDER BY comp_level, display_order;
```
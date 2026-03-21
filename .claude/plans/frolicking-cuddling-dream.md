# Plan: Dynamic Preference Kinds — Preferences Panel Enhancement
**Status:** READY FOR IMPLEMENTATION
**Last Reviewed:** 2026-03-20
**Skills Verified:** /database, /frontend, /backend, /multitenancy, /i18n

---

## Context & Goals

Replace the 6 hardcoded tabs in `preferences-panel.tsx` with a fully data-driven system:
1. New global catalog table `sys_preference_kind_cd` — 9 kind rows
2. New per-tenant config table `org_preference_kind_cf` — tenant overrides (copied on init)
3. Add FK `preference_sys_kind` constraint on `sys_service_preference_cd`
4. Update SPECIAL_CARE / DELICATE_COND from `condition_stain` → `condition_special`
5. Make `preference_sys_kind` NOT NULL on `sys_service_preference_cd` and `org_service_preference_cf`
6. New API endpoint `GET /api/v1/catalog/preference-kinds`
7. New service method `PreferenceCatalogService.getPreferenceKinds()`
8. New TS type `PreferenceKind` in `lib/types/service-preferences.ts`
9. Update hook `use-preference-catalog.ts` — add kinds query + `prefsByKind` map
10. Rewrite `preferences-panel.tsx` — dynamic tabs from kinds data
11. i18n keys for the new dynamic panel
12. `npm run build` passes

---

## Critical Rules (verified from skill files)

- Audit fields: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` (NOT TIMESTAMPTZ, NOT NOT NULL) per `.claude/skills/database/conventions.md`
- All `org_*` tables: RLS + composite FK on `tenant_org_id`
- Max 30 chars for all DB objects
- API route logger: `log` (from `@/lib/utils/logger`) — matches `service-preferences/route.ts`
- Service logger: `logger` (from `@/lib/utils/logger`) — matches `preference-catalog.service.ts`
- `requirePermission()` returns `AuthContext | NextResponse` — destructure `{ tenantId }`
- NEVER modify existing migrations — create NEW ones only
- Next migration numbers: **0171**, **0172** (last numeric is 0170)

---

## File Inventory

### Files to CREATE
| File | Purpose |
|---|---|
| `supabase/migrations/0171_create_preference_kind_tables.sql` | New sys + org tables, seeds, backfill |
| `supabase/migrations/0172_preference_kind_fk_notnull.sql` | FK constraint, NOT NULL, seed function |
| `web-admin/app/api/v1/catalog/preference-kinds/route.ts` | GET endpoint |

### Files to MODIFY
| File | Change |
|---|---|
| `web-admin/lib/types/service-preferences.ts` | Add `PreferenceKind`, `PreferenceMainType`, `PREFERENCE_MAIN_TYPES` |
| `web-admin/lib/services/preference-catalog.service.ts` | Add `getPreferenceKinds()` static method |
| `web-admin/src/features/orders/hooks/use-preference-catalog.ts` | Add kinds query, `prefsByKind`, expose new return values |
| `web-admin/src/features/orders/ui/preferences-panel.tsx` | Full dynamic rewrite |
| `web-admin/messages/en.json` | Add `notesPalette.loading` + `notesPalette.kinds.*` keys |
| `web-admin/messages/ar.json` | Add `notesPalette.loading` + `notesPalette.kinds.*` keys (Arabic) |

---

## Step 1 — Migration 0171: Create sys_preference_kind_cd + org_preference_kind_cf

**File:** `supabase/migrations/0171_create_preference_kind_tables.sql`

```sql
-- ==================================================================
-- Migration: 0171_create_preference_kind_tables.sql
-- Purpose: Create sys_preference_kind_cd (global catalog) and
--          org_preference_kind_cf (per-tenant overrides) for the
--          dynamic preference panel tabs system.
-- Do NOT apply — user reviews and applies manually.
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: sys_preference_kind_cd (global, no RLS)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_preference_kind_cd (
  -- Primary key
  kind_code        VARCHAR(30) PRIMARY KEY,

  -- Display
  name             VARCHAR(250),
  name2            VARCHAR(250),
  description      TEXT,
  description2     TEXT,

  -- Rendering
  kind_bg_color    VARCHAR(20),
  main_type_code   VARCHAR(30),
  icon             VARCHAR(100),

  -- Visibility flags
  is_show_in_quick_bar  BOOLEAN NOT NULL DEFAULT true,
  is_show_for_customer  BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by   VARCHAR(120),
  created_info TEXT,
  updated_at   TIMESTAMP,
  updated_by   VARCHAR(120),
  updated_info TEXT,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  rec_notes    VARCHAR(200),
  is_active    BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE sys_preference_kind_cd IS 'Global catalog of preference kinds driving the dynamic tab row in the order preferences panel';
COMMENT ON COLUMN sys_preference_kind_cd.kind_code      IS 'Matches preference_sys_kind discriminator: service_prefs, packing_prefs, condition_stain, condition_damag, condition_special, condition_pattern, condition_material, color, note';
COMMENT ON COLUMN sys_preference_kind_cd.main_type_code IS 'Rendering driver: preferences (selector list), conditions (toggle chips), color (swatch grid), notes (textarea)';
COMMENT ON COLUMN sys_preference_kind_cd.kind_bg_color  IS 'CSS color string for tab badge background';

-- ==================================================================
-- SECTION 2: Seed 9 global kinds
-- ==================================================================

INSERT INTO sys_preference_kind_cd (
  kind_code, name, name2,
  kind_bg_color, main_type_code, icon,
  is_show_in_quick_bar, is_show_for_customer,
  rec_order, is_active, created_by
) VALUES
  ('service_prefs',      'Service Preferences', 'تفضيلات الخدمة',  '#1976D2', 'preferences', 'mdi-tune',            true, true, 10, true, 'system_admin'),
  ('packing_prefs',      'Packing Preferences', 'تفضيلات التعبئة', '#388E3C', 'preferences', 'mdi-package-variant', true, true, 20, true, 'system_admin'),
  ('condition_stain',    'Stains',              'البقع',            '#E53935', 'conditions',  'mdi-water',           true, true, 30, true, 'system_admin'),
  ('condition_damag',    'Damage',              'التلف',            '#F57C00', 'conditions',  'mdi-alert-circle',    true, true, 40, true, 'system_admin'),
  ('condition_special',  'Special Care',        'عناية خاصة',       '#7B1FA2', 'conditions',  'mdi-heart',           true, true, 50, true, 'system_admin'),
  ('condition_pattern',  'Patterns',            'الأنماط',          '#0097A7', 'conditions',  'mdi-shape',           true, true, 60, true, 'system_admin'),
  ('condition_material', 'Material',            'المادة',           '#5D4037', 'conditions',  'mdi-fabric',          true, true, 70, true, 'system_admin'),
  ('color',              'Colors',              'الألوان',          '#F50057', 'color',       'mdi-palette',         true, true, 80, true, 'system_admin'),
  ('note',               'Notes',               'الملاحظات',        '#546E7A', 'notes',       'mdi-note-text',       true, true, 90, true, 'system_admin')
ON CONFLICT (kind_code) DO NOTHING;

-- ==================================================================
-- SECTION 3: org_preference_kind_cf (per-tenant overrides, with RLS)
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_preference_kind_cf (
  -- Primary key
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  kind_code     VARCHAR(30) NOT NULL REFERENCES sys_preference_kind_cd(kind_code),

  -- Tenant overrides (NULL = use sys default)
  name          VARCHAR(250),
  name2         VARCHAR(250),
  kind_bg_color VARCHAR(20),

  -- Visibility overrides
  is_show_in_quick_bar BOOLEAN NOT NULL DEFAULT true,
  is_show_for_customer BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by   VARCHAR(120),
  created_info TEXT,
  updated_at   TIMESTAMP,
  updated_by   VARCHAR(120),
  updated_info TEXT,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  rec_notes    VARCHAR(200),
  is_active    BOOLEAN NOT NULL DEFAULT true,

  UNIQUE (tenant_org_id, kind_code)
);

COMMENT ON TABLE org_preference_kind_cf IS 'Per-tenant overrides for preference kind display: name, color, visibility. Seeded from sys_preference_kind_cd on tenant init.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_pref_kind_cf_tenant
  ON org_preference_kind_cf(tenant_org_id);

CREATE INDEX IF NOT EXISTS idx_org_pref_kind_cf_tn_st
  ON org_preference_kind_cf(tenant_org_id, rec_status);

CREATE INDEX IF NOT EXISTS idx_org_pref_kind_cf_tn_act
  ON org_preference_kind_cf(tenant_org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_pref_kind_cf_created
  ON org_preference_kind_cf(tenant_org_id, created_at DESC);

-- Enable RLS
ALTER TABLE org_preference_kind_cf ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON org_preference_kind_cf
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));

-- ==================================================================
-- SECTION 4: Seed org_preference_kind_cf for all existing tenants
-- ==================================================================

INSERT INTO org_preference_kind_cf (
  tenant_org_id, kind_code,
  is_show_in_quick_bar, is_show_for_customer,
  rec_order, is_active, created_by
)
SELECT
  t.id,
  s.kind_code,
  s.is_show_in_quick_bar,
  s.is_show_for_customer,
  s.rec_order,
  true,
  'system_migration'
FROM org_tenants_mst t
CROSS JOIN sys_preference_kind_cd s
WHERE t.rec_status = 1
ON CONFLICT (tenant_org_id, kind_code) DO NOTHING;

-- ==================================================================
-- SECTION 5: Update SPECIAL_CARE + DELICATE_COND to condition_special
-- These were seeded in 0165 under condition_stain by mistake.
-- ==================================================================

UPDATE sys_service_preference_cd
SET preference_sys_kind = 'condition_special'
WHERE code IN ('SPECIAL_CARE', 'DELICATE_COND')
  AND preference_sys_kind = 'condition_stain';

-- Backfill org_service_preference_cf denormalized column
UPDATE org_service_preference_cf cf
SET preference_sys_kind = 'condition_special'
WHERE cf.preference_code IN ('SPECIAL_CARE', 'DELICATE_COND');

COMMIT;
```

---

## Step 2 — Migration 0172: FK + NOT NULL + seed function

**File:** `supabase/migrations/0172_preference_kind_fk_notnull.sql`

```sql
-- ==================================================================
-- Migration: 0172_preference_kind_fk_notnull.sql
-- Purpose: Add FK from sys_service_preference_cd.preference_sys_kind
--          to sys_preference_kind_cd, enforce NOT NULL on both tables,
--          add seed_tenant_pref_kinds() helper for new tenants.
-- Do NOT apply — user reviews and applies manually.
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: Safe backfill — ensure no NULL or unknown kind codes
--            before adding NOT NULL / FK constraints.
-- ==================================================================

UPDATE sys_service_preference_cd
SET preference_sys_kind = 'service_prefs'
WHERE preference_sys_kind IS NULL
   OR preference_sys_kind NOT IN (
      'service_prefs','packing_prefs','condition_stain','condition_damag',
      'condition_special','condition_pattern','condition_material','color','note'
   );

UPDATE org_service_preference_cf cf
SET preference_sys_kind = COALESCE(
      (SELECT cd.preference_sys_kind
         FROM sys_service_preference_cd cd
        WHERE cd.code = cf.preference_code),
      'service_prefs'
    )
WHERE cf.preference_sys_kind IS NULL;

-- ==================================================================
-- SECTION 2: Enforce NOT NULL
-- ==================================================================

ALTER TABLE sys_service_preference_cd
  ALTER COLUMN preference_sys_kind SET NOT NULL;

ALTER TABLE org_service_preference_cf
  ALTER COLUMN preference_sys_kind SET NOT NULL;

-- ==================================================================
-- SECTION 3: FK from sys_service_preference_cd → sys_preference_kind_cd
-- ==================================================================

ALTER TABLE sys_service_preference_cd
  ADD CONSTRAINT fk_sys_svc_pref_kind
    FOREIGN KEY (preference_sys_kind)
    REFERENCES sys_preference_kind_cd(kind_code)
    ON UPDATE CASCADE;

-- ==================================================================
-- SECTION 4: seed_tenant_pref_kinds(UUID) — call for new tenants
-- ==================================================================

CREATE OR REPLACE FUNCTION seed_tenant_pref_kinds(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO org_preference_kind_cf (
    tenant_org_id, kind_code,
    is_show_in_quick_bar, is_show_for_customer,
    rec_order, is_active, created_by
  )
  SELECT
    p_tenant_id,
    s.kind_code,
    s.is_show_in_quick_bar,
    s.is_show_for_customer,
    s.rec_order,
    true,
    'system_seed'
  FROM sys_preference_kind_cd s
  WHERE s.is_active = true
  ON CONFLICT (tenant_org_id, kind_code) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION seed_tenant_pref_kinds(UUID) IS
  'Call during new tenant provisioning to populate org_preference_kind_cf from sys catalog.';

COMMIT;
```

> **Name length check:** `seed_tenant_pref_kinds` = 22 chars ✓, `fk_sys_svc_pref_kind` = 20 chars ✓, all index names ≤ 30 chars ✓

---

## Step 3 — Types

**File:** `web-admin/lib/types/service-preferences.ts`
**Action:** Read the file first, then insert at the beginning (before existing type declarations, after existing imports):

```typescript
// ─── Preference Kind ─────────────────────────────────────────────────────────

export const PREFERENCE_MAIN_TYPES = {
  PREFERENCES: 'preferences',
  CONDITIONS:  'conditions',
  COLOR:       'color',
  NOTES:       'notes',
} as const;

export type PreferenceMainType = (typeof PREFERENCE_MAIN_TYPES)[keyof typeof PREFERENCE_MAIN_TYPES];

export interface PreferenceKind {
  kind_code:            string;
  name:                 string | null;
  name2:                string | null;
  kind_bg_color:        string | null;
  main_type_code:       PreferenceMainType | null;
  icon:                 string | null;
  is_show_in_quick_bar: boolean;
  is_show_for_customer: boolean;
  is_active:            boolean;
  rec_order:            number | null;
}
```

---

## Step 4 — Service Method

**File:** `web-admin/lib/services/preference-catalog.service.ts`

**Import update** — add to the existing import from `@/lib/types/service-preferences`:
```typescript
import type {
  ServicePreference,
  PackingPreference,
  PreferenceBundle,
  PreferenceKind,        // ADD
  PreferenceMainType,    // ADD
} from '@/lib/types/service-preferences';
```

**New static method** — insert inside `PreferenceCatalogService` class, after `getExtraTurnaroundMinutesBatch` (line ~483):

```typescript
  /**
   * Get preference kinds for tenant (sys catalog + org overrides merged).
   * @param quickBarOnly - When true, only return kinds with is_show_in_quick_bar=true
   */
  static async getPreferenceKinds(
    supabase: SupabaseClient,
    tenantId: string,
    quickBarOnly = false
  ): Promise<PreferenceKind[]> {
    try {
      const { data: sysKinds, error: sysError } = await supabase
        .from('sys_preference_kind_cd')
        .select('kind_code, name, name2, kind_bg_color, main_type_code, icon, is_show_in_quick_bar, is_show_for_customer, rec_order, is_active')
        .eq('is_active', true)
        .order('rec_order', { ascending: true });

      if (sysError) {
        logger.error('Failed to fetch sys_preference_kind_cd', new Error(sysError.message), {
          tenantId,
          feature: 'preference_catalog',
          action: 'get_preference_kinds',
        });
        return [];
      }

      const { data: tenantCf } = await supabase
        .from('org_preference_kind_cf')
        .select('kind_code, name, name2, kind_bg_color, is_show_in_quick_bar, is_show_for_customer, is_active')
        .eq('tenant_org_id', tenantId);

      const cfMap = new Map(
        (tenantCf || []).map((c) => [c.kind_code, c])
      );

      return (sysKinds || [])
        .filter((s) => {
          const cf = cfMap.get(s.kind_code);
          if (cf && !cf.is_active) return false;
          if (quickBarOnly) {
            const show = cf ? cf.is_show_in_quick_bar : s.is_show_in_quick_bar;
            if (!show) return false;
          }
          return true;
        })
        .map((s) => {
          const cf = cfMap.get(s.kind_code);
          return {
            kind_code:            s.kind_code,
            name:                 cf?.name ?? s.name,
            name2:                cf?.name2 ?? s.name2,
            kind_bg_color:        cf?.kind_bg_color ?? s.kind_bg_color,
            main_type_code:       s.main_type_code as PreferenceMainType | null,
            icon:                 s.icon,
            is_show_in_quick_bar: cf ? cf.is_show_in_quick_bar : s.is_show_in_quick_bar,
            is_show_for_customer: cf ? cf.is_show_for_customer : s.is_show_for_customer,
            is_active:            true,
            rec_order:            s.rec_order,
          } as PreferenceKind;
        });
    } catch (err) {
      logger.error('PreferenceCatalogService.getPreferenceKinds failed', err instanceof Error ? err : new Error(String(err)), {
        tenantId,
        feature: 'preference_catalog',
      });
      return [];
    }
  }
```

---

## Step 5 — API Endpoint

**File:** `web-admin/app/api/v1/catalog/preference-kinds/route.ts`

```typescript
/**
 * GET /api/v1/catalog/preference-kinds
 * Fetch preference kinds for tenant (sys catalog + tenant overrides merged)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { log } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('orders:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;
    const { tenantId } = authCheck;

    const { searchParams } = new URL(request.url);
    const quickBarOnly = searchParams.get('quickBarOnly') === 'true';

    const supabase = await createClient();
    const kinds = await PreferenceCatalogService.getPreferenceKinds(
      supabase,
      tenantId,
      quickBarOnly
    );

    return NextResponse.json({ success: true, data: kinds });
  } catch (error) {
    log.error(
      '[API] GET /catalog/preference-kinds error',
      error instanceof Error ? error : new Error(String(error)),
      {
        feature: 'preference_catalog',
        action: 'get_preference_kinds',
      }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preference kinds' },
      { status: 500 }
    );
  }
}
```

---

## Step 6 — Hook Update

**File:** `web-admin/src/features/orders/hooks/use-preference-catalog.ts`
**Action:** Read the file first. Then make the following targeted additions:

**Add to imports at top:**
```typescript
import { useMemo } from 'react';                           // add if not present
import type { PreferenceKind } from '@/lib/types/service-preferences';
```

**Add new query** (alongside existing `servicePrefsQuery`/`packingPrefsQuery`):
```typescript
  const kindsQuery = useQuery<PreferenceKind[]>({
    queryKey: ['preference-kinds', tenantId],
    queryFn: async () => {
      const res = await fetch('/api/v1/catalog/preference-kinds?quickBarOnly=true');
      if (!res.ok) throw new Error('Failed to fetch preference kinds');
      const json = await res.json();
      return json.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!tenantId,
  });
```

**Add `prefsByKind` memo** (after the queries, before the return):
```typescript
  const prefsByKind = useMemo(() => {
    const allPrefs = servicePrefsQuery.data ?? [];
    const map = new Map<string, typeof allPrefs>();
    for (const pref of allPrefs) {
      const key = pref.preference_sys_kind ?? 'service_prefs';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pref);
    }
    return map;
  }, [servicePrefsQuery.data]);
```

**Extend return object** (add to existing return — do NOT remove existing keys):
```typescript
    preferenceKinds: kindsQuery.data ?? [],
    kindsLoading:    kindsQuery.isLoading,
    prefsByKind,
```

---

## Step 7 — preferences-panel.tsx Rewrite

**File:** `web-admin/src/features/orders/ui/preferences-panel.tsx`
**Action:** Read the full file first, understand all existing props, callbacks, and sub-sections, then rewrite with dynamic tabs while preserving all existing logic.

### Changes summary
1. Remove `type ActiveTab` union + `useState<ActiveTab>('stain')`
2. Remove static `tabs[]` array
3. Add `const [activeKindCode, setActiveKindCode] = useState<string | null>(null)`
4. Add `useEffect` to set default from first kind (once loaded)
5. Destructure `{ preferenceKinds, kindsLoading, prefsByKind, packingPrefs }` from hook
6. Render dynamic tab row from `preferenceKinds`
7. Dispatch content by `activeKind.main_type_code` via switch

### Tab row render pattern:
```tsx
<div className="flex flex-row rtl:flex-row-reverse overflow-x-auto border-b shrink-0">
  {preferenceKinds.map((kind) => {
    const label = getBilingual(kind.name, kind.name2);
    const isActive = kind.kind_code === activeKindCode;
    return (
      <button
        key={kind.kind_code}
        type="button"
        onClick={() => setActiveKindCode(kind.kind_code)}
        className={[
          'px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
          isActive
            ? 'border-current'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        ].join(' ')}
        style={
          isActive && kind.kind_bg_color
            ? { borderColor: kind.kind_bg_color, color: kind.kind_bg_color }
            : undefined
        }
      >
        {label}
      </button>
    );
  })}
</div>
```

### Content dispatch pattern:
```tsx
function renderContent(kind: PreferenceKind) {
  switch (kind.main_type_code) {
    case 'preferences':
      return kind.kind_code === 'packing_prefs'
        ? <PackingPrefsList prefs={packingPrefs} {/* existing props */} />
        : <ServicePrefsList prefs={prefsByKind.get('service_prefs') ?? []} {/* existing props */} />;
    case 'conditions':
      return <ConditionChips conditions={prefsByKind.get(kind.kind_code) ?? []} {/* existing props */} />;
    case 'color':
      return <ColorSwatchGrid colors={prefsByKind.get('color') ?? []} {/* existing props */} />;
    case 'notes':
      return <NotesArea {/* existing props */} />;
    default:
      return null;
  }
}
```

### Loading skeleton:
```tsx
if (kindsLoading) {
  return (
    <div className="flex flex-col h-full p-4 gap-2">
      {[1,2,3].map(i => (
        <div key={i} className="h-8 rounded bg-muted animate-pulse" />
      ))}
    </div>
  );
}
```

### RTL import addition:
The `getBilingual` utility handles bilingual text — import from `@/lib/utils/bilingual` if not already imported.

---

## Step 8 — i18n Keys

### en.json — inside `"orders"."notesPalette"` object:
```json
"loading": "Loading preferences...",
"kinds": {
  "service_prefs":      "Service Prefs",
  "packing_prefs":      "Packing",
  "condition_stain":    "Stains",
  "condition_damag":    "Damage",
  "condition_special":  "Special Care",
  "condition_pattern":  "Patterns",
  "condition_material": "Material",
  "color":              "Colors",
  "note":               "Notes"
}
```

### ar.json — inside `"orders"."notesPalette"` object:
```json
"loading": "جارٍ تحميل التفضيلات...",
"kinds": {
  "service_prefs":      "تفضيلات الخدمة",
  "packing_prefs":      "التعبئة",
  "condition_stain":    "البقع",
  "condition_damag":    "التلف",
  "condition_special":  "عناية خاصة",
  "condition_pattern":  "الأنماط",
  "condition_material": "المادة",
  "color":              "الألوان",
  "note":               "الملاحظات"
}
```

> Tab labels come primarily from `kind.name` / `kind.name2` (DB). These keys are static fallback/reference only. Run `npm run check:i18n` after adding.

---

## Implementation Order

1. Create migration **0171** → STOP, user applies
2. Create migration **0172** → STOP, user applies
3. Update `lib/types/service-preferences.ts` (types)
4. Update `lib/services/preference-catalog.service.ts` (add method)
5. Create `app/api/v1/catalog/preference-kinds/route.ts`
6. Update `src/features/orders/hooks/use-preference-catalog.ts`
7. Rewrite `src/features/orders/ui/preferences-panel.tsx`
8. Update `messages/en.json` + `messages/ar.json`
9. Run `npm run build` — fix until green
10. Run `npm run check:i18n` — fix until green

---

## Pre-Implementation Checklist

### Database
- [x] Audit fields: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` (not TIMESTAMPTZ, not NOT NULL)
- [x] `is_active BOOLEAN NOT NULL DEFAULT true` on both tables
- [x] All DB object names ≤ 30 chars (checked above)
- [x] `idx_org_pref_kind_cf_tenant` (28 chars), `idx_org_pref_kind_cf_tn_st` (26 chars), `idx_org_pref_kind_cf_tn_act` (27 chars), `idx_org_pref_kind_cf_created` (28 chars) — all ✓
- [x] RLS + `tenant_isolation` policy on `org_preference_kind_cf`
- [x] `UNIQUE (tenant_org_id, kind_code)` on `org_preference_kind_cf`
- [x] FK: `org_preference_kind_cf.kind_code → sys_preference_kind_cd(kind_code)` ✓
- [x] FK: `sys_service_preference_cd.preference_sys_kind → sys_preference_kind_cd(kind_code)` ON UPDATE CASCADE ✓
- [x] NOT NULL enforced after safe backfill (both tables)
- [x] SPECIAL_CARE + DELICATE_COND → `condition_special` (with org backfill)
- [x] 0171 seeds all existing tenants via CROSS JOIN WHERE rec_status=1
- [x] 0172 adds `seed_tenant_pref_kinds(UUID)` (22 chars) for new tenants
- [x] No existing migration files touched
- [x] Both migrations wrapped in `BEGIN; ... COMMIT;`

### Backend
- [x] API route uses `log` (not `logger`) — matches existing route files
- [x] Service uses `logger` — matches existing service file
- [x] `requirePermission('orders:read')` → `{ tenantId }` destructured
- [x] `await createClient()` (server-side Supabase)
- [x] `export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'`
- [x] Error response `{ success: false, error }` status 500
- [x] Service: every DB query filters by `tenantId`

### Frontend
- [x] No `@ui/compat` imports
- [x] No `@/components/ui` imports
- [x] `getBilingual(kind.name, kind.name2)` for tab labels
- [x] RTL: `flex-row rtl:flex-row-reverse` on tab row
- [x] Loading skeleton while `kindsLoading`
- [x] `useEffect` sets default tab (no inline initialization to avoid stale render)
- [x] `useMemo` for `prefsByKind` — prevents recompute on every render
- [x] `enabled: !!tenantId` on `kindsQuery` — no fetch before auth

### Types
- [x] `PREFERENCE_MAIN_TYPES` as `const` object
- [x] `PreferenceMainType` derived from const, not duplicated as string union
- [x] `PreferenceKind` interface fields match DB columns exactly
- [x] No `any` types

### i18n
- [x] Both `en.json` and `ar.json` updated
- [x] Keys nested under existing `orders.notesPalette`
- [x] `loading` key is new (confirmed not present in existing file)
- [x] `kinds.*` keys are new
- [x] `npm run check:i18n` to run after changes

-- ==================================================================
-- 0245_order_sources_physical_intake.sql
-- Purpose: Configurable order sources (sys), physical intake tracking,
--          tenant allowlist for sources, org_orders_mst FK + text notes,
--          remove received_at DB default (app sets explicitly).
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- A. Global catalog: sys_order_sources_cd
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sys_order_sources_cd (
  order_source_code VARCHAR(64) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  requires_remote_intake_confirm BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by TEXT,
created_info TEXT,
updated_at TIMESTAMP,
updated_by TEXT,
updated_info TEXT,
rec_status SMALLINT DEFAULT 1,
rec_order INTEGER,
rec_notes TEXT
);

COMMENT ON TABLE public.sys_order_sources_cd IS 'Configurable sales / integration channel for orders (POS, mobile apps, partners).';
COMMENT ON COLUMN public.sys_order_sources_cd.order_source_code IS 'Stable API identifier (e.g. customer_mobile_app).';
COMMENT ON COLUMN public.sys_order_sources_cd.requires_remote_intake_confirm IS 'When true, new orders start remote intake (draft, pending_dropoff, received_at null) until staff confirms.';

INSERT INTO public.sys_order_sources_cd (order_source_code, name, name2, requires_remote_intake_confirm, sort_order) VALUES
  ('legacy_unknown', 'Unknown / legacy', 'غير معروف', false, 0),
  ('pos', 'POS (counter)', 'نقطة البيع', false, 10),
  ('web_admin', 'Web admin', 'لوحة الويب', false, 20),
  ('customer_mobile_app', 'Customer mobile app', 'تطبيق العميل', true, 30),
  ('staff_mobile_app', 'Staff mobile app', 'تطبيق الموظف', false, 40),
  ('driver_mobile_app', 'Driver mobile app', 'تطبيق السائق', false, 50),
  ('kiosk', 'Kiosk', 'كiosk', false, 60),
  ('whatsapp_bot', 'WhatsApp bot', 'واتساب', false, 70),
  ('b2b_portal', 'B2B portal', 'بوابة B2B', false, 80),
  ('api_partner', 'API / partner integration', 'تكامل API', false, 90)
ON CONFLICT (order_source_code) DO NOTHING;

-- ------------------------------------------------------------------
-- B. Tenant allowlist (empty = allow all active global sources)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.org_tenant_order_sources_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES public.org_tenants_mst (id) ON DELETE CASCADE,
  order_source_code VARCHAR(64) NOT NULL REFERENCES public.sys_order_sources_cd (order_source_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by TEXT,
created_info TEXT,
updated_at TIMESTAMP,
updated_by TEXT,
updated_info TEXT,
rec_status SMALLINT DEFAULT 1,
rec_order INTEGER,
rec_notes TEXT,
is_active BOOLEAN NOT NULL DEFAULT true,
  
  UNIQUE (tenant_org_id, order_source_code)
);

CREATE INDEX IF NOT EXISTS idx_org_tenant_order_sources_tenant
  ON public.org_tenant_order_sources_cf (tenant_org_id);

COMMENT ON TABLE public.org_tenant_order_sources_cf IS 'Per-tenant allow/deny for order_source_code. Zero rows = all active sources allowed.';

ALTER TABLE public.org_tenant_order_sources_cf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_tenant_order_sources_cf ON public.org_tenant_order_sources_cf;
CREATE POLICY tenant_isolation_org_tenant_order_sources_cf ON public.org_tenant_order_sources_cf
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ------------------------------------------------------------------
-- C. org_orders_mst: channel + physical intake + notes
-- ------------------------------------------------------------------
ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS order_source_code VARCHAR(64) NOT NULL DEFAULT 'legacy_unknown'
    REFERENCES public.sys_order_sources_cd (order_source_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS physical_intake_status VARCHAR(30) NOT NULL DEFAULT 'received';

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS physical_intake_at TIMESTAMPTZ;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS physical_intake_by UUID;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS physical_intake_info TEXT;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS received_info TEXT;

COMMENT ON COLUMN public.org_orders_mst.order_source_code IS 'FK to sys_order_sources_cd — how the order was created.';
COMMENT ON COLUMN public.org_orders_mst.physical_intake_status IS 'e.g. pending_dropoff | received — goods at branch gate.';
COMMENT ON COLUMN public.org_orders_mst.physical_intake_info IS 'Optional notes before physical receipt (customer bag description, etc.).';
COMMENT ON COLUMN public.org_orders_mst.received_info IS 'Optional notes when goods are received at branch.';

CREATE INDEX IF NOT EXISTS idx_org_orders_tenant_source_intake
  ON public.org_orders_mst (tenant_org_id, order_source_code, physical_intake_status);

CREATE INDEX IF NOT EXISTS idx_org_orders_pending_dropoff
  ON public.org_orders_mst (tenant_org_id)
  WHERE physical_intake_status = 'pending_dropoff';

-- Drop DB default on received_at so remote bookings can stay NULL until confirm.
ALTER TABLE public.org_orders_mst
  ALTER COLUMN received_at DROP DEFAULT;

-- Best-effort backfill channel for known mobile JSON marker (intake flags unchanged for historical rows).
UPDATE public.org_orders_mst o
SET order_source_code = 'customer_mobile_app'
WHERE (o.customer_details ->> 'source') = 'customer_mobile_app'
  AND o.order_source_code = 'legacy_unknown';

UPDATE public.org_orders_mst o
SET physical_intake_status = 'pending_dropoff',
    received_at = NULL
WHERE o.order_source_code = 'customer_mobile_app'
  AND o.current_status = 'draft'
  AND (o.customer_details ->> 'source') = 'customer_mobile_app';

-- Read policy for global code table (tenant-agnostic reference data)
ALTER TABLE public.sys_order_sources_cd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sys_order_sources_cd_select_all ON public.sys_order_sources_cd;
CREATE POLICY sys_order_sources_cd_select_all ON public.sys_order_sources_cd
  FOR SELECT
  USING (true);

COMMIT;

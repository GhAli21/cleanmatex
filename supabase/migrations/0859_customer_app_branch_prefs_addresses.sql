-- =============================================================================
-- Migration: 0859_customer_app_branch_prefs_addresses.sql
-- Purpose:   Extend Customer App persistence with last-used branch tracking on
--            org_customers_mst, reusable default order note settings on both
--            sys_customers_mst and org_customers_mst, a global customer
--            addresses table (sys_customer_addresses_dtl), and dual pickup/
--            delivery & bag-estimate fields on org_ord_requests_mst.
-- Affected:  org_customers_mst, sys_customers_mst, sys_customer_addresses_dtl,
--            org_ord_requests_mst
-- Related:   0854_customer_app_order_foundation.sql
--
-- Runtime boundary:
--   Customer App APIs execute server-side in web-admin (/api/v1/public/customer/*)
--   using service-role access after verifying the opaque global customer session.
--   No anon or authenticated role receives direct table access to
--   sys_customer_addresses_dtl.
--
-- Deployment:
--   Forward-only draft. Review before application. Do NOT apply via agent,
--   Supabase CLI, or MCP; the repository owner applies migrations manually.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- -----------------------------------------------------------------------------
-- 1. Organization customer relationship: last-used branch & fallback order note.
-- -----------------------------------------------------------------------------
-- Tracks the last branch used by a customer inside one Organization so the
-- Customer App top switcher pill and booking Step 1 pre-select it automatically.
-- Also adds org-level fallback default order note fields for customers who do
-- not yet have a global sys_customers_mst identity.
ALTER TABLE public.org_customers_mst
  ADD COLUMN last_branch_id UUID,                                     -- Last branch used on an order/request for this org; NULL if none yet
  ADD COLUMN default_order_note TEXT,                                 -- Fallback default order note when customer has no global sys_customers_mst row
  ADD COLUMN auto_apply_order_default_note BOOLEAN NOT NULL DEFAULT false; -- When true, pre-fills default_order_note on upcoming Customer App orders

-- Composite FK uses (last_branch_id, tenant_org_id) to match the exact parent
-- unique key order on org_branches_mst(id, tenant_org_id) required by Prisma 6
-- (see 0553/0854). ON DELETE RESTRICT prevents tenant-scoped branch corruption
-- and avoids invalid ON DELETE SET NULL on required tenant_org_id.
ALTER TABLE public.org_customers_mst
  ADD CONSTRAINT fk_ocm_last_branch_tenant
    FOREIGN KEY (last_branch_id, tenant_org_id)
    REFERENCES public.org_branches_mst(id, tenant_org_id)
    ON DELETE RESTRICT;

-- Supports tenant-scoped lookups and reporting by customer last-used branch
-- while ignoring rows where no last branch has been recorded yet.
CREATE INDEX ix_ocm_tenant_last_branch
  ON public.org_customers_mst (tenant_org_id, last_branch_id)
  WHERE last_branch_id IS NOT NULL;

COMMENT ON COLUMN public.org_customers_mst.last_branch_id IS
  'Most recent Organization branch selected on a Customer App order or request; auto-updated on order placement when the branch changes and validated as active/customer-app-enabled on read.';
COMMENT ON COLUMN public.org_customers_mst.default_order_note IS
  'Organization-scoped fallback default general order note used only when the customer has no global sys_customers_mst identity.';
COMMENT ON COLUMN public.org_customers_mst.auto_apply_order_default_note IS
  'Controls whether default_order_note is automatically pre-filled in the Customer App General Order Note field for upcoming orders when operating on org-only customer records.';
COMMENT ON CONSTRAINT fk_ocm_last_branch_tenant ON public.org_customers_mst IS
  'Enforces tenant-safe branch ownership using (last_branch_id, tenant_org_id) to mirror org_branches_mst(id, tenant_org_id) for Prisma 6 compatibility; restricts deletion of referenced branches.';
COMMENT ON INDEX public.ix_ocm_tenant_last_branch IS
  'Supports tenant-scoped filtering and branch-affinity queries over org_customers_mst rows that have a recorded last_branch_id.';

-- -----------------------------------------------------------------------------
-- 2. Global customer identity: reusable default order note & auto-apply flag.
-- -----------------------------------------------------------------------------
-- Persists the customer-chosen reusable General Order Note at the global
-- identity level so it stays consistent across all linked Organizations and
-- can be toggled off anytime from Account Profile.
ALTER TABLE public.sys_customers_mst
  ADD COLUMN default_order_note TEXT,                                 -- Global reusable general order note saved from Customer App checkout or profile
  ADD COLUMN auto_apply_order_default_note BOOLEAN NOT NULL DEFAULT false; -- When true, pre-fills default_order_note on all upcoming Customer App orders

COMMENT ON COLUMN public.sys_customers_mst.default_order_note IS
  'Global customer-authored default general order note (e.g., gate/arrival instructions) shared across linked Organizations when auto_apply_order_default_note is enabled.';
COMMENT ON COLUMN public.sys_customers_mst.auto_apply_order_default_note IS
  'Customer-controlled flag indicating whether default_order_note should auto-populate on upcoming Customer App orders; toggleable from checkout Step 5 or Account Profile.';

-- -----------------------------------------------------------------------------
-- 3. Global customer addresses table (sys_customer_addresses_dtl).
-- -----------------------------------------------------------------------------
-- Stores reusable pickup/delivery addresses for customers linked to a global
-- sys_customers_mst identity so they do not re-enter villa/office details per
-- Organization. Customers without a sys_customers_mst.id continue saving to
-- tenant-scoped org_customer_addresses.
CREATE TABLE public.sys_customer_addresses_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                      -- Stable opaque primary identifier for one global customer address
  customer_id UUID NOT NULL,                                          -- Owning global customer in sys_customers_mst
  address_type TEXT DEFAULT 'home',                                   -- Address category: home, work, or other
  label TEXT,                                                         -- Short customer-defined address title (e.g., Home Villa 14, Office)
  building TEXT,                                                      -- Villa number, building name, or tower identifier
  floor TEXT,                                                         -- Floor number or level within the building
  apartment TEXT,                                                     -- Apartment, flat, or office unit number
  street TEXT,                                                        -- Street, way, or road identifier
  area TEXT,                                                          -- Neighborhood, district, zone, or block
  city TEXT,                                                          -- City or wilayat name (no locale default per DB rules)
  country TEXT,                                                       -- ISO 3166-1 alpha-2 country code; intentionally no default per DB rules
  postal_code TEXT,                                                   -- Optional postal or ZIP code
  latitude DECIMAL(10, 8),                                            -- WGS84 latitude in decimal degrees (-90 to 90)
  longitude DECIMAL(11, 8),                                           -- WGS84 longitude in decimal degrees (-180 to 180)
  delivery_notes TEXT,                                                -- Doorstep, gate, reception, or call-on-arrival instructions
  is_default BOOLEAN NOT NULL DEFAULT false,                          -- Marks the single active default address for this global customer
  is_active BOOLEAN NOT NULL DEFAULT true,                            -- Soft-active marker (false when customer removes an address)
  rec_status SMALLINT NOT NULL DEFAULT 1,                             -- Lifecycle flag: 1=active, 0=soft-deleted (never hard-delete history)
  rec_order INTEGER,                                                  -- Optional display ordering value
  rec_notes TEXT,                                                     -- Non-secret administrative note; never exposed to the customer
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),                      -- Instant (UTC) when the address row was created
  created_by TEXT,                                                    -- Authenticated actor or service that created the address
  created_info TEXT,                                                  -- Non-secret creation provenance (e.g., customer_app version)
  updated_at TIMESTAMPTZ,                                             -- Instant (UTC) of the latest permitted update
  updated_by TEXT,                                                    -- Authenticated actor or service that last updated the address
  updated_info TEXT,                                                  -- Non-secret update provenance
  CONSTRAINT fk_scad_customer
    FOREIGN KEY (customer_id)
    REFERENCES public.sys_customers_mst(id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_scad_address_type
    CHECK (address_type IS NULL OR address_type IN ('home', 'work', 'other')),
  CONSTRAINT chk_scad_country_iso
    CHECK (country IS NULL OR char_length(btrim(country)) = 2),
  CONSTRAINT chk_scad_lat_range
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT chk_scad_lng_range
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  CONSTRAINT chk_scad_rec_status
    CHECK (rec_status IN (0, 1))
);

-- Supports listing active global addresses for one customer with default first
-- and newest entries next, avoiding full scans on sys_customer_addresses_dtl.
CREATE INDEX ix_scad_customer_active
  ON public.sys_customer_addresses_dtl (customer_id, is_default DESC, created_at DESC)
  WHERE is_active = true AND rec_status = 1;

-- Guarantees at most one active default address per global customer.
CREATE UNIQUE INDEX uq_scad_customer_default
  ON public.sys_customer_addresses_dtl (customer_id)
  WHERE is_default = true AND is_active = true AND rec_status = 1;

-- Enforce defense-in-depth: global customer addresses are read and mutated only
-- through authenticated service-role customer API routes; anon and authenticated
-- JWT roles receive zero direct table privileges.
ALTER TABLE public.sys_customer_addresses_dtl ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sys_customer_addresses_dtl FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sys_customer_addresses_dtl TO service_role;

COMMENT ON TABLE public.sys_customer_addresses_dtl IS
  'Global customer pickup and delivery addresses owned by sys_customers_mst, reused across linked Organizations in the Customer App. Accessed strictly via authenticated server APIs using service_role; anon and authenticated have no direct privileges.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.id IS 'Opaque primary identifier for one global customer address.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.customer_id IS 'Owning global customer in sys_customers_mst.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.address_type IS 'Controlled address category (home, work, or other) for UI icons and grouping.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.label IS 'Short customer-friendly address label displayed in pickers and Account Profile.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.building IS 'Villa number, building name, or tower identifier for GCC addressing.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.floor IS 'Floor or level identifier within the building.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.apartment IS 'Apartment, flat, or office unit identifier.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.street IS 'Street, way, or road identifier.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.area IS 'District, neighborhood, zone, or block name.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.city IS 'City or wilayat name; intentionally carries no default value.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.country IS 'Optional two-letter ISO 3166-1 alpha-2 country code; intentionally carries no default value.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.postal_code IS 'Optional postal or ZIP code.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.latitude IS 'WGS84 latitude coordinate in decimal degrees (-90 to 90) for map pin accuracy.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.longitude IS 'WGS84 longitude coordinate in decimal degrees (-180 to 180) for map pin accuracy.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.delivery_notes IS 'Customer arrival or handoff instructions (e.g., gate code, leave with reception, call on arrival).';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.is_default IS 'True for the customer primary default address; enforced unique among active rows per customer_id.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.is_active IS 'Soft-active flag; false hides removed addresses while preserving audit history.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.rec_status IS 'Standard record status: 1=active, 0=soft-deleted.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.rec_order IS 'Optional display sort order.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.rec_notes IS 'Internal non-secret administrative note; never returned to the customer.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.created_at IS 'Instant (UTC) when this address was created.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.created_by IS 'Authenticated actor or trusted service that created this address.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.created_info IS 'Non-secret creation provenance metadata.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.updated_at IS 'Instant (UTC) when this address was last modified.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.updated_by IS 'Authenticated actor or trusted service that last modified this address.';
COMMENT ON COLUMN public.sys_customer_addresses_dtl.updated_info IS 'Non-secret update provenance metadata.';
COMMENT ON CONSTRAINT fk_scad_customer ON public.sys_customer_addresses_dtl IS
  'Requires every global address to belong to an existing sys_customers_mst identity and blocks orphaned deletes.';
COMMENT ON CONSTRAINT chk_scad_address_type ON public.sys_customer_addresses_dtl IS
  'Restricts address_type to the approved home/work/other UI vocabulary.';
COMMENT ON CONSTRAINT chk_scad_country_iso ON public.sys_customer_addresses_dtl IS
  'Ensures provided country codes follow two-character ISO 3166-1 alpha-2 length.';
COMMENT ON CONSTRAINT chk_scad_lat_range ON public.sys_customer_addresses_dtl IS
  'Rejects invalid geographic latitudes outside [-90, 90].';
COMMENT ON CONSTRAINT chk_scad_lng_range ON public.sys_customer_addresses_dtl IS
  'Rejects invalid geographic longitudes outside [-180, 180].';
COMMENT ON CONSTRAINT chk_scad_rec_status ON public.sys_customer_addresses_dtl IS
  'Restricts rec_status to 1 (active) or 0 (soft-deleted).';
COMMENT ON INDEX public.ix_scad_customer_active IS
  'Supports fast customer-scoped retrieval of active global addresses ordered by default flag and recency.';
COMMENT ON INDEX public.uq_scad_customer_default IS
  'Enforces that a global customer has at most one active default address at any time.';

-- -----------------------------------------------------------------------------
-- 4. Fast Quick Drop requests: separate delivery mode, dual address refs & bags.
-- -----------------------------------------------------------------------------
-- Extends org_ord_requests_mst (from 0854) so Fast Quick Drop supports the
-- independent 2x2 Pickup/Delivery choices (collect vs drop-off, deliver vs
-- store pickup), separate pickup/delivery address snapshots from either SYS or
-- ORG address tables without cross-table FK clashes, and estimated bag counts.
ALTER TABLE public.org_ord_requests_mst
  ADD COLUMN delivery_mode_code TEXT NOT NULL DEFAULT 'STORE_PICKUP', -- Controlled return mode: DELIVER_ADDRESS or STORE_PICKUP
  ADD COLUMN pickup_address_id UUID,                                  -- Source address UUID when collection_method_code = COLLECT_FROM_ADDRESS
  ADD COLUMN pickup_address_source TEXT,                              -- Address table provenance for pickup_address_id: SYS or ORG
  ADD COLUMN delivery_address_id UUID,                                -- Source address UUID when delivery_mode_code = DELIVER_ADDRESS
  ADD COLUMN delivery_address_source TEXT,                            -- Address table provenance for delivery_address_id: SYS or ORG
  ADD COLUMN delivery_address_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- Immutable delivery-address snapshot for staff conversion review
  ADD COLUMN estimated_total_bags INTEGER NOT NULL DEFAULT 0;         -- Customer-estimated laundry bag count hint (never billable quantity)

ALTER TABLE public.org_ord_requests_mst
  ADD CONSTRAINT chk_orq_delivery_mode
    CHECK (delivery_mode_code IN ('DELIVER_ADDRESS', 'STORE_PICKUP')),
  ADD CONSTRAINT chk_orq_pickup_addr_src
    CHECK (
      (pickup_address_id IS NULL AND pickup_address_source IS NULL)
      OR (pickup_address_id IS NOT NULL AND pickup_address_source IN ('SYS', 'ORG'))
    ),
  ADD CONSTRAINT chk_orq_deliv_addr_src
    CHECK (
      (delivery_address_id IS NULL AND delivery_address_source IS NULL)
      OR (delivery_address_id IS NOT NULL AND delivery_address_source IN ('SYS', 'ORG'))
    ),
  ADD CONSTRAINT chk_orq_bag_count
    CHECK (estimated_total_bags >= 0);

COMMENT ON COLUMN public.org_ord_requests_mst.delivery_mode_code IS
  'Customer-selected return fulfillment method: DELIVER_ADDRESS (driver delivers to address) or STORE_PICKUP (customer picks up at branch).';
COMMENT ON COLUMN public.org_ord_requests_mst.pickup_address_id IS
  'Reference UUID of the saved customer address used for collection; resolved via pickup_address_source (SYS or ORG) alongside collection_address_snapshot.';
COMMENT ON COLUMN public.org_ord_requests_mst.pickup_address_source IS
  'Table provenance of pickup_address_id: SYS (sys_customer_addresses_dtl) or ORG (org_customer_addresses).';
COMMENT ON COLUMN public.org_ord_requests_mst.delivery_address_id IS
  'Reference UUID of the saved customer address used for return delivery; resolved via delivery_address_source (SYS or ORG) alongside delivery_address_snapshot.';
COMMENT ON COLUMN public.org_ord_requests_mst.delivery_address_source IS
  'Table provenance of delivery_address_id: SYS (sys_customer_addresses_dtl) or ORG (org_customer_addresses).';
COMMENT ON COLUMN public.org_ord_requests_mst.delivery_address_snapshot IS
  'Immutable delivery-address snapshot captured at request submission for staff review and POS conversion without depending on mutable address rows.';
COMMENT ON COLUMN public.org_ord_requests_mst.estimated_total_bags IS
  'Customer-estimated total laundry bags for pickup capacity planning; operational hint only and never an authoritative order quantity.';
COMMENT ON CONSTRAINT chk_orq_delivery_mode ON public.org_ord_requests_mst IS
  'Restricts delivery_mode_code to the approved DELIVER_ADDRESS or STORE_PICKUP return options.';
COMMENT ON CONSTRAINT chk_orq_pickup_addr_src ON public.org_ord_requests_mst IS
  'Requires pickup_address_id and pickup_address_source (SYS/ORG) to be either both NULL or both populated.';
COMMENT ON CONSTRAINT chk_orq_deliv_addr_src ON public.org_ord_requests_mst IS
  'Requires delivery_address_id and delivery_address_source (SYS/ORG) to be either both NULL or both populated.';
COMMENT ON CONSTRAINT chk_orq_bag_count ON public.org_ord_requests_mst IS
  'Prevents negative customer-estimated bag counts.';

COMMIT;

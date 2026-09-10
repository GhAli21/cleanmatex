-- Rack & Bags modal: add locker_location, locker_code, hanging_count to org_orders_mst
-- Mirrors the bag_count precedent in 0012_order_intake_enhancements.sql

BEGIN;

ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS locker_location TEXT;
COMMENT ON COLUMN org_orders_mst.locker_location IS 'Locker identifier assigned at rack/bags entry (separate from rack_location)';

ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS locker_code TEXT;
COMMENT ON COLUMN org_orders_mst.locker_code IS 'Locker access code paired with locker_location';

ALTER TABLE org_orders_mst ADD COLUMN IF NOT EXISTS hanging_count INTEGER DEFAULT 0;
COMMENT ON COLUMN org_orders_mst.hanging_count IS 'Number of hanging garments recorded at rack/bags entry';

ALTER TABLE org_orders_mst ADD CONSTRAINT chk_hanging_count
  CHECK (hanging_count is null Or hanging_count >= 0);

COMMIT;

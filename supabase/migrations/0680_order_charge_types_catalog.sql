-- 0680_order_charge_types_catalog.sql
-- Order charge types: add the missing codes and make sys_charge_types_cd the
-- single source of allowed values.
--
-- Why: the snapshot writer (order-financial-write.service.ts) buckets DELIVERY
-- and SERVICE charge rows into delivery_charge_amount / service_charge_amount,
-- and PLAN §5 lists delivery, service and other charges. A hard-coded CHECK on
-- org_order_charges_dtl.charge_type allowed only PREFERENCE, EXPRESS,
-- BULK_SURCHARGE and SPECIAL_HANDLING, so those charges could never be stored.
-- Replacing the CHECK with a foreign key means a new charge type needs only a
-- catalog row, not a constraint rewrite.

-- ── New catalog codes ────────────────────────────────────────────────────────
-- DELIVERY → snapshot delivery_charge_amount; SERVICE → service_charge_amount;
-- OTHER → other_charges_amount (the remainder bucket). Codes are canonical:
-- the writer's legacy aliases (DELIVERY_CHARGE, SERVICE_CHARGE) are not seeded.
INSERT INTO public.sys_charge_types_cd (charge_type, name, name2, description, sort_order) VALUES
  ('DELIVERY', 'Delivery Fee',   'رسوم التوصيل', 'Pickup or delivery fee charged on the order.', 5),
  ('SERVICE',  'Service Charge', 'رسوم الخدمة',  'Order-level service charge.',                   6),
  ('OTHER',    'Other Charge',   'رسوم أخرى',    'Any other order-level charge.',                 7)
ON CONFLICT (charge_type) DO UPDATE SET
  name        = EXCLUDED.name,
  name2       = EXCLUDED.name2,
  description = EXCLUDED.description,
  sort_order  = EXCLUDED.sort_order;

-- ── Replace the hard-coded CHECK with a catalog FK ───────────────────────────
-- The CHECK duplicated the catalog's first four rows. RESTRICT: nothing depends
-- on a CHECK constraint, so this fails loudly if that ever changes.
ALTER TABLE public.org_order_charges_dtl
  DROP CONSTRAINT org_order_charges_dtl_charge_type_check RESTRICT;

-- Every charge row must use a catalog code. Default NO ACTION: a code in use
-- can't be deleted from the catalog (retire it with is_active = false instead).
ALTER TABLE public.org_order_charges_dtl
  ADD CONSTRAINT fk_ocd_charge_type
  FOREIGN KEY (charge_type) REFERENCES public.sys_charge_types_cd (charge_type);

COMMENT ON CONSTRAINT fk_ocd_charge_type ON public.org_order_charges_dtl IS
  'Charge type must exist in sys_charge_types_cd (replaces the hard-coded CHECK, 0680).';

COMMENT ON TABLE public.sys_charge_types_cd IS
  'Catalog of order charge types; org_order_charges_dtl.charge_type references it (fk_ocd_charge_type). Retire a code with is_active = false, never delete it.';

COMMENT ON COLUMN public.org_order_charges_dtl.charge_type IS
  'Charge type code from sys_charge_types_cd. DELIVERY, SERVICE and EXPRESS feed their own snapshot buckets; the rest go to other_charges_amount.';

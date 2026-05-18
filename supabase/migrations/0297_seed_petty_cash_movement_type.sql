-- Migration: 0297_seed_petty_cash_movement_type.sql
-- Adds PETTY_CASH to sys_cash_drawer_movement_type_cd.
-- The code is referenced by the cash drawer service (recordMovement) and the
-- billing UI dropdown but was missing from the initial seed in migration 0267,
-- causing a FK constraint violation when users try to save a Petty Cash movement.

INSERT INTO public.sys_cash_drawer_movement_type_cd
  (code, name, name2, default_direction, affects_expected_cash, display_order)
VALUES
  ('PETTY_CASH', 'Petty Cash', 'عهدة نقدية', 'OUT', true, 5)
ON CONFLICT (code) DO UPDATE SET
  name                  = EXCLUDED.name,
  name2                 = EXCLUDED.name2,
  default_direction     = EXCLUDED.default_direction,
  affects_expected_cash = EXCLUDED.affects_expected_cash,
  display_order         = EXCLUDED.display_order;

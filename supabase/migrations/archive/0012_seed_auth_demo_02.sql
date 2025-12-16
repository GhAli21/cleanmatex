-- 0012_seed_auth_demo_02.sql — Second Demo Tenant auth + employees (numeric UUID pattern)
-- Pattern base: 20000002-2222-2222-2222-22222222222X
-- Tenant: BlueWave Laundry Co.
/*
BEGIN;

-- Create demo admin/operator in Supabase auth if available; fallback to public.auth_users
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    -- Admin
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '20000002-2222-2222-2222-222222222223') THEN
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, phone, raw_user_meta_data, created_at)
      VALUES ('20000002-2222-2222-2222-222222222223', 'admin@bluewave.example', crypt('Admin#BlueWave2025', gen_salt('bf')), now(), '+96871112233',
              '{"tenant_hint":"bluewave-laundry","role":"admin"}', now());
    END IF;
    -- Operator
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '20000002-2222-2222-2222-222222222224') THEN
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, phone, raw_user_meta_data, created_at)
      VALUES ('20000002-2222-2222-2222-222222222224', 'operator@bluewave.example', crypt('Op#BlueWave2025', gen_salt('bf')), now(), '+96871112234',
              '{"tenant_hint":"bluewave-laundry","role":"operator"}', now());
    END IF;
  ELSIF to_regclass('public.auth_users') IS NOT NULL THEN
    INSERT INTO public.auth_users (id) VALUES ('20000002-2222-2222-2222-222222222223') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.auth_users (id) VALUES ('20000002-2222-2222-2222-222222222224') ON CONFLICT (id) DO NOTHING;
  END IF;
END$$;

-- Employees for Tenant #2 (BlueWave)
INSERT INTO org_emp_users (
  id, tenant_id, supabase_user_id, name, name_ar, first_name, last_name, disply_name,
  phone, email, role, address, area, building, floor, is_active, is_user, created_at, updated_at
) VALUES
  ('20000002-2222-2222-2222-222222222223', '20000002-2222-2222-2222-222222222221', '20000002-2222-2222-2222-222222222223', 'BlueWave Admin', 'مسؤول بلو ويف', 'BlueWave', 'Admin', 'Admin BW',
   '+96871112233', 'admin@bluewave.example', 'admin', 'Qurum Business District', 'Qurum', 'BW-HQ', '1', true, true, now(), now()),
  ('20000002-2222-2222-2222-222222222224', '20000002-2222-2222-2222-222222222221', '20000002-2222-2222-2222-222222222224', 'BlueWave Operator', 'مُشغل بلو ويف', 'BlueWave', 'Operator', 'Operator BW',
   '+96871112234', 'operator@bluewave.example', 'operator', 'Qurum Business District', 'Qurum', 'BW-HQ', '1', true, true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = now();

COMMIT;
*/

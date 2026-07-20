INSERT INTO "public"."org_branches_mst" ("tenant_org_id", "branch_name", "name", "name2", "is_main", "s_date", "phone", "email", "type", "address", "country", "city", "area", "street", "building", "floor", "latitude", "longitude", "rec_order", "rec_status", "is_active", "rec_notes", "created_at", "created_by", "created_info", "updated_at", "updated_by", "updated_info", "tax_pricing_mode", "extra_price_pricing_mode") VALUES ( '20000002-2222-2222-2222-222222222221', 'BlueWave Qurum Branch', 'Main Branch Name', 'الفرع الرئيسي', true, '2026-05-18 19:15:00.27425', '+96871112231', 'qurum@bluewave.example', 'walk_in', 'Qurum Heights Plaza, Shop 12', 'OM', 'Muscat', 'Qurum', null, null, null, 23.602, 58.47, null, 1, true, null, '2026-05-18 19:15:00.27425', null, null, null, null, null, null, null);
commit;

SELECT value FROM sys_fin_runtime_cf WHERE key = 'outbox_secret_key';

SELECT 1 FROM public.sys_auth_role_default_permissions
    WHERE permission_code = 'pricing:override' 
    --AND role_code = 'admin'
;
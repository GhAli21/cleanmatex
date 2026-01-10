-- Migration: 0070_sys_stng_profiles_gcc_seed.sql
-- Description: Seed 12 hierarchical system profiles (GCC focus)
-- Date: 2026-01-08
-- Feature: SAAS Platform Settings Management
-- Dependencies: 0068_sys_stng_categories_and_profiles_schema.sql, 0069_sys_stng_categories_seed.sql

-- =====================================================
-- Hierarchical Profile Structure (Inheritance Tree)
-- =====================================================
--
-- GENERAL_MAIN_PROFILE (Root - most general settings)
--   │
--   └─── GCC_MAIN_PROFILE (GCC region defaults)
--         │
--         ├─── GCC_OM_MAIN (Oman country defaults)
--         │     ├─── GCC_OM_SME (Oman Small/Medium Enterprise)
--         │     └─── GCC_OM_ENTERPRISE (Oman Enterprise)
--         │
--         ├─── GCC_KSA_MAIN (Saudi Arabia country defaults)
--         │     ├─── GCC_KSA_SME (Saudi Small/Medium Enterprise)
--         │     └─── GCC_KSA_ENTERPRISE (Saudi Enterprise)
--         │
--         └─── GCC_UAE_MAIN (UAE country defaults)
--               ├─── GCC_UAE_SME (UAE Small/Medium Enterprise)
--               └─── GCC_UAE_ENTERPRISE (UAE Enterprise)
--
-- FRANCHISE_BASE (Separate tree - franchise standards)
--
-- =====================================================

-- =====================================================
-- PART 1: Seed Profile Definitions (in dependency order)
-- =====================================================

-- 1. GENERAL_MAIN_PROFILE (Root profile - most general)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GENERAL_MAIN_PROFILE',
  'General Main Profile',
  'الملف العام الرئيسي',
  'Most general settings applicable to any business globally. Root of the profile hierarchy.',
  'الإعدادات الأكثر عمومية والمطبقة على أي عمل تجاري عالميًا. جذر التسلسل الهرمي للملف الشخصي.',
  NULL,  -- No country
  NULL,  -- No segment
  NULL,  -- Root profile (no parent)
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  stng_profile_name2 = EXCLUDED.stng_profile_name2,
  updated_at = CURRENT_TIMESTAMP;


-- 2. GCC_MAIN_PROFILE (GCC region parent)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_MAIN_PROFILE',
  'GCC Main Profile',
  'الملف الرئيسي لدول مجلس التعاون الخليجي',
  'GCC-specific settings overriding general defaults. Parent for all GCC country profiles.',
  'إعدادات خاصة بدول مجلس التعاون الخليجي تتجاوز الإعدادات العامة. الملف الأساسي لجميع ملفات دول مجلس التعاون.',
  NULL,  -- Region-wide (no specific country)
  NULL,  -- No segment
  'GENERAL_MAIN_PROFILE',  -- Inherits from GENERAL_MAIN_PROFILE
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 3. GCC_OM_MAIN (Oman country parent)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_OM_MAIN',
  'Oman Main Profile',
  'الملف الرئيسي لسلطنة عمان',
  'Oman-specific settings: OMR currency, 5% VAT, Arabic primary language, DD/MM/YYYY date format.',
  'إعدادات خاصة بسلطنة عمان: العملة ريال عماني، ضريبة القيمة المضافة 5%، اللغة العربية الأساسية.',
  'OM',  -- Oman
  NULL,  -- No segment (country-level)
  'GCC_MAIN_PROFILE',  -- Inherits from GCC_MAIN_PROFILE
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  country_code = EXCLUDED.country_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 4. GCC_KSA_MAIN (Saudi Arabia country parent)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_KSA_MAIN',
  'Saudi Arabia Main Profile',
  'الملف الرئيسي للمملكة العربية السعودية',
  'Saudi Arabia-specific settings: SAR currency, 15% VAT, Zakat enabled, Arabic primary language.',
  'إعدادات خاصة بالمملكة العربية السعودية: العملة ريال سعودي، ضريبة القيمة المضافة 15%، الزكاة مفعلة.',
  'SA',  -- Saudi Arabia
  NULL,  -- No segment (country-level)
  'GCC_MAIN_PROFILE',  -- Inherits from GCC_MAIN_PROFILE
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  country_code = EXCLUDED.country_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 5. GCC_UAE_MAIN (UAE country parent)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_UAE_MAIN',
  'UAE Main Profile',
  'الملف الرئيسي للإمارات العربية المتحدة',
  'UAE-specific settings: AED currency, 5% VAT, Arabic primary language, DD/MM/YYYY date format.',
  'إعدادات خاصة بالإمارات العربية المتحدة: العملة درهم إماراتي، ضريبة القيمة المضافة 5%.',
  'AE',  -- UAE
  NULL,  -- No segment (country-level)
  'GCC_MAIN_PROFILE',  -- Inherits from GCC_MAIN_PROFILE
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  country_code = EXCLUDED.country_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 6. GCC_OM_SME (Oman Small/Medium Enterprise)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_OM_SME',
  'Oman SME Profile',
  'ملف المنشآت الصغيرة والمتوسطة بعمان',
  'Small/Medium Enterprise defaults for Oman: 5 max concurrent orders, 3-day auto-close, simplified workflow.',
  'إعدافات افتراضية للمنشآت الصغيرة والمتوسطة في عمان: 5 طلبات متزامنة كحد أقصى، إغلاق تلقائي بعد 3 أيام.',
  'OM',
  'SME',
  'GCC_OM_MAIN',  -- Inherits from GCC_OM_MAIN
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  segment_code = EXCLUDED.segment_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 7. GCC_OM_ENTERPRISE (Oman Enterprise)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_OM_ENTERPRISE',
  'Oman Enterprise Profile',
  'ملف المؤسسات الكبيرة بعمان',
  'Enterprise defaults for Oman: 50 max concurrent orders, 7-day auto-close, advanced reporting, multi-branch support.',
  'إعدادات افتراضية للمؤسسات الكبيرة في عمان: 50 طلبًا متزامنًا كحد أقصى، إغلاق تلقائي بعد 7 أيام.',
  'OM',
  'ENTERPRISE',
  'GCC_OM_MAIN',  -- Inherits from GCC_OM_MAIN
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  segment_code = EXCLUDED.segment_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 8. GCC_KSA_SME (Saudi Arabia Small/Medium Enterprise)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_KSA_SME',
  'Saudi Arabia SME Profile',
  'ملف المنشآت الصغيرة والمتوسطة بالسعودية',
  'Small/Medium Enterprise defaults for Saudi Arabia: 5 max concurrent orders, 3-day auto-close, simplified workflow.',
  'إعدادات افتراضية للمنشآت الصغيرة والمتوسطة في السعودية: 5 طلبات متزامنة كحد أقصى.',
  'SA',
  'SME',
  'GCC_KSA_MAIN',  -- Inherits from GCC_KSA_MAIN
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  segment_code = EXCLUDED.segment_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 9. GCC_KSA_ENTERPRISE (Saudi Arabia Enterprise)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_KSA_ENTERPRISE',
  'Saudi Arabia Enterprise Profile',
  'ملف المؤسسات الكبيرة بالسعودية',
  'Enterprise defaults for Saudi Arabia: 50 max concurrent orders, 7-day auto-close, advanced reporting, multi-branch.',
  'إعدادات افتراضية للمؤسسات الكبيرة في السعودية: 50 طلبًا متزامنًا كحد أقصى.',
  'SA',
  'ENTERPRISE',
  'GCC_KSA_MAIN',  -- Inherits from GCC_KSA_MAIN
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  segment_code = EXCLUDED.segment_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 10. GCC_UAE_SME (UAE Small/Medium Enterprise)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_UAE_SME',
  'UAE SME Profile',
  'ملف المنشآت الصغيرة والمتوسطة بالإمارات',
  'Small/Medium Enterprise defaults for UAE: 5 max concurrent orders, 3-day auto-close, simplified workflow.',
  'إعدادات افتراضية للمنشآت الصغيرة والمتوسطة في الإمارات: 5 طلبات متزامنة كحد أقصى.',
  'AE',
  'SME',
  'GCC_UAE_MAIN',  -- Inherits from GCC_UAE_MAIN
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  segment_code = EXCLUDED.segment_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 11. GCC_UAE_ENTERPRISE (UAE Enterprise)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'GCC_UAE_ENTERPRISE',
  'UAE Enterprise Profile',
  'ملف المؤسسات الكبيرة بالإمارات',
  'Enterprise defaults for UAE: 50 max concurrent orders, 7-day auto-close, advanced reporting, multi-branch support.',
  'إعدادات افتراضية للمؤسسات الكبيرة في الإمارات: 50 طلبًا متزامنًا كحد أقصى.',
  'AE',
  'ENTERPRISE',
  'GCC_UAE_MAIN',  -- Inherits from GCC_UAE_MAIN
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  segment_code = EXCLUDED.segment_code,
  parent_profile_code = EXCLUDED.parent_profile_code,
  updated_at = CURRENT_TIMESTAMP;


-- 12. FRANCHISE_BASE (Separate root for franchises)
-- ========================================================
INSERT INTO sys_stng_profiles_mst (
  stng_profile_code,
  stng_profile_name,
  stng_profile_name2,
  stng_profile_desc,
  stng_profile_desc2,
  country_code,
  segment_code,
  parent_profile_code,
  stng_profile_version,
  created_by,
  is_active
) VALUES (
  'FRANCHISE_BASE',
  'Franchise Base Profile',
  'الملف الأساسي للامتيازات',
  'Standardized franchise settings with locked branding and centralized reporting. Separate inheritance tree from regional profiles.',
  'إعدادات امتياز موحدة مع علامة تجارية مقفلة وتقارير مركزية. شجرة وراثة منفصلة عن الملفات الإقليمية.',
  NULL,  -- No specific country
  'FRANCHISE',
  NULL,  -- Root profile (separate tree)
  1,
  'system_admin',
  true
) ON CONFLICT (stng_profile_code) DO UPDATE SET
  stng_profile_name = EXCLUDED.stng_profile_name,
  segment_code = EXCLUDED.segment_code,
  updated_at = CURRENT_TIMESTAMP;


-- =====================================================
-- Verification Query
-- =====================================================

DO $$
DECLARE
  profile_count INTEGER;
  root_count INTEGER;
BEGIN
  -- Count total profiles
  SELECT COUNT(*) INTO profile_count FROM sys_stng_profiles_mst WHERE is_active = true;

  -- Count root profiles (no parent)
  SELECT COUNT(*) INTO root_count FROM sys_stng_profiles_mst WHERE parent_profile_code IS NULL AND is_active = true;

  IF profile_count = 12 THEN
    RAISE NOTICE 'SUCCESS: All 12 profiles seeded successfully';
  ELSE
    RAISE WARNING 'WARNING: Expected 12 profiles, found %', profile_count;
  END IF;

  IF root_count = 2 THEN
    RAISE NOTICE 'SUCCESS: 2 root profiles found (GENERAL_MAIN_PROFILE, FRANCHISE_BASE)';
  ELSE
    RAISE WARNING 'WARNING: Expected 2 root profiles, found %', root_count;
  END IF;
END $$;


-- =====================================================
-- Summary
-- =====================================================

-- 12 Profiles seeded in hierarchical order:
--
-- ROOT LEVEL:
-- 1. GENERAL_MAIN_PROFILE (root)
-- 12. FRANCHISE_BASE (separate root)
--
-- LEVEL 2 (Regional):
-- 2. GCC_MAIN_PROFILE → GENERAL_MAIN_PROFILE
--
-- LEVEL 3 (Country):
-- 3. GCC_OM_MAIN → GCC_MAIN_PROFILE
-- 4. GCC_KSA_MAIN → GCC_MAIN_PROFILE
-- 5. GCC_UAE_MAIN → GCC_MAIN_PROFILE
--
-- LEVEL 4 (Segment):
-- 6. GCC_OM_SME → GCC_OM_MAIN
-- 7. GCC_OM_ENTERPRISE → GCC_OM_MAIN
-- 8. GCC_KSA_SME → GCC_KSA_MAIN
-- 9. GCC_KSA_ENTERPRISE → GCC_KSA_MAIN
-- 10. GCC_UAE_SME → GCC_UAE_MAIN
-- 11. GCC_UAE_ENTERPRISE → GCC_UAE_MAIN
--
-- Inheritance example:
-- GCC_OM_SME inherits from:
-- GCC_OM_SME → GCC_OM_MAIN → GCC_MAIN_PROFILE → GENERAL_MAIN_PROFILE
--
-- Next migration will seed sample profile values for these profiles.

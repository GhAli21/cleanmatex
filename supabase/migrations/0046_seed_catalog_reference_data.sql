-- ==================================================================
-- 0046_seed_catalog_reference_data.sql
-- Purpose: Seed item types and product templates for catalog system
-- Author: CleanMateX Development Team
-- Created: 2025-01-26
-- PRD: Product Catalog System Redesign
-- Dependencies: 0045_catalog_system_2027_architecture.sql
-- ==================================================================
-- This migration seeds:
-- 1. 10 item types (TOPS, BOTTOMS, FULL_BODY, OUTERWEAR, INTIMATE, SPECIAL, HOUSEHOLD, RETAIL_GOODS, ACCESSORIES, OTHER)
-- 2. 46 service product templates (from existing demo products)
-- 3. 14 retail product templates (new)
-- ==================================================================

BEGIN;

-- ==================================================================
-- PART 1: SEED ITEM TYPES (10 types)
-- ==================================================================

INSERT INTO sys_item_type_cd (
  item_type_code,
  name,
  name2,
  description,
  description2,
  is_garment,
  is_retail,
  display_order,
  icon,
  color,
  is_system,
  is_active,
  created_by,
  rec_status
) VALUES
('TOPS', 'Tops', 'القمصان والبلوزات', 'Shirts, blouses, t-shirts, sweaters', 'القمصان، البلوزات، التيشيرتات، الكنزات', true, false, 10, 'Shirt', '#007bff', true, true, 'system_seed', 1),
('BOTTOMS', 'Bottoms', 'البنطلونات والتنانير', 'Pants, trousers, skirts, shorts', 'البنطلونات، التنانير، الشورتات', true, false, 20, 'Pants', '#ff7f50', true, true, 'system_seed', 1),
('FULL_BODY', 'Full Body', 'ملابس الجسم الكامل', 'Dresses, suits, jumpsuits', 'الفساتين، البدلات، الجمبسوتات', true, false, 30, 'Dress', '#ffc107', true, true, 'system_seed', 1),
('OUTERWEAR', 'Outerwear', 'الملابس الخارجية', 'Jackets, coats, blazers', 'السترات، المعاطف، البليزرات', true, false, 40, 'Jacket', '#dc3545', true, true, 'system_seed', 1),
('INTIMATE', 'Intimate Apparel', 'الملابس الداخلية', 'Underwear, lingerie, bras', 'الملابس الداخلية، حمالات الصدر', true, false, 50, 'Underwear', '#6f42c1', true, true, 'system_seed', 1),
('SPECIAL', 'Special Items', 'ملابس خاصة', 'Special garments (saree, kimono, traditional wear)', 'ملابس خاصة (ساري، كيمونو، ملابس تقليدية)', true, false, 60, 'Special', '#17a2b8', true, true, 'system_seed', 1),
('HOUSEHOLD', 'Household Textiles', 'المنسوجات المنزلية', 'Bedding, curtains, towels', 'ملاءات، ستائر، مناشف', false, false, 70, 'Bed', '#28a745', true, true, 'system_seed', 1),
('RETAIL_GOODS', 'Retail Goods', 'منتجات التجزئة', 'Retail products (detergents, hangers, bags)', 'منتجات التجزئة (منظفات، علاقات، أكياس)', false, true, 80, 'ShoppingBag', '#fd7e14', true, true, 'system_seed', 1),
('ACCESSORIES', 'Accessories', 'الإكسسوارات', 'Ties, belts, scarves, hats', 'ربطات عنق، أحزمة، أوشحة، قبعات', true, false, 90, 'Hanger', '#e83e8c', true, true, 'system_seed', 1),
('OTHER', 'Other Items', 'أخرى', 'Other miscellaneous items', 'أصناف أخرى متنوعة', true, false, 100, 'Help', '#6c757d', true, true, 'system_seed', 1)
ON CONFLICT (item_type_code) DO NOTHING;

-- ==================================================================
-- PART 2: SEED SERVICE PRODUCT TEMPLATES (46 templates)
-- ==================================================================
-- Convert existing demo products to templates
-- Data source: 0027_products_clothes_data.sql
-- ==================================================================

-- TOPS (13 products) - seed_priority: 10-22
INSERT INTO sys_service_prod_templates_cd (
  template_code, service_category_code, item_type_code, name, name2, hint_text,
  is_retail_item, price_type, product_unit,
  default_sell_price, default_express_sell_price, product_cost, min_sell_price,
  min_quantity, pieces_per_product, extra_days,
  turnaround_hh, turnaround_hh_express, multiplier_express,
  tags, id_sku, is_to_seed, seed_priority,
  product_color1, product_icon, is_active, created_by, rec_status
) VALUES
-- Business Shirt
('SHRT_BUS', 'DRY_CLEAN', 'TOPS', 'Business Shirt', 'قميص رسمي', 'Laundered & pressed, medium starch.', false, 'PER_PC', 'PC', 8.000, 12.000, 2.500, 7.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["shirt", "launder"]}', 'SKU-T-SHRTB', true, 10, '#007bff', 'mdi-tie', true, 'system_seed', 1),
-- T-shirt
('TSHIRT_STD', 'DRY_CLEAN', 'TOPS', 'T-shirt (Standard)', 'قميص تيشيرت (عادي)', 'Simple wash & fold.', false, 'PER_PC', 'PC', 4.000, 6.000, 1.000, 3.500, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["tshirt", "casual"]}', 'SKU-T-TSH', true, 11, '#007bff', 'mdi-tshirt-crew', true, 'system_seed', 1),
-- Blouse
('BLOUSE_DC', 'WASH_AND_IRON', 'TOPS', 'Blouse (Dry Clean)', 'بلوزة (تنظيف جاف)', 'Delicate dry clean for silk/rayon.', false, 'PER_PC', 'PC', 22.000, 30.000, 6.000, 20.000, 1, 1, 0, 72.00, 48.00, 1.36, '{"tags": ["blouse", "delicate"]}', 'SKU-T-BLO', true, 12, '#007bff', 'mdi-human-female-girl', true, 'system_seed', 1),
-- Polo
('POLO_LAU', 'DRY_CLEAN', 'TOPS', 'Polo Shirt (Launder)', 'قميص بولو (غسيل)', 'Launder and fold.', false, 'PER_PC', 'PC', 6.000, 9.000, 1.500, 5.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["polo", "casual"]}', 'SKU-T-POL', true, 13, '#007bff', 'mdi-tshirt', true, 'system_seed', 1),
-- Tank Top
('TANK_TOP', 'DRY_CLEAN', 'TOPS', 'Tank Top', 'فانيلة (بلوزة بلا أكمام)', 'Simple wash & fold.', false, 'PER_PC', 'PC', 3.500, 5.250, 0.800, 3.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["tank", "sport"]}', 'SKU-T-TANK', true, 14, '#007bff', 'mdi-tshirt-tank', true, 'system_seed', 1),
-- Wool Sweater
('SWTR_WOOL', 'LAUNDRY', 'TOPS', 'Wool Sweater', 'كنزة صوفية', 'Hand-finished dry clean.', false, 'PER_PC', 'PC', 28.000, 42.000, 8.000, 25.000, 1, 1, 1, 96.00, 72.00, 1.50, '{"tags": ["sweater", "wool", "winter"]}', 'SKU-T-SWTR', true, 15, '#007bff', 'mdi-hvac-fan', true, 'system_seed', 1),
-- Fleece Hoodie
('HOODIE_F', 'DRY_CLEAN', 'TOPS', 'Fleece Hoodie', 'هودي صوفي', 'Standard wash and fold.', false, 'PER_PC', 'PC', 10.000, 15.000, 3.000, 8.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["hoodie", "fleece"]}', 'SKU-T-HOOD', true, 16, '#007bff', 'mdi-hoodie', true, 'system_seed', 1),
-- Cotton Sweatshirt
('SWT_COT', 'DRY_CLEAN', 'TOPS', 'Cotton Sweatshirt', 'قميص رياضي قطني', 'Standard wash and fold.', false, 'PER_PC', 'PC', 8.000, 12.000, 2.500, 7.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["sweatshirt", "cotton"]}', 'SKU-T-SWTC', true, 17, '#007bff', 'mdi-gymnastics', true, 'system_seed', 1),
-- Delicate Cardigan
('CARD_DEL', 'LAUNDRY', 'TOPS', 'Delicate Cardigan', 'كارديجان (ملابس خفيفة)', 'Hand-finished dry clean.', false, 'PER_PC', 'PC', 25.000, 37.500, 7.000, 22.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["cardigan", "delicate"]}', 'SKU-T-CARD', true, 18, '#007bff', 'mdi-sweater', true, 'system_seed', 1),
-- Winter Jumper
('JUMPER_W', 'LAUNDRY', 'TOPS', 'Winter Jumper', 'سترة شتوية', 'Dry clean for heavy fabrics.', false, 'PER_PC', 'PC', 32.000, 48.000, 9.000, 28.000, 1, 1, 1, 96.00, 72.00, 1.50, '{"tags": ["jumper", "winter"]}', 'SKU-T-JUMP', true, 19, '#007bff', 'mdi-snowflake', true, 'system_seed', 1),
-- Turtleneck
('TURL_STD', 'LAUNDRY', 'TOPS', 'Turtleneck Sweater', 'كنزة بياقة عالية', 'Dry clean and fold.', false, 'PER_PC', 'PC', 24.000, 36.000, 6.500, 21.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["turtleneck", "sweater"]}', 'SKU-T-TURTL', true, 20, '#007bff', 'mdi-human-male-height', true, 'system_seed', 1),
-- Vest (Padded)
('VEST_W', 'LAUNDRY', 'TOPS', 'Padded Vest', 'صدرية (فيست) مبطنة', 'Dry clean for down/synthetic padding.', false, 'PER_PC', 'PC', 22.000, 33.000, 6.000, 20.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["vest", "padded", "winter"]}', 'SKU-O-VSTP', true, 21, '#dc3545', 'mdi-fire', true, 'system_seed', 1),
-- Windbreaker
('WBRKR', 'LAUNDRY', 'TOPS', 'Windbreaker', 'سترة واقية من الرياح', 'Gentle launder and fold.', false, 'PER_PC', 'PC', 15.000, 22.500, 4.000, 13.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["windbreaker", "sport"]}', 'SKU-O-WBRK', true, 22, '#dc3545', 'mdi-wind-turbine', true, 'system_seed', 1)
ON CONFLICT (template_code) DO NOTHING;

-- BOTTOMS (7 products) - seed_priority: 30-36
INSERT INTO sys_service_prod_templates_cd (
  template_code, service_category_code, item_type_code, name, name2, hint_text,
  is_retail_item, price_type, product_unit,
  default_sell_price, default_express_sell_price, product_cost, min_sell_price,
  min_quantity, pieces_per_product, extra_days,
  turnaround_hh, turnaround_hh_express, multiplier_express,
  tags, id_sku, is_to_seed, seed_priority,
  product_color1, product_icon, is_active, created_by, rec_status
) VALUES
('TR_WOOL', 'DRY_CLEAN', 'BOTTOMS', 'Wool Trousers', 'بنطلون صوف', 'Dry clean and press.', false, 'PER_PC', 'PC', 20.000, 30.000, 6.000, 18.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["trousers", "wool", "dryclean"]}', 'SKU-B-TWL', true, 30, '#ff7f50', 'mdi-pipe', true, 'system_seed', 1),
('PANTS_COT', 'WASH_AND_IRON', 'BOTTOMS', 'Cotton Pants', 'بنطلون قطني', 'Launder and press.', false, 'PER_PC', 'PC', 15.000, 22.500, 4.000, 13.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["pants", "cotton", "launder"]}', 'SKU-B-PCOT', true, 31, '#ff7f50', 'mdi-pipe', true, 'system_seed', 1),
('JEANS_STD', 'DRY_CLEAN', 'BOTTOMS', 'Denim Jeans', 'جينز (بنطلون جينز)', 'Standard wash and fold.', false, 'PER_PC', 'PC', 12.000, 18.000, 3.500, 10.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["jeans", "denim"]}', 'SKU-B-JNS', true, 32, '#ff7f50', 'mdi-tshirt-crew', true, 'system_seed', 1),
('SHORTS_C', 'DRY_CLEAN', 'BOTTOMS', 'Casual Shorts', 'شورت كاجوال', 'Standard wash and fold.', false, 'PER_PC', 'PC', 8.000, 12.000, 2.000, 7.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["shorts", "casual"]}', 'SKU-B-SHRT', true, 33, '#ff7f50', 'mdi-tshirt-crew', true, 'system_seed', 1),
('LEG_FIT', 'WASH_AND_IRON', 'BOTTOMS', 'Fitness Leggings', 'ليغينغز (رياضي)', 'Delicate wash, air dry.', false, 'PER_PC', 'PC', 10.000, 15.000, 3.000, 9.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["leggings", "sport"]}', 'SKU-B-LEG', true, 34, '#ff7f50', 'mdi-run', true, 'system_seed', 1),
('SWEATPANTS', 'WASH_AND_IRON', 'BOTTOMS', 'Sweatpants', 'بنطلون رياضي', 'Standard wash and fold.', false, 'PER_PC', 'PC', 9.000, 13.500, 2.500, 8.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["sweatpants", "casual"]}', 'SKU-B-SWEAT', true, 35, '#ff7f50', 'mdi-gymnastics', true, 'system_seed', 1),
('SKIRT_A', 'DRY_CLEAN', 'BOTTOMS', 'A-Line Skirt', 'تنورة بقصة A', 'Dry clean or delicate launder.', false, 'PER_PC', 'PC', 18.000, 27.000, 5.000, 16.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["skirt", "dryclean"]}', 'SKU-B-SKIRT', true, 36, '#ff7f50', 'mdi-human-female-girl', true, 'system_seed', 1)
ON CONFLICT (template_code) DO NOTHING;

-- FULL_BODY (8 products) - seed_priority: 50-57
INSERT INTO sys_service_prod_templates_cd (
  template_code, service_category_code, item_type_code, name, name2, hint_text,
  is_retail_item, price_type, product_unit,
  default_sell_price, default_express_sell_price, product_cost, min_sell_price,
  min_quantity, pieces_per_product, extra_days,
  turnaround_hh, turnaround_hh_express, multiplier_express,
  tags, id_sku, is_to_seed, seed_priority,
  product_color1, product_icon, is_active, created_by, rec_status
) VALUES
('DRESS_C', 'DRY_CLEAN', 'FULL_BODY', 'Casual Dress', 'فستان كاجوال', 'Standard launder and press.', false, 'PER_PC', 'PC', 30.000, 45.000, 9.000, 25.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["dress", "casual"]}', 'SKU-F-DRSC', true, 50, '#ffc107', 'mdi-hanger', true, 'system_seed', 1),
('JUMPSUIT', 'IRON_ONLY', 'FULL_BODY', 'Standard Jumpsuit', 'جمبسوت (ملابس قطعة واحدة)', 'Dry clean service.', false, 'PER_PC', 'PC', 35.000, 52.500, 12.000, 30.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["jumpsuit", "dryclean"]}', 'SKU-F-JUMP', true, 51, '#ffc107', 'mdi-hanger', true, 'system_seed', 1),
('SUIT_2PC', 'DRY_CLEAN', 'FULL_BODY', '2-Piece Business Suit', 'بدلة عمل قطعتين', 'Full dry clean and hand press.', false, 'FIXED', 'SUIT', 60.000, 90.000, 18.000, 50.000, 1, 2, 0, 72.00, 48.00, 1.50, '{"tags": ["suit", "business", "dryclean"]}', 'SKU-F-SUIT2', true, 52, '#ffc107', 'mdi-tie', true, 'system_seed', 1),
('TUXEDO_PRM', 'WASH_AND_IRON', 'FULL_BODY', 'Premium Tuxedo', 'بدلة توكسيدو فاخرة', 'Specialty clean and preservation. Max time allowed.', false, 'FIXED', 'SUIT', 95.000, 0.000, 30.000, 80.000, 1, 2, 1, 99.99, 0.00, 1.00, '{"tags": ["tuxedo", "premium"]}', 'SKU-F-TUXP', true, 53, '#ffc107', 'mdi-tie', true, 'system_seed', 1),
('OVERALLS', 'DRY_CLEAN', 'FULL_BODY', 'Work Overalls', 'أفرول عمل', 'Heavy duty wash.', false, 'PER_PC', 'PC', 15.000, 22.500, 5.000, 13.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["overalls", "workwear"]}', 'SKU-F-OVER', true, 54, '#ffc107', 'mdi-wrench', true, 'system_seed', 1),
('PAJAMAS', 'IRON_ONLY', 'FULL_BODY', 'Pajamas/Sleepwear', 'بيجامة/ملابس نوم', 'Standard launder and fold (per set).', false, 'PER_PC', 'SET', 10.000, 15.000, 3.000, 8.000, 1, 2, 0, 48.00, 24.00, 1.50, '{"tags": ["pajamas", "sleepwear"]}', 'SKU-F-PJS', true, 55, '#ffc107', 'mdi-bed', true, 'system_seed', 1),
('ROBE_DEL', 'WASH_AND_IRON', 'FULL_BODY', 'Bathrobe/Robe', 'روب حمام/منزل', 'Laundered, pressed, and hung.', false, 'PER_PC', 'PC', 18.000, 27.000, 5.000, 15.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["robe", "bath"]}', 'SKU-F-ROBE', true, 56, '#ffc107', 'mdi-shower', true, 'system_seed', 1),
('PONCHO', 'WASH_AND_IRON', 'FULL_BODY', 'Poncho', 'بونشو', 'Dry clean/delicate launder.', false, 'PER_PC', 'PC', 20.000, 30.000, 5.000, 18.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["poncho", "casual"]}', 'SKU-O-PON', true, 57, '#dc3545', 'mdi-tshirt-crew', true, 'system_seed', 1)
ON CONFLICT (template_code) DO NOTHING;

-- OUTERWEAR (12 products) - seed_priority: 70-81
INSERT INTO sys_service_prod_templates_cd (
  template_code, service_category_code, item_type_code, name, name2, hint_text,
  is_retail_item, price_type, product_unit,
  default_sell_price, default_express_sell_price, product_cost, min_sell_price,
  min_quantity, pieces_per_product, extra_days,
  turnaround_hh, turnaround_hh_express, multiplier_express,
  tags, id_sku, is_to_seed, seed_priority,
  product_color1, product_icon, is_active, created_by, rec_status
) VALUES
('JCKT_STD', 'DRY_CLEAN', 'OUTERWEAR', 'Standard Jacket', 'جاكيت (سترة عادية)', 'Standard dry clean.', false, 'PER_PC', 'PC', 25.000, 37.500, 7.000, 22.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["jacket", "dryclean"]}', 'SKU-O-JCK', true, 70, '#dc3545', 'mdi-coat-rack', true, 'system_seed', 1),
('COAT_WINT', 'ALTERATION', 'OUTERWEAR', 'Winter Coat', 'معطف شتوي', 'Heavy coat dry clean (long). Max time allowed.', false, 'PER_PC', 'PC', 45.000, 67.500, 15.000, 40.000, 1, 1, 1, 99.99, 72.00, 1.50, '{"tags": ["coat", "winter", "heavy"]}', 'SKU-O-COAT', true, 71, '#dc3545', 'mdi-snowman', true, 'system_seed', 1),
('BLAZER_DC', 'DRY_CLEAN', 'OUTERWEAR', 'Business Blazer', 'بليزر (سترة عمل)', 'Dry clean and press.', false, 'PER_PC', 'PC', 28.000, 42.000, 8.000, 25.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["blazer", "dryclean"]}', 'SKU-O-BLZR', true, 72, '#dc3545', 'mdi-tie', true, 'system_seed', 1),
('RCOAT_WTR', 'ALTERATION', 'OUTERWEAR', 'Waterproof Raincoat', 'معطف واقٍ من المطر (مقاوم للماء)', 'Special gentle clean.', false, 'PER_PC', 'PC', 30.000, 45.000, 10.000, 27.000, 1, 1, 1, 96.00, 72.00, 1.50, '{"tags": ["raincoat", "waterproof"]}', 'SKU-O-RCOAT', true, 73, '#dc3545', 'mdi-umbrella', true, 'system_seed', 1),
('TCOAT_DC', 'REPAIRS', 'OUTERWEAR', 'Trench Coat', 'معطف ترنش', 'Dry clean and specialized pressing.', false, 'PER_PC', 'PC', 40.000, 60.000, 13.000, 35.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["trench", "coat"]}', 'SKU-O-TRCH', true, 74, '#dc3545', 'mdi-magnify', true, 'system_seed', 1),
('BOMBER', 'REPAIRS', 'OUTERWEAR', 'Bomber Jacket', 'جاكيت بومبر', 'Standard dry clean.', false, 'PER_PC', 'PC', 28.000, 42.000, 8.000, 25.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["bomber", "jacket"]}', 'SKU-O-BOMB', true, 75, '#dc3545', 'mdi-air-balloon', true, 'system_seed', 1),
('PARKA_W', 'DRY_CLEAN', 'OUTERWEAR', 'Winter Parka', 'سترة باركا شتوية', 'Dry clean with fur/hood care. Max time allowed.', false, 'PER_PC', 'PC', 50.000, 75.000, 18.000, 45.000, 1, 1, 1, 99.99, 72.00, 1.50, '{"tags": ["parka", "winter"]}', 'SKU-O-PARKA', true, 76, '#dc3545', 'mdi-snowflake', true, 'system_seed', 1),
('WCOAT_DC', 'DRY_CLEAN', 'OUTERWEAR', 'Waistcoat/Vest (Suit)', 'سترة بدون أكمام (بدلة)', 'Dry clean, suit component.', false, 'PER_PC', 'PC', 15.000, 22.500, 4.500, 13.000, 1, 1, 0, 72.00, 48.00, 1.50, '{"tags": ["waistcoat", "suit"]}', 'SKU-O-WCOAT', true, 79, '#dc3545', 'mdi-tie', true, 'system_seed', 1)
ON CONFLICT (template_code) DO NOTHING;

-- INTIMATE (6 products) - seed_priority: 90-95
INSERT INTO sys_service_prod_templates_cd (
  template_code, service_category_code, item_type_code, name, name2, hint_text,
  is_retail_item, price_type, product_unit,
  default_sell_price, default_express_sell_price, product_cost, min_sell_price,
  min_quantity, pieces_per_product, extra_days,
  turnaround_hh, turnaround_hh_express, multiplier_express,
  tags, id_sku, is_to_seed, seed_priority,
  product_color1, product_icon, is_active, created_by, rec_status
) VALUES
('UND_PANT', 'DRY_CLEAN', 'INTIMATE', 'Underpants (Single)', 'ملابس داخلية (قطعة واحدة)', 'Launder only, per piece.', false, 'PER_PC', 'PC', 2.500, 3.750, 0.500, 2.000, 1, 1, 0, 24.00, 12.00, 1.50, '{"tags": ["underwear", "launder"]}', 'SKU-I-UND', true, 90, '#6f42c1', 'mdi-water-boiler', true, 'system_seed', 1),
('BOXER', 'WASH_AND_IRON', 'INTIMATE', 'Boxer Shorts (Single)', 'شورت بوكسر (قطعة واحدة)', 'Launder only, per piece.', false, 'PER_PC', 'PC', 3.000, 4.500, 0.700, 2.500, 1, 1, 0, 24.00, 12.00, 1.50, '{"tags": ["boxer", "launder"]}', 'SKU-I-BOX', true, 91, '#6f42c1', 'mdi-water-boiler', true, 'system_seed', 1),
('BRA_STD', 'WASH_AND_IRON', 'INTIMATE', 'Standard Bra', 'حمالة صدر عادية', 'Delicate wash, air dry.', false, 'PER_PC', 'PC', 7.000, 10.500, 2.000, 6.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["bra", "delicate"]}', 'SKU-I-BRA', true, 93, '#6f42c1', 'mdi-heart', true, 'system_seed', 1),
('BRA_SPORT', 'REPAIRS', 'INTIMATE', 'Sports Bra', 'حمالة صدر رياضية', 'Gym wear wash.', false, 'PER_PC', 'PC', 6.000, 9.000, 1.500, 5.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["bra", "sport"]}', 'SKU-I-BRSP', true, 94, '#6f42c1', 'mdi-dumbbell', true, 'system_seed', 1),
('CAMI_DEL', 'REPAIRS', 'INTIMATE', 'Camisole/Slip', 'قميص داخلي خفيف', 'Delicate launder.', false, 'PER_PC', 'PC', 8.000, 12.000, 2.500, 7.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["camisole", "delicate"]}', 'SKU-I-CAMI', true, 95, '#6f42c1', 'mdi-heart', true, 'system_seed', 1),
('STOCKINGS', 'ALTERATION', 'INTIMATE', 'Stockings/Hosiery', 'جوارب طويلة/خفيفة', 'Delicate launder, per pair.', false, 'PER_PC', 'PAIR', 4.000, 6.000, 1.000, 3.500, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["stockings", "hosiery"]}', 'SKU-I-STK', true, 96, '#6f42c1', 'mdi-sock', true, 'system_seed', 1)
ON CONFLICT (template_code) DO NOTHING;

-- SPECIAL (4 products) - seed_priority: 110-113
INSERT INTO sys_service_prod_templates_cd (
  template_code, service_category_code, item_type_code, name, name2, hint_text,
  is_retail_item, price_type, product_unit,
  default_sell_price, default_express_sell_price, product_cost, min_sell_price,
  min_quantity, pieces_per_product, extra_days,
  turnaround_hh, turnaround_hh_express, multiplier_express,
  tags, id_sku, is_to_seed, seed_priority,
  product_color1, product_icon, is_active, created_by, rec_status
) VALUES
('SWIM_SUIT', 'ALTERATION', 'SPECIAL', 'Swimsuit', 'ملابس سباحة (قطعة واحدة)', 'Rinse and delicate wash.', false, 'PER_PC', 'PC', 15.000, 22.500, 4.000, 13.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["swimwear", "sport"]}', 'SKU-S-SWIM', true, 110, '#17a2b8', 'mdi-swim', true, 'system_seed', 1),
('WETSUIT', 'ALTERATION', 'SPECIAL', 'Wetsuit/Scuba Suit', 'بدلة غطس/غوص', 'Special equipment cleaning.', false, 'FIXED', 'SUIT', 40.000, 60.000, 15.000, 35.000, 1, 1, 1, 96.00, 72.00, 1.50, '{"tags": ["wetsuit", "scuba"]}', 'SKU-S-WET', true, 111, '#17a2b8', 'mdi-diving-scuba', true, 'system_seed', 1),
('LAB_COAT', 'IRON_ONLY', 'SPECIAL', 'Lab Coat', 'معطف مختبر', 'Sanitized high-temperature wash.', false, 'PER_PC', 'PC', 12.000, 18.000, 4.000, 10.000, 1, 1, 0, 48.00, 24.00, 1.50, '{"tags": ["labcoat", "uniform"]}', 'SKU-S-LAB', true, 112, '#17a2b8', 'mdi-flask', true, 'system_seed', 1),
('SAREE', 'DRY_CLEAN', 'SPECIAL', 'Saree/Sari', 'ساري/ساري هندي', 'Delicate dry clean and fold. Max time allowed.', false, 'FIXED', 'UNIT', 65.000, 0.000, 20.000, 55.000, 1, 1, 1, 99.99, 0.00, 1.00, '{"tags": ["saree", "traditional"]}', 'SKU-S-SAR', true, 113, '#17a2b8', 'mdi-flag-variant', true, 'system_seed', 1)
ON CONFLICT (template_code) DO NOTHING;

-- ==================================================================
-- PART 3: SEED RETAIL PRODUCT TEMPLATES (14 templates)
-- ==================================================================
-- seed_priority: 500-570 (after service products)
-- ==================================================================

INSERT INTO sys_service_prod_templates_cd (
  template_code, service_category_code, item_type_code, name, name2, hint_text,
  is_retail_item, price_type, product_unit,
  default_sell_price, default_express_sell_price, product_cost, min_sell_price,
  min_quantity, pieces_per_product, extra_days,
  turnaround_hh, turnaround_hh_express, multiplier_express,
  tags, id_sku, is_to_seed, seed_priority,
  product_color1, product_icon, is_active, created_by, rec_status
) VALUES
-- Detergents
('DETERGENT_500ML', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Liquid Detergent (500ml)', 'منظف سائل (500 مل)', 'Premium liquid detergent for washing machines', true, 'PER_PC', 'PC', 3.500, NULL, 1.500, 3.000, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["detergent", "liquid", "laundry"]}', 'SKU-R-DET500', true, 500, '#fd7e14', 'mdi-bottle-tonic-plus', true, 'system_seed', 1),
('DETERGENT_1L', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Liquid Detergent (1L)', 'منظف سائل (1 لتر)', 'Premium liquid detergent 1 liter bottle', true, 'PER_PC', 'PC', 6.000, NULL, 3.000, 5.000, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["detergent", "liquid", "laundry"]}', 'SKU-R-DET1L', true, 510, '#fd7e14', 'mdi-bottle-tonic-plus', true, 'system_seed', 1),
('FABRIC_SOFTENER', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Fabric Softener (1L)', 'منعم الأقمشة (1 لتر)', 'Makes clothes soft and fresh', true, 'PER_PC', 'PC', 4.500, NULL, 2.000, 4.000, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["softener", "fabric", "laundry"]}', 'SKU-R-SOFT1L', true, 520, '#fd7e14', 'mdi-flower', true, 'system_seed', 1),

-- Hangers & Bags
('HANGER_PLASTIC', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Plastic Hanger', 'علاقة بلاستيكية', 'Standard plastic clothes hanger', true, 'PER_PC', 'PC', 0.500, NULL, 0.200, 0.400, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["hanger", "plastic"]}', 'SKU-R-HANG-P', true, 530, '#fd7e14', 'mdi-hanger', true, 'system_seed', 1),
('HANGER_WOOD', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Wooden Hanger', 'علاقة خشبية', 'Premium wooden clothes hanger', true, 'PER_PC', 'PC', 2.000, NULL, 0.800, 1.500, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["hanger", "wood", "premium"]}', 'SKU-R-HANG-W', true, 540, '#fd7e14', 'mdi-hanger', true, 'system_seed', 1),
('GARMENT_BAG', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Garment Cover Bag', 'كيس حفظ الملابس', 'Protective garment bag', true, 'PER_PC', 'PC', 1.500, NULL, 0.600, 1.200, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["bag", "garment", "storage"]}', 'SKU-R-BAG-G', true, 550, '#fd7e14', 'mdi-tshirt-crew', true, 'system_seed', 1),

-- Stain Removers
('STAIN_REMOVER', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Stain Remover Spray', 'بخاخ إزالة البقع', 'Powerful stain remover spray', true, 'PER_PC', 'PC', 5.500, NULL, 2.500, 5.000, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["stain", "remover", "spray"]}', 'SKU-R-STAIN', true, 560, '#fd7e14', 'mdi-spray-bottle', true, 'system_seed', 1),
('BLEACH_500ML', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Bleach (500ml)', 'مبيض (500 مل)', 'Bleach for whites and stains', true, 'PER_PC', 'PC', 2.500, NULL, 1.000, 2.000, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["bleach", "whitener"]}', 'SKU-R-BLEACH', true, 570, '#fd7e14', 'mdi-water-plus', true, 'system_seed', 1),

-- Additional retail products
('IRONING_SPRAY', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Ironing Spray', 'بخاخ كي الملابس', 'Makes ironing easier and smoother', true, 'PER_PC', 'PC', 3.000, NULL, 1.200, 2.500, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["ironing", "spray"]}', 'SKU-R-IRON-S', true, 575, '#fd7e14', 'mdi-spray', true, 'system_seed', 1),
('LAUNDRY_BAG_S', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Mesh Laundry Bag (Small)', 'كيس غسيل شبكي (صغير)', 'Small mesh bag for delicates', true, 'PER_PC', 'PC', 1.500, NULL, 0.600, 1.200, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["bag", "mesh", "laundry"]}', 'SKU-R-BAG-S', true, 580, '#fd7e14', 'mdi-shopping', true, 'system_seed', 1),
('LAUNDRY_BAG_M', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Mesh Laundry Bag (Medium)', 'كيس غسيل شبكي (متوسط)', 'Medium mesh bag for regular items', true, 'PER_PC', 'PC', 2.000, NULL, 0.800, 1.600, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["bag", "mesh", "laundry"]}', 'SKU-R-BAG-M', true, 585, '#fd7e14', 'mdi-shopping', true, 'system_seed', 1),
('LAUNDRY_BAG_L', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Mesh Laundry Bag (Large)', 'كيس غسيل شبكي (كبير)', 'Large mesh bag for bulk items', true, 'PER_PC', 'PC', 2.500, NULL, 1.000, 2.000, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["bag", "mesh", "laundry"]}', 'SKU-R-BAG-L', true, 590, '#fd7e14', 'mdi-shopping', true, 'system_seed', 1),
('LINT_ROLLER', 'RETAIL_ITEMS', 'RETAIL_GOODS', 'Lint Roller', 'أداة إزالة الوبر', 'Sticky roller for lint and pet hair', true, 'PER_PC', 'PC', 4.000, NULL, 1.500, 3.500, 1, 1, 0, 0.00, 0.00, 1.00, '{"tags": ["lint", "roller", "cleaning"]}', 'SKU-R-LINT', true, 595, '#fd7e14', 'mdi-roller-shade', true, 'system_seed', 1)
ON CONFLICT (template_code) DO NOTHING;

COMMIT;

-- ==================================================================
-- END OF MIGRATION
-- ==================================================================

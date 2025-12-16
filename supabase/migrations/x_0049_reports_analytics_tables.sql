-- ==================================================================
-- 0049_reports_analytics_tables.sql
-- Purpose: Create Reports & Analytics code tables
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates code tables for reports and analytics:
-- 1. sys_report_category_cd - Report categories (FINANCIAL, OPERATIONAL, etc.)
-- 2. sys_metric_type_cd - Metric types (REVENUE, ORDERS_COUNT, etc.)
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_report_category_cd
-- Purpose: Report categories for organizing analytics and reports
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_report_category_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Classification
  parent_category_code VARCHAR(50),                 -- For hierarchical categories
  report_type VARCHAR(50),                          -- 'financial', 'operational', 'customer', 'inventory'

  -- Access Control
  requires_admin_access BOOLEAN DEFAULT false,
  allowed_user_roles VARCHAR(50)[],                -- Array of role codes

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System categories cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "dashboard_widget": true,
      "export_formats": ["pdf", "excel", "csv"],
      "refresh_interval": "daily",
      "data_retention_days": 365,
      "default_date_range": "last_30_days"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_report_category_active
  ON sys_report_category_cd(is_active, display_order);

CREATE INDEX idx_report_category_type
  ON sys_report_category_cd(report_type, is_active);

CREATE INDEX idx_report_category_parent
  ON sys_report_category_cd(parent_category_code) WHERE parent_category_code IS NOT NULL;

-- Comments
COMMENT ON TABLE sys_report_category_cd IS
  'Report categories for organizing analytics, dashboards, and reports';

COMMENT ON COLUMN sys_report_category_cd.code IS
  'Unique category code (e.g., FINANCIAL, OPERATIONAL, CUSTOMER, INVENTORY)';

COMMENT ON COLUMN sys_report_category_cd.report_type IS
  'Type of report category (financial, operational, customer, inventory)';

COMMENT ON COLUMN sys_report_category_cd.allowed_user_roles IS
  'Array of user role codes that can access reports in this category';

-- ==================================================================
-- TABLE: sys_metric_type_cd
-- Purpose: Metric types for analytics and KPIs
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_metric_type_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Classification
  category_code VARCHAR(50),                        -- Links to sys_report_category_cd
  metric_group VARCHAR(50),                         -- 'revenue', 'orders', 'customers', 'inventory', 'quality'
  data_type VARCHAR(20) NOT NULL,                   -- 'count', 'sum', 'average', 'percentage', 'currency', 'duration'
  unit VARCHAR(20),                                 -- 'SAR', 'USD', 'items', 'hours', 'percent'

  -- Calculation
  calculation_formula TEXT,                         -- SQL or formula for calculating this metric
  aggregation_period VARCHAR(20),                   -- 'daily', 'weekly', 'monthly', 'yearly', 'real_time'
  requires_date_range BOOLEAN DEFAULT true,

  -- Display Format
  format_pattern VARCHAR(50),                       -- Format string (e.g., '#,##0.00', '#,##0')
  decimal_places INTEGER DEFAULT 2,
  show_trend BOOLEAN DEFAULT true,                  -- Show trend indicators (up/down)
  show_percentage BOOLEAN DEFAULT false,            -- Show as percentage

  -- Thresholds
  target_value DECIMAL(15,2),
  warning_threshold DECIMAL(15,2),
  critical_threshold DECIMAL(15,2),

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System metrics cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "dashboard_priority": "high",
      "alert_on_threshold": true,
      "comparison_period": "previous_period",
      "data_source": "orders",
      "filters": ["tenant_id", "date_range"],
      "related_metrics": ["ORDERS_COUNT", "REVENUE"]
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_metric_type_active
  ON sys_metric_type_cd(is_active, display_order);

CREATE INDEX idx_metric_type_category
  ON sys_metric_type_cd(category_code, is_active);

CREATE INDEX idx_metric_type_group
  ON sys_metric_type_cd(metric_group, is_active);

-- Comments
COMMENT ON TABLE sys_metric_type_cd IS
  'Metric types for analytics, KPIs, and dashboard widgets';

COMMENT ON COLUMN sys_metric_type_cd.code IS
  'Unique metric code (e.g., REVENUE, ORDERS_COUNT, CUSTOMER_COUNT)';

COMMENT ON COLUMN sys_metric_type_cd.data_type IS
  'Type of metric data (count, sum, average, percentage, currency, duration)';

COMMENT ON COLUMN sys_metric_type_cd.calculation_formula IS
  'SQL query or formula for calculating this metric';

COMMENT ON COLUMN sys_metric_type_cd.aggregation_period IS
  'How often this metric is calculated (daily, weekly, monthly, yearly, real_time)';

-- ==================================================================
-- SEED DATA: sys_report_category_cd
-- ==================================================================

INSERT INTO sys_report_category_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  report_type,
  requires_admin_access,
  is_system,
  is_active,
  metadata
) VALUES
  (
    'FINANCIAL',
    'Financial Reports',
    'التقارير المالية',
    'Financial reports including revenue, payments, billing, and subscription analytics',
    'التقارير المالية بما في ذلك الإيرادات والمدفوعات والفواتير وتحليلات الاشتراكات',
    1,
    'dollar-sign',
    '#10B981',
    'financial',
    false,
    true,
    true,
    '{"dashboard_widget": true, "export_formats": ["pdf", "excel", "csv"], "refresh_interval": "daily", "data_retention_days": 365, "default_date_range": "last_30_days"}'::jsonb
  ),
  (
    'OPERATIONAL',
    'Operational Reports',
    'التقارير التشغيلية',
    'Operational reports including orders, workflow, quality, and performance metrics',
    'التقارير التشغيلية بما في ذلك الطلبات وسير العمل والجودة ومقاييس الأداء',
    2,
    'activity',
    '#3B82F6',
    'operational',
    false,
    true,
    true,
    '{"dashboard_widget": true, "export_formats": ["pdf", "excel", "csv"], "refresh_interval": "hourly", "data_retention_days": 90, "default_date_range": "last_7_days"}'::jsonb
  ),
  (
    'CUSTOMER',
    'Customer Reports',
    'تقارير العملاء',
    'Customer analytics including customer count, retention, satisfaction, and behavior',
    'تحليلات العملاء بما في ذلك عدد العملاء والاحتفاظ والرضا والسلوك',
    3,
    'users',
    '#8B5CF6',
    'customer',
    false,
    true,
    true,
    '{"dashboard_widget": true, "export_formats": ["pdf", "excel", "csv"], "refresh_interval": "daily", "data_retention_days": 730, "default_date_range": "last_30_days"}'::jsonb
  ),
  (
    'INVENTORY',
    'Inventory Reports',
    'تقارير المخزون',
    'Inventory and catalog reports including product usage, stock levels, and catalog analytics',
    'تقارير المخزون والكتالوج بما في ذلك استخدام المنتجات ومستويات المخزون وتحليلات الكتالوج',
    4,
    'package',
    '#F59E0B',
    'inventory',
    false,
    true,
    true,
    '{"dashboard_widget": true, "export_formats": ["pdf", "excel", "csv"], "refresh_interval": "daily", "data_retention_days": 180, "default_date_range": "last_30_days"}'::jsonb
  ),
  (
    'QUALITY',
    'Quality Reports',
    'تقارير الجودة',
    'Quality assurance reports including issue tracking, quality metrics, and compliance',
    'تقارير ضمان الجودة بما في ذلك تتبع المشكلات ومقاييس الجودة والامتثال',
    5,
    'award',
    '#EF4444',
    'operational',
    false,
    true,
    true,
    '{"dashboard_widget": true, "export_formats": ["pdf", "excel", "csv"], "refresh_interval": "daily", "data_retention_days": 365, "default_date_range": "last_30_days"}'::jsonb
  ),
  (
    'SYSTEM',
    'System Reports',
    'تقارير النظام',
    'System and platform reports including tenant activity, user activity, and system health',
    'تقارير النظام والمنصة بما في ذلك نشاط المستأجرين ونشاط المستخدمين وصحة النظام',
    6,
    'server',
    '#6B7280',
    'operational',
    true,
    true,
    true,
    '{"dashboard_widget": false, "export_formats": ["pdf", "excel", "csv"], "refresh_interval": "hourly", "data_retention_days": 90, "default_date_range": "last_7_days"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  report_type = EXCLUDED.report_type,
  requires_admin_access = EXCLUDED.requires_admin_access,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_metric_type_cd
-- ==================================================================

INSERT INTO sys_metric_type_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  category_code,
  metric_group,
  data_type,
  unit,
  aggregation_period,
  requires_date_range,
  format_pattern,
  decimal_places,
  show_trend,
  show_percentage,
  is_system,
  is_active,
  metadata
) VALUES
  -- Revenue Metrics
  (
    'REVENUE',
    'Total Revenue',
    'إجمالي الإيرادات',
    'Total revenue from all orders',
    'إجمالي الإيرادات من جميع الطلبات',
    1,
    'dollar-sign',
    '#10B981',
    'FINANCIAL',
    'revenue',
    'currency',
    'SAR',
    'daily',
    true,
    '#,##0.00',
    2,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "high", "alert_on_threshold": true, "comparison_period": "previous_period", "data_source": "orders", "filters": ["tenant_id", "date_range"]}'::jsonb
  ),
  (
    'REVENUE_MONTHLY',
    'Monthly Revenue',
    'الإيرادات الشهرية',
    'Total revenue for the current month',
    'إجمالي الإيرادات للشهر الحالي',
    2,
    'calendar',
    '#10B981',
    'FINANCIAL',
    'revenue',
    'currency',
    'SAR',
    'monthly',
    true,
    '#,##0.00',
    2,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "high", "comparison_period": "previous_month", "data_source": "orders"}'::jsonb
  ),
  (
    'AVERAGE_ORDER_VALUE',
    'Average Order Value',
    'متوسط قيمة الطلب',
    'Average revenue per order',
    'متوسط الإيرادات لكل طلب',
    3,
    'trending-up',
    '#10B981',
    'FINANCIAL',
    'revenue',
    'currency',
    'SAR',
    'daily',
    true,
    '#,##0.00',
    2,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "comparison_period": "previous_period", "data_source": "orders"}'::jsonb
  ),
  (
    'REVENUE_GROWTH_RATE',
    'Revenue Growth Rate',
    'معدل نمو الإيرادات',
    'Percentage change in revenue compared to previous period',
    'النسبة المئوية للتغيير في الإيرادات مقارنة بالفترة السابقة',
    4,
    'arrow-up-right',
    '#10B981',
    'FINANCIAL',
    'revenue',
    'percentage',
    'percent',
    'daily',
    true,
    '#,##0.00',
    2,
    true,
    true,
    true,
    true,
    '{"dashboard_priority": "high", "comparison_period": "previous_period", "data_source": "orders"}'::jsonb
  ),
  -- Order Metrics
  (
    'ORDERS_COUNT',
    'Total Orders',
    'إجمالي الطلبات',
    'Total number of orders',
    'إجمالي عدد الطلبات',
    10,
    'shopping-cart',
    '#3B82F6',
    'OPERATIONAL',
    'orders',
    'count',
    'orders',
    'daily',
    true,
    '#,##0',
    0,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "high", "alert_on_threshold": true, "comparison_period": "previous_period", "data_source": "orders"}'::jsonb
  ),
  (
    'ORDERS_TODAY',
    'Orders Today',
    'الطلبات اليوم',
    'Number of orders created today',
    'عدد الطلبات التي تم إنشاؤها اليوم',
    11,
    'calendar',
    '#3B82F6',
    'OPERATIONAL',
    'orders',
    'count',
    'orders',
    'daily',
    false,
    '#,##0',
    0,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "high", "data_source": "orders", "real_time": true}'::jsonb
  ),
  (
    'ORDERS_PENDING',
    'Pending Orders',
    'الطلبات المعلقة',
    'Number of orders currently in progress',
    'عدد الطلبات قيد التنفيذ حالياً',
    12,
    'clock',
    '#F59E0B',
    'OPERATIONAL',
    'orders',
    'count',
    'orders',
    'real_time',
    false,
    '#,##0',
    0,
    false,
    false,
    true,
    true,
    '{"dashboard_priority": "high", "data_source": "orders", "real_time": true}'::jsonb
  ),
  (
    'ORDERS_COMPLETED',
    'Completed Orders',
    'الطلبات المكتملة',
    'Number of orders completed in the selected period',
    'عدد الطلبات المكتملة في الفترة المحددة',
    13,
    'check-circle',
    '#10B981',
    'OPERATIONAL',
    'orders',
    'count',
    'orders',
    'daily',
    true,
    '#,##0',
    0,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "comparison_period": "previous_period", "data_source": "orders"}'::jsonb
  ),
  (
    'ORDERS_CANCELLED',
    'Cancelled Orders',
    'الطلبات الملغاة',
    'Number of cancelled orders',
    'عدد الطلبات الملغاة',
    14,
    'x-circle',
    '#EF4444',
    'OPERATIONAL',
    'orders',
    'count',
    'orders',
    'daily',
    true,
    '#,##0',
    0,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "alert_on_threshold": true, "comparison_period": "previous_period", "data_source": "orders"}'::jsonb
  ),
  (
    'ORDER_COMPLETION_RATE',
    'Order Completion Rate',
    'معدل إتمام الطلب',
    'Percentage of orders completed successfully',
    'نسبة الطلبات المكتملة بنجاح',
    15,
    'target',
    '#3B82F6',
    'OPERATIONAL',
    'orders',
    'percentage',
    'percent',
    'daily',
    true,
    '#,##0.00',
    2,
    true,
    true,
    true,
    true,
    '{"dashboard_priority": "high", "alert_on_threshold": true, "comparison_period": "previous_period", "data_source": "orders"}'::jsonb
  ),
  (
    'AVERAGE_ORDER_TURNAROUND',
    'Average Order Turnaround',
    'متوسط وقت إتمام الطلب',
    'Average time to complete an order',
    'متوسط الوقت لإتمام الطلب',
    16,
    'timer',
    '#3B82F6',
    'OPERATIONAL',
    'orders',
    'duration',
    'hours',
    'daily',
    true,
    '#,##0.00',
    2,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "comparison_period": "previous_period", "data_source": "orders"}'::jsonb
  ),
  -- Customer Metrics
  (
    'CUSTOMER_COUNT',
    'Total Customers',
    'إجمالي العملاء',
    'Total number of active customers',
    'إجمالي عدد العملاء النشطين',
    20,
    'users',
    '#8B5CF6',
    'CUSTOMER',
    'customers',
    'count',
    'customers',
    'daily',
    false,
    '#,##0',
    0,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "high", "comparison_period": "previous_period", "data_source": "customers"}'::jsonb
  ),
  (
    'NEW_CUSTOMERS',
    'New Customers',
    'العملاء الجدد',
    'Number of new customers in the selected period',
    'عدد العملاء الجدد في الفترة المحددة',
    21,
    'user-plus',
    '#8B5CF6',
    'CUSTOMER',
    'customers',
    'count',
    'customers',
    'daily',
    true,
    '#,##0',
    0,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "high", "comparison_period": "previous_period", "data_source": "customers"}'::jsonb
  ),
  (
    'CUSTOMER_RETENTION_RATE',
    'Customer Retention Rate',
    'معدل الاحتفاظ بالعملاء',
    'Percentage of customers who made repeat orders',
    'نسبة العملاء الذين قاموا بطلبات متكررة',
    22,
    'repeat',
    '#8B5CF6',
    'CUSTOMER',
    'customers',
    'percentage',
    'percent',
    'monthly',
    true,
    '#,##0.00',
    2,
    true,
    true,
    true,
    true,
    '{"dashboard_priority": "high", "alert_on_threshold": true, "comparison_period": "previous_month", "data_source": "customers"}'::jsonb
  ),
  (
    'CUSTOMER_LIFETIME_VALUE',
    'Customer Lifetime Value',
    'القيمة الدائمة للعميل',
    'Average total revenue per customer',
    'متوسط إجمالي الإيرادات لكل عميل',
    23,
    'dollar-sign',
    '#8B5CF6',
    'CUSTOMER',
    'customers',
    'currency',
    'SAR',
    'monthly',
    true,
    '#,##0.00',
    2,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "comparison_period": "previous_month", "data_source": "customers"}'::jsonb
  ),
  (
    'AVERAGE_ORDERS_PER_CUSTOMER',
    'Average Orders per Customer',
    'متوسط الطلبات لكل عميل',
    'Average number of orders per customer',
    'متوسط عدد الطلبات لكل عميل',
    24,
    'shopping-bag',
    '#8B5CF6',
    'CUSTOMER',
    'customers',
    'average',
    'orders',
    'monthly',
    true,
    '#,##0.00',
    2,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "comparison_period": "previous_month", "data_source": "customers"}'::jsonb
  ),
  -- Inventory Metrics
  (
    'PRODUCTS_COUNT',
    'Total Products',
    'إجمالي المنتجات',
    'Total number of products in catalog',
    'إجمالي عدد المنتجات في الكتالوج',
    30,
    'package',
    '#F59E0B',
    'INVENTORY',
    'inventory',
    'count',
    'products',
    'daily',
    false,
    '#,##0',
    0,
    false,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "data_source": "products"}'::jsonb
  ),
  (
    'PRODUCTS_USED',
    'Products Used',
    'المنتجات المستخدمة',
    'Number of products used in orders',
    'عدد المنتجات المستخدمة في الطلبات',
    31,
    'package-check',
    '#F59E0B',
    'INVENTORY',
    'inventory',
    'count',
    'products',
    'daily',
    true,
    '#,##0',
    0,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "comparison_period": "previous_period", "data_source": "products"}'::jsonb
  ),
  (
    'MOST_USED_PRODUCTS',
    'Most Used Products',
    'المنتجات الأكثر استخداماً',
    'Top products by usage count',
    'أفضل المنتجات حسب عدد الاستخدامات',
    32,
    'star',
    '#F59E0B',
    'INVENTORY',
    'inventory',
    'count',
    'products',
    'daily',
    true,
    '#,##0',
    0,
    false,
    false,
    true,
    true,
    '{"dashboard_priority": "low", "data_source": "products", "limit": 10}'::jsonb
  ),
  -- Quality Metrics
  (
    'QUALITY_ISSUES_COUNT',
    'Quality Issues',
    'مشاكل الجودة',
    'Total number of quality issues reported',
    'إجمالي عدد مشاكل الجودة المبلغ عنها',
    40,
    'alert-triangle',
    '#EF4444',
    'QUALITY',
    'quality',
    'count',
    'issues',
    'daily',
    true,
    '#,##0',
    0,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "high", "alert_on_threshold": true, "comparison_period": "previous_period", "data_source": "order_issues"}'::jsonb
  ),
  (
    'QUALITY_PASS_RATE',
    'Quality Pass Rate',
    'معدل نجاح الجودة',
    'Percentage of orders that passed quality checks',
    'نسبة الطلبات التي اجتازت فحوصات الجودة',
    41,
    'check-circle-2',
    '#10B981',
    'QUALITY',
    'quality',
    'percentage',
    'percent',
    'daily',
    true,
    '#,##0.00',
    2,
    true,
    true,
    true,
    true,
    '{"dashboard_priority": "high", "alert_on_threshold": true, "comparison_period": "previous_period", "data_source": "quality_checks"}'::jsonb
  ),
  (
    'AVERAGE_ISSUES_PER_ORDER',
    'Average Issues per Order',
    'متوسط المشاكل لكل طلب',
    'Average number of quality issues per order',
    'متوسط عدد مشاكل الجودة لكل طلب',
    42,
    'alert-circle',
    '#EF4444',
    'QUALITY',
    'quality',
    'average',
    'issues',
    'daily',
    true,
    '#,##0.00',
    2,
    true,
    false,
    true,
    true,
    '{"dashboard_priority": "medium", "alert_on_threshold": true, "comparison_period": "previous_period", "data_source": "order_issues"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  category_code = EXCLUDED.category_code,
  metric_group = EXCLUDED.metric_group,
  data_type = EXCLUDED.data_type,
  unit = EXCLUDED.unit,
  aggregation_period = EXCLUDED.aggregation_period,
  requires_date_range = EXCLUDED.requires_date_range,
  format_pattern = EXCLUDED.format_pattern,
  decimal_places = EXCLUDED.decimal_places,
  show_trend = EXCLUDED.show_trend,
  show_percentage = EXCLUDED.show_percentage,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- REGISTER TABLES IN REGISTRY
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  description,
  description2,
  category,
  display_order,
  is_editable,
  is_extensible,
  supports_tenant_override,
  requires_unique_name,
  metadata
) VALUES
  (
    'sys_report_category_cd',
    'Report Categories',
    'فئات التقارير',
    'Categories for organizing reports and analytics',
    'فئات لتنظيم التقارير والتحليلات',
    'Reports & Analytics',
    1,
    true,
    true,
    false,
    true,
    '{"icon": "file-bar-chart", "color": "#3B82F6", "help_text": "Organize reports into categories for better navigation"}'::jsonb
  ),
  (
    'sys_metric_type_cd',
    'Metric Types',
    'أنواع المقاييس',
    'Types of metrics and KPIs for analytics and dashboards',
    'أنواع المقاييس ومؤشرات الأداء الرئيسية للتحليلات ولوحات المعلومات',
    'Reports & Analytics',
    2,
    true,
    true,
    false,
    true,
    '{"icon": "trending-up", "color": "#10B981", "help_text": "Define metric types for tracking KPIs and analytics"}'::jsonb
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;


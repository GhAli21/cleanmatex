-- =============================================================================
-- 0345_ntf_catalog_seed.sql
-- Purpose: Notification Hub – seed all 27 categories, 115 events, and
--          default event-channel mappings into the catalog tables.
-- PRD: CMX-PRD-019 · Source: notification_event_catalog.csv
-- Author: CleanMateX Development Team
-- Created: 2026-06-06
-- =============================================================================
-- Idempotent: all INSERTs use ON CONFLICT DO UPDATE so re-running is safe.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1 — Categories (27)
-- =============================================================================

INSERT INTO sys_ntf_categories_cd
  (code, name, name2, description, description2, icon, color, display_order)
VALUES
  ('ORDER',        'Order',         'الطلب',            'Order lifecycle events',             'أحداث دورة حياة الطلب',          'shopping-bag',    '#3B82F6', 10),
  ('ORDER_ITEM',   'Order Item',    'عنصر الطلب',       'Order item-level events',            'أحداث عناصر الطلب',              'tag',             '#6366F1', 11),
  ('PREPARATION',  'Preparation',   'التحضير',           'Quick-drop preparation events',      'أحداث تحضير الطلبات السريعة',    'scissors',        '#8B5CF6', 12),
  ('PROCESSING',   'Processing',    'المعالجة',          'Laundry processing step events',     'أحداث خطوات المعالجة',           'settings',        '#A78BFA', 13),
  ('ASSEMBLY',     'Assembly',      'التجميع',           'Assembly stage events',              'أحداث مرحلة التجميع',            'layers',          '#7C3AED', 14),
  ('QA',           'Quality Check', 'فحص الجودة',        'Quality assurance events',           'أحداث ضمان الجودة',              'check-circle',    '#10B981', 15),
  ('PACKING',      'Packing',       'التعبئة',           'Packing completion events',          'أحداث اكتمال التعبئة',           'package',         '#059669', 16),
  ('PICKUP',       'Pickup',        'الاستلام',          'Pickup scheduling and completion',   'أحداث جدولة واكتمال الاستلام',   'map-pin',         '#F59E0B', 20),
  ('DELIVERY',     'Delivery',      'التوصيل',           'Delivery assignment and completion', 'أحداث التوصيل وإتمامه',          'truck',           '#EF4444', 21),
  ('PAYMENT',      'Payment',       'الدفع',             'Payment transaction events',         'أحداث معاملات الدفع',            'credit-card',     '#10B981', 30),
  ('REFUND',       'Refund',        'الاسترداد',         'Refund request and processing',      'أحداث طلب ومعالجة الاسترداد',    'corner-up-left',  '#F59E0B', 31),
  ('INVOICE',      'Invoice',       'الفاتورة',          'Invoice and credit note events',     'أحداث الفاتورة وإشعار الدائن',   'file-text',       '#3B82F6', 32),
  ('STATEMENT',    'Statement',     'كشف الحساب',        'Account statement events',           'أحداث كشف الحساب',               'bar-chart-2',     '#6366F1', 33),
  ('CUSTOMER',     'Customer',      'العميل',            'Customer profile events',            'أحداث ملف العميل',               'user',            '#F59E0B', 40),
  ('LOYALTY',      'Loyalty',       'الولاء',            'Loyalty points and tier events',     'أحداث نقاط الولاء والمستويات',   'award',           '#EC4899', 41),
  ('WALLET',       'Wallet',        'المحفظة',           'Wallet balance events',              'أحداث رصيد المحفظة',             'pocket',          '#8B5CF6', 42),
  ('GIFTCARD',     'Gift Card',     'بطاقة الهدية',      'Gift card lifecycle events',         'أحداث دورة حياة بطاقة الهدية',   'gift',            '#EC4899', 43),
  ('MEMBERSHIP',   'Membership',    'العضوية',           'Membership lifecycle events',        'أحداث دورة حياة العضوية',        'star',            '#F59E0B', 44),
  ('STAFF',        'Staff',         'الموظف',            'Staff task and attendance events',   'أحداث مهام وحضور الموظفين',      'users',           '#6366F1', 50),
  ('INVENTORY',    'Inventory',     'المخزون',           'Inventory stock events',             'أحداث مخزون المستودع',           'archive',         '#EF4444', 51),
  ('MACHINE',      'Machine',       'الآلة',             'Machine maintenance and downtime',   'أحداث صيانة الآلات وتعطلها',     'tool',            '#F59E0B', 52),
  ('MARKETING',    'Marketing',     'التسويق',           'Campaign and engagement events',     'أحداث الحملات التسويقية',        'megaphone',       '#EC4899', 60),
  ('SUBSCRIPTION', 'Subscription',  'الاشتراك',          'Tenant subscription lifecycle',      'دورة حياة اشتراك المستأجر',      'repeat',          '#3B82F6', 70),
  ('PLAN_LIMIT',   'Plan Limit',    'حد الخطة',          'Plan quota warning and breach',      'تحذير وتجاوز حصة الخطة',         'alert-triangle',  '#EF4444', 71),
  ('SECURITY',     'Security',      'الأمان',            'Security and access events',         'أحداث الأمان والوصول',           'shield',          '#EF4444', 80),
  ('SYSTEM',       'System',        'النظام',            'System maintenance and provider',    'صيانة النظام ومزود الخدمة',      'server',          '#6366F1', 90),
  ('WORKFLOW',     'Workflow',      'مسار العمل',         'Order workflow stage transitions',   'انتقالات مراحل مسار الطلب',      'git-branch',      '#A78BFA', 95)
ON CONFLICT (code) DO UPDATE SET
  name         = EXCLUDED.name,
  name2        = EXCLUDED.name2,
  description  = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  icon         = EXCLUDED.icon,
  color        = EXCLUDED.color,
  display_order= EXCLUDED.display_order,
  updated_at   = CURRENT_TIMESTAMP;

-- =============================================================================
-- SECTION 2 — Events (115)
-- Columns: code, category_code, name, name2, description, description2,
--          priority, is_transactional, requires_consent,
--          default_recipients, idempotency_key_pattern
-- =============================================================================

INSERT INTO sys_ntf_events_cd
  (code, category_code, name, name2, description, description2,
   priority, is_transactional, requires_consent,
   default_recipients, idempotency_key_pattern)
VALUES

-- ---- ORDER (13) ----
('order.created',             'ORDER', 'Order Created',           'تم إنشاء الطلب',         'Order record created from any channel',                  'تم إنشاء سجل الطلب من أي قناة',                        'NORMAL',  true,  false, ARRAY['customer','staff','tenant_admin'],             '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.quick_drop.created',  'ORDER', 'Quick Drop Created',      'طلب سريع مُنشأ',          'Quick-drop bag accepted before full itemization',         'تم قبول الكيس السريع قبل الجرد الكامل',                 'NORMAL',  true,  false, ARRAY['preparation_staff','customer'],                '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.preparation.required','ORDER', 'Preparation Required',    'التحضير مطلوب',           'Quick-drop order needs itemization',                      'الطلب السريع يحتاج إلى جرد',                            'HIGH',    true,  false, ARRAY['preparation_staff','branch_manager'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.prepared',            'ORDER', 'Order Prepared',          'الطلب مُحضَّر',           'Items itemized and ready for processing',                 'العناصر مُحصاة وجاهزة للمعالجة',                       'NORMAL',  true,  false, ARRAY['customer','processing_staff'],                 '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.processing.started',  'ORDER', 'Processing Started',      'بدأت المعالجة',           'Order enters processing workflow',                        'الطلب يدخل مسار المعالجة',                              'NORMAL',  true,  false, ARRAY['customer','staff'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.ready',               'ORDER', 'Order Ready',             'الطلب جاهز',             'Order ready for pickup or delivery',                      'الطلب جاهز للاستلام أو التوصيل',                        'HIGH',    true,  false, ARRAY['customer','driver','reception'],               '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.delayed',             'ORDER', 'Order Delayed',           'تأخر الطلب',             'Ready-by time is at risk or missed',                      'وقت الاستعداد في خطر أو فات',                           'HIGH',    true,  false, ARRAY['customer','branch_manager'],                  '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.cancelled',           'ORDER', 'Order Cancelled',         'تم إلغاء الطلب',         'Order cancelled by staff, customer, or policy',           'تم إلغاء الطلب من الموظف أو العميل أو السياسة',        'HIGH',    true,  false, ARRAY['customer','tenant_admin'],                     '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.closed',              'ORDER', 'Order Closed',            'الطلب مغلق',             'Order financially and operationally closed',              'الطلب مغلق ماليًا وتشغيليًا',                           'NORMAL',  true,  false, ARRAY['customer','tenant_admin'],                     '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.priority.changed',    'ORDER', 'Priority Changed',        'تغيّرت الأولوية',         'Order priority changed by authorized user',               'تم تغيير أولوية الطلب من مستخدم مصرح له',              'NORMAL',  true,  false, ARRAY['staff','branch_manager'],                     '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.split.created',       'ORDER', 'Split Order Created',     'تم تقسيم الطلب',         'Parent order split into sub-order',                       'الطلب الأصلي مقسم إلى طلب فرعي',                        'HIGH',    true,  false, ARRAY['customer','staff','finance'],                  '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.issue.created',       'ORDER', 'Order Issue Created',     'مشكلة طلب مُنشأة',       'Issue-to-solve created before or after delivery',         'تم إنشاء مشكلة للحل قبل أو بعد التوصيل',               'HIGH',    true,  false, ARRAY['customer','qa_staff','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.issue.resolved',      'ORDER', 'Order Issue Resolved',    'مشكلة الطلب محلولة',     'Issue-to-solve resolved',                                 'تم حل المشكلة',                                          'NORMAL',  true,  false, ARRAY['customer','qa_staff','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- ORDER_ITEM (5) ----
('order.item.added',          'ORDER_ITEM', 'Item Added',         'تمت إضافة عنصر',         'Item added to order during intake or preparation',        'تمت إضافة عنصر إلى الطلب أثناء الاستقبال أو التحضير',  'LOW',     true,  false, ARRAY['customer','staff'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.item.removed',        'ORDER_ITEM', 'Item Removed',       'تمت إزالة عنصر',         'Item removed from order with audit trail',                'تمت إزالة عنصر مع سجل تدقيق',                           'NORMAL',  true,  false, ARRAY['customer','staff'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.item.missing',        'ORDER_ITEM', 'Item Missing',       'عنصر مفقود',             'Expected scanned item is missing during assembly or QA',  'العنصر المُفحَص غائب أثناء التجميع أو ضبط الجودة',     'URGENT',  true,  false, ARRAY['qa_staff','branch_manager','customer'],        '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.item.damaged',        'ORDER_ITEM', 'Item Damaged',       'عنصر تالف',              'Damage recorded for a garment or piece',                  'تم تسجيل تلف لقطعة ملابس',                              'URGENT',  true,  false, ARRAY['qa_staff','branch_manager','customer'],        '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('order.item.rework.required','ORDER_ITEM', 'Rework Required',    'إعادة المعالجة مطلوبة',  'QA rejects item and sends it back for reprocessing',      'ضبط الجودة يرفض العنصر ويعيده للمعالجة',               'HIGH',    true,  false, ARRAY['processing_staff','qa_staff','branch_manager'],'{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- PREPARATION (2) ----
('preparation.task.created',  'PREPARATION', 'Prep Task Created', 'تم إنشاء مهمة التحضير',  'Task created for quick-drop itemization',                 'تم إنشاء مهمة للجرد السريع',                            'HIGH',    true,  false, ARRAY['preparation_staff'],                           '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('preparation.task.completed','PREPARATION', 'Prep Task Done',    'مهمة التحضير مكتملة',    'All required preparation is complete',                    'اكتمل جميع التحضير المطلوب',                             'NORMAL',  true,  false, ARRAY['processing_staff','reception'],                '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- PROCESSING (1) ----
('processing.step.completed', 'PROCESSING', 'Step Completed',     'الخطوة مكتملة',          'Sorting, pretreatment, washing, drying, or finishing done','تمت خطوة الفرز أو المعالجة المسبقة أو الغسيل أو التجفيف أو التشطيب', 'LOW', true, false, ARRAY['staff','branch_manager'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- ASSEMBLY (3) ----
('assembly.started',          'ASSEMBLY', 'Assembly Started',     'بدأ التجميع',             'Assembly task starts for expected pieces',                 'بدأت مهمة التجميع للقطع المتوقعة',                      'NORMAL',  true,  false, ARRAY['assembly_staff'],                              '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('assembly.exception',        'ASSEMBLY', 'Assembly Exception',   'استثناء تجميع',           'Missing, wrong, damaged, or extra item detected',          'تم اكتشاف عنصر مفقود أو خاطئ أو تالف أو زائد',         'URGENT',  true,  false, ARRAY['qa_staff','branch_manager'],                   '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('assembly.completed',        'ASSEMBLY', 'Assembly Completed',   'اكتمل التجميع',           'All expected items assembled',                             'تم تجميع جميع العناصر المتوقعة',                         'NORMAL',  true,  false, ARRAY['qa_staff','packing_staff'],                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- QA (3) ----
('qa.started',                'QA', 'QA Started',                 'بدأ فحص الجودة',          'Quality assurance inspection started',                     'بدأ فحص الجودة',                                         'NORMAL',  true,  false, ARRAY['qa_staff'],                                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('qa.passed',                 'QA', 'QA Passed',                  'نجح فحص الجودة',          'Order or item passed quality assurance',                   'الطلب أو العنصر اجتاز فحص الجودة',                      'NORMAL',  true,  false, ARRAY['packing_staff','customer'],                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('qa.failed',                 'QA', 'QA Failed',                  'فشل فحص الجودة',          'Order or item failed quality assurance',                   'الطلب أو العنصر فشل في فحص الجودة',                     'HIGH',    true,  false, ARRAY['processing_staff','branch_manager','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- PACKING (1) ----
('packing.completed',         'PACKING', 'Packing Done',          'اكتملت التعبئة',          'Packing list and packaging profile completed',             'اكتملت قائمة التعبئة وملف التغليف',                     'NORMAL',  true,  false, ARRAY['reception','driver','customer'],                '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- PICKUP (4) ----
('pickup.scheduled',          'PICKUP', 'Pickup Scheduled',       'تم جدولة الاستلام',       'Customer schedules pickup',                                'العميل يحدد موعد الاستلام',                              'NORMAL',  true,  false, ARRAY['customer','driver','branch_staff'],             '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('pickup.reminder',           'PICKUP', 'Pickup Reminder',        'تذكير بالاستلام',         'Reminder sent before pickup time',                         'إرسال تذكير قبل وقت الاستلام',                           'NORMAL',  true,  false, ARRAY['customer','driver'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('pickup.driver_assigned',    'PICKUP', 'Driver Assigned',        'تم تعيين السائق',         'Driver assigned for pickup',                               'تم تعيين سائق للاستلام',                                 'NORMAL',  true,  false, ARRAY['customer','driver'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('pickup.completed',          'PICKUP', 'Pickup Completed',       'اكتمل الاستلام',          'Pickup proof captured',                                    'تم التقاط دليل الاستلام',                                 'NORMAL',  true,  false, ARRAY['customer','branch_staff'],                     '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- DELIVERY (7) ----
('delivery.assigned',         'DELIVERY', 'Delivery Assigned',    'تم تعيين التوصيل',        'Driver receives delivery task',                            'السائق يستلم مهمة التوصيل',                              'HIGH',    true,  false, ARRAY['driver','customer'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('delivery.out_for_delivery', 'DELIVERY', 'Out for Delivery',     'في طريق التوصيل',         'Order leaves branch or plant',                             'الطلب يغادر الفرع أو المصنع',                             'HIGH',    true,  false, ARRAY['customer','driver','reception'],                '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('delivery.otp_generated',    'DELIVERY', 'OTP Generated',        'تم إنشاء رمز OTP',        'OTP generated for proof of delivery',                      'تم إنشاء رمز التحقق لإثبات التوصيل',                     'URGENT',  true,  false, ARRAY['customer','driver'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('delivery.arrived',          'DELIVERY', 'Driver Arrived',       'وصل السائق',             'Driver is at customer location',                           'السائق في موقع العميل',                                  'URGENT',  true,  false, ARRAY['customer'],                                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('delivery.failed',           'DELIVERY', 'Delivery Failed',      'فشل التوصيل',            'Delivery attempt failed',                                  'فشلت محاولة التوصيل',                                     'HIGH',    true,  false, ARRAY['customer','driver','branch_manager'],           '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('delivery.delivered',        'DELIVERY', 'Delivered',            'تم التسليم',             'Delivery proof captured',                                  'تم التقاط دليل التسليم',                                  'NORMAL',  true,  false, ARRAY['customer','tenant_admin'],                     '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('delivery.collected',        'DELIVERY', 'Collected',            'تم الاستلام',            'Customer collected from branch',                           'العميل استلم الطلب من الفرع',                             'NORMAL',  true,  false, ARRAY['customer','staff'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- PAYMENT (5) ----
('payment.requested',         'PAYMENT', 'Payment Requested',     'طُلب الدفع',             'Payment link or amount issued',                            'تم إصدار رابط أو مبلغ الدفع',                            'HIGH',    true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('payment.received',          'PAYMENT', 'Payment Received',      'تم استلام الدفع',         'Payment or voucher successfully recorded',                  'تم تسجيل الدفع أو القسيمة بنجاح',                        'NORMAL',  true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('payment.failed',            'PAYMENT', 'Payment Failed',        'فشل الدفع',              'Payment failed via any method',                            'فشل الدفع بأي طريقة',                                    'HIGH',    true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('payment.partial_received',  'PAYMENT', 'Partial Payment',       'دفع جزئي',               'Partial payment recorded',                                 'تم تسجيل دفع جزئي',                                      'NORMAL',  true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('payment.collection_due',    'PAYMENT', 'Collection Due',        'مستحق التحصيل',           'Pay-on-collection amount outstanding',                     'مبلغ الدفع عند الاستلام مستحق',                           'HIGH',    true,  false, ARRAY['customer','reception','driver'],                '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- REFUND (4) ----
('refund.requested',          'REFUND', 'Refund Requested',       'طُلب الاسترداد',          'Refund request created',                                   'تم إنشاء طلب استرداد',                                   'HIGH',    true,  false, ARRAY['customer','finance','tenant_admin'],            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('refund.approved',           'REFUND', 'Refund Approved',        'تمت الموافقة على الاسترداد','Refund approved by authorized role',                       'تمت الموافقة على الاسترداد من قِبل دور مخوّل',           'HIGH',    true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('refund.rejected',           'REFUND', 'Refund Rejected',        'تم رفض الاسترداد',        'Refund rejected with reason',                              'تم رفض الاسترداد مع السبب',                               'HIGH',    true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('refund.processed',          'REFUND', 'Refund Processed',       'تمت معالجة الاسترداد',    'Refund sent to gateway, wallet, cash, or voucher',         'تم إرسال الاسترداد إلى البوابة أو المحفظة أو النقد',     'NORMAL',  true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- INVOICE (3) ----
('invoice.issued',            'INVOICE', 'Invoice Issued',        'تم إصدار الفاتورة',       'Tax or AR invoice issued',                                 'تم إصدار فاتورة ضريبية أو فاتورة ذمم مدينة',             'NORMAL',  true,  false, ARRAY['customer','finance','b2b_contact'],             '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('invoice.cancelled',         'INVOICE', 'Invoice Cancelled',     'تم إلغاء الفاتورة',       'Invoice cancelled or voided',                              'تم إلغاء الفاتورة أو إبطالها',                            'HIGH',    true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('credit_note.issued',        'INVOICE', 'Credit Note Issued',    'تم إصدار إشعار الدائن',   'Credit note issued for reversal or refund',                'تم إصدار إشعار الدائن للتسوية أو الاسترداد',             'NORMAL',  true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- STATEMENT (2) ----
('statement.generated',       'STATEMENT', 'Statement Generated', 'تم إنشاء الكشف',          'B2B or customer statement generated',                      'تم إنشاء كشف حساب B2B أو العميل',                        'NORMAL',  true,  false, ARRAY['b2b_contact','finance'],                       '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('statement.overdue',         'STATEMENT', 'Statement Overdue',   'الكشف متأخر',             'Statement due date passed',                                'مر الموعد النهائي لكشف الحساب',                           'HIGH',    true,  false, ARRAY['b2b_contact','finance'],                       '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- CUSTOMER (3) ----
('customer.stub.created',     'CUSTOMER', 'Stub Customer',        'عميل مبدئي مُنشأ',        'POS creates minimal customer profile',                     'نقطة البيع تنشئ ملف عميل أدنى',                          'NORMAL',  true,  false, ARRAY['customer','reception'],                        '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('customer.upgraded',         'CUSTOMER', 'Customer Upgraded',    'تمت ترقية العميل',         'Stub becomes full app profile after OTP',                  'الملف المبدئي يصبح ملفًا كاملًا بعد OTP',                'NORMAL',  true,  false, ARRAY['customer','tenant_admin'],                     '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('customer.profile.updated',  'CUSTOMER', 'Profile Updated',      'تم تحديث الملف الشخصي',   'Customer updates profile, address, or preference',         'العميل يحدث الملف الشخصي أو العنوان أو التفضيلات',       'LOW',     true,  false, ARRAY['customer','staff'],                            '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- LOYALTY (3) ----
('loyalty.points_added',      'LOYALTY', 'Points Added',          'تمت إضافة النقاط',         'Loyalty points earned after eligible order or payment',    'تم اكتساب نقاط الولاء بعد طلب أو دفع مؤهل',             'LOW',     true,  false, ARRAY['customer'],                                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('loyalty.points_redeemed',   'LOYALTY', 'Points Redeemed',       'تم استبدال النقاط',        'Customer uses loyalty points',                             'العميل يستخدم نقاط الولاء',                               'NORMAL',  true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('loyalty.tier_changed',      'LOYALTY', 'Tier Changed',          'تغير مستوى العضوية',       'Customer moves to new loyalty tier',                       'العميل ينتقل إلى مستوى ولاء جديد',                       'NORMAL',  true,  false, ARRAY['customer'],                                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- WALLET (2) ----
('wallet.topup',              'WALLET', 'Wallet Top-Up',          'إعادة شحن المحفظة',        'Wallet receives balance',                                  'المحفظة تستقبل رصيدًا',                                   'NORMAL',  true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('wallet.debited',            'WALLET', 'Wallet Debited',         'تم خصم المحفظة',           'Wallet used to pay or adjust',                             'المحفظة مستخدمة للدفع أو التسوية',                       'NORMAL',  true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- GIFTCARD (2) ----
('giftcard.issued',           'GIFTCARD', 'Gift Card Issued',     'تم إصدار بطاقة هدية',     'Gift card code generated or sold',                         'تم إنشاء أو بيع رمز بطاقة الهدية',                       'NORMAL',  true,  false, ARRAY['customer','finance'],                          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('giftcard.activated',        'GIFTCARD', 'Gift Card Activated',  'تم تفعيل بطاقة الهدية',   'Gift card becomes usable',                                 'أصبحت بطاقة الهدية قابلة للاستخدام',                     'NORMAL',  true,  false, ARRAY['customer'],                                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- MEMBERSHIP (3) ----
('membership.started',        'MEMBERSHIP', 'Membership Started', 'بدأت العضوية',             'Customer membership or subscription starts',               'بدأت عضوية العميل أو اشتراكه',                           'NORMAL',  true,  false, ARRAY['customer'],                                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('membership.renewal_due',    'MEMBERSHIP', 'Renewal Due',        'موعد التجديد',             'Membership renewal date approaches',                       'يقترب موعد تجديد العضوية',                               'NORMAL',  true,  false, ARRAY['customer'],                                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('membership.expired',        'MEMBERSHIP', 'Membership Expired', 'انتهت العضوية',            'Membership benefits expired',                              'انتهت مزايا العضوية',                                     'NORMAL',  true,  false, ARRAY['customer'],                                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- STAFF (3) ----
('staff.task.assigned',       'STAFF', 'Task Assigned',           'تم تعيين مهمة',            'Task assigned to role or user',                            'تم تعيين مهمة لدور أو مستخدم',                           'NORMAL',  true,  false, ARRAY['assigned_staff'],                              '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('staff.shift.started',       'STAFF', 'Shift Started',           'بدأت الوردية',             'Staff clock-in or shift starts',                           'تسجيل دخول الموظف أو بدء الوردية',                       'LOW',     true,  false, ARRAY['staff','manager'],                             '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('staff.attendance.exception','STAFF', 'Attendance Exception',    'استثناء الحضور',           'Late, missing check-out, or absence detected',             'تأخر أو غياب تسجيل الخروج أو الغياب',                    'NORMAL',  true,  false, ARRAY['staff','manager'],                             '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- INVENTORY (3) ----
('inventory.low_stock',       'INVENTORY', 'Low Stock',           'مخزون منخفض',             'Inventory item reaches threshold',                         'وصل عنصر المخزون إلى الحد الأدنى',                       'HIGH',    true,  false, ARRAY['inventory_staff','branch_manager'],             '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('inventory.reorder_created', 'INVENTORY', 'Reorder Created',     'تم إنشاء طلب إعادة توريد','Purchase request or reorder created',                      'تم إنشاء طلب شراء أو إعادة توريد',                       'NORMAL',  true,  false, ARRAY['inventory_staff','tenant_admin'],               '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('inventory.stockout',        'INVENTORY', 'Stockout',            'نفاد المخزون',             'Inventory item unavailable',                               'عنصر المخزون غير متاح',                                  'URGENT',  true,  false, ARRAY['inventory_staff','branch_manager'],             '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- MACHINE (3) ----
('machine.maintenance_due',   'MACHINE', 'Maintenance Due',       'صيانة مستحقة',             'Machine maintenance threshold reached',                    'وصلت الآلة إلى حد الصيانة',                              'HIGH',    true,  false, ARRAY['ops_manager','branch_manager'],                '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('machine.downtime_started',  'MACHINE', 'Downtime Started',      'بدأ التعطل',               'Machine marked as down',                                   'تم تحديد الآلة بأنها معطلة',                              'HIGH',    true,  false, ARRAY['ops_manager','branch_manager'],                '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('machine.downtime_resolved', 'MACHINE', 'Downtime Resolved',     'تم حل التعطل',             'Machine is active again',                                  'الآلة نشطة مرة أخرى',                                    'NORMAL',  true,  false, ARRAY['ops_manager','branch_manager'],                '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- MARKETING (11) ----
('campaign.created',               'MARKETING', 'Campaign Created',          'تم إنشاء الحملة',               'Marketing campaign draft created',                         'تم إنشاء مسودة الحملة التسويقية',                         'LOW',    true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.approved',              'MARKETING', 'Campaign Approved',         'تمت الموافقة على الحملة',       'Campaign approved and ready to send',                      'تمت الموافقة على الحملة وهي جاهزة للإرسال',              'NORMAL', true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.launched',              'MARKETING', 'Campaign Launched',         'تم إطلاق الحملة',               'Campaign run has started',                                 'بدأ تنفيذ الحملة',                                        'NORMAL', true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.completed',             'MARKETING', 'Campaign Completed',        'اكتملت الحملة',                 'Campaign run completed',                                   'اكتمل تنفيذ الحملة',                                      'NORMAL', true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.failed',                'MARKETING', 'Campaign Failed',           'فشلت الحملة',                   'Campaign failed due to provider, quota, or validation',    'الحملة فشلت بسبب مزود الخدمة أو الحصة أو التحقق',        'HIGH',   true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.recipient.opened',      'MARKETING', 'Recipient Opened',          'العميل فتح الرسالة',            'Campaign recipient opened the message',                    'فتح مستلم الحملة الرسالة',                                'LOW',    true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.recipient.clicked',     'MARKETING', 'Recipient Clicked',         'العميل نقر على الرابط',         'Campaign recipient clicked a link',                        'نقر مستلم الحملة على رابط',                               'LOW',    true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.recipient.bounced',     'MARKETING', 'Recipient Bounced',         'ارتداد الرسالة',                'Campaign message bounced',                                 'ارتدت رسالة الحملة',                                      'LOW',    true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.recipient.unsubscribed','MARKETING', 'Recipient Unsubscribed',    'إلغاء اشتراك العميل',           'Campaign recipient unsubscribed',                          'ألغى مستلم الحملة اشتراكه',                               'LOW',    true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.recipient.complained',  'MARKETING', 'Recipient Complained',      'شكوى من العميل',               'Campaign recipient filed a spam complaint',                'قدّم مستلم الحملة شكوى بريد عشوائي',                     'LOW',    true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('campaign.recipient.converted',   'MARKETING', 'Recipient Converted',       'تحويل العميل',                  'Campaign recipient completed conversion action',           'أكمل مستلم الحملة إجراء التحويل',                         'LOW',    true,  true, ARRAY['marketing_user','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- SUBSCRIPTION (3) ----
('subscription.trial_ending',      'SUBSCRIPTION', 'Trial Ending',           'انتهاء التجربة',               'Tenant trial period near end',                             'يقترب انتهاء الفترة التجريبية للمستأجر',                  'NORMAL', true,  false, ARRAY['tenant_admin','platform_success'],        '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('subscription.renewal_due',       'SUBSCRIPTION', 'Renewal Due',            'موعد التجديد',                  'Tenant subscription renewal approaching',                  'يقترب موعد تجديد اشتراك المستأجر',                       'NORMAL', true,  false, ARRAY['tenant_admin','platform_billing'],        '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('subscription.payment_failed',    'SUBSCRIPTION', 'Sub. Payment Failed',    'فشل دفع الاشتراك',              'Tenant subscription payment failed',                       'فشل دفع اشتراك المستأجر',                                 'HIGH',   true,  false, ARRAY['tenant_admin','platform_billing'],        '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- PLAN_LIMIT (2) ----
('plan.limit_reached',             'PLAN_LIMIT', 'Limit Reached',            'تم الوصول إلى الحد',            'Tenant reached plan quota',                                'وصل المستأجر إلى حصة الخطة',                              'HIGH',   true,  false, ARRAY['tenant_admin','platform_success'],        '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('plan.limit_warning',             'PLAN_LIMIT', 'Limit Warning',            'تحذير من الحد',                 'Tenant near plan quota limit',                             'المستأجر على وشك الوصول إلى حصة الخطة',                  'NORMAL', true,  false, ARRAY['tenant_admin'],                           '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- SECURITY (4) ----
('security.login.detected',        'SECURITY', 'Login Detected',             'تم اكتشاف دخول',               'New or unusual login detected',                            'تم اكتشاف دخول جديد أو غير مألوف',                       'NORMAL', true,  false, ARRAY['user','tenant_admin'],                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('security.role.changed',          'SECURITY', 'Role Changed',               'تغيّر الدور',                   'User role or permission changed',                          'تغير دور المستخدم أو صلاحياته',                          'HIGH',   true,  false, ARRAY['user','tenant_admin'],                    '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('security.password.changed',      'SECURITY', 'Password Changed',           'تغيّرت كلمة المرور',            'Password or credentials changed',                          'تغيّرت كلمة المرور أو بيانات الاعتماد',                   'HIGH',   true,  false, ARRAY['user'],                                   '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('security.suspicious_activity',   'SECURITY', 'Suspicious Activity',        'نشاط مشبوه',                   'Risky action detected',                                    'تم اكتشاف إجراء خطير',                                   'CRITICAL',true, false, ARRAY['tenant_admin','platform_security'],       '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- SYSTEM (6) ----
('system.maintenance.scheduled',   'SYSTEM', 'Maintenance Scheduled',        'صيانة مجدولة',                  'Scheduled maintenance announced',                          'تم الإعلان عن صيانة مجدولة',                             'NORMAL', true,  false, ARRAY['tenant_admin','staff','platform_users'],  '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('system.maintenance.started',     'SYSTEM', 'Maintenance Started',          'بدأت الصيانة',                  'Maintenance window started',                               'بدأت نافذة الصيانة',                                      'HIGH',   true,  false, ARRAY['tenant_admin','staff'],                   '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('system.maintenance.completed',   'SYSTEM', 'Maintenance Completed',        'اكتملت الصيانة',                'Maintenance completed successfully',                       'اكتملت الصيانة بنجاح',                                   'NORMAL', true,  false, ARRAY['tenant_admin','staff'],                   '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('provider.whatsapp.degraded',     'SYSTEM', 'WhatsApp Degraded',            'WhatsApp متدهور',               'WhatsApp provider failure or degraded performance',        'فشل مزود WhatsApp أو تدهور أداؤه',                       'HIGH',   true,  false, ARRAY['platform_admin','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('provider.sms.degraded',          'SYSTEM', 'SMS Provider Degraded',        'مزود SMS متدهور',               'SMS provider failure or degraded performance',             'فشل مزود SMS أو تدهور أداؤه',                            'HIGH',   true,  false, ARRAY['platform_admin','tenant_admin'],          '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('queue.backlog.high',             'SYSTEM', 'Queue Backlog High',           'طابور الإشعارات مرتفع',          'Notification queue backlog crosses threshold',             'تجاوز تراكم طابور الإشعارات الحد المسموح',                'CRITICAL',true, false, ARRAY['platform_admin','devops'],               '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),

-- ---- WORKFLOW (14) ----
('workflow.stage.intake.entered',          'WORKFLOW', 'Intake Stage',          'مرحلة الاستقبال',         'Order enters intake stage',           'الطلب يدخل مرحلة الاستقبال',           'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.preparing.entered',       'WORKFLOW', 'Preparing Stage',       'مرحلة التحضير',           'Order enters preparing stage',        'الطلب يدخل مرحلة التحضير',             'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.sorting.entered',         'WORKFLOW', 'Sorting Stage',         'مرحلة الفرز',             'Order enters sorting stage',          'الطلب يدخل مرحلة الفرز',               'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.pretreatment.entered',    'WORKFLOW', 'Pretreatment Stage',    'مرحلة المعالجة المسبقة',  'Order enters pretreatment stage',     'الطلب يدخل مرحلة المعالجة المسبقة',    'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.washing.entered',         'WORKFLOW', 'Washing Stage',         'مرحلة الغسيل',            'Order enters washing stage',          'الطلب يدخل مرحلة الغسيل',              'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.drying.entered',          'WORKFLOW', 'Drying Stage',          'مرحلة التجفيف',           'Order enters drying stage',           'الطلب يدخل مرحلة التجفيف',             'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.finishing.entered',       'WORKFLOW', 'Finishing Stage',       'مرحلة التشطيب',           'Order enters finishing stage',        'الطلب يدخل مرحلة التشطيب',             'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.assembly.entered',        'WORKFLOW', 'Assembly Stage',        'مرحلة التجميع',           'Order enters assembly stage',         'الطلب يدخل مرحلة التجميع',             'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.qa.entered',              'WORKFLOW', 'QA Stage',              'مرحلة الجودة',            'Order enters QA stage',               'الطلب يدخل مرحلة ضبط الجودة',          'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.packing.entered',         'WORKFLOW', 'Packing Stage',         'مرحلة التعبئة',           'Order enters packing stage',          'الطلب يدخل مرحلة التعبئة',             'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.ready.entered',           'WORKFLOW', 'Ready Stage',           'مرحلة الجاهزية',          'Order enters ready stage',            'الطلب يدخل مرحلة الجاهزية',            'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.out_for_delivery.entered','WORKFLOW', 'Out for Delivery Stage','مرحلة التوصيل',           'Order enters out-for-delivery stage', 'الطلب يدخل مرحلة التسليم',             'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.delivered.entered',       'WORKFLOW', 'Delivered Stage',       'مرحلة التسليم',           'Order enters delivered stage',        'الطلب يدخل مرحلة الاستلام',            'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}'),
('workflow.stage.closed.entered',          'WORKFLOW', 'Closed Stage',          'مرحلة الإغلاق',           'Order enters closed stage',           'الطلب يدخل مرحلة الإغلاق',             'NORMAL', true, false, ARRAY['staff','customer'], '{tenant_org_id}:{event_code}:{source_entity_id}:{recipient_id}')

ON CONFLICT (code) DO UPDATE SET
  category_code           = EXCLUDED.category_code,
  name                    = EXCLUDED.name,
  name2                   = EXCLUDED.name2,
  description             = EXCLUDED.description,
  description2            = EXCLUDED.description2,
  priority                = EXCLUDED.priority,
  is_transactional        = EXCLUDED.is_transactional,
  requires_consent        = EXCLUDED.requires_consent,
  default_recipients      = EXCLUDED.default_recipients,
  idempotency_key_pattern = EXCLUDED.idempotency_key_pattern,
  updated_at              = CURRENT_TIMESTAMP;

-- =============================================================================
-- SECTION 3 — Default Event-Channel Mappings
-- Grouped by channel for readability.
-- All events that use a given channel are listed under that channel.
-- can_override = true means a tenant/user can disable this channel per-event.
-- =============================================================================

-- ---- IN_APP mappings ----
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
VALUES
  ('order.created',                          'IN_APP', true, true),
  ('order.quick_drop.created',               'IN_APP', true, true),
  ('order.preparation.required',             'IN_APP', true, true),
  ('order.prepared',                         'IN_APP', true, true),
  ('order.processing.started',               'IN_APP', true, true),
  ('order.ready',                            'IN_APP', true, true),
  ('order.delayed',                          'IN_APP', true, true),
  ('order.cancelled',                        'IN_APP', true, true),
  ('order.closed',                           'IN_APP', true, true),
  ('order.priority.changed',                 'IN_APP', true, true),
  ('order.split.created',                    'IN_APP', true, true),
  ('order.issue.created',                    'IN_APP', true, true),
  ('order.issue.resolved',                   'IN_APP', true, true),
  ('order.item.added',                       'IN_APP', true, true),
  ('order.item.removed',                     'IN_APP', true, true),
  ('order.item.missing',                     'IN_APP', true, false), -- cannot override URGENT
  ('order.item.damaged',                     'IN_APP', true, false),
  ('order.item.rework.required',             'IN_APP', true, true),
  ('preparation.task.created',               'IN_APP', true, true),
  ('preparation.task.completed',             'IN_APP', true, true),
  ('processing.step.completed',              'IN_APP', true, true),
  ('assembly.started',                       'IN_APP', true, true),
  ('assembly.exception',                     'IN_APP', true, false),
  ('assembly.completed',                     'IN_APP', true, true),
  ('qa.started',                             'IN_APP', true, true),
  ('qa.passed',                              'IN_APP', true, true),
  ('qa.failed',                              'IN_APP', true, true),
  ('packing.completed',                      'IN_APP', true, true),
  ('pickup.scheduled',                       'IN_APP', true, true),
  ('pickup.completed',                       'IN_APP', true, true),
  ('delivery.assigned',                      'IN_APP', true, true),
  ('delivery.failed',                        'IN_APP', true, true),
  ('delivery.delivered',                     'IN_APP', true, true),
  ('delivery.collected',                     'IN_APP', true, true),
  ('payment.received',                       'IN_APP', true, true),
  ('refund.requested',                       'IN_APP', true, true),
  ('invoice.issued',                         'IN_APP', true, true),
  ('invoice.cancelled',                      'IN_APP', true, true),
  ('credit_note.issued',                     'IN_APP', true, true),
  ('statement.generated',                    'IN_APP', true, true),
  ('customer.stub.created',                  'IN_APP', true, true),
  ('customer.upgraded',                      'IN_APP', true, true),
  ('customer.profile.updated',               'IN_APP', true, true),
  ('loyalty.points_added',                   'IN_APP', true, true),
  ('loyalty.points_redeemed',                'IN_APP', true, true),
  ('loyalty.tier_changed',                   'IN_APP', true, true),
  ('wallet.topup',                           'IN_APP', true, true),
  ('wallet.debited',                         'IN_APP', true, true),
  ('staff.task.assigned',                    'IN_APP', true, true),
  ('staff.shift.started',                    'IN_APP', true, true),
  ('staff.attendance.exception',             'IN_APP', true, true),
  ('inventory.low_stock',                    'IN_APP', true, true),
  ('inventory.reorder_created',              'IN_APP', true, true),
  ('inventory.stockout',                     'IN_APP', true, false),
  ('machine.maintenance_due',                'IN_APP', true, true),
  ('machine.downtime_started',               'IN_APP', true, true),
  ('machine.downtime_resolved',              'IN_APP', true, true),
  ('campaign.created',                       'IN_APP', true, true),
  ('campaign.approved',                      'IN_APP', true, true),
  ('campaign.launched',                      'IN_APP', true, true),
  ('campaign.completed',                     'IN_APP', true, true),
  ('campaign.failed',                        'IN_APP', true, true),
  ('campaign.recipient.opened',              'IN_APP', true, true),
  ('campaign.recipient.clicked',             'IN_APP', true, true),
  ('campaign.recipient.bounced',             'IN_APP', true, true),
  ('campaign.recipient.unsubscribed',        'IN_APP', true, true),
  ('campaign.recipient.complained',          'IN_APP', true, true),
  ('campaign.recipient.converted',           'IN_APP', true, true),
  ('subscription.trial_ending',              'IN_APP', true, true),
  ('subscription.renewal_due',               'IN_APP', true, true),
  ('subscription.payment_failed',            'IN_APP', true, true),
  ('plan.limit_reached',                     'IN_APP', true, true),
  ('plan.limit_warning',                     'IN_APP', true, true),
  ('security.login.detected',                'IN_APP', true, true),
  ('security.role.changed',                  'IN_APP', true, true),
  ('security.password.changed',              'IN_APP', true, true),
  ('security.suspicious_activity',           'IN_APP', true, false),
  ('system.maintenance.scheduled',           'IN_APP', true, true),
  ('system.maintenance.started',             'IN_APP', true, true),
  ('system.maintenance.completed',           'IN_APP', true, true),
  ('provider.whatsapp.degraded',             'IN_APP', true, true),
  ('provider.sms.degraded',                  'IN_APP', true, true),
  ('queue.backlog.high',                     'IN_APP', true, false),
  ('workflow.stage.intake.entered',          'IN_APP', true, true),
  ('workflow.stage.preparing.entered',       'IN_APP', true, true),
  ('workflow.stage.sorting.entered',         'IN_APP', true, true),
  ('workflow.stage.pretreatment.entered',    'IN_APP', true, true),
  ('workflow.stage.washing.entered',         'IN_APP', true, true),
  ('workflow.stage.drying.entered',          'IN_APP', true, true),
  ('workflow.stage.finishing.entered',       'IN_APP', true, true),
  ('workflow.stage.assembly.entered',        'IN_APP', true, true),
  ('workflow.stage.qa.entered',              'IN_APP', true, true),
  ('workflow.stage.packing.entered',         'IN_APP', true, true),
  ('workflow.stage.ready.entered',           'IN_APP', true, true),
  ('workflow.stage.out_for_delivery.entered','IN_APP', true, true),
  ('workflow.stage.delivered.entered',       'IN_APP', true, true),
  ('workflow.stage.closed.entered',          'IN_APP', true, true)
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  updated_at   = CURRENT_TIMESTAMP;

-- ---- PUSH mappings ----
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
VALUES
  ('order.created',                          'PUSH', true, true),
  ('order.preparation.required',             'PUSH', true, true),
  ('order.prepared',                         'PUSH', true, true),
  ('order.processing.started',               'PUSH', true, true),
  ('order.ready',                            'PUSH', true, true),
  ('order.delayed',                          'PUSH', true, true),
  ('order.cancelled',                        'PUSH', true, true),
  ('order.priority.changed',                 'PUSH', true, true),
  ('order.split.created',                    'PUSH', true, true),
  ('order.issue.created',                    'PUSH', true, true),
  ('order.issue.resolved',                   'PUSH', true, true),
  ('order.item.missing',                     'PUSH', true, false),
  ('order.item.damaged',                     'PUSH', true, false),
  ('order.item.rework.required',             'PUSH', true, true),
  ('preparation.task.created',               'PUSH', true, true),
  ('preparation.task.completed',             'PUSH', true, true),
  ('assembly.started',                       'PUSH', true, true),
  ('assembly.exception',                     'PUSH', true, false),
  ('assembly.completed',                     'PUSH', true, true),
  ('qa.passed',                              'PUSH', true, true),
  ('qa.failed',                              'PUSH', true, true),
  ('packing.completed',                      'PUSH', true, true),
  ('pickup.scheduled',                       'PUSH', true, true),
  ('pickup.reminder',                        'PUSH', true, true),
  ('pickup.driver_assigned',                 'PUSH', true, true),
  ('pickup.completed',                       'PUSH', true, true),
  ('delivery.assigned',                      'PUSH', true, true),
  ('delivery.out_for_delivery',              'PUSH', true, true),
  ('delivery.otp_generated',                 'PUSH', true, false),
  ('delivery.arrived',                       'PUSH', true, false),
  ('delivery.failed',                        'PUSH', true, true),
  ('delivery.delivered',                     'PUSH', true, true),
  ('delivery.collected',                     'PUSH', true, true),
  ('payment.requested',                      'PUSH', true, true),
  ('payment.received',                       'PUSH', true, true),
  ('payment.failed',                         'PUSH', true, true),
  ('refund.approved',                        'PUSH', true, true),
  ('refund.rejected',                        'PUSH', true, true),
  ('refund.processed',                       'PUSH', true, true),
  ('invoice.issued',                         'PUSH', true, true),
  ('customer.upgraded',                      'PUSH', true, true),
  ('customer.profile.updated',               'PUSH', true, true),
  ('loyalty.points_added',                   'PUSH', true, true),
  ('loyalty.points_redeemed',                'PUSH', true, true),
  ('loyalty.tier_changed',                   'PUSH', true, true),
  ('wallet.topup',                           'PUSH', true, true),
  ('wallet.debited',                         'PUSH', true, true),
  ('giftcard.issued',                        'PUSH', true, true),
  ('giftcard.activated',                     'PUSH', true, true),
  ('membership.started',                     'PUSH', true, true),
  ('membership.renewal_due',                 'PUSH', true, true),
  ('membership.expired',                     'PUSH', true, true),
  ('staff.task.assigned',                    'PUSH', true, true),
  ('staff.attendance.exception',             'PUSH', true, true),
  ('inventory.low_stock',                    'PUSH', true, true),
  ('inventory.stockout',                     'PUSH', true, false),
  ('machine.maintenance_due',                'PUSH', true, true),
  ('machine.downtime_started',               'PUSH', true, true),
  ('security.login.detected',                'PUSH', true, true),
  ('security.password.changed',              'PUSH', true, true),
  ('security.suspicious_activity',           'PUSH', true, false),
  ('workflow.stage.intake.entered',          'PUSH', true, true),
  ('workflow.stage.preparing.entered',       'PUSH', true, true),
  ('workflow.stage.sorting.entered',         'PUSH', true, true),
  ('workflow.stage.pretreatment.entered',    'PUSH', true, true),
  ('workflow.stage.washing.entered',         'PUSH', true, true),
  ('workflow.stage.drying.entered',          'PUSH', true, true),
  ('workflow.stage.finishing.entered',       'PUSH', true, true),
  ('workflow.stage.assembly.entered',        'PUSH', true, true),
  ('workflow.stage.qa.entered',              'PUSH', true, true),
  ('workflow.stage.packing.entered',         'PUSH', true, true),
  ('workflow.stage.ready.entered',           'PUSH', true, true),
  ('workflow.stage.out_for_delivery.entered','PUSH', true, true),
  ('workflow.stage.delivered.entered',       'PUSH', true, true),
  ('workflow.stage.closed.entered',          'PUSH', true, true)
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  updated_at   = CURRENT_TIMESTAMP;

-- ---- WHATSAPP mappings ----
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
VALUES
  ('order.created',               'WHATSAPP', true, true),
  ('order.quick_drop.created',    'WHATSAPP', true, true),
  ('order.prepared',              'WHATSAPP', true, true),
  ('order.ready',                 'WHATSAPP', true, true),
  ('order.delayed',               'WHATSAPP', true, true),
  ('order.cancelled',             'WHATSAPP', true, true),
  ('order.issue.created',         'WHATSAPP', true, true),
  ('order.issue.resolved',        'WHATSAPP', true, true),
  ('order.item.missing',          'WHATSAPP', true, false),
  ('order.item.damaged',          'WHATSAPP', true, false),
  ('pickup.scheduled',            'WHATSAPP', true, true),
  ('pickup.reminder',             'WHATSAPP', true, true),
  ('pickup.driver_assigned',      'WHATSAPP', true, true),
  ('pickup.completed',            'WHATSAPP', true, true),
  ('delivery.assigned',           'WHATSAPP', true, true),
  ('delivery.out_for_delivery',   'WHATSAPP', true, true),
  ('delivery.otp_generated',      'WHATSAPP', true, false),
  ('delivery.arrived',            'WHATSAPP', true, false),
  ('delivery.failed',             'WHATSAPP', true, true),
  ('delivery.delivered',          'WHATSAPP', true, true),
  ('delivery.collected',          'WHATSAPP', true, true),
  ('payment.requested',           'WHATSAPP', true, true),
  ('payment.received',            'WHATSAPP', true, true),
  ('payment.failed',              'WHATSAPP', true, true),
  ('payment.partial_received',    'WHATSAPP', true, true),
  ('payment.collection_due',      'WHATSAPP', true, true),
  ('refund.approved',             'WHATSAPP', true, true),
  ('refund.rejected',             'WHATSAPP', true, true),
  ('refund.processed',            'WHATSAPP', true, true),
  ('credit_note.issued',          'WHATSAPP', true, true),
  ('statement.generated',         'WHATSAPP', true, true),
  ('statement.overdue',           'WHATSAPP', true, true),
  ('customer.stub.created',       'WHATSAPP', true, true),
  ('customer.upgraded',           'WHATSAPP', true, true),
  ('loyalty.points_added',        'WHATSAPP', true, true),
  ('loyalty.points_redeemed',     'WHATSAPP', true, true),
  ('loyalty.tier_changed',        'WHATSAPP', true, true),
  ('wallet.topup',                'WHATSAPP', true, true),
  ('wallet.debited',              'WHATSAPP', true, true),
  ('giftcard.issued',             'WHATSAPP', true, true),
  ('giftcard.activated',          'WHATSAPP', true, true),
  ('membership.started',          'WHATSAPP', true, true),
  ('membership.renewal_due',      'WHATSAPP', true, true),
  ('membership.expired',          'WHATSAPP', true, true),
  ('subscription.trial_ending',   'WHATSAPP', true, true),
  ('subscription.renewal_due',    'WHATSAPP', true, true),
  ('subscription.payment_failed', 'WHATSAPP', true, true)
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  updated_at   = CURRENT_TIMESTAMP;

-- ---- SMS mappings ----
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
VALUES
  ('order.ready',               'SMS', true, true),
  ('pickup.reminder',           'SMS', true, true),
  ('delivery.out_for_delivery', 'SMS', true, true),
  ('delivery.otp_generated',    'SMS', true, false),
  ('delivery.arrived',          'SMS', true, false),
  ('payment.requested',         'SMS', true, true),
  ('payment.failed',            'SMS', true, true),
  ('payment.collection_due',    'SMS', true, true),
  ('statement.overdue',         'SMS', true, true),
  ('customer.stub.created',     'SMS', true, true),
  ('membership.renewal_due',    'SMS', true, true)
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  updated_at   = CURRENT_TIMESTAMP;

-- ---- EMAIL mappings ----
INSERT INTO sys_ntf_event_chan_map (event_code, channel_code, is_default, can_override)
VALUES
  ('order.cancelled',              'EMAIL', true, true),
  ('order.closed',                 'EMAIL', true, true),
  ('payment.requested',            'EMAIL', true, true),
  ('payment.received',             'EMAIL', true, true),
  ('payment.failed',               'EMAIL', true, true),
  ('refund.requested',             'EMAIL', true, true),
  ('refund.approved',              'EMAIL', true, true),
  ('refund.rejected',              'EMAIL', true, true),
  ('refund.processed',             'EMAIL', true, true),
  ('invoice.issued',               'EMAIL', true, true),
  ('invoice.cancelled',            'EMAIL', true, true),
  ('credit_note.issued',           'EMAIL', true, true),
  ('statement.generated',          'EMAIL', true, true),
  ('statement.overdue',            'EMAIL', true, true),
  ('loyalty.tier_changed',         'EMAIL', true, true),
  ('giftcard.issued',              'EMAIL', true, true),
  ('giftcard.activated',           'EMAIL', true, true),
  ('membership.started',           'EMAIL', true, true),
  ('membership.renewal_due',       'EMAIL', true, true),
  ('membership.expired',           'EMAIL', true, true),
  ('staff.attendance.exception',   'EMAIL', true, true),
  ('inventory.low_stock',          'EMAIL', true, true),
  ('inventory.reorder_created',    'EMAIL', true, true),
  ('inventory.stockout',           'EMAIL', true, false),
  ('machine.maintenance_due',      'EMAIL', true, true),
  ('machine.downtime_started',     'EMAIL', true, true),
  ('machine.downtime_resolved',    'EMAIL', true, true),
  ('campaign.approved',            'EMAIL', true, true),
  ('campaign.launched',            'EMAIL', true, true),
  ('campaign.completed',           'EMAIL', true, true),
  ('campaign.failed',              'EMAIL', true, true),
  ('subscription.trial_ending',    'EMAIL', true, true),
  ('subscription.renewal_due',     'EMAIL', true, true),
  ('subscription.payment_failed',  'EMAIL', true, true),
  ('plan.limit_reached',           'EMAIL', true, true),
  ('plan.limit_warning',           'EMAIL', true, true),
  ('security.login.detected',      'EMAIL', true, true),
  ('security.role.changed',        'EMAIL', true, true),
  ('security.password.changed',    'EMAIL', true, true),
  ('security.suspicious_activity', 'EMAIL', true, false),
  ('system.maintenance.scheduled', 'EMAIL', true, true),
  ('system.maintenance.started',   'EMAIL', true, true),
  ('system.maintenance.completed', 'EMAIL', true, true),
  ('provider.whatsapp.degraded',   'EMAIL', true, true),
  ('provider.sms.degraded',        'EMAIL', true, true),
  ('queue.backlog.high',           'EMAIL', true, false),
  ('delivery.delivered',           'EMAIL', true, true)
ON CONFLICT (event_code, channel_code) DO UPDATE SET
  is_default   = EXCLUDED.is_default,
  can_override = EXCLUDED.can_override,
  updated_at   = CURRENT_TIMESTAMP;

COMMIT;

-- =============================================================================
-- Migration: 0705_doc_seq_type_implement_desc_ar.sql
-- Purpose: Store an Arabic support-facing implementation description for every
--          Human-Friendly Code type, so HQ Code Types is bilingual end to end.
--
-- Scope: public.sys_doc_seq_type_cd only. Numbering, counters, triggers,
--        permissions, and tenant data are unchanged.
--
-- Rollback: forward-only repository. A corrective migration may relax the
--           nonblank constraint or replace individual Arabic descriptions; it
--           must preserve the English source description and audit provenance.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '10s';

-- The English support note already exists; this companion is required so Arabic HQ users do not receive English-only guidance.
ALTER TABLE public.sys_doc_seq_type_cd
  ADD COLUMN implement_description2 TEXT;
COMMENT ON COLUMN public.sys_doc_seq_type_cd.implement_description2 IS
  'Arabic support-facing explanation of how this human-friendly code is assigned and diagnosed. Required and nonblank for every type.';

-- Backfill each registered type with its own operationally accurate Arabic guide. Technical identifiers remain verbatim so operators can match logs and schema objects.
WITH translations (doc_type_code, implement_description2) AS (
  VALUES
    ('ORDER', $ar$يُدار رقم الطلب بالمحرك منذ P2. تُرجع fn_doc_seq_next للمنشأة ORD-<YYYYMMDD بحسب المنطقة الزمنية للمنشأة>-<تسلسل بأربع خانات يتمدّد بعد 9999> مع إعادة ضبط يومية وعداد مقفل في org_doc_seq_mst. يستدعيه إنشاء الطلب قبل INSERT، ويملأ trg_ord_no_assign القيمة الفارغة، بينما تُنشأ الطلبات الفرعية بصيغة <رقم الطلب الجذر>-S<n> تحت قفل صف الجذر. يمنع trg_ord_no_guard تغيير الرقم. افحص org_orders_mst وعداد ORDER في org_doc_seq_mst.$ar$),
    ('ORDER_ITEM', $ar$رمز بند الطلب فرعي بصيغة <رقم الطلب>-<n> من دون بادئة مطبوعة؛ ITM محجوز للمسح فقط. يحجز التطبيق الطلب استشارياً ثم يختار n أعلى قيمة سابقة زائد واحد، بما فيها البنود المحذوفة فلا يعاد استعمال الرقم. ويملأ before_ins_set_order_item_srno القيمة الفارغة عبر fn_next_order_item_srno تحت القفل نفسه. التفرد والحصانة مفروضان بواسطة uq_ord_item_srno وtrg_ord_item_srno_guard، وbarcode يحمل القيمة نفسها.$ar$),
    ('ORDER_PIECE', $ar$رمز القطعة فرعي بصيغة <رقم بند الطلب>-<تسلسل القطعة> من دون بادئة مطبوعة؛ PEC محجوز للمسح فقط. لا يكتبه web-admin؛ بل يعيّنه trg_ord_piece_code_set عبر fn_ord_piece_code_set عند الإدراج ويمنع trg_ord_piece_code_guard تعديله. الوسم الخارجي مستقل في barcode وله صيغة وتفرد وقواعد منع مطابقة رموز المنصة؛ افحص piece_code وbarcode معاً.$ar$),
    ('STORE_CREDIT_NOTE', $ar$يُدار رقم إشعار رصيد المتجر بالمحرك منذ P5. يملأ trg_fin_cn_no_assign الحقل الفارغ بـ SCN-<سنة المنطقة الزمنية للمنشأة>-<تسلسل بست خانات يتمدّد> مع إعادة ضبط سنوية وعداد مقفل في org_doc_seq_mst. يدرج stored-value.service.ts قيمة فارغة ثم يقرأ الرقم النهائي من صف RETURNING. يمنع trg_fin_cn_no_guard التعديل وck_fin_cn_no_set الفراغ؛ أما صفوف CN القديمة فتبقى، وorg_order_credit_apps_dtl لقطة وليست مولداً.$ar$),
    ('FIN_JOURNAL', $ar$تستدعي محرك ترحيل ERP الدالة fn_next_fin_doc_no للنوع JOURNAL. تقفل الدالة صف org_fin_doc_seq_mst للمنشأة والنوع، تزيد last_no، ثم تعيد البادئة إن وجدت مع تسلسل مبطن إلى padding_len من دون اقتطاع. لا توجد بادئة مطبوعة حالياً؛ JRL مفتاح محجوز للمسح فقط. افحص prefix وlast_no وpadding_len للنوع JOURNAL.$ar$),
    ('AR_INVOICE', $ar$تستدعي nextArInvoiceNumber الدالة fn_next_fin_doc_no للنوع AR_INV. تحفظ org_fin_doc_seq_mst البادئة ARI- والعداد، ويُنشأ الصف المفقود ببادئة فارغة؛ لذلك يجب أن يوجد صف البادئة قبل أول استخدام. افحص prefix وlast_no للنوع AR_INV؛ ARI هو المفتاح المحجوز للمسح.$ar$),
    ('REFUND', $ar$تستدعي order-refund.service.ts الدالة fn_next_fin_doc_no للنوع REFUND. تحفظ org_fin_doc_seq_mst البادئة REF- والعداد، لكن إنشاء صف مفقود يجعله ببادئة فارغة؛ لذلك تحقّق من صف التهيئة قبل أول رقم. افحص prefix وlast_no للنوع REFUND؛ REF هو المفتاح المحجوز للمسح.$ar$),
    ('TAX_INVOICE', $ar$تأخذ allocateTaxDocumentSequence صف عداد مقفلاً لكل منشأة ونوع مستند وسنة مالية من org_tax_doc_seq_counters ثم تُرجع INV-<السنة المالية>-<تسلسل بست خانات>. يشترك عمود الهدف مع أنواع المستندات الضريبية الأربعة؛ افحص عدادات المنشأة، وINV مفتاح المسح المحجوز.$ar$),
    ('TAX_SIMPLIFIED', $ar$تأخذ allocateTaxDocumentSequence صف عداد مقفلاً لكل منشأة ونوع مستند وسنة مالية من org_tax_doc_seq_counters ثم تُرجع SIM-<السنة المالية>-<تسلسل بست خانات>. يشترك عمود الهدف مع أنواع المستندات الضريبية الأربعة؛ افحص عدادات المنشأة، وSIM مفتاح المسح المحجوز.$ar$),
    ('TAX_CREDIT_NOTE', $ar$تأخذ allocateTaxDocumentSequence صف عداد مقفلاً لكل منشأة ونوع مستند وسنة مالية من org_tax_doc_seq_counters ثم تُرجع CN-<السنة المالية>-<تسلسل بست خانات>. يشترك عمود الهدف مع أنواع المستندات الضريبية الأربعة؛ افحص عدادات المنشأة، وTCN مفتاح المسح المحجوز.$ar$),
    ('TAX_DEBIT_NOTE', $ar$تأخذ allocateTaxDocumentSequence صف عداد مقفلاً لكل منشأة ونوع مستند وسنة مالية من org_tax_doc_seq_counters ثم تُرجع DN-<السنة المالية>-<تسلسل بست خانات>. يشترك عمود الهدف مع أنواع المستندات الضريبية الأربعة؛ افحص عدادات المنشأة، وTDN مفتاح المسح المحجوز.$ar$),
    ('RECEIPT_VOUCHER', $ar$تأخذ generateBizVoucherNo قفل bvm_voucher_no_<tenant> الاستشاري، وتقرأ أكبر قيمة نصية لـ RV-<سنة الخادم>-، ثم تُرجع RV-YYYY-<تسلسل بست خانات>. يشترك voucher_no مع أنواع السندات الأخرى والمولد القديم؛ افحص أحدث RV في org_fin_vouchers_mst. RCV مفتاح المسح المحجوز.$ar$),
    ('PAYMENT_VOUCHER', $ar$تأخذ generateBizVoucherNo قفل bvm_voucher_no_<tenant> الاستشاري، وتقرأ أكبر قيمة نصية لـ PV-<سنة الخادم>-، ثم تُرجع PV-YYYY-<تسلسل بست خانات>. يشترك voucher_no مع أنواع السندات الأخرى والمولد القديم؛ افحص أحدث PV في org_fin_vouchers_mst. PMV مفتاح المسح المحجوز.$ar$),
    ('REFUND_VOUCHER', $ar$تأخذ generateBizVoucherNo قفل bvm_voucher_no_<tenant> الاستشاري، وتقرأ أكبر قيمة نصية لـ RF-<سنة الخادم>-، ثم تُرجع RF-YYYY-<تسلسل بست خانات>. يشترك voucher_no مع أنواع السندات الأخرى والمولد القديم؛ افحص أحدث RF في org_fin_vouchers_mst. RFV مفتاح المسح المحجوز.$ar$),
    ('ADJUSTMENT_VOUCHER', $ar$تأخذ generateBizVoucherNo قفل bvm_voucher_no_<tenant> الاستشاري، وتقرأ أكبر قيمة نصية لـ ADJ-<سنة الخادم>-، ثم تُرجع ADJ-YYYY-<تسلسل بست خانات>. يشترك voucher_no مع أنواع السندات الأخرى والمولد القديم؛ افحص أحدث ADJ في org_fin_vouchers_mst. ADJ مفتاح المسح المحجوز.$ar$),
    ('TRANSFER_VOUCHER', $ar$تأخذ generateBizVoucherNo قفل bvm_voucher_no_<tenant> الاستشاري، وتقرأ أكبر قيمة نصية لـ TR-<سنة الخادم>-، ثم تُرجع TR-YYYY-<تسلسل بست خانات>. يشترك voucher_no مع أنواع السندات الأخرى والمولد القديم؛ افحص أحدث TR في org_fin_vouchers_mst. TRV مفتاح المسح المحجوز.$ar$),
    ('VOUCHER_OTHER', $ar$تأخذ generateBizVoucherNo قفل bvm_voucher_no_<tenant> الاستشاري، وتقرأ أكبر قيمة نصية لـ VCH-<سنة الخادم>-، ثم تُرجع VCH-YYYY-<تسلسل بست خانات>. يشترك voucher_no مع أنواع السندات الأخرى والمولد القديم؛ افحص أحدث VCH في org_fin_vouchers_mst. VCH مفتاح المسح المحجوز.$ar$),
    ('LEGACY_VOUCHER', $ar$ينشئ generateVoucherNo القديم بادئات متغيرة مثل VCR-RCP وREF وCRN وVCR-PAY وVCR-ADJ ثم -YYYY-<تسلسل بخمس خانات> باستخدام أكبر قيمة نصية وسنة الخادم. لا توجد بادئة مطبوعة ثابتة؛ VCR مفتاح المسح المحجوز. هذا المسار مؤجل للتقاعد في P10، لذا افحص أرقام VCR القديمة عند التشخيص.$ar$),
    ('POS_SESSION', $ar$تنشئ pos-session.service.ts رقم الجلسة بصيغة POS-<YYYYMMDD>-<ثمانية محارف عشوائية>، ويكون فريداً داخل المنشأة والفرع. افحص session_no في org_pos_sessions_mst بحسب المنشأة؛ POS مفتاح المسح المحجوز.$ar$),
    ('POS_Z_REPORT', $ar$تنشئ pos-shift-report.service.ts تقرير الإغلاق بصيغة Z-<رقم الجلسة> باستخدام ثابت من pos-shift-report.ts. الرقم مشتق من جلسة الأب وليس من عداد مستقل؛ ZRP مفتاح المسح المحجوز. افحص report_no وأصل session_no في org_pos_shift_z_rpt_tr.$ar$),
    ('CASH_DRAWER_SESSION', $ar$تأخذ generate_cash_drawer_sess_no قفلاً استشارياً مبنياً من المنشأة والتاريخ، ثم تقرأ أكبر SES-<تاريخ اليوم>- وتُرجع SES-YYYYMMDD-<تسلسل بأربع خانات>. يجب أن يستدعيها cash-drawer-session.service.ts في المعاملة نفسها مع INSERT. افحص session_no؛ SES مفتاح المسح المحجوز.$ar$),
    ('CASH_DRAWER_TRX', $ar$تُرجع generate_cash_drawer_trx_no، المتاحة لـ service_role فقط، الرقم CDT-YYYYMMDD-<تسلسل بأربع خانات>. افحص trx_no في org_cash_drawer_trx_mst ضمن المنشأة؛ CDT مفتاح المسح المحجوز.$ar$),
    ('CUSTOMER', $ar$تكتب generate_customer_number رقم العميل في sys_customers_mst العالمي باستخدام MAX+1 مقيداً بـ first_tenant_org_id ومبطناً إلى خمس خانات من دون قفل. CRM وحدة منشأة لكن الجدول والنطاق SYS؛ معالجة سباق التزامن مؤجلة إلى P10. افحص أحدث customer_number؛ CUS مفتاح المسح المحجوز.$ar$),
    ('USER', $ar$تولّد القيمة الافتراضية fn_org_user_code_next رمز المستخدم من التسلسل العالمي org_user_code_seq بصيغة U مع ست خانات، وتتجاوز الرموز المدخلة يدوياً. النطاق SYS رغم وجود tenant_org_id في الجدول لأن الرقم على مستوى المنصة. افحص last_value للتسلسل؛ USR مفتاح المسح المحجوز.$ar$),
    ('PRODUCT', $ar$تُرجع generateProductCode في catalog.service.ts الرقم PROD-<أكبر قيمة نصية + 1، بخمس خانات>. يشترك product_code مع STOCK_ITEM؛ افحص أحدث PROD في org_product_data_mst ضمن المنشأة. PROD مفتاح المسح المحجوز، ومعالجة سباق MAX مؤجلة إلى P10.$ar$),
    ('STOCK_ITEM', $ar$تُرجع inventory-service.ts لمنتج التجزئة INV-<أكبر قيمة + 1، بخمس خانات> بالبحث عن INV-. تتعارض البادئة المطبوعة INV مع الفواتير الضريبية؛ لذلك SKU هو مفتاح المسح المحجوز. افحص أحدث INV في org_product_data_mst ضمن المنشأة؛ معالجة سباق MAX مؤجلة إلى P10.$ar$),
    ('GIFT_CARD', $ar$تُرجع gift-card-service.ts رمز البطاقة CMX-XXXX-XXXX-XXXX عشوائياً. تتعارض البادئة CMX مع العملاء المحتملين في HQ؛ لذلك GFT هو مفتاح المسح المحجوز. افحص gift_card_code في org_gift_cards_mst ضمن المنشأة.$ar$),
    ('DELIVERY_ROUTE', $ar$تحدّث delivery-route-command.service.ts العداد org_dlv_route_seq_cf بعملية upsert مع RETURNING ثم تطبع RT-YYYY-<تسلسل بثلاث خانات يتمدّد>. افحص عداد المسار للمنشأة؛ RTE مفتاح المسح المحجوز.$ar$),
    ('B2B_CONTRACT', $ar$تُرجع b2b-contracts.service.ts الرقم CON-YYYYMM-<COUNT+1 بأربع خانات>، ويمكن إدخال قيمة يدوية. افحص contract_no في org_b2b_contracts_mst ضمن المنشأة؛ CON مفتاح المسح المحجوز، وتحقق من التكرار عند الإدخال اليدوي.$ar$),
    ('B2B_STATEMENT', $ar$تُرجع b2b-statements.service.ts الرقم STMT-YYYYMM-<COUNT+1 بأربع خانات>. افحص statement_no في org_b2b_statements_mst ضمن المنشأة؛ STMT مفتاح المسح المحجوز.$ar$),
    ('AR_DISPUTE', $ar$تُرجع ar-dispute.service.ts الرقم ARD-<طابع UTC yyyymmddhhmmss>-<أربعة محارف base36>. افحص dispute_no في org_ar_disputes_mst ضمن المنشأة؛ ARD مفتاح المسح المحجوز.$ar$),
    ('AR_DUNNING_RUN', $ar$تعيّن ar-dunning-ops.service.ts run_no كأكبر رقم + 1 لكل عميل؛ القيمة عدد صحيح بلا بادئة مطبوعة. DUN مفتاح المسح المحجوز. افحص customer_id وMAX(run_no) في org_ar_dunning_runs_mst ضمن المنشأة.$ar$),
    ('AR_RECON_RUN', $ar$تُرجع reconciliation.service.ts الرقم RECON-YYYY-<COUNT+1 بثلاث خانات>. افحص run_no في org_fin_recon_runs_mst ضمن المنشأة؛ RECON مفتاح المسح المحجوز.$ar$),
    ('ERP_EXPENSE', $ar$تُرجع erp-lite-expenses.service.ts الرقم EXP-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ نقل المحرك إلى التسلسل المركزي مؤجل إلى P10. افحص expense_no في org_fin_exp_mst؛ EXP مفتاح المسح المحجوز.$ar$),
    ('ERP_PETTY_CASHBOX', $ar$تُرجع erp-lite-expenses.service.ts الرمز PCB-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص cashbox_code في org_fin_cashbox_mst؛ PCB مفتاح المسح المحجوز.$ar$),
    ('ERP_PETTY_CASH_TXN', $ar$تُرجع erp-lite-expenses.service.ts الرقم PCT-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص txn_no في org_fin_cash_txn_tr؛ PCT مفتاح المسح المحجوز.$ar$),
    ('ERP_PETTY_CASH_RECON', $ar$تُرجع erp-lite-expenses.service.ts الرقم PCR-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص recon_no في org_fin_cash_rec_mst؛ PCR مفتاح المسح المحجوز.$ar$),
    ('ERP_SUPPLIER', $ar$تُرجع erp-lite-v2.service.ts الرمز SUP-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص supplier_code في org_fin_supp_mst؛ SUP مفتاح المسح المحجوز.$ar$),
    ('ERP_PO', $ar$تُرجع erp-lite-v2.service.ts الرقم PO-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص po_no في org_fin_po_mst؛ PUR مفتاح المسح المحجوز.$ar$),
    ('ERP_AP_INVOICE', $ar$تُرجع erp-lite-v2.service.ts الرقم API-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص ap_inv_no في org_fin_ap_inv_mst؛ API مفتاح المسح المحجوز.$ar$),
    ('ERP_AP_PAYMENT', $ar$تُرجع erp-lite-v2.service.ts الرقم APP-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص ap_pmt_no في org_fin_ap_pmt_mst؛ APP مفتاح المسح المحجوز.$ar$),
    ('ERP_BANK_ACCOUNT', $ar$تُرجع erp-lite-v2.service.ts الرمز BNK-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص bank_code في org_fin_bank_acct_mst؛ BNK مفتاح المسح المحجوز.$ar$),
    ('ERP_BANK_STATEMENT', $ar$تُرجع erp-lite-v2.service.ts رقم دفعة الكشف BST-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص import_batch_no في org_fin_bank_stmt_mst؛ BST مفتاح المسح المحجوز.$ar$),
    ('ERP_BANK_RECON', $ar$تُرجع erp-lite-v2.service.ts الرمز BRC-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص recon_code في org_fin_bank_recon_mst؛ BRC مفتاح المسح المحجوز.$ar$),
    ('ERP_ALLOC_RULE', $ar$تُرجع erp-lite-phase10.service.ts الرمز ALR-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص rule_code في org_fin_alloc_rule_mst؛ ALR مفتاح المسح المحجوز.$ar$),
    ('ERP_ALLOC_RUN', $ar$تُرجع erp-lite-phase10.service.ts الرقم APR-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص run_no في org_fin_alloc_run_mst؛ APR مفتاح المسح المحجوز.$ar$),
    ('ERP_COST_COMPONENT', $ar$تُرجع erp-lite-phase10.service.ts الرمز CMP-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص comp_code في org_fin_cost_cmp_cd؛ CMP مفتاح المسح المحجوز.$ar$),
    ('ERP_COST_RUN', $ar$تُرجع erp-lite-phase10.service.ts الرقم CRN-YYYYMM-<COUNT+1 بخمس خانات> وفق شهر UTC. يعتمد المسار حالياً على COUNT+1 وقد يتسابق؛ النقل إلى المحرك المركزي مؤجل إلى P10. افحص run_no في org_fin_cost_run_mst؛ CRN مفتاح المسح المحجوز.$ar$),
    ('HQ_SAAS_INVOICE', $ar$تُرجع sys_bill_generate_invoice_number الرقم INV-<سنة التاريخ الحالي>-<nextval من seq_invoice_number بست خانات>. يبدأ التسلسل العالمي من 1000 ولا يعاد ضبطه؛ السنة مطبوعة فقط. يحمل الجدول tenant_org_id للمنشأة المفوترة لكن الرقم على مستوى المنصة. تتعارض INV مع الفواتير الضريبية؛ HQI مفتاح المسح المحجوز. افحص last_value للتسلسل.$ar$),
    ('HQ_MARKETING_LEAD', $ar$تأخذ hq_crm_marketing_lead_code_next قفلاً استشارياً يومياً، تزيد hq_crm_marketing_lead_daily_seq، ثم تُرجع CMX-<تاريخ UTC YYYYMMDD>-<تسلسل بست خانات>. يبدأ أول رقم يومي من 32. تتعارض CMX مع بطاقات الهدايا؛ MLD مفتاح المسح المحجوز. افحص العداد اليومي.$ar$),
    ('STOCK_TRANSACTION', $ar$يُدار رقم حركة المخزون بالمحرك منذ 0703_stock_transaction_hfc. يعيّن trg_inv_stock_no_assign دائماً STK-<YYYYMMDD في المنطقة الزمنية للمنشأة>-<تسلسل بأربع خانات يتمدّد> من fn_doc_seq_next وorg_doc_seq_mst، ويستبدل أي قيمة يرسلها الكاتب كي تشترك جميع المسارات في عداد ذري واحد. يمنع trg_inv_stock_no_guard التعديل، وتترك deduct_retail_stock_for_order وinventory-service الحقل فارغاً. uq_inv_stock_tr_no يفرض التفرد داخل المنشأة؛ افحص الحركات وعداد STOCK_TRANSACTION.$ar$)
)
UPDATE public.sys_doc_seq_type_cd AS type
   SET implement_description2 = translations.implement_description2,
       updated_at = now(),
       updated_by = 'migration',
       updated_info = '0705_doc_seq_type_implement_desc_ar'
  FROM translations
 WHERE type.doc_type_code = translations.doc_type_code;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.sys_doc_seq_type_cd) <> 51 THEN
    RAISE EXCEPTION 'DOC_SEQ_TYPE_COUNT_CHANGED: explicit Arabic translations require review';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.sys_doc_seq_type_cd
     WHERE implement_description2 IS NULL
        OR btrim(implement_description2) = ''
  ) THEN
    RAISE EXCEPTION 'DOC_SEQ_IMPLEMENT_DESCRIPTION2_BACKFILL_FAILED';
  END IF;
END
$verify$;

ALTER TABLE public.sys_doc_seq_type_cd
  ALTER COLUMN implement_description2 SET NOT NULL,
  ADD CONSTRAINT ck_doc_seq_type_impl_desc2
    CHECK (btrim(implement_description2) <> '');
COMMENT ON CONSTRAINT ck_doc_seq_type_impl_desc2 ON public.sys_doc_seq_type_cd IS
  'Prevents an English-only or blank Arabic implementation guide from being registered for a document sequence type.';

COMMIT;

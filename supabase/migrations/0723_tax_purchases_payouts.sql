-- =============================================================================
-- Migration: 0723_tax_purchases_payouts.sql
-- Program:   Tax Engine T5 / M6 — tax columns for purchases, payouts and gift cards
-- Plan:      docs/features/Tax_Config/TAX_ENGINE_PLAN.md §5, §6
-- Builds on: 0718 (item classes, supplier tax fields), 0719 (tax lines)
-- Purpose:   Purchase lines say how they are taxed, so tax rules can match them.
--            Input tax itself is recorded in org_tax_lines_tr; these columns are
--            only the facts the rules need, plus the withheld amount on a payment
--            and the gift card tax mode used by T6.
-- Data:      All purchase tables are empty today; existing gift cards take MPV,
--            which is what the seeded kits already do (taxed when used).
-- =============================================================================

BEGIN;

-- 1. Item tax class per purchase line. NULL = the organization's default INPUT class.
ALTER TABLE public.org_fin_exp_dtl    ADD COLUMN IF NOT EXISTS tax_item_class_code TEXT NULL;
ALTER TABLE public.org_fin_po_dtl     ADD COLUMN IF NOT EXISTS tax_item_class_code TEXT NULL;
ALTER TABLE public.org_fin_ap_inv_dtl ADD COLUMN IF NOT EXISTS tax_item_class_code TEXT NULL;

COMMENT ON COLUMN public.org_fin_exp_dtl.tax_item_class_code IS 'Item tax class of this expense line (org_tax_item_classes_cf); tax rules match on it. NULL = the default INPUT class.';
COMMENT ON COLUMN public.org_fin_po_dtl.tax_item_class_code IS 'Item tax class of this purchase order line (org_tax_item_classes_cf); carried to the AP invoice line. NULL = the default INPUT class.';
COMMENT ON COLUMN public.org_fin_ap_inv_dtl.tax_item_class_code IS 'Item tax class of this AP invoice line (org_tax_item_classes_cf); tax rules match on it. NULL = the default INPUT class.';

ALTER TABLE public.org_fin_exp_dtl
  ADD CONSTRAINT fk_ofed_tax_class FOREIGN KEY (tenant_org_id, tax_item_class_code)
    REFERENCES public.org_tax_item_classes_cf (tenant_org_id, class_code) ON DELETE RESTRICT;
ALTER TABLE public.org_fin_po_dtl
  ADD CONSTRAINT fk_ofpod_tax_class FOREIGN KEY (tenant_org_id, tax_item_class_code)
    REFERENCES public.org_tax_item_classes_cf (tenant_org_id, class_code) ON DELETE RESTRICT;
ALTER TABLE public.org_fin_ap_inv_dtl
  ADD CONSTRAINT fk_ofaid_tax_class FOREIGN KEY (tenant_org_id, tax_item_class_code)
    REFERENCES public.org_tax_item_classes_cf (tenant_org_id, class_code) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_ofed_tax_class ON public.org_fin_exp_dtl IS 'The class belongs to the same organization; a class in use cannot be deleted.';
COMMENT ON CONSTRAINT fk_ofpod_tax_class ON public.org_fin_po_dtl IS 'The class belongs to the same organization; a class in use cannot be deleted.';
COMMENT ON CONSTRAINT fk_ofaid_tax_class ON public.org_fin_ap_inv_dtl IS 'The class belongs to the same organization; a class in use cannot be deleted.';

CREATE INDEX IF NOT EXISTS idx_ofed_tax_class  ON public.org_fin_exp_dtl (tenant_org_id, tax_item_class_code) WHERE tax_item_class_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ofpod_tax_class ON public.org_fin_po_dtl (tenant_org_id, tax_item_class_code) WHERE tax_item_class_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ofaid_tax_class ON public.org_fin_ap_inv_dtl (tenant_org_id, tax_item_class_code) WHERE tax_item_class_code IS NOT NULL;

COMMENT ON INDEX public.idx_ofed_tax_class IS 'Supports the class foreign key: find expense lines using a class.';
COMMENT ON INDEX public.idx_ofpod_tax_class IS 'Supports the class foreign key: find purchase order lines using a class.';
COMMENT ON INDEX public.idx_ofaid_tax_class IS 'Supports the class foreign key: find AP invoice lines using a class.';

-- 2. Party on the expense header: PO and AP invoice already have supplier_id.
ALTER TABLE public.org_fin_exp_mst ADD COLUMN IF NOT EXISTS supplier_id UUID NULL;
COMMENT ON COLUMN public.org_fin_exp_mst.supplier_id IS 'Supplier of this expense, when known; its tax class and country drive the tax rules. NULL = a one-off payee named in payee_name.';

ALTER TABLE public.org_fin_exp_mst
  ADD CONSTRAINT fk_ofe_supplier FOREIGN KEY (tenant_org_id, supplier_id)
    REFERENCES public.org_fin_supp_mst (tenant_org_id, id) ON DELETE RESTRICT;
COMMENT ON CONSTRAINT fk_ofe_supplier ON public.org_fin_exp_mst IS 'The supplier belongs to the same organization; a supplier with expenses cannot be deleted.';

CREATE INDEX IF NOT EXISTS idx_ofe_supplier ON public.org_fin_exp_mst (tenant_org_id, supplier_id) WHERE supplier_id IS NOT NULL;
COMMENT ON INDEX public.idx_ofe_supplier IS 'Supports the supplier foreign key and the expense list per supplier.';

-- 3. Withholding on a supplier payment: amount_total settles the invoice, the rest of it is owed to the tax authority.
ALTER TABLE public.org_fin_ap_pmt_mst ADD COLUMN IF NOT EXISTS wht_amount DECIMAL(19, 4) NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.org_fin_ap_pmt_mst.wht_amount IS 'Tax withheld from this payment, in currency_code. Cash paid to the supplier = amount_total - wht_amount; the withheld part is a liability to the tax authority.';

ALTER TABLE public.org_fin_ap_pmt_mst
  ADD CONSTRAINT ck_ofap_wht CHECK (wht_amount >= 0 AND wht_amount <= amount_total);
COMMENT ON CONSTRAINT ck_ofap_wht ON public.org_fin_ap_pmt_mst IS 'Withheld tax is never negative and never more than the amount being settled.';

-- 4. When a gift card is taxed: SPV at sale, MPV when it is used.
ALTER TABLE public.org_gift_cards_mst ADD COLUMN IF NOT EXISTS voucher_tax_mode TEXT NOT NULL DEFAULT 'MPV';
COMMENT ON COLUMN public.org_gift_cards_mst.voucher_tax_mode IS 'SPV = the tax is known at sale and charged then; MPV = charged when the card is used. Default MPV matches the seeded kits.';

ALTER TABLE public.org_gift_cards_mst
  ADD CONSTRAINT ck_ogc_voucher_tax_mode CHECK (voucher_tax_mode IN ('SPV', 'MPV'));
COMMENT ON CONSTRAINT ck_ogc_voucher_tax_mode ON public.org_gift_cards_mst IS 'Allowed gift card tax modes.';

COMMIT;

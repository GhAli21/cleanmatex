-- ==============================================================================
-- Description: V1 Payment Config HQ implementation
-- Author: Platform team
-- Date: 2026-05-15
-- ==============================================================================

-- 1. Modify sys_payment_method_cd table
ALTER TABLE public.sys_payment_method_cd
ADD COLUMN IF NOT EXISTS payment_nature varchar(50) DEFAULT 'REAL_PAYMENT',
ADD COLUMN IF NOT EXISTS method_category varchar(50),
ADD COLUMN IF NOT EXISTS is_deprecated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS replacement_code varchar(100),
ADD COLUMN IF NOT EXISTS gateway_code varchar(80);

ALTER TABLE public.sys_payment_method_cd
DROP CONSTRAINT IF EXISTS chk_sys_payment_method_payment_nature;

ALTER TABLE public.sys_payment_method_cd
ADD CONSTRAINT chk_sys_payment_method_payment_nature
CHECK (
  payment_nature IN (
    'REAL_PAYMENT',
    'CREDIT_APPLICATION',
    'AR_ALLOCATION',
    'DEFERRED_SETTLEMENT',
    'PROVIDER',
    'INTERNAL_ADJUSTMENT'
  )
);

-- Classification updates for existing rows
UPDATE public.sys_payment_method_cd 
SET payment_nature='REAL_PAYMENT', method_category='CASH', is_deprecated=false, replacement_code=null, gateway_code=null 
WHERE payment_method_code='CASH';

UPDATE public.sys_payment_method_cd 
SET payment_nature='REAL_PAYMENT', method_category='CARD', is_deprecated=false, replacement_code=null, gateway_code=null 
WHERE payment_method_code='CARD';

UPDATE public.sys_payment_method_cd 
SET payment_nature='REAL_PAYMENT', method_category='CHECK', is_deprecated=false, replacement_code=null, gateway_code=null 
WHERE payment_method_code='CHECK';

UPDATE public.sys_payment_method_cd 
SET payment_nature='REAL_PAYMENT', method_category='BANK', is_deprecated=false, replacement_code=null, gateway_code=null 
WHERE payment_method_code='BANK_TRANSFER';

UPDATE public.sys_payment_method_cd 
SET payment_nature='REAL_PAYMENT', method_category='MOBILE', is_deprecated=false, replacement_code=null, gateway_code=null 
WHERE payment_method_code='MOBILE_PAYMENT';

UPDATE public.sys_payment_method_cd 
SET payment_nature='DEFERRED_SETTLEMENT', method_category='TIMING', is_deprecated=true, is_enabled=false, is_active=false, rec_status=0, replacement_code='sys_payment_type_cd.PAY_ON_COLLECTION', gateway_code=null 
WHERE payment_method_code='PAY_ON_COLLECTION';

UPDATE public.sys_payment_method_cd 
SET payment_nature='AR_ALLOCATION', method_category='INVOICE', is_deprecated=true, is_enabled=false, is_active=false, rec_status=0, replacement_code='sys_payment_type_cd.CREDIT_INVOICE', gateway_code=null 
WHERE payment_method_code='INVOICE';

UPDATE public.sys_payment_method_cd 
SET payment_nature='PROVIDER', method_category='GATEWAY_PROVIDER', is_deprecated=true, is_enabled=false, is_active=false, rec_status=0, replacement_code='sys_payment_gateway_cd.HYPERPAY', gateway_code='HYPERPAY' 
WHERE payment_method_code='HYPERPAY';

UPDATE public.sys_payment_method_cd 
SET payment_nature='PROVIDER', method_category='GATEWAY_PROVIDER', is_deprecated=true, is_enabled=false, is_active=false, rec_status=0, replacement_code='sys_payment_gateway_cd.PAYTABS', gateway_code='PAYTABS' 
WHERE payment_method_code='PAYTABS';

UPDATE public.sys_payment_method_cd 
SET payment_nature='PROVIDER', method_category='GATEWAY_PROVIDER', is_deprecated=true, is_enabled=false, is_active=false, rec_status=0, replacement_code='sys_payment_gateway_cd.STRIPE', gateway_code='STRIPE' 
WHERE payment_method_code='STRIPE';

-- Insert PAYMENT_GATEWAY
INSERT INTO public.sys_payment_method_cd (
  payment_method_code, payment_method_name, payment_method_name2,
  is_enabled, is_active, rec_notes, payment_method_color1,
  payment_method_icon, payment_nature, method_category,
  is_deprecated, rec_status
)
VALUES (
  'PAYMENT_GATEWAY', 'Payment Gateway', 'بوابة دفع',
  true, true, 'Online payment gateway method; provider is stored separately in sys_payment_gateway_cd.',
  '#6366f1', 'credit-card', 'REAL_PAYMENT', 'GATEWAY', false, 1
)
ON CONFLICT (payment_method_code) DO UPDATE SET
  payment_method_name = EXCLUDED.payment_method_name,
  payment_method_name2 = EXCLUDED.payment_method_name2,
  rec_notes = EXCLUDED.rec_notes,
  payment_nature = EXCLUDED.payment_nature,
  method_category = EXCLUDED.method_category,
  is_deprecated = EXCLUDED.is_deprecated;


-- 2. Create sys_card_brand_cd
CREATE TABLE IF NOT EXISTS public.sys_card_brand_cd (
  code varchar(50) PRIMARY KEY,
  name varchar(250) NOT NULL,
  name2 varchar(250),
  description text,
  description2 text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  rec_status smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sys_card_brand_rec_status CHECK (rec_status IN (0,1,2))
);

INSERT INTO public.sys_card_brand_cd (code,name,name2,display_order) VALUES
('VISA','Visa','فيزا',1),
('MASTERCARD','Mastercard','ماستركارد',2),
('AMEX','American Express','أمريكان إكسبريس',3),
('MADA','Mada','مدى',4),
('OMANNET','OmanNet','عمان نت',5),
('APPLE_PAY','Apple Pay','Apple Pay',6),
('GOOGLE_PAY','Google Pay','Google Pay',7),
('UNKNOWN','Unknown','غير معروف',999)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, name2=EXCLUDED.name2, display_order=EXCLUDED.display_order;


-- 3. Create sys_cash_drawer_session_status_cd
CREATE TABLE IF NOT EXISTS public.sys_cash_drawer_session_status_cd (
  code varchar(50) PRIMARY KEY,
  name varchar(250) NOT NULL,
  name2 varchar(250),
  description text,
  description2 text,
  is_final boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  rec_status smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sys_cash_drawer_session_status_rec_status CHECK (rec_status IN (0,1,2))
);

INSERT INTO public.sys_cash_drawer_session_status_cd
(code,name,name2,is_final,display_order) VALUES
('OPEN','Open','مفتوحة',false,1),
('CLOSED','Closed','مغلقة',true,2),
('FORCE_CLOSED','Force Closed','مغلقة إجبارياً',true,3),
('CANCELLED','Cancelled','ملغاة',true,4)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, name2=EXCLUDED.name2, is_final=EXCLUDED.is_final, display_order=EXCLUDED.display_order;


-- 4. Create sys_cash_drawer_movement_type_cd
CREATE TABLE IF NOT EXISTS public.sys_cash_drawer_movement_type_cd (
  code varchar(50) PRIMARY KEY,
  name varchar(250) NOT NULL,
  name2 varchar(250),
  description text,
  description2 text,
  default_direction varchar(10) NOT NULL,
  affects_expected_cash boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  rec_status smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sys_cash_drawer_movement_type_direction CHECK (default_direction IN ('IN','OUT','NONE')),
  CONSTRAINT chk_sys_cash_drawer_movement_type_rec_status CHECK (rec_status IN (0,1,2))
);

INSERT INTO public.sys_cash_drawer_movement_type_cd
(code,name,name2,default_direction,affects_expected_cash,display_order) VALUES
('OPENING_FLOAT','Opening Float','رصيد افتتاحي','IN',true,1),
('CASH_SALE','Cash Sale','بيع نقدي','IN',true,2),
('CASH_REFUND','Cash Refund','استرداد نقدي','OUT',true,3),
('CASH_IN','Cash In','إدخال نقدي','IN',true,4),
('CASH_OUT','Cash Out','إخراج نقدي','OUT',true,5),
('CASH_DROP','Cash Drop','توريد نقدي','OUT',true,6),
('CLOSING_COUNT','Closing Count','جرد الإغلاق','NONE',false,7),
('SHORTAGE','Shortage','عجز','NONE',false,8),
('OVERAGE','Overage','زيادة','NONE',false,9),
('ADJUSTMENT','Adjustment','تسوية','NONE',false,10)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, name2=EXCLUDED.name2, default_direction=EXCLUDED.default_direction, affects_expected_cash=EXCLUDED.affects_expected_cash, display_order=EXCLUDED.display_order;

-- ==============================================================================
-- Description: Fix payment gateway table to include is_enabled column
-- Author: Platform team
-- Date: 2026-05-15
-- ==============================================================================

ALTER TABLE public.sys_payment_gateway_cd
ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;

-- Ensure audit columns are consistent if missing (though 0134 should have added them)
ALTER TABLE public.sys_payment_gateway_cd
ADD COLUMN IF NOT EXISTS rec_notes text,
ADD COLUMN IF NOT EXISTS rec_status smallint DEFAULT 1;

-- Update existing gateways to have is_enabled = true
UPDATE public.sys_payment_gateway_cd SET is_enabled = true WHERE is_enabled IS NULL;

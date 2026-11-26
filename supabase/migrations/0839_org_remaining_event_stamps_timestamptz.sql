-- Remaining organization event stamps become timestamptz.
-- s_date defaults to now() and stored rows carry a time, so it is an instant, not a civil date.
-- effective_from and effective_until are the instants an override starts and ends.

BEGIN;


-- org_branches_mst.s_date
ALTER TABLE public.org_branches_mst ALTER COLUMN s_date TYPE timestamptz USING s_date AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_branches_mst.s_date IS 'UTC instant (s_date). Converted from a naive stamp written while the database session was UTC. The default is now() and stored rows carry a time, so this is an instant, not a civil date.';
ALTER TABLE public.org_branches_mst ALTER COLUMN s_date SET DEFAULT now();

-- org_customers_mst.s_date
ALTER TABLE public.org_customers_mst ALTER COLUMN s_date TYPE timestamptz USING s_date AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_customers_mst.s_date IS 'UTC instant (s_date). Converted from a naive stamp written while the database session was UTC. The default is now() and stored rows carry a time, so this is an instant, not a civil date.';
ALTER TABLE public.org_customers_mst ALTER COLUMN s_date SET DEFAULT now();

-- org_ff_overrides_cf.approved_at
ALTER TABLE public.org_ff_overrides_cf ALTER COLUMN approved_at TYPE timestamptz USING approved_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ff_overrides_cf.approved_at IS 'UTC instant (approved_at). Converted from a naive stamp written while the database session was UTC.';

-- org_ff_overrides_cf.effective_from
ALTER TABLE public.org_ff_overrides_cf ALTER COLUMN effective_from TYPE timestamptz USING effective_from AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ff_overrides_cf.effective_from IS 'UTC instant (effective_from). Converted from a naive stamp written while the database session was UTC. Instant the override starts.';

-- org_ff_overrides_cf.effective_until
ALTER TABLE public.org_ff_overrides_cf ALTER COLUMN effective_until TYPE timestamptz USING effective_until AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_ff_overrides_cf.effective_until IS 'UTC instant (effective_until). Converted from a naive stamp written while the database session was UTC. Instant the override ends.';

-- org_pln_subscriptions_mst.activated_at
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN activated_at TYPE timestamptz USING activated_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_subscriptions_mst.activated_at IS 'UTC instant (activated_at). Converted from a naive stamp written while the database session was UTC.';

-- org_pln_subscriptions_mst.cancelled_at
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN cancelled_at TYPE timestamptz USING cancelled_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_subscriptions_mst.cancelled_at IS 'UTC instant (cancelled_at). Converted from a naive stamp written while the database session was UTC.';

-- org_pln_subscriptions_mst.discount_applied_at
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN discount_applied_at TYPE timestamptz USING discount_applied_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_subscriptions_mst.discount_applied_at IS 'UTC instant (discount_applied_at). Converted from a naive stamp written while the database session was UTC.';

-- org_pln_subscriptions_mst.plan_change_scheduled_at
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN plan_change_scheduled_at TYPE timestamptz USING plan_change_scheduled_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_subscriptions_mst.plan_change_scheduled_at IS 'UTC instant (plan_change_scheduled_at). Converted from a naive stamp written while the database session was UTC.';

-- org_pln_subscriptions_mst.plan_changed_at
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN plan_changed_at TYPE timestamptz USING plan_changed_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_subscriptions_mst.plan_changed_at IS 'UTC instant (plan_changed_at). Converted from a naive stamp written while the database session was UTC.';

-- org_pln_subscriptions_mst.suspended_at
ALTER TABLE public.org_pln_subscriptions_mst ALTER COLUMN suspended_at TYPE timestamptz USING suspended_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_pln_subscriptions_mst.suspended_at IS 'UTC instant (suspended_at). Converted from a naive stamp written while the database session was UTC.';

-- org_users_mst.last_login_at
ALTER TABLE public.org_users_mst ALTER COLUMN last_login_at TYPE timestamptz USING last_login_at AT TIME ZONE 'UTC';
COMMENT ON COLUMN public.org_users_mst.last_login_at IS 'UTC instant (last_login_at). Converted from a naive stamp written while the database session was UTC.';


COMMIT;

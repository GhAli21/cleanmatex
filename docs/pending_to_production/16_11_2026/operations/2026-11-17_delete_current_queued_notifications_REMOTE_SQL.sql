-- Owner-run only: execute in the REMOTE Supabase SQL editor.
-- Purpose: permanently delete exactly the 57 notification outbox rows that were
-- QUEUED when this script was generated on 2026-11-17. This is not a migration.
-- Safety: aborts if a target row changed state/disappeared or gained a direct
-- dependent record. It never deletes non-target rows or any non-QUEUED row.

BEGIN;

CREATE TEMP TABLE queued_notification_delete_target (
  id UUID PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO queued_notification_delete_target (id) VALUES
  ('0224ef8d-0b7a-45b8-9423-83f8f58c40d1'),
  ('0e34994c-55df-4526-990c-3008b210b8e5'),
  ('11012f10-0fb4-420a-9c87-5c5ea84357cb'),
  ('11fc3bef-71ac-4624-a699-566acd63dc61'),
  ('1206c9b5-036e-4da9-a74c-c8703ef9bd53'),
  ('137f379f-366e-4e9b-bc11-2e337ba5dad4'),
  ('18b51079-2b95-4f62-aa0c-93f16d028590'),
  ('203f0f12-de96-4bba-bbb6-fbbb746f6d68'),
  ('20b5dd22-b772-484a-aac9-ffd8a1c0e608'),
  ('25cf9cb7-8fc0-47e8-bf87-c5cab78e805c'),
  ('27f8da79-36b4-4882-9281-981c1d32b05f'),
  ('2a39638f-02e3-45a7-8af6-0b9d9c13ac47'),
  ('2abdd2ab-2abf-4c2f-82d4-f2243631dbd8'),
  ('2ac50253-1dee-4dc6-b35e-7de804611936'),
  ('31818f15-6085-4dda-a030-a3b38006f46d'),
  ('3c677f1c-fc69-45e8-b43d-63f159503533'),
  ('4126de4d-da51-4be7-8c04-1f82ccfe510f'),
  ('46d73d38-4bc8-4ac2-b964-cc8edc299893'),
  ('4eaf52d4-7e7c-4e10-96a5-3bee7bb169cf'),
  ('526a4f5f-e939-41cd-858e-686ddb3331b9'),
  ('52adde4f-076a-4bb7-916b-4a48acc1c970'),
  ('55600311-c983-4a03-9a48-74973b239618'),
  ('62e3c258-8d88-440c-99a5-65ce7fa93ec9'),
  ('64738bde-af3e-4188-8f8f-c4fc3837b487'),
  ('65a11bd3-3787-4d7f-a1fe-e7647a8d5889'),
  ('670dd75f-2475-4058-9b36-f314cc9a878b'),
  ('6bb45bf3-2741-4353-96d4-71093503d71c'),
  ('730c0c3a-a9c0-48ef-b273-3d501c4b2124'),
  ('787d469a-4db5-46f0-989a-79d268f21427'),
  ('80bb8f62-351b-45b0-a943-789440c31f75'),
  ('8398e683-d023-458f-89e5-8747af0d7f4b'),
  ('8714f9a1-1300-4c73-98cc-cb2d2925a5f4'),
  ('8c0a5a54-8226-4fc9-aaef-97bd9d51eb5b'),
  ('8c9e2ea0-6b33-4e71-8ab6-24675e415435'),
  ('8f4dd482-51c8-4a64-8964-d14bc36091c4'),
  ('8f636421-6131-4466-8456-3b29881dcff6'),
  ('9437c6f0-423b-4d49-8917-99843aa5302c'),
  ('9a42f4ae-86f4-4845-b128-8691b77ea179'),
  ('9a84a0e8-060a-4832-be1d-74b56084899c'),
  ('9aeda289-e39d-44cb-8a5f-9a11f9e13aaf'),
  ('a0202649-e845-4c94-9370-0669eb4d5714'),
  ('a18d5701-712d-4675-872e-fb449e665f22'),
  ('a4657192-793f-4d83-940e-171ba6a13017'),
  ('a48d831d-0e6c-4142-9a2d-bf92278144bf'),
  ('b5ea6806-3fdd-4dcf-b4d9-199860955ed8'),
  ('b6febee9-22f2-44bd-bdb5-dc627a7ad389'),
  ('bb4a769d-d18f-4c87-8f48-76d637d36cdb'),
  ('c32b5ee7-ee5f-4aa5-b43a-3c72a5915def'),
  ('c7cf8543-8792-474e-a237-8c2c9a2e5371'),
  ('d6c43c6b-03a7-4db3-af7e-68039d3e316f'),
  ('da1ddea0-0aac-44bb-b8f3-1912bd1a9ca8'),
  ('e5c8f625-9239-4754-b8f3-f11ba19f840e'),
  ('e6924de2-ea8e-484b-93ac-c65680bdb6fe'),
  ('e74d483d-d1f1-4c5c-899f-f1a14b244d61'),
  ('ebce0f5b-7e65-435b-97fd-aba2ca9d11b7'),
  ('ec0da11b-27ec-4daf-a960-22999d9636bd'),
  ('fa19d82e-12fa-482a-940f-fa691add6a2f');

DO $$
DECLARE
  v_target_count INTEGER;
  v_current_count INTEGER;
BEGIN
  SELECT count(*) INTO v_target_count FROM queued_notification_delete_target;
  SELECT count(*) INTO v_current_count
  FROM public.org_ntf_outbox_dtl o
  JOIN queued_notification_delete_target t ON t.id = o.id
  WHERE o.status = 'QUEUED';

  IF v_target_count <> 57 OR v_current_count <> 57 THEN
    RAISE EXCEPTION 'Abort: expected 57 unchanged QUEUED targets, found target_count=% queued_target_count=%',
      v_target_count, v_current_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.org_ntf_camp_targets_dtl c
    JOIN queued_notification_delete_target t ON t.id = c.outbox_id
  ) OR EXISTS (
    SELECT 1
    FROM public.org_ntf_delivery_log_dtl d
    JOIN public.org_ntf_outbox_dtl o ON o.id = d.outbox_id AND o.tenant_org_id = d.tenant_org_id
    JOIN queued_notification_delete_target t ON t.id = o.id
  ) OR EXISTS (
    SELECT 1
    FROM public.org_ntf_receipts_tr r
    JOIN public.org_ntf_outbox_dtl o ON o.id = r.delivery_id AND o.tenant_org_id = r.tenant_org_id
    JOIN queued_notification_delete_target t ON t.id = o.id
  ) THEN
    RAISE EXCEPTION 'Abort: a queued target now has a dependent campaign, delivery-log, or receipt record';
  END IF;
END;
$$;

DELETE FROM public.org_ntf_outbox_dtl o
USING queued_notification_delete_target t
WHERE o.id = t.id
  AND o.status = 'QUEUED';

COMMIT;

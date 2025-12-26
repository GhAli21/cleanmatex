
Do After supabase db reset :-

node scripts/db/create-demo-admins.js

select * from migrate_users_to_rbac();

UPDATE org_users_mst
SET email = auth.users.email,
phone=auth.users.phone
FROM auth.users
WHERE org_users_mst.user_id = auth.users.id;

commit;


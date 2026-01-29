# add-new-permission

Write your command content here.

This command will be available in chat with /add-new-permission permission code [role]

create insert statement for new permission to:
sys_auth_permissions
sys_auth_role_default_permissions for roles super_admin, tenant_admin, [role]

append that insert statement to docs/master_data/Permissions_To_InsertTo_DB.sql

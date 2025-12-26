-- Seed default HQ admin user (idempotent)
DO $$
DECLARE
    admin_exists BOOLEAN;
BEGIN
    -- Check if admin user with this email already exists
    SELECT EXISTS(
        SELECT 1 FROM hq_users 
		--WHERE email = 'admin@cleanmatex.com'
    ) INTO admin_exists;

    IF admin_exists = false THEN
        INSERT INTO hq_users (
            email,
            full_name,
            full_name_ar,
            password_hash,
            role_code,
            is_active,
            is_email_verified,
            mfa_enabled,
            password_changed_at,
            created_at,
            updated_at
        ) VALUES (
            'admin@cleanmatex.com',
            'System Administrator',
            'مدير النظام',
            '$2b$10$YQiiz.hqezrzK7pjpLqOxejwKKPsFH8rY.GrSGbUCpBQrjK8qr9aG', -- Admin@123
            'SUPER_ADMIN',
            true,
            true,
            false,
            now(),
            now(),
            now()
        );

        RAISE NOTICE 'Default admin user created: admin@cleanmatex.com / Admin@123';
    ELSE
        RAISE NOTICE 'Admin user already exists, skipping creation.';
    END IF;
END $$;

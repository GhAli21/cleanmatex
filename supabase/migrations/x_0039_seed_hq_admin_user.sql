-- =====================================================
-- Migration: Seed Default HQ Admin User
-- Purpose: Create default Super Admin user for Platform HQ Console
-- Date: 2025-11-20
-- =====================================================

-- Check if admin user already exists, if not insert
DO $$
DECLARE
    admin_exists BOOLEAN;
BEGIN
    -- Check if admin user exists
    SELECT EXISTS(
        SELECT 1 FROM hq_users 
		--WHERE email = 'admin@cleanmatex.com'
    ) INTO admin_exists;

    IF admin_exists=false THEN
        -- Insert default admin user
        -- Password: Admin@123
        -- Bcrypt hash generated with salt rounds = 10
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

        RAISE NOTICE 'Default admin user created successfully!';
        RAISE NOTICE 'Email: admin@cleanmatex.com';
        RAISE NOTICE 'Password: Admin@123';
        RAISE NOTICE 'IMPORTANT: Change this password after first login!';
    ELSE
        RAISE NOTICE 'Admin user already exists, skipping creation.';
    END IF;
END $$;

-- Add comment
COMMENT ON TABLE hq_users IS 'Platform HQ Console - Admin users. Default admin: admin@cleanmatex.com / Admin@123';

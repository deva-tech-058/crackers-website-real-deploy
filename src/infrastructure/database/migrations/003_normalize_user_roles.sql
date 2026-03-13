-- Users role normalization migration
-- Aligns existing/live databases to application role model: admin | user

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(50);

UPDATE users
SET role = 'admin'
WHERE LOWER(TRIM(COALESCE(role, ''))) IN ('admin', 'administrator', 'superadmin', 'super_admin');

UPDATE users
SET role = 'user'
WHERE role IS NULL
   OR TRIM(role) = ''
   OR LOWER(TRIM(role)) IN ('user', 'customer', 'client', 'buyer');

ALTER TABLE users
    ALTER COLUMN role SET DEFAULT 'user';

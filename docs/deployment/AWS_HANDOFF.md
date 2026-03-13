# AWS Handoff Checklist

Use this document while handing over to DevOps.

## 1. Runtime

- Node.js: 20.x LTS recommended
- Package manager: npm
- Start command: `npm start`
- Port: from `PORT` env (default `3000`)

## 2. Environment Variables

Set these in AWS secret manager / environment:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`

## 3. Database Setup

Run migrations in order:

1. `src/infrastructure/database/migrations/001_create_orders_tables.sql`
2. `src/infrastructure/database/migrations/002_create_user_addresses_table.sql`
3. `src/infrastructure/database/migrations/003_normalize_user_roles.sql`

Or use consolidated setup script:

- `docs/database/DEVOPS_FULL_DATABASE_SCRIPT.sql`

Table reference:

- `docs/database/TABLE_REFERENCE.md`

## 4. Static and Upload Paths

- Static frontend served from `public/`
- Uploaded media served from `/uploads`
- Ensure write permission for `uploads/` in runtime container/instance.

## 5. Health Checks

After deployment, verify:

- `GET /api/auth/test` returns success
- `GET /api/auth/session` returns 401 without auth, 200 with valid auth
- `GET /api/products`
- `GET /api/categories`
- `GET /api/hero`
- `GET /api/orders` (admin)

## 6. App Flows to Smoke Test

- User register/login
- Product add/edit/delete from admin page
- Order creation from checkout
- User address save (`/api/user/addresses`)
- Admin order status update
- Admin user role promote/demote (`PATCH /api/auth/users/:id/role`)
- Session invalidation: delete a logged-in DB user and confirm auto-logout within poll interval

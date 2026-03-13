# Project Runtime Flow

## 1. Login Flow

1. User submits mobile + password in `public/login.html`.
2. `POST /api/auth/login` validates credentials from `users` table.
3. Server returns JWT + role (`admin` or `user`) and sets `authToken` cookie.
4. Frontend stores normalized session in `localStorage` via `public/js/auth-session.js`.
5. Redirect:
   - `admin` -> `/admin/admin-dashboard.html`
   - `user` -> `/`

## 2. Real-Time Session Safety

1. `public/js/auth-session.js` polls `GET /api/auth/session` every 15 seconds.
2. `src/middleware/auth.middleware.js` validates:
   - token is valid
   - user still exists in DB
3. If account is deleted or token invalid:
   - API returns `401`
   - frontend clears session and redirects to `/login.html`
4. If admin role is removed while page is open:
   - session poll syncs role
   - admin pages auto logout/redirect

## 3. Admin Access Flow

1. `/admin/*` static pages are protected by:
   - `authenticateTokenForPage`
   - `requireAdminForPage`
2. Admin navbar user label is rendered by `public/js/admin-navbar.js`.
3. Admin role management endpoint:
   - `PATCH /api/auth/users/:id/role`
   - `POST /api/auth/users/:id/role` (compatibility fallback)

## 4. Role Management Rules

- Only authenticated admins can promote/demote users.
- Self-demotion is blocked.
- Last admin demotion is blocked.
- Accepted role values are normalized to `admin`/`user`.

## 5. AWS Readiness Pointers

- Start command: `npm start`
- Run DB migrations in order: `001`, `002`, `003`
- Validate: auth login, session endpoint, admin role change, order flow, product CRUD.

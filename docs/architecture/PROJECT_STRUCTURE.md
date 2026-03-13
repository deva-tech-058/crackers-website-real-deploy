# Project Structure

## Active Runtime Flow

`src/server.js` -> `src/app.js` -> `src/routes/*` -> `src/controllers/*` -> `src/services/*` -> PostgreSQL

## Folder Layout

```txt
crackers-website/
  docs/
    architecture/
      PROJECT_FLOW.md
      PROJECT_STRUCTURE.md
    database/
      TABLE_REFERENCE.md
    deployment/
      AWS_HANDOFF.md
  public/
    admin/
    *.html
    js/
      admin-navbar.js
      auth-session.js
      navbar-auth.js
  scripts/
    add-product-video-column.sql
    clear-products.sql
  src/
    app.js
    server.js
    config/
      db.js
    controllers/
      auth.controller.js
      category.controller.js
      hero.controller.js
      order.controller.js
      product.controller.js
    infrastructure/
      database/
        migrations/
    middleware/
      auth.middleware.js
      error.middleware.js
    routes/
      auth.routes.js
      categories.routes.js
      hero.routes.js
      orders.routes.js
      products.routes.js
      user.routes.js
    services/
      auth.service.js
      category.service.js
      hero.service.js
      product.service.js
  uploads/
  .env
  .env.example
  package.json
```

## Cleanup Applied

- Removed duplicate wrapper routes/controllers from root.
- Removed unused placeholder module architecture (`src/modules`).
- Removed unused placeholder files (`src/models`, `src/core`, `src/utils/logger.js`, old static css/js leftovers).
- Added docs for database and AWS handoff.

## Auth and Session Notes

- Login is role-aware (`admin` / `user`) from `src/services/auth.service.js`.
- Auth middleware validates token **and** checks live user record in DB (`src/middleware/auth.middleware.js`).
- Real-time client session validation runs from `public/js/auth-session.js` via `GET /api/auth/session`.
- Admin navbar identity rendering is centralized in `public/js/admin-navbar.js`.

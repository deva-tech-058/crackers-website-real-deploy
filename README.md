# Crackers Website

Production-ready Node.js + PostgreSQL project for crackers e-commerce (customer + admin pages).

## Tech Stack

- Node.js (CommonJS)
- Express
- PostgreSQL (`pg`)
- Static frontend from `public/`

## Run Locally

1. Install dependencies:
   `npm install`
2. Create env file:
   `copy .env.example .env`
3. Update `.env` with real DB + JWT values.
4. Start server:
   `npm start`

Server starts on `http://localhost:3000` by default.

## Environment Variables

Required keys are documented in `.env.example`:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`

## Database

- Run SQL migrations from:
  `src/infrastructure/database/migrations/`
- Full one-shot DevOps SQL script:
  `docs/database/DEVOPS_FULL_DATABASE_SCRIPT.sql`
- Table-wise reference:
  `docs/database/TABLE_REFERENCE.md`

## Current Production Structure

```txt
public/
  admin/
  *.html
  js/
src/
  app.js
  server.js
  config/
    db.js
  controllers/
  services/
  routes/
  middleware/
  infrastructure/
    database/
      migrations/
scripts/
docs/
  architecture/
  database/
```

## AWS Handoff

Use `docs/deployment/AWS_HANDOFF.md` for DevOps handover checklist.

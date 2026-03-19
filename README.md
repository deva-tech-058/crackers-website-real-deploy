# Crackers Website (AWS EC2 + Jenkins Ready)

This project is now prepared for:

- Frontend on **separate EC2**
- Backend Node.js API on **separate EC2**
- Database on **Amazon RDS PostgreSQL**
- Images/media on **Amazon S3**
- Domain via **Route 53**
- CI/CD via **Jenkins pipeline** (no Docker)

## Target Architecture

1. `www.example.com` -> Frontend EC2 (Nginx serving `public/`)
2. `api.example.com` -> Backend EC2 (Nginx reverse proxy to Node/PM2)
3. Backend -> RDS PostgreSQL
4. Media uploads -> S3 bucket
5. Jenkins -> deploys frontend and backend to both EC2 servers over SSH

## Project Structure

```txt
public/
  js/
    runtime-config.js
    api-client.js
src/
  app.js
  server.js
  config/
    app.config.js
    auth-cookie.config.js
    db.js
  controllers/
  routes/
  services/
  middleware/
  utils/
Jenkinsfile
ecosystem.config.js
deploy/
  nginx/
    frontend.conf
    backend-api.conf
  scripts/
    render-runtime-config.sh
    remote-deploy-backend.sh
    remote-deploy-frontend.sh
docs/deployment/
```

## Local Run

```bash
npm install
copy .env.example .env
npm start
```

## Production Env (Backend EC2)

Set in backend EC2 `.env`:

- `NODE_ENV=production`
- `PORT=3000`
- `SERVE_STATIC=false`
- `DATABASE_URL=...` (RDS connection string)
- `DB_SSL=true`
- `JWT_SECRET=...`
- `CORS_ALLOWED_ORIGINS=https://www.example.com`
- `AUTH_COOKIE_SAME_SITE=none` (if frontend/backend are different domains)
- `AUTH_COOKIE_SECURE=true`
- `STORAGE_DRIVER=s3`
- `S3_REGION=ap-south-1`
- `S3_BUCKET_NAME=your-crackers-assets`
- `S3_UPLOAD_PREFIX=uploads`
- `S3_PUBLIC_BASE_URL=https://your-crackers-assets.s3.ap-south-1.amazonaws.com` (optional)
- `S3_UPLOAD_ACL=` (optional; keep empty for modern ACL-disabled buckets)

If you want local files instead of S3:

- `STORAGE_DRIVER=local`

## Frontend Runtime Config

Frontend API routing is controlled by `public/js/runtime-config.js`.

Jenkins automatically generates this using:

- `API_BASE_URL`
- `ASSET_BASE_URL`
- `FRONTEND_BASE_URL`

## Jenkins CI/CD

Use root [Jenkinsfile](C:\Users\devaraj\OneDrive\Desktop\project\crackers-website\Jenkinsfile).

Pipeline does:

1. Install + syntax validation
2. Generate frontend runtime config
3. Package backend + frontend artifacts
4. Deploy backend to backend EC2 and reload PM2
5. Deploy frontend to frontend EC2

## Nginx Samples

- Frontend: [frontend.conf](C:\Users\devaraj\OneDrive\Desktop\project\crackers-website\deploy\nginx\frontend.conf)
- Backend API: [backend-api.conf](C:\Users\devaraj\OneDrive\Desktop\project\crackers-website\deploy\nginx\backend-api.conf)

## PM2

PM2 process config is in:

- [ecosystem.config.js](C:\Users\devaraj\OneDrive\Desktop\project\crackers-website\ecosystem.config.js)

## Health Check

- `GET /api/health`

## Deployment Docs

- [AWS_HANDOFF.md](C:\Users\devaraj\OneDrive\Desktop\project\crackers-website\docs\deployment\AWS_HANDOFF.md)
- [AWS_SPLIT_DEPLOYMENT.md](C:\Users\devaraj\OneDrive\Desktop\project\crackers-website\docs\deployment\AWS_SPLIT_DEPLOYMENT.md)
- [JENKINS_EC2_PIPELINE.md](C:\Users\devaraj\OneDrive\Desktop\project\crackers-website\docs\deployment\JENKINS_EC2_PIPELINE.md)

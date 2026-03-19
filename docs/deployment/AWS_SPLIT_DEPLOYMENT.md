# AWS Split Deployment (Frontend EC2 + Backend EC2 + RDS)

This runbook matches your requested setup:

- Frontend in one EC2
- Backend Node.js API in another EC2
- Images/uploads in S3 bucket
- RDS PostgreSQL
- Route 53 custom domain
- Jenkins CI/CD deploy

## 1. AWS Resources

Create:

1. `frontend-ec2` (Nginx + static hosting)
2. `backend-ec2` (Node.js + PM2 + Nginx reverse proxy)
3. `rds-postgres` in private subnet
4. `s3-assets-bucket` for product/hero media
5. Route 53 hosted zone and DNS records

Suggested DNS:

- `A` record -> `www.example.com` -> frontend EC2 public IP / ALB
- `A` record -> `api.example.com` -> backend EC2 public IP / ALB

## 2. Security Groups

Frontend EC2 SG:

- Inbound 80/443 from Internet
- SSH (22) from your office IP / Jenkins IP

Backend EC2 SG:

- Inbound 80/443 from Internet (or from frontend/ALB only)
- SSH (22) from Jenkins IP

RDS SG:

- Inbound 5432 only from backend EC2 SG

## 3. Backend EC2 Setup

Install:

- Node.js 20
- Nginx
- PM2 (`npm i -g pm2`)

Deploy path:

- `/var/www/crackers-backend`

Create `.env` in backend app path with production values.
For S3 mode include:

- `STORAGE_DRIVER=s3`
- `S3_REGION=ap-south-1`
- `S3_BUCKET_NAME=your-assets-bucket`
- `S3_UPLOAD_PREFIX=uploads`
- `S3_PUBLIC_BASE_URL=` (optional, use if CloudFront/custom domain)
- `S3_UPLOAD_ACL=` (optional, keep empty for ACL-disabled buckets)

Start app first time:

```bash
cd /var/www/crackers-backend
npm ci --omit=dev
pm2 start ecosystem.config.js --only crackers-api --update-env
pm2 save
```

Apply backend Nginx config:

- `deploy/nginx/backend-api.conf`

## 4. Frontend EC2 Setup

Install:

- Nginx

Deploy path:

- `/var/www/crackers-frontend/public`

Apply frontend Nginx config:

- `deploy/nginx/frontend.conf`

## 5. Runtime Config for Frontend

Jenkins generates `public/js/runtime-config.js` during build:

```js
window.__APP_CONFIG__ = {
  API_BASE_URL: "https://api.example.com",
  ASSET_BASE_URL: "https://api.example.com",
  FRONTEND_BASE_URL: "https://www.example.com",
};
```

## 6. Database Migration

Run:

1. `src/infrastructure/database/migrations/001_create_orders_tables.sql`
2. `src/infrastructure/database/migrations/002_create_user_addresses_table.sql`
3. `src/infrastructure/database/migrations/003_normalize_user_roles.sql`

Or:

- `docs/database/DEVOPS_FULL_DATABASE_SCRIPT.sql`

## 7. Jenkins Deployment

Use root `Jenkinsfile`.

Pipeline deploys:

1. Backend package -> backend EC2 -> `npm ci --omit=dev` -> PM2 reload
2. Frontend package -> frontend EC2 -> static files refresh

Required Jenkins credential:

- SSH private key credential id: `aws-ec2-ssh`

## 8. Smoke Test

1. `https://api.example.com/api/health`
2. `https://www.example.com`
3. Login/register flow
4. Admin product CRUD
5. Hero upload/delete
6. Order create + view
7. Uploaded images load from S3 URL

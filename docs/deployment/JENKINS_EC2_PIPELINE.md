# Jenkins Pipeline Setup (Frontend EC2 + Backend EC2)

This guide configures Jenkins for this repository.

## 1. Jenkins Plugins

Install:

- Pipeline
- SSH Agent
- Credentials Binding
- Workspace Cleanup

## 2. Credentials

Create Jenkins credential:

- Type: `SSH Username with private key`
- ID: `aws-ec2-ssh`
- Username: EC2 SSH user (example: `ec2-user`)
- Private key: your deploy key

Use same key on both frontend and backend EC2 (or create one per host and adjust pipeline).

## 3. EC2 Prerequisites

Backend EC2:

- Node.js + npm installed
- PM2 installed globally (`npm i -g pm2`)
- Project path exists: `/var/www/crackers-backend`
- `.env` created manually in backend path
- For S3 uploads, backend `.env` includes `STORAGE_DRIVER=s3`, `S3_REGION`, `S3_BUCKET_NAME` (optional `S3_UPLOAD_ACL`)
- Backend EC2 IAM role or credentials must allow `s3:PutObject` on bucket

Frontend EC2:

- Nginx installed
- Path exists: `/var/www/crackers-frontend`

## 4. Create Jenkins Job

1. New Item -> Pipeline
2. Configure SCM to this repo
3. Pipeline script from SCM: `Jenkinsfile`
4. Save

## 5. Build Parameters

Set at build time:

- `BACKEND_HOST`: `ec2-user@api.example.com`
- `FRONTEND_HOST`: `ec2-user@www.example.com`
- `BACKEND_APP_DIR`: `/var/www/crackers-backend`
- `FRONTEND_APP_DIR`: `/var/www/crackers-frontend`
- `PM2_APP_NAME`: `crackers-api`
- `API_BASE_URL`: `https://api.example.com`
- `ASSET_BASE_URL`: `https://api.example.com`
- `FRONTEND_BASE_URL`: `https://www.example.com`

## 6. What Pipeline Does

1. Checkout code
2. `npm ci` + syntax checks
3. Generate frontend `runtime-config.js`
4. Create:
   - `backend-release.tar.gz`
   - `frontend-release.tar.gz`
5. Copy + deploy backend release to backend EC2
6. Copy + deploy frontend release to frontend EC2

## 7. First-Time Backend PM2 Boot

Run once on backend EC2:

```bash
cd /var/www/crackers-backend
pm2 start ecosystem.config.js --only crackers-api --update-env
pm2 save
pm2 startup
```

## 8. Troubleshooting

- If SSH fails: verify SG inbound 22 and key mapping.
- If PM2 reload fails: verify `pm2` is installed for deploy user.
- If frontend still old: clear Nginx cache / browser cache and rebuild.

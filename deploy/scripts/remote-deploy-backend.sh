#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <backend_app_dir> <pm2_app_name>"
  exit 1
fi

BACKEND_APP_DIR="$1"
PM2_APP_NAME="$2"

cd "$BACKEND_APP_DIR"
npm ci --omit=dev

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --only "$PM2_APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --only "$PM2_APP_NAME" --update-env
fi

pm2 save
echo "Backend deployed: $PM2_APP_NAME"

#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <backend_app_dir> <pm2_app_name>"
  exit 1
fi

BACKEND_APP_DIR="$1"
PM2_APP_NAME="$2"

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi

  return 1
}

configure_nginx_upload_limit() {
  local limit_mb="${UPLOAD_FILE_MAX_MB:-1024}"
  if ! [[ "$limit_mb" =~ ^[0-9]+$ ]]; then
    limit_mb=1024
  fi

  if ! command -v nginx >/dev/null 2>&1; then
    echo "Nginx not found on this host. Skipping Nginx upload size configuration."
    return
  fi

  local conf_file="/etc/nginx/conf.d/zz-crackers-upload-limit.conf"
  if [ ! -d "/etc/nginx/conf.d" ]; then
    echo "Nginx conf.d directory not found. Skipping Nginx upload size configuration."
    return
  fi

  local conf_content="# Managed by crackers deploy script
client_max_body_size ${limit_mb}m;
"

  if printf "%s" "$conf_content" | run_privileged tee "$conf_file" >/dev/null; then
    if run_privileged nginx -t; then
      run_privileged systemctl reload nginx \
        || run_privileged service nginx reload \
        || run_privileged nginx -s reload \
        || true
      echo "Nginx upload limit applied: ${limit_mb}MB"
    else
      echo "WARNING: nginx -t failed after writing upload limit config."
    fi
  else
    echo "WARNING: Unable to write ${conf_file}. Keep client_max_body_size manually >= ${limit_mb}m."
  fi
}

cd "$BACKEND_APP_DIR"
npm ci --omit=dev
configure_nginx_upload_limit

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --only "$PM2_APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --only "$PM2_APP_NAME" --update-env
fi

pm2 save
echo "Backend deployed: $PM2_APP_NAME"

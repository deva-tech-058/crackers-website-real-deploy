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
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
send_timeout 300s;
proxy_request_buffering off;
proxy_buffering off;
proxy_max_temp_file_size 0;
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

cleanup_conflicting_pm2_apps() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found while checking PM2 conflicts; skipping cleanup."
    return
  fi

  local conflicting_apps
  conflicting_apps="$(
    PM2_TARGET_NAME="$PM2_APP_NAME" PM2_TARGET_DIR="$BACKEND_APP_DIR" pm2 jlist 2>/dev/null \
      | node -e '
          const fs = require("fs");
          const targetName = String(process.env.PM2_TARGET_NAME || "").trim();
          const targetDir = String(process.env.PM2_TARGET_DIR || "").replace(/\\/g, "/").replace(/\/+$/, "");
          const legacyNames = new Set(["crackers", "crackers-backend", "crackers-api"]);

          function normalize(value) {
            return String(value || "").replace(/\\/g, "/").replace(/\/+$/, "");
          }

          const input = fs.readFileSync(0, "utf8");
          let list = [];
          try {
            list = JSON.parse(input);
          } catch {
            list = [];
          }

          const conflicts = new Set();
          for (const app of list) {
            const name = String(app?.name || "").trim();
            if (!name || name === targetName) continue;

            const env = app?.pm2_env || {};
            const execPath = normalize(env.pm_exec_path);
            const cwd = normalize(env.pm_cwd);
            const sameDir = Boolean(targetDir) && (cwd === targetDir || execPath.startsWith(`${targetDir}/`));
            const sameEntry = execPath.endsWith("/src/server.js") || execPath === "src/server.js";
            const looksLegacy = legacyNames.has(name);

            if (looksLegacy || (sameDir && sameEntry)) {
              conflicts.add(name);
            }
          }

          process.stdout.write(Array.from(conflicts).join("\n"));
        ' || true
  )"

  if [ -z "$conflicting_apps" ]; then
    return
  fi

  while IFS= read -r app_name; do
    [ -z "$app_name" ] && continue
    if pm2 describe "$app_name" >/dev/null 2>&1; then
      echo "Removing conflicting PM2 process: $app_name"
      pm2 delete "$app_name" || true
    fi
  done <<< "$conflicting_apps"
}

resolve_app_port() {
  local raw_port="${PORT:-}"
  if [[ "$raw_port" =~ ^[0-9]+$ ]]; then
    echo "$raw_port"
    return
  fi

  if [ -f ".env" ]; then
    raw_port="$(
      grep -E '^[[:space:]]*PORT[[:space:]]*=' .env \
        | tail -n 1 \
        | cut -d'=' -f2- \
        | tr -d '"' \
        | tr -d "'" \
        | tr -d '[:space:]'
    )"
    if [[ "$raw_port" =~ ^[0-9]+$ ]]; then
      echo "$raw_port"
      return
    fi
  fi

  echo "3000"
}

reload_or_start_pm2() {
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    if pm2 reload ecosystem.config.js --only "$PM2_APP_NAME" --update-env; then
      return
    fi

    echo "PM2 reload failed for $PM2_APP_NAME. Performing clean restart."
    pm2 delete "$PM2_APP_NAME" || true
  fi

  pm2 start ecosystem.config.js --only "$PM2_APP_NAME" --update-env
}

wait_for_backend_health() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl not found. Skipping backend health verification."
    return
  fi

  local app_port
  app_port="$(resolve_app_port)"
  local health_url="http://127.0.0.1:${app_port}/api/health"
  local max_attempts=20
  local delay_seconds=2

  for ((attempt=1; attempt<=max_attempts; attempt++)); do
    if curl --silent --show-error --fail --max-time 5 "$health_url" >/dev/null; then
      echo "Backend health check passed: $health_url"
      return
    fi
    sleep "$delay_seconds"
  done

  echo "ERROR: Backend health check failed after ${max_attempts} attempts: $health_url"
  pm2 logs "$PM2_APP_NAME" --lines 50 --nostream || true
  exit 1
}

cd "$BACKEND_APP_DIR"
npm ci --omit=dev
configure_nginx_upload_limit
cleanup_conflicting_pm2_apps
reload_or_start_pm2
wait_for_backend_health

pm2 save
echo "Backend deployed: $PM2_APP_NAME"

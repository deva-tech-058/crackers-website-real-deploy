#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <frontend_root_dir>"
  exit 1
fi

FRONTEND_ROOT_DIR="$1"

if [ ! -d "$FRONTEND_ROOT_DIR/public" ]; then
  echo "Frontend public directory not found: $FRONTEND_ROOT_DIR/public"
  exit 1
fi

echo "Frontend deployed at $FRONTEND_ROOT_DIR/public"

#!/usr/bin/env bash
set -euo pipefail
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD}"
: "${PANEL_SERVICE_TOKEN:?Set PANEL_SERVICE_TOKEN}"
export DATA_DIR="${DATA_DIR:-$PWD/data}"
exec python3 server.py

#!/usr/bin/env bash
# backup.sh — Bragi QTC backup script
# Creates a JSON export and a pg_dump, then pushes both to a NAS via SMB.
#
# Schedule example (daily at 02:00):
#   0 2 * * * /path/to/bragi-qtc/backup.sh >> /var/log/bragi-backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${SCRIPT_DIR}/.backup.conf"
ENV="${SCRIPT_DIR}/.env"

for f in "$CONF" "$ENV"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: $f not found." >&2
    exit 1
  fi
done

source "$CONF"
source "$ENV"

# Derived from .env / docker-compose defaults
PORT="${PORT:-3003}"
API_URL="http://localhost:${PORT}"
DB_USER="bragi"
DB_NAME="bragi"
DB_SERVICE="db"

DATE="$(date +%Y-%m-%d_%H%M%S)"
TMP_DIR="$(mktemp -d)"
MOUNT_DIR="$(mktemp -d)"

cleanup() {
  if mountpoint -q "$MOUNT_DIR" 2>/dev/null; then
    umount "$MOUNT_DIR" || true
  fi
  rm -rf "$TMP_DIR" "$MOUNT_DIR"
}
trap cleanup EXIT

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ---------------------------------------------------------------------------
# 1. pg_dump via docker compose
# ---------------------------------------------------------------------------
log "Starting pg_dump..."
PG_DUMP_FILE="${TMP_DIR}/bragi-db-${DATE}.sql.gz"
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" \
  exec -T "$DB_SERVICE" \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$PG_DUMP_FILE"
log "pg_dump complete: $(basename "$PG_DUMP_FILE")"

# ---------------------------------------------------------------------------
# 2. JSON backup via API
# ---------------------------------------------------------------------------
log "Fetching JSON backup from API..."
JSON_BACKUP_FILE="${TMP_DIR}/bragi-json-${DATE}.json.gz"

TOKEN="$(curl -sf -X POST "${API_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SEED_ADMIN_EMAIL}\",\"password\":\"${SEED_ADMIN_PASSWORD}\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)"

if [[ -z "$TOKEN" ]]; then
  log "ERROR: Could not obtain API token."
  exit 1
fi

curl -sf "${API_URL}/api/backup" \
  -H "Authorization: Bearer ${TOKEN}" \
  | gzip > "$JSON_BACKUP_FILE"
log "JSON backup complete: $(basename "$JSON_BACKUP_FILE")"

# ---------------------------------------------------------------------------
# 3. Mount NAS and copy files
# ---------------------------------------------------------------------------
log "Mounting NAS //${NAS_HOST}/${NAS_SHARE}..."
mount -t cifs "//${NAS_HOST}/${NAS_SHARE}" "$MOUNT_DIR" \
  -o "username=${NAS_USER},password=${NAS_PASS},uid=$(id -u),gid=$(id -g)"

NAS_TARGET="${MOUNT_DIR}/${NAS_BACKUP_DIR}/${DATE}"
mkdir -p "$NAS_TARGET"
cp "$PG_DUMP_FILE" "$NAS_TARGET/"
cp "$JSON_BACKUP_FILE" "$NAS_TARGET/"
log "Files copied to NAS: ${NAS_BACKUP_DIR}/${DATE}/"

# ---------------------------------------------------------------------------
# 4. Prune old backups
# ---------------------------------------------------------------------------
log "Pruning backups older than ${RETENTION_DAYS} days..."
find "${MOUNT_DIR}/${NAS_BACKUP_DIR}" -maxdepth 1 -mindepth 1 -type d \
  -mtime +"${RETENTION_DAYS}" -exec rm -rf {} +
log "Pruning done."

log "Backup finished successfully."

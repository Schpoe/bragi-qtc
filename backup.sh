#!/usr/bin/env bash
# backup.sh — Bragi QTC backup script
# Creates a JSON export and a pg_dump, then pushes both to a NAS via SMB.
#
# Setup:
#   1. Copy .backup.conf.example to .backup.conf and fill in credentials
#   2. Install cifs-utils:  sudo apt install cifs-utils
#   3. Make executable:     chmod +x backup.sh
#   4. Add cron job:        sudo crontab -e
#      Add line:  CRON_TZ=Europe/Vienna
#                 0 23 * * * /path/to/bragi-qtc/backup.sh

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_FILE="$SCRIPT_DIR/.backup.conf"
ENV_FILE="$SCRIPT_DIR/.env"
LOG_FILE="$SCRIPT_DIR/backup.log"
MOUNT_POINT="/mnt/bragi-nas"

# ── Load config ───────────────────────────────────────────────────────────────
for f in "$CONF_FILE" "$ENV_FILE"; do
  [[ -f "$f" ]] || { echo "ERROR: $f not found." >&2; exit 1; }
done
source "$CONF_FILE"
source "$ENV_FILE"

: "${NAS_HOST:?NAS_HOST not set in .backup.conf}"
: "${NAS_SHARE:?NAS_SHARE not set in .backup.conf}"
: "${NAS_BACKUP_DIR:?NAS_BACKUP_DIR not set in .backup.conf}"
: "${NAS_USER:?NAS_USER not set in .backup.conf}"
: "${NAS_PASS:?NAS_PASS not set in .backup.conf}"
: "${RETENTION_DAYS:=30}"
: "${SEED_ADMIN_EMAIL:?SEED_ADMIN_EMAIL not set in .env}"
: "${SEED_ADMIN_PASSWORD:?SEED_ADMIN_PASSWORD not set in .env}"

PORT="${PORT:-3003}"
API_URL="http://localhost:${PORT}"

# ── Logging ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

# ── Cleanup on exit ───────────────────────────────────────────────────────────
TEMP_DIR=""
cleanup() {
  mountpoint -q "$MOUNT_POINT" 2>/dev/null && umount "$MOUNT_POINT" 2>/dev/null || true
  [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]] && rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# =============================================================================
log "=== Backup started ==="

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="bragi-$TIMESTAMP"
TEMP_DIR=$(mktemp -d)
BACKUP_DIR="$TEMP_DIR/$BACKUP_NAME"
mkdir -p "$BACKUP_DIR"

# ── 1. pg_dump ────────────────────────────────────────────────────────────────
log "Dumping PostgreSQL..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T db \
  pg_dump -U bragi bragi \
  | gzip > "$BACKUP_DIR/postgres.sql.gz" \
  || die "PostgreSQL dump failed"
log "  postgres.sql.gz: $(du -sh "$BACKUP_DIR/postgres.sql.gz" | cut -f1)"

# ── 2. JSON backup via API ────────────────────────────────────────────────────
log "Fetching JSON backup from API..."
TOKEN="$(curl -sf -X POST "${API_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SEED_ADMIN_EMAIL}\",\"password\":\"${SEED_ADMIN_PASSWORD}\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)"
[[ -n "$TOKEN" ]] || die "Could not obtain API token — check SEED_ADMIN_EMAIL/PASSWORD in .env"

curl -sf "${API_URL}/api/backup" \
  -H "Authorization: Bearer ${TOKEN}" \
  | gzip > "$BACKUP_DIR/bragi-data.json.gz" \
  || die "JSON backup API call failed"
log "  bragi-data.json.gz: $(du -sh "$BACKUP_DIR/bragi-data.json.gz" | cut -f1)"

# ── 3. Pack into single archive ───────────────────────────────────────────────
log "Creating archive..."
ARCHIVE="/tmp/${BACKUP_NAME}.tar.gz"
tar czf "$ARCHIVE" -C "$TEMP_DIR" "$BACKUP_NAME"
ARCHIVE_SIZE=$(du -sh "$ARCHIVE" | cut -f1)
log "  Archive: ${BACKUP_NAME}.tar.gz ($ARCHIVE_SIZE)"

# ── 4. Mount NAS and copy ─────────────────────────────────────────────────────
log "Mounting NAS //${NAS_HOST}/${NAS_SHARE}..."
mkdir -p "$MOUNT_POINT"
mount -t cifs "//${NAS_HOST}/${NAS_SHARE}" "$MOUNT_POINT" \
  -o "username=${NAS_USER},password=${NAS_PASS},uid=$(id -u),gid=$(id -g),file_mode=0660,dir_mode=0770" \
  || die "Failed to mount NAS — check NAS_HOST/USER/PASS and connectivity"

REMOTE_DIR="${MOUNT_POINT}/${NAS_BACKUP_DIR}"
mkdir -p "$REMOTE_DIR"

log "Copying backup to NAS..."
cp "$ARCHIVE" "$REMOTE_DIR/" || die "Copy to NAS failed"
log "  Copied to ${NAS_BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# ── 5. Retention ──────────────────────────────────────────────────────────────
log "Applying retention policy (${RETENTION_DAYS} days)..."
DELETED=0
while IFS= read -r old_file; do
  rm -f "$old_file"
  log "  Deleted: $(basename "$old_file")"
  ((DELETED++))
done < <(find "$REMOTE_DIR" -name "bragi-*.tar.gz" -mtime +"$RETENTION_DAYS" 2>/dev/null)
log "  Retention: removed $DELETED old backup(s)"

BACKUP_COUNT=$(find "$REMOTE_DIR" -name "bragi-*.tar.gz" 2>/dev/null | wc -l)
log "NAS now holds $BACKUP_COUNT backup(s)"
log "=== Backup complete: $BACKUP_NAME ($ARCHIVE_SIZE) ==="

rm -f "$ARCHIVE"

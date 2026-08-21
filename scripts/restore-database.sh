#!/usr/bin/env bash
#
# Restore a backup produced by backup-database.sh (Phase 20 — Production
# Infrastructure). By default restores into an ISOLATED throwaway database
# (never the live application database) so this script is safe to run for
# routine restore-drills without any risk to real data — matching
# docs/BACKUP_RECOVERY.md's "do not mark backup testing PASS unless a real
# restore was executed" requirement and its "never modify... without a
# restore drill" spirit.
#
# Usage:
#   ./scripts/restore-database.sh <backup-file.sql.gz> [target-database-name]
#
# If target-database-name is omitted, restores into a new database named
# "<DB_DATABASE>_restore_test_<timestamp>" — created fresh, never overwrites
# an existing database unless you explicitly pass the real DB_DATABASE name
# as the second argument (which this script will refuse to do without
# --force, since that would be a real, destructive production restore).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ -f .env ]; then
  # See backup-database.sh's matching comment — .env has unquoted values
  # with spaces (e.g. APP_NAME), which breaks a plain `source`.
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    export "${line?}"
  done < .env
fi

BACKUP_FILE="${1:?Usage: restore-database.sh <backup-file.sql.gz> [target-database-name] [--force]}"
TARGET_DB="${2:-}"
FORCE=0
for arg in "$@"; do
  if [ "$arg" = "--force" ]; then
    FORCE=1
  fi
done

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:?DB_USERNAME is required}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-${DB_PASSWORD}}"
DB_DATABASE="${DB_DATABASE:?DB_DATABASE is required}"

if [ -z "$TARGET_DB" ]; then
  TARGET_DB="${DB_DATABASE}_restore_test_$(date -u +%Y%m%dT%H%M%SZ)"
  echo "[restore] No target database given — using isolated test database: ${TARGET_DB}"
elif [ "$TARGET_DB" = "$DB_DATABASE" ] && [ "$FORCE" != "1" ]; then
  echo "[restore] Refusing to restore over the live database '${DB_DATABASE}' without --force." >&2
  echo "[restore] Re-run with: $0 ${BACKUP_FILE} ${DB_DATABASE} --force" >&2
  exit 1
fi

run_mysql() {
  if [ "${MYSQLDUMP_VIA_COMPOSE:-0}" = "1" ]; then
    docker compose -f "${COMPOSE_FILE:-docker-compose.yml}" exec -T mysql \
      mysql -uroot -p"${DB_ROOT_PASSWORD}" "$@"
  else
    "${MYSQL_BIN:-mysql}" -h "${DB_HOST}" -P "${DB_PORT}" -uroot -p"${DB_ROOT_PASSWORD}" "$@"
  fi
}

echo "[restore] Creating database '${TARGET_DB}' if it does not exist..."
run_mysql -e "CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[restore] Restoring ${BACKUP_FILE} into '${TARGET_DB}'..."
gunzip -c "$BACKUP_FILE" | run_mysql "${TARGET_DB}"

echo "[restore] Restore complete. Verifying table count..."
TABLE_COUNT="$(run_mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${TARGET_DB}';")"
echo "[restore] ${TABLE_COUNT} tables present in ${TARGET_DB}."

if [ "$TABLE_COUNT" = "0" ]; then
  echo "[restore] WARNING: zero tables restored — the backup may be empty or the restore failed silently." >&2
  exit 1
fi

echo "[restore] Done. Target database: ${TARGET_DB}"
echo "[restore] Drop it when finished verifying with:"
echo "[restore]   DROP DATABASE \`${TARGET_DB}\`;"

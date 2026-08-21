#!/usr/bin/env bash
#
# MySQL logical backup (Phase 20 — Production Infrastructure).
#
# Runs mysqldump against the docker-compose `mysql` service (or any MySQL
# reachable via the DB_* env vars), compresses the output, writes it to
# BACKUP_DIR with a timestamped filename, and prunes old backups according
# to BACKUP_RETENTION_DAILY/WEEKLY/MONTHLY (counts, not calendar-aware —
# "daily" keeps the N most recent backups regardless of exact cadence,
# "weekly"/"monthly" buckets are approximated by day-of-week/day-of-month
# markers on the filename so a single script covers all three tiers without
# needing a real scheduler-aware retention engine).
#
# This does NOT invent a cloud destination — no S3/GCS/other object storage
# is configured anywhere in this repository, so backups are written to a
# local (mountable) directory only. See docs/BACKUP_RECOVERY.md for the
# broader recovery procedure this script is one piece of.
#
# Usage:
#   ./scripts/backup-database.sh
#
# Required env (read from the process environment or a sourced .env):
#   DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
# Optional:
#   BACKUP_DIR (default ./backups)
#   BACKUP_RETENTION_DAILY (default 7)
#   BACKUP_RETENTION_WEEKLY (default 4)
#   BACKUP_RETENTION_MONTHLY (default 6)
#   MYSQLDUMP_BIN (default: mysqldump on PATH, or docker compose exec if
#     MYSQLDUMP_VIA_COMPOSE=1 is set)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ -f .env ]; then
  # Plain `source .env` breaks on unquoted values containing spaces (e.g.
  # APP_NAME=Fashion ERP Backend), which this project's .env legitimately
  # has — the app itself loads .env via the `dotenv` npm package, which
  # tolerates this; bash's `source` does not. Export line-by-line instead.
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    export "${line?}"
  done < .env
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:?DB_USERNAME is required}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
DB_DATABASE="${DB_DATABASE:?DB_DATABASE is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${BACKUP_RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${BACKUP_RETENTION_MONTHLY:-6}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAY_OF_WEEK="$(date -u +%u)"   # 1=Monday .. 7=Sunday
DAY_OF_MONTH="$(date -u +%d)"

FILENAME="${DB_DATABASE}-${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

echo "[backup] Starting mysqldump for database '${DB_DATABASE}' at ${DB_HOST}:${DB_PORT}"

run_mysqldump() {
  if [ "${MYSQLDUMP_VIA_COMPOSE:-0}" = "1" ]; then
    # Run inside the mysql container itself — avoids needing a mysqldump
    # binary on the host, and avoids exposing the DB port publicly (the
    # compose file intentionally does not publish mysql's port).
    docker compose -f "${COMPOSE_FILE:-docker-compose.yml}" exec -T mysql \
      mysqldump -u"${DB_USERNAME}" -p"${DB_PASSWORD}" \
      --single-transaction --quick --routines --triggers --events \
      --no-tablespaces \
      "${DB_DATABASE}"
  else
    "${MYSQLDUMP_BIN:-mysqldump}" \
      -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USERNAME}" -p"${DB_PASSWORD}" \
      --single-transaction --quick --routines --triggers --events \
      --no-tablespaces \
      "${DB_DATABASE}"
  fi
}

# --single-transaction gives a consistent InnoDB snapshot without locking
# tables for the duration of the dump — safe to run against a live database.
if ! run_mysqldump | gzip -9 > "${FILEPATH}.tmp"; then
  echo "[backup] mysqldump failed" >&2
  rm -f "${FILEPATH}.tmp"
  exit 1
fi

mv "${FILEPATH}.tmp" "${FILEPATH}"

BACKUP_SIZE="$(du -h "${FILEPATH}" | cut -f1)"
echo "[backup] Wrote ${FILEPATH} (${BACKUP_SIZE})"

# ---- Retention pruning ----
# Every backup counts toward "daily" retention. Additionally, the first
# backup taken on a Monday (day_of_week=1) is tagged into the "weekly"
# bucket, and the first backup taken on the 1st of the month is tagged into
# the "monthly" bucket — both by filename marker, not a separate directory,
# so a single flat backup dir stays simple to reason about.
if [ "$DAY_OF_WEEK" = "1" ]; then
  cp "${FILEPATH}" "${BACKUP_DIR}/weekly-${TIMESTAMP}-${FILENAME}"
fi
if [ "$DAY_OF_MONTH" = "01" ]; then
  cp "${FILEPATH}" "${BACKUP_DIR}/monthly-${TIMESTAMP}-${FILENAME}"
fi

prune() {
  local pattern="$1"
  local keep="$2"
  # `ls` on a non-matching glob exits non-zero and would kill the script
  # under `set -e`/pipefail; shopt -s nullglob makes the glob expand to
  # nothing instead of the literal pattern when there's no match, and the
  # explicit array-length check below avoids invoking `ls`/`tail` at all in
  # that case.
  shopt -s nullglob
  local matches=("${BACKUP_DIR}"/${pattern})
  shopt -u nullglob

  if [ "${#matches[@]}" -le "$keep" ]; then
    return 0
  fi

  # shellcheck disable=SC2012
  ls -1t "${matches[@]}" | tail -n "+$((keep + 1))" | while read -r old; do
    echo "[backup] Pruning old backup: ${old}"
    rm -f -- "${old}"
  done
}

prune "${DB_DATABASE}-*.sql.gz" "$RETENTION_DAILY"
prune "weekly-*-${DB_DATABASE}-*.sql.gz" "$RETENTION_WEEKLY"
prune "monthly-*-${DB_DATABASE}-*.sql.gz" "$RETENTION_MONTHLY"

echo "[backup] Done."

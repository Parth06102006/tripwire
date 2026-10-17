#!/usr/bin/env bash
# Back up the case store, the only state that cannot be rebuilt from the
# release bundle (the graph can be reloaded; analyst decisions cannot).
#
#   bash deploy/scripts/backup-cases.sh [s3://bucket/traceaml/backups]
#
# Uses SQLite's online backup API, so it is consistent while the API runs.
# Schedule daily with cron, for example:
#   15 2 * * * cd /opt/traceaml && bash deploy/scripts/backup-cases.sh s3://my-bucket/traceaml/backups
set -euo pipefail

DEST="${1:-}"
COMPOSE=(docker compose -f "$(dirname "$0")/../compose.prod.yaml" --env-file "$(dirname "$0")/../.env.production")
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOCAL_DIR=/srv/traceaml/backups
mkdir -p "$LOCAL_DIR"

"${COMPOSE[@]}" exec -T api python - <<'PY'
import sqlite3
source = sqlite3.connect("/app/data/cases/cases.db")
target = sqlite3.connect("/app/data/cases/cases-backup.db")
source.backup(target)
target.close()
source.close()
PY
container="$("${COMPOSE[@]}" ps -q api)"
docker cp "$container:/app/data/cases/cases-backup.db" "$LOCAL_DIR/cases-$STAMP.db"
"${COMPOSE[@]}" exec -T api rm -f /app/data/cases/cases-backup.db
gzip -f "$LOCAL_DIR/cases-$STAMP.db"
echo "backup: $LOCAL_DIR/cases-$STAMP.db.gz"

if [[ -n "$DEST" ]]; then
  aws s3 cp "$LOCAL_DIR/cases-$STAMP.db.gz" "$DEST/cases-$STAMP.db.gz" --sse AES256
fi
# Keep two weeks locally.
find "$LOCAL_DIR" -name 'cases-*.db.gz' -mtime +14 -delete

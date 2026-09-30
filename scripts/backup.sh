#!/usr/bin/env sh
# Dump the database to ./backups/valo-YYYYmmdd-HHMMSS.sql.gz
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/valo-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U valo valo | gzip > "$file"
echo "Backup: $file"

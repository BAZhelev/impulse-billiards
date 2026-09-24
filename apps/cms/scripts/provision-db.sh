#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
# Start PostgreSQL. Payload creates the databases it connects to (`cms`, `cms_test`)
# and their schema automatically on first connect (see `push` in payload.config.ts).
docker compose -f "$COMPOSE_FILE" up -d postgres

# Wait until PostgreSQL accepts connections
until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done
#!/usr/bin/env bash
# Apply the Forge schema to a Postgres database, from zero.
#
#   DATABASE_URL=postgres://... ./scripts/db-apply.sh
#   DATABASE_URL=postgres://... ./scripts/db-apply.sh --rls     (also run RLS assertions)
#   DATABASE_URL=postgres://... ./scripts/db-apply.sh --seed    (also insert demo data)
#
# schema.sql is idempotent (`create ... if not exists`, `create or replace`), so
# running it twice is safe. It is the single migration source for this repo; see
# docs/decisions.md for why there is no migrations/ directory yet.

set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to a Postgres connection string (Supabase: Project settings -> Database -> Connection string)}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. Install the Postgres client, or run schema.sql in the Supabase SQL editor." >&2
  exit 1
fi

cd "$(dirname "$0")/.."

echo "Applying supabase/schema.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/schema.sql

for arg in "$@"; do
  case "$arg" in
    --seed)
      echo "Applying supabase/seed.sql"
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
      ;;
    --rls)
      echo "Running RLS assertions"
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/rls.sql
      ;;
  esac
done

echo "Done."

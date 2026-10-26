#!/usr/bin/env bash
# Cloud database tests on plain PostgreSQL 16 (pnpm db:test). Needs a superuser connection through the usual libpq
# variables (PGHOST, PGPORT, PGUSER, PGPASSWORD). Creates and drops its own throwaway database each run.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
db="gharplan_cloud_test_$$"
export SAMPLE_PROJECT="$root/docs/examples/sample-project.json"
cleanup() { psql -q -d postgres -c "drop database if exists $db with (force)" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql -q -d postgres -v ON_ERROR_STOP=1 -c "create database $db" >/dev/null
run() { PGDATABASE="$db" psql -q -X -v ON_ERROR_STOP=1 "$@"; }
run -f "$here/bootstrap.sql" >/dev/null
for migration in "$root"/server/supabase/migrations/*.sql; do run -f "$migration" >/dev/null; done
run -f "$here/cloud_projects.test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //' | grep -v '^$'
PGDATABASE="$db" bash "$here/concurrency.sh"
# D86 Room photo AI: quotas, the monthly cap, the job lifecycle and its own race tests.
run -f "$here/room_ai.test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //' | grep -v '^$'
PGDATABASE="$db" bash "$here/room_ai_concurrency.sh"

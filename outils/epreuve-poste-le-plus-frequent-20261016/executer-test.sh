#!/usr/bin/env bash
# Lance l'épreuve sur nexus-test (JAMAIS Production). Tout est annulé (ROLLBACK).
# Le mot de passe vient du trousseau `nexus-test-db`, injecté sans être affiché.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
sed -e '/^begin;$/d' -e '/^commit;$/d' \
  "$RACINE/supabase/migrations/20261016120000_poste_le_plus_frequent.sql" > "$TMP/migration.sql"
PGPASSWORD="$(security find-generic-password -s nexus-test-db -w)" \
  /opt/homebrew/opt/libpq/bin/psql \
  "postgresql://postgres@db.udljdqxerrbbbajxubfn.supabase.co:5432/postgres?sslmode=require&connect_timeout=12" \
  -X -v chemin_migration="$TMP/migration.sql" -f "$ICI/epreuve-test.sql" 2>&1 \
  | sed 's/postgres:[^@]*@/postgres:***@/g'

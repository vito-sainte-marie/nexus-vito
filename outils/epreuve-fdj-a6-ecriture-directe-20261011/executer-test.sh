#!/usr/bin/env bash
# Épreuve A6 (20261011090000) sur nexus-test, dans UNE transaction annulée.
# Connexion directe (jamais le pooler) ; mot de passe lu au trousseau, jamais
# affiché. N'écrit rien de persistant : epreuve-test.sql se termine par
# ROLLBACK et la migration n'est appliquée qu'à l'intérieur.
# Usage : outils/epreuve-fdj-a6-ecriture-directe-20261011/executer-test.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
MIG="$RACINE/supabase/migrations/20261011090000_fdj_a6_ecriture_directe_releves_reports_audit_fermee.sql"
PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"
echo "migration : blob $(git -C "$RACINE" hash-object "$MIG")"
PGPASSWORD="$(security find-generic-password -a nexus -s nexus-test-db -w)" "$PSQL" \
  "host=db.udljdqxerrbbbajxubfn.supabase.co port=5432 user=postgres dbname=postgres sslmode=require connect_timeout=12" \
  -v ON_ERROR_STOP=1 -v migration="$MIG" -X -q -t -A -f "$ICI/epreuve-test.sql" | grep -v '^$' > "$ICI/.sortie.txt"
# Verdict : chaque essai « apres » / « rpc » / « positif » doit rendre exactement
# son SQLSTATE attendu (champ 5 = attendu, champ 6 = obtenu), chaque droit
# « fermé ». La sortie complète est affichée AVANT le verdict.
cat "$ICI/.sortie.txt"
set +e
awk -F'|' '
  $1=="J" && ($2=="apres" || $2=="rpc" || $2=="positif") && $5!=$6 { print "ÉCART " $0; e++ }
  $1=="J" && $2=="droits" && $6!="fermé" { print "ÉCART " $0; e++ }
  # Le défaut doit être reproduit avant la migration : INSERT et TRUNCATE
  # admis pour un authentifié, TRUNCATE admis pour anon.
  $1=="J" && $2=="avant" && $4=="authenticated" && $3 ~ /^fdj_.* (INSERT|TRUNCATE)/ && $6!="OK" { print "DÉFAUT NON REPRODUIT " $0; e++ }
  $1=="J" && $2=="avant" && $4=="anon" && $3 ~ /^fdj_.* TRUNCATE/ && $6!="OK" { print "DÉFAUT NON REPRODUIT " $0; e++ }
  $1=="J" { n++ }
  END { print "essais : " n ", écarts : " e+0; exit (e>0) }' "$ICI/.sortie.txt"
rc=$?
rm -f "$ICI/.sortie.txt"
exit $rc

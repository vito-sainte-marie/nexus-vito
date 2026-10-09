#!/usr/bin/env bash
# Recette C du mandat consolidé (08/10/2026) : joue scenarios.sql sur la base
# NEXUS Test réelle, dans des transactions annulées. Refuse toute autre base.
#   PGPASSWORD=… ./executer.sh            (mot de passe de nexus-test-db)
# Sortie : « RECETTE VERTE » si tous les blocs attendus sont OK et aucun ÉCHEC.
set -euo pipefail
cd "$(dirname "$0")"

HOTE=db.udljdqxerrbbbajxubfn.supabase.co   # NEXUS Test, connexion directe (jamais le pooler)
URL="postgresql://postgres@${HOTE}:5432/postgres?sslmode=require&connect_timeout=30"
PSQL=${PSQL:-$(command -v psql || echo /opt/homebrew/opt/libpq/bin/psql)}

case "$URL" in
  *uzhjpqpctpvxytxpxoqz*) echo "REFUS : Production" >&2; exit 2 ;;
  "postgresql://postgres@db.udljdqxerrbbbajxubfn.supabase.co:5432/"*) ;;
  *) echo "REFUS : base inconnue" >&2; exit 2 ;;
esac
[ -n "${PGPASSWORD:-}" ] || { echo "PGPASSWORD absent" >&2; exit 2; }

# Contrôle d'identité : la base jointe doit être celle de Test (site fantôme).
ID=$("$PSQL" "$URL" -Atc "select current_database() || '|' || (select count(*) from public.sites where site_id = 'site-fantome-test')")
[ "$ID" = "postgres|1" ] || { echo "REFUS : identité de base inattendue ($ID)" >&2; exit 2; }

ATTENDUS="AUTRESITE BROUILLON COFFRE NONAUTORISE PARTIEL QDEUXSEPT QDEUXSIX SEULMANAGER TROPPERCU VALIDEE VDEUX VUN"
SORTIE=$("$PSQL" "$URL" -X -q -f scenarios.sql 2>&1)
echo "$SORTIE"

OKS=$(echo "$SORTIE" | grep -o "NOTICE:  OK [A-Z]*" | awk '{print $3}' | sort | tr '\n' ' ' | sed 's/ $//')
if echo "$SORTIE" | grep -q "ÉCHEC\|ERROR"; then echo "RECETTE ROUGE : échec ou erreur ci-dessus" >&2; exit 1; fi
[ "$OKS" = "$ATTENDUS" ] || { echo "RECETTE ROUGE : attendus [$ATTENDUS], obtenus [$OKS]" >&2; exit 1; }

# Rien ne reste : les stations fictives n'existent plus après les rollbacks.
RESTE=$("$PSQL" "$URL" -Atc "select count(*) from public.sites where site_id in ('site-a','site-b')")
[ "$RESTE" = "0" ] || { echo "RECETTE ROUGE : $RESTE station(s) fictive(s) restée(s)" >&2; exit 1; }

# Contre-témoins : chaque mutation débranche une règle dans la transaction du
# bloc (le rollback la rebranche) ; les blocs nommés « Rougit : » doivent tomber.
for M in mutations/*.sql; do
  ROUGIT=$(sed -n 's/^-- Rougit : //p' "$M")
  SM=$("$PSQL" "$URL" -X -q -v mutation="$M" -f scenarios.sql 2>&1 || true)
  OKM=" $(echo "$SM" | grep -o "NOTICE:  OK [A-Z]*" | awk '{print $3}' | tr '\n' ' ')"
  for B in $ROUGIT; do
    case "$OKM" in *" $B "*) echo "RECETTE ROUGE : $M ne fait pas tomber $B" >&2; exit 1 ;; esac
  done
  echo "contre-témoin $(basename "$M") : $ROUGIT tombe(nt)"
done
RESTE=$("$PSQL" "$URL" -Atc "select count(*) from public.sites where site_id in ('site-a','site-b')")
[ "$RESTE" = "0" ] || { echo "RECETTE ROUGE : station(s) fictive(s) restée(s) après les contre-témoins" >&2; exit 1; }
echo "RECETTE VERTE ($OKS)"

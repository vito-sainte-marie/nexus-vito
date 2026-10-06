#!/usr/bin/env bash
# Épreuve 20261006220000 — invoices.methode_identification admet 'nom_decenium'.
# Rejoue, dans un conteneur Postgres JETABLE, les migrations du dépôt jusqu'à
# 20261005180000, prouve le refus (témoin), applique 20261006220000, puis :
# DEF, HIST, DECENIUM (insert du worker sous service_role), REFUS, COMPTES ;
# REJEU (seconde application refusée, contrainte inchangée) ; DERIVE (base
# divergente refusée, contrainte inchangée).
# Ne touche ni Test ni Production : aucune URL distante n'est lue.
# Usage : outils/epreuve-invoices-nom-decenium-20261006/executer.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
MIGRATION="20261006220000_invoices_methode_identification_nom_decenium.sql"
IMAGE="supabase/postgres:17.6.1.175"
NOM="decenium-epreuve-$$"
SORTIE="$(mktemp -d)"
trap 'docker rm -f "$NOM" >/dev/null 2>&1 || true; rm -rf "$SORTIE"' EXIT

docker run -d --name "$NOM" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for i in $(seq 1 60); do
  docker exec "$NOM" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 2
done
sleep 3  # l'image redémarre Postgres après son initialisation
until docker exec "$NOM" psql -U postgres -h localhost -tAc 'select 1' >/dev/null 2>&1; do sleep 2; done

docker exec "$NOM" mkdir -p /mig /ep
docker cp "$RACINE/supabase/migrations/." "$NOM:/mig/"
docker cp "$ICI/." "$NOM:/ep/"
psql_() { docker exec -w /ep "$NOM" psql -U postgres -h localhost -q "$@"; }
contrainte() { psql_ -tAc "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.invoices'::regclass and conname='invoices_methode_identification_check'"; }

docker exec "$NOM" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q -f /ep/echafaudage-storage.sql
n=0
for f in $(cd "$RACINE/supabase/migrations" && ls *.sql | sort); do
  [ "$f" = "$MIGRATION" ] && continue
  [[ "$f" > "$MIGRATION" ]] && { echo "ÉCHEC : migration postérieure $f"; exit 1; }
  psql_ -v ON_ERROR_STOP=1 -f "/mig/$f" >/dev/null 2>"$SORTIE/mig.err" \
    || { echo "ÉCHEC migration $f"; cat "$SORTIE/mig.err"; exit 1; }
  n=$((n+1))
done
echo "migrations antérieures appliquées : $n"
echo "avant : $(contrainte)"

psql_ -f avant.sql >"$SORTIE/avant.txt" 2>&1 || true
grep -q 'NOTICE:  OK TEMOIN' "$SORTIE/avant.txt" || { cat "$SORTIE/avant.txt"; echo "ÉCHEC : témoin"; exit 1; }
echo "OK TEMOIN (nom_decenium refusé avant : 23514)"

psql_ -v ON_ERROR_STOP=1 -f "/mig/$MIGRATION" >"$SORTIE/mig.txt" 2>&1 || { cat "$SORTIE/mig.txt"; echo "ÉCHEC : migration"; exit 1; }
APRES="$(contrainte)"
echo "après : $APRES"

psql_ -f apres.sql >"$SORTIE/apres.txt" 2>&1 || true
grep -E 'ÉCHEC|ERROR' "$SORTIE/apres.txt" && { cat "$SORTIE/apres.txt"; echo "ÉCHEC : scénarios"; exit 1; }
verts="$(grep -o 'NOTICE:  OK [A-Z]*' "$SORTIE/apres.txt" | sed 's/NOTICE:  OK //' | tr '\n' ' ' | sed 's/ $//')"
[ "$verts" = "DEF HIST DECENIUM REFUS COMPTES" ] || { cat "$SORTIE/apres.txt"; echo "ÉCHEC : verts $verts"; exit 1; }
echo "OK $verts"

if psql_ -v ON_ERROR_STOP=1 -f "/mig/$MIGRATION" >"$SORTIE/rejeu.txt" 2>&1; then echo "ÉCHEC : rejeu accepté"; exit 1; fi
grep -q 'inattendue' "$SORTIE/rejeu.txt" && [ "$(contrainte)" = "$APRES" ] || { cat "$SORTIE/rejeu.txt"; echo "ÉCHEC : rejeu"; exit 1; }
echo "OK REJEU (seconde application refusée, contrainte inchangée)"

psql_ -v ON_ERROR_STOP=1 -f derive.sql
DERIVEE="$(contrainte)"
if psql_ -v ON_ERROR_STOP=1 -f "/mig/$MIGRATION" >"$SORTIE/derive.txt" 2>&1; then echo "ÉCHEC : base dérivée réécrite"; exit 1; fi
grep -q 'inattendue' "$SORTIE/derive.txt" && [ "$(contrainte)" = "$DERIVEE" ] || { cat "$SORTIE/derive.txt"; echo "ÉCHEC : dérive"; exit 1; }
echo "OK DERIVE (base divergente refusée, contrainte inchangée)"
echo "ÉPREUVE VERTE"

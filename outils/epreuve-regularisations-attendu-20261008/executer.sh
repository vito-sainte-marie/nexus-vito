#!/usr/bin/env bash
# Épreuve de l'attendu des tiroirs qui lit les régularisations
# (20261008160000, mandat consolidé §3, B8). Rejoue, dans un conteneur Postgres JETABLE, toutes les
# migrations du dépôt puis les scénarios ; puis, pour chaque fichier de
# mutations/, débranche une règle et vérifie que rougissent EXACTEMENT les blocs
# que son en-tête annonce (« Rougit : … »).
# Ne touche ni Test ni Production : aucune URL distante n'est lue.
# Usage : outils/epreuve-regularisations-attendu-20261008/executer.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
IMAGE="supabase/postgres:17.6.1.175"
NOM="era-epreuve-$$"
SORTIE="$(mktemp -d)"
trap 'docker rm -f "$NOM" >/dev/null 2>&1 || true; rm -rf "$SORTIE"' EXIT

docker run -d --name "$NOM" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for i in $(seq 1 60); do
  docker exec "$NOM" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 2
done
sleep 3  # l'image redémarre Postgres après son initialisation
until docker exec "$NOM" psql -U postgres -h localhost -tAc 'select 1' >/dev/null 2>&1; do sleep 2; done

docker exec "$NOM" mkdir -p /mig /role
docker cp "$RACINE/supabase/migrations/." "$NOM:/mig/"
docker cp "$ICI/." "$NOM:/role/"

docker exec "$NOM" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q -f /role/echafaudage-storage.sql
n=0
for f in $(cd "$RACINE/supabase/migrations" && ls *.sql | sort); do
  docker exec "$NOM" psql -U postgres -h localhost -v ON_ERROR_STOP=1 -q -f "/mig/$f" >/dev/null 2>"$SORTIE/mig.err" \
    || { echo "ÉCHEC migration $f"; cat "$SORTIE/mig.err"; exit 1; }
  n=$((n+1))
done
echo "migrations appliquées : $n"

ATTENDUS="ANNULATION AUTRECOLONNE COFFRE DETAIL DROITS FDJ FDJVALIDATION ISOLATION UPSERT VALIDATION"
oks() { grep -o "NOTICE:  OK [A-Z]*" "$1" | sed 's/NOTICE:  OK //' | sort | tr '\n' ' ' | sed 's/ $//'; }
mots() { tr ' ' '\n' | grep . | sort; }

echo "— scénarios (règles branchées) —"
docker exec -w /role "$NOM" psql -U postgres -h localhost -q -f scenarios.sql >"$SORTIE/reel.txt" 2>&1 || true
grep -E 'ÉCHEC' "$SORTIE/reel.txt" && { cat "$SORTIE/reel.txt"; echo "ÉCHEC : scénarios"; exit 1; }
verts="$(oks "$SORTIE/reel.txt")"
echo "verts : $verts"
[ "$verts" = "$ATTENDUS" ] || { cat "$SORTIE/reel.txt"; echo "ÉCHEC : attendu $ATTENDUS"; exit 1; }

echo "— contre-témoins —"
nb=0
for m in $(cd "$ICI/mutations" && ls *.sql | sort); do
  annonce="$(sed -n 's/.*Rougit : \(.*\)\./\1/p' "$ICI/mutations/$m" | tr -d ',')"
  [ -n "$annonce" ] || { echo "ÉCHEC : $m n'annonce pas ses rouges"; exit 1; }
  docker exec -w /role "$NOM" psql -U postgres -h localhost -q -v mutation="mutations/$m" -f scenarios.sql >"$SORTIE/mut.txt" 2>&1 || true
  grep -q 'MUTATION MANQUÉE' "$SORTIE/mut.txt" && { grep 'MUTATION MANQUÉE' "$SORTIE/mut.txt" | head -1; echo "ÉCHEC : $m vise à côté"; exit 1; }
  rouges="$(comm -23 <(echo "$ATTENDUS" | mots) <(oks "$SORTIE/mut.txt" | mots) | tr '\n' ' ' | sed 's/ $//')"
  attendu="$(echo "$annonce" | mots | tr '\n' ' ' | sed 's/ $//')"
  echo "$m : rougit $rouges"
  [ "$rouges" = "$attendu" ] || { cat "$SORTIE/mut.txt"; echo "ÉCHEC : $m devait rougir exactement $attendu"; exit 1; }
  nb=$((nb+1))
done
echo "contre-témoins conformes : $nb"
echo "ÉPREUVE VERTE"

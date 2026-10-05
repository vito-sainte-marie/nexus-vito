#!/usr/bin/env bash
# Épreuve FDJ — seule une prise de poste « caissiere » ouvre un quart (20261005180000).
# Rejoue, dans un conteneur Postgres JETABLE, toutes les migrations du dépôt
# puis les scénarios P, R, V, M, C, I, K et ACL ; vérifie que le contre-témoin
# (fonction de 20260916220500 restaurée) rougit exactement P, R, V, I et K.
# Ne touche ni Test ni Production : aucune URL distante n'est lue.
# Usage : outils/epreuve-fdj-ouverture-caissiere-seule-20261005/executer.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
IMAGE="supabase/postgres:17.6.1.175"
NOM="fdjrole-epreuve-$$"
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

ATTENDUS="ACL C I K M P R V"
oks() { grep -o "NOTICE:  OK [A-Z]*" "$1" | sed 's/NOTICE:  OK //' | sort | tr '\n' ' ' | sed 's/ $//'; }

echo "— scénarios (fonction corrigée) —"
docker exec -w /role "$NOM" psql -U postgres -h localhost -q -f scenarios.sql >"$SORTIE/reel.txt" 2>&1 || true
grep -E 'ÉCHEC' "$SORTIE/reel.txt" && { cat "$SORTIE/reel.txt"; echo "ÉCHEC : scénarios"; exit 1; }
verts="$(oks "$SORTIE/reel.txt")"
echo "verts : $verts"
[ "$verts" = "$ATTENDUS" ] || { cat "$SORTIE/reel.txt"; echo "ÉCHEC : attendu $ATTENDUS"; exit 1; }

echo "— contre-témoin (fonction de 20260916220500 restaurée) —"
docker exec -w /role "$NOM" psql -U postgres -h localhost -q -f mutation.sql >"$SORTIE/mut.txt" 2>&1 || true
verts_mut="$(oks "$SORTIE/mut.txt")"
rouges=$(grep -c 'ERROR:  ÉCHEC' "$SORTIE/mut.txt" || true)
echo "verts : $verts_mut ; blocs rougis : $rouges / 5"
[ "$verts_mut" = "ACL C M" ] && [ "$rouges" = 5 ] \
  || { cat "$SORTIE/mut.txt"; echo "ÉCHEC : le contre-témoin doit rougir exactement P, R, V, I et K"; exit 1; }
echo "ÉPREUVE VERTE"

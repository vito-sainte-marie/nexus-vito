#!/usr/bin/env bash
# Épreuve FDJ — réconciliation canonique caisse (20261005090000).
# Rejoue, dans un conteneur Postgres JETABLE, toutes les migrations du dépôt
# puis les scénarios A–G, M, R et ACL ; vérifie que le contre-témoin (helper
# neutralisé) rougit les 9 blocs de scénario ; relit le ledger produit par le
# serveur avec le moteur des écrans (nexus-fdj-moteur.js).
# Ne touche ni Test ni Production : aucune URL distante n'est lue.
# Usage : outils/epreuve-fdj-reconciliation-canonique-20261005/executer.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
IMAGE="supabase/postgres:17.6.1.175"
NOM="fdjreco-epreuve-$$"
SORTIE="$(mktemp -d)"
trap 'docker rm -f "$NOM" >/dev/null 2>&1 || true; rm -rf "$SORTIE"' EXIT

docker run -d --name "$NOM" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for i in $(seq 1 60); do
  docker exec "$NOM" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 2
done
sleep 3  # l'image redémarre Postgres après son initialisation
until docker exec "$NOM" psql -U postgres -h localhost -tAc 'select 1' >/dev/null 2>&1; do sleep 2; done

docker exec "$NOM" mkdir -p /mig /reco
docker cp "$RACINE/supabase/migrations/." "$NOM:/mig/"
docker cp "$ICI/." "$NOM:/reco/"

docker exec "$NOM" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q -f /reco/echafaudage-storage.sql
n=0
for f in $(cd "$RACINE/supabase/migrations" && ls *.sql | sort); do
  docker exec "$NOM" psql -U postgres -h localhost -v ON_ERROR_STOP=1 -q -f "/mig/$f" >/dev/null 2>"$SORTIE/mig.err" \
    || { echo "ÉCHEC migration $f"; cat "$SORTIE/mig.err"; exit 1; }
  n=$((n+1))
done
echo "migrations appliquées : $n"

echo "— scénarios (helper réel) —"
docker exec -w /reco "$NOM" psql -U postgres -h localhost -q -f scenarios.sql >"$SORTIE/reel.txt" 2>&1 \
  || { cat "$SORTIE/reel.txt"; echo "ÉCHEC : scénarios"; exit 1; }
grep -v '^LEDGER|' "$SORTIE/reel.txt" | grep -E 'OK|NOTICE' | sed 's/^psql:[^ ]* //' || true

echo "— contre-témoin (helper neutralisé) —"
docker exec -w /reco "$NOM" psql -U postgres -h localhost -q -f mutation.sql >"$SORTIE/mut.txt" 2>&1 || true
rouges=$(grep -c 'ERROR:  ÉCHEC' "$SORTIE/mut.txt" || true)
echo "blocs rougis : $rouges / 9"
[ "$rouges" = 9 ] || { cat "$SORTIE/mut.txt"; echo "ÉCHEC : le contre-témoin ne rougit pas les 9 blocs"; exit 1; }

echo "— relecture du ledger par le moteur des écrans —"
node "$ICI/croise.js" "$RACINE/nexus-fdj-moteur.js" "$SORTIE/reel.txt"
echo "— contre-témoin de la relecture (ledger écrit sans le helper) —"
docker exec -w /reco "$NOM" psql -U postgres -h localhost -q -f mutation_ledger.sql >"$SORTIE/mutledger.txt" 2>&1 || true
bilan=$(node "$ICI/croise.js" "$RACINE/nexus-fdj-moteur.js" "$SORTIE/mutledger.txt" | tail -1 || true)
echo "$bilan"
# Le témoin doit avoir LU les 16 soldes et en refuser au moins un ; « 0/0 » ne prouve rien.
case "$bilan" in
  "16/16 "*|"") echo "ÉCHEC : la relecture ne distingue pas le ledger sans réconciliation"; exit 1 ;;
esac
[ "$(grep -c '^[OK][KO] ' <(node "$ICI/croise.js" "$RACINE/nexus-fdj-moteur.js" "$SORTIE/mutledger.txt" || true))" = 16 ] \
  || { echo "ÉCHEC : le témoin n'a pas relu les 16 soldes"; exit 1; }
echo "ÉPREUVE VERTE"

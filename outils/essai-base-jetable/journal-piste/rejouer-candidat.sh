#!/usr/bin/env bash
# Recette complémentaire isolée (arbitrage de Frédéric du 17/10/2026, décision 1) :
# jouer la migration candidate de Journal Piste et sa preuve sur la base jetable,
# APRÈS le rejeu de l'historique. Jamais sur Test ni Production.
#
# Étapes, chacune consignée dans <sortie>/ :
#   1. inventaire des droits AVANT (inventaire-droits.sql) ;
#   2. preuve AVANT : doit échouer proprement (les tables n'existent pas) ;
#   3. application de la migration candidate, telle qu'extraite de la demande ;
#   4. preuve APRÈS : chaque cas OK ou KO ;
#   5. inventaire des droits APRÈS, et différence avec AVANT.
#
# Usage : rejouer-candidat.sh <migration.sql> <preuve.sql> <dossier_sortie>
set -uo pipefail

MIGRATION="${1:?migration candidate requise}"
PREUVE="${2:?preuve requise}"
SORTIE="${3:?dossier de sortie requis}"
ICI="$(cd "$(dirname "$0")/.." && pwd)"

case "${PGHOST:-}" in
  localhost|127.0.0.1) ;;
  *) echo "REFUS : PGHOST='${PGHOST:-}' n'est pas une base locale." >&2; exit 3 ;;
esac

mkdir -p "$SORTIE"
psql_fichier() { psql -X -v ON_ERROR_STOP=1 -f "$1" > "$2" 2>&1; }

inventaire() { psql_fichier "$ICI/inventaire-droits.sql" "$1.brut" || { cat "$1.brut"; return 1; }; LC_ALL=C sort -u "$1.brut" > "$1"; }
inventaire "$SORTIE/droits-avant.txt" || { echo "inventaire AVANT impossible"; exit 1; }

if psql_fichier "$PREUVE" "$SORTIE/preuve-avant.txt"; then avant=reussie; else avant=echec; fi
avant_erreur=$(grep -m1 -E 'ERROR' "$SORTIE/preuve-avant.txt" | sed 's/^psql:[^ ]* //')

debut=$(date +%s%3N)
if psql_fichier "$MIGRATION" "$SORTIE/migration.txt"; then migration=appliquee; else migration=echec; fi
duree=$(( $(date +%s%3N) - debut ))
migration_erreur=$(grep -m1 -E 'ERROR' "$SORTIE/migration.txt" | sed 's/^psql:[^ ]* //')

if [ "$migration" = appliquee ]; then
  if psql_fichier "$PREUVE" "$SORTIE/preuve-apres.txt"; then apres=reussie; else apres=echec; fi
  ok=$(grep -cE '\| OK$' "$SORTIE/preuve-apres.txt" || true)
  ko=$(grep -cE '\| KO$' "$SORTIE/preuve-apres.txt" || true)
  grep -E '\| KO$' "$SORTIE/preuve-apres.txt" | sed 's/ *| */|/g' > "$SORTIE/cas-ko.txt" || true
  inventaire "$SORTIE/droits-apres.txt"
  LC_ALL=C comm -13 "$SORTIE/droits-avant.txt" "$SORTIE/droits-apres.txt" > "$SORTIE/droits-ajoutes.txt"
  LC_ALL=C comm -23 "$SORTIE/droits-avant.txt" "$SORTIE/droits-apres.txt" > "$SORTIE/droits-retires.txt"
else
  apres=non_jouee; ok=0; ko=0; : > "$SORTIE/cas-ko.txt"; : > "$SORTIE/droits-ajoutes.txt"; : > "$SORTIE/droits-retires.txt"
fi

jq -nc --arg avant "$avant" --arg avant_erreur "$avant_erreur" --arg migration "$migration" \
  --arg migration_erreur "$migration_erreur" --argjson duree_ms "$duree" --arg apres "$apres" \
  --argjson ok "$ok" --argjson ko "$ko" \
  --argjson ajoutes "$(wc -l < "$SORTIE/droits-ajoutes.txt")" --argjson retires "$(wc -l < "$SORTIE/droits-retires.txt")" \
  '{preuve_avant:$avant, preuve_avant_erreur:$avant_erreur, migration:$migration, migration_erreur:$migration_erreur,
    migration_duree_ms:$duree_ms, preuve_apres:$apres, cas_ok:$ok, cas_ko:$ko, droits_ajoutes:$ajoutes, droits_retires:$retires}' \
  | tee "$SORTIE/bilan.json"

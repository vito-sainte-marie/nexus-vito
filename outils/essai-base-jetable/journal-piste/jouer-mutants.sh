#!/usr/bin/env bash
# Joue chaque mutant suivi de la preuve, dans UNE transaction annulée.
# Verdicts : tue_par_migration (ses postconditions refusent), tue_par_preuve
# (la preuve rend au moins un cas KO que le témoin ne rend pas, valeur obtenue
# comprise), SURVIT (la preuve rend exactement ce qu'elle rend au témoin),
# non_applique. Le témoin (migration intacte) est joué en premier : un KO qu'il
# rend déjà ne peut pas compter comme une détection.
# Après chaque mutant, on vérifie que la base est revenue à son état : aucune
# table du lot ne doit subsister.
#
# Usage : jouer-mutants.sh <dossier_mutants> <preuve.sql> <fichier_jsonl>
set -uo pipefail
DOSSIER="${1:?}"; PREUVE="${2:?}"; SORTIE="${3:?}"
case "${PGHOST:-}" in localhost|127.0.0.1) ;; *) echo "REFUS : base non locale" >&2; exit 3 ;; esac
: > "$SORTIE"
ko_temoin=""
while IFS=$'\t' read -r nom applique description; do
  if [ "$applique" != oui ]; then
    verdict=non_applique; cas=""
  else
    out=$(cat "$DOSSIER/$nom.sql" "$PREUVE" | psql -X -v ON_ERROR_STOP=1 2>&1); code=$?
    # KO avec la valeur obtenue : « P5=2 » n'est pas « P5=1 ».
    ko=$(printf '%s\n' "$out" | grep -E '\| KO$' | awk -F'|' '{for(i=1;i<=NF;i++) gsub(/^ +| +$/, "", $i); print $1 "=" $3}' | LC_ALL=C sort | paste -sd ',' -)
    ok=$(printf '%s\n' "$out" | grep -cE '\| OK$')
    [ "$nom" = temoin ] && ko_temoin="$ko"
    propres=$(comm -23 <(tr ',' '\n' <<<"$ko" | grep -v '^$' | LC_ALL=C sort) <(tr ',' '\n' <<<"$ko_temoin" | grep -v '^$' | LC_ALL=C sort) | paste -sd ',' -)
    if [ "$ok" -gt 0 ] && [ "$ko" = "$ko_temoin" ]; then verdict=SURVIT; cas="$ok OK${ko:+, KO du témoin seulement : $ko}"
    elif [ "$ok" -gt 0 ] && [ -n "$propres" ]; then verdict=tue_par_preuve; cas="$propres"
    elif [ "$ok" -gt 0 ]; then verdict=SURVIT; cas="KO différents du témoin mais aucun nouveau : $ko"
    elif [ "$ok" -eq 0 ]; then verdict=tue_par_migration; cas=$(printf '%s\n' "$out" | grep -m1 ERROR | sed 's/^psql:[^ ]* //' | cut -c1-160)
    else verdict=erreur_preuve; cas=$(printf '%s\n' "$out" | grep -m1 ERROR | cut -c1-160)
    fi
  fi
  propre=$(psql -X -tA -c "select to_regclass('public.carburant_index_config') is null")
  jq -nc --arg nom "$nom" --arg description "$description" --arg verdict "$verdict" --arg cas "$cas" --arg propre "$propre" \
    '{nom:$nom, description:$description, verdict:$verdict, cas:$cas, base_revenue_propre:($propre=="t")}' >> "$SORTIE"
  [ "$propre" = t ] || { echo "ARRÊT : la base n'est pas revenue à son état après $nom"; exit 1; }
done < "$DOSSIER/liste.tsv"
jq -c '{nom, verdict, cas}' "$SORTIE"

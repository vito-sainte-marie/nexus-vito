#!/usr/bin/env bash
# Joue chaque mutant suivi de la preuve, dans UNE transaction annulée.
# Verdicts : tue_par_migration (ses postconditions refusent), tue_par_preuve
# (au moins un cas KO, listé), SURVIT (la preuve ne voit rien), non_applique.
# Après chaque mutant, on vérifie que la base est revenue à son état : aucune
# table du lot ne doit subsister.
#
# Usage : jouer-mutants.sh <dossier_mutants> <preuve.sql> <fichier_jsonl>
set -uo pipefail
DOSSIER="${1:?}"; PREUVE="${2:?}"; SORTIE="${3:?}"
case "${PGHOST:-}" in localhost|127.0.0.1) ;; *) echo "REFUS : base non locale" >&2; exit 3 ;; esac
: > "$SORTIE"
while IFS=$'\t' read -r nom applique description; do
  if [ "$applique" != oui ]; then
    verdict=non_applique; cas=""
  else
    out=$(cat "$DOSSIER/$nom.sql" "$PREUVE" | psql -X -v ON_ERROR_STOP=1 2>&1); code=$?
    ko=$(printf '%s\n' "$out" | grep -E '\| KO$' | awk -F'|' '{gsub(/^ +| +$/, "", $1); print $1}' | paste -sd ',' -)
    ok=$(printf '%s\n' "$out" | grep -cE '\| OK$')
    if [ $code -eq 0 ] && [ -z "$ko" ]; then verdict=SURVIT; cas="$ok OK"
    elif [ -n "$ko" ]; then verdict=tue_par_preuve; cas="$ko"
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

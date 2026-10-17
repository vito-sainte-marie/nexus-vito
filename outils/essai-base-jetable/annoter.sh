#!/usr/bin/env bash
# Publie un fichier texte en annotations « notice » numérotées.
# Une annotation est tronquée à 4 096 caractères et une étape en garde au plus
# 10 : le fichier part en morceaux de 3 800 caractères au plus, lignes jointes
# par « | ». Au-delà de <max> morceaux, échec explicite plutôt que perte muette.
# Usage : annoter.sh <titre> <fichier> [max=8]
set -euo pipefail
titre="$1"; fichier="$2"; max="${3:-8}"
total=$(wc -l < "$fichier" | tr -d ' ')
if [ "$total" -eq 0 ]; then echo "::notice title=$titre (vide)::aucune ligne"; exit 0; fi
tmp=$(mktemp -d)
awk -v max=3800 -v d="$tmp" '{ if (len + length($0) + 1 > max) { n++; len = 0 } print > (d "/" sprintf("%02d", n)); len += length($0) + 1 }' n=1 "$fichier"
morceaux=$(ls "$tmp" | wc -l | tr -d ' ')
[ "$morceaux" -le "$max" ] || { echo "::error title=$titre::$morceaux morceaux, plus que $max"; exit 1; }
k=0
for f in "$tmp"/*; do
  k=$((k + 1))
  echo "::notice title=$titre $k/$morceaux ($total lignes)::$(paste -sd '|' "$f")"
done

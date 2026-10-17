#!/usr/bin/env bash
# Essai de faisabilité (GO de Frédéric du 17/10/2026) : rejouer les migrations
# du dépôt, dans leur ordre officiel, sur une base PostgreSQL/Supabase LOCALE
# et JETABLE. Aucune base distante, aucun secret.
#
# Ordre officiel : celui de Supabase, l'ordre lexical des noms de fichier de
# supabase/migrations/*.sql, qui commencent par leur horodatage.
#
# Chaque migration est appliquée telle quelle (aucune réécriture), en
# respectant son propre contrôle de transaction : psql sans
# --single-transaction, ON_ERROR_STOP actif. Après un échec, l'essai CONTINUE
# pour recenser les obstacles suivants, mais chaque échec postérieur au premier
# est marqué « possiblement en cascade » : il peut n'être que la conséquence du
# premier. Le premier échec est le seul fait certain.
#
# Sortie : un fichier JSONL, une ligne par migration
#   {rang, fichier, statut: ok|echec, duree_ms, cascade, erreur}
#
# Usage : rejouer-migrations.sh <dossier_migrations> <fichier_jsonl>
# Connexion : variables PG* standard (PGHOST, PGPORT, PGUSER, PGPASSWORD).
set -euo pipefail

DOSSIER="${1:?dossier des migrations requis}"
SORTIE="${2:?fichier de sortie requis}"

# Garde : cet essai ne parle qu'à une base locale. Toute autre cible est refusée
# avant la moindre connexion.
case "${PGHOST:-}" in
  localhost|127.0.0.1) ;;
  *) echo "REFUS : PGHOST='${PGHOST:-}' n'est pas une base locale. Cet essai ne touche aucune base distante." >&2; exit 3 ;;
esac

: > "$SORTIE"
rang=0
premier_echec=""
mapfile -t FICHIERS < <(find "$DOSSIER" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | LC_ALL=C sort)
total=${#FICHIERS[@]}
echo "Migrations trouvées : $total"

for nom in "${FICHIERS[@]}"; do
  rang=$((rang + 1))
  debut=$(date +%s%3N)
  if sortie=$(psql -X -q -v ON_ERROR_STOP=1 -f "$DOSSIER/$nom" 2>&1); then
    statut=ok; erreur=""
  else
    statut=echec
    erreur=$(printf '%s\n' "$sortie" | grep -E 'ERROR|FATAL|psql:' | head -n 6)
  fi
  duree=$(( $(date +%s%3N) - debut ))
  cascade=false
  if [ "$statut" = echec ]; then
    if [ -z "$premier_echec" ]; then premier_echec="$nom"; else cascade=true; fi
  fi
  jq -nc --argjson rang "$rang" --arg fichier "$nom" --arg statut "$statut" \
    --argjson duree_ms "$duree" --argjson cascade "$cascade" --arg erreur "$erreur" \
    '{rang:$rang, fichier:$fichier, statut:$statut, duree_ms:$duree_ms, cascade:$cascade, erreur:$erreur}' >> "$SORTIE"
  [ "$statut" = ok ] || echo "ÉCHEC #$rang $nom :: $(printf '%s' "$erreur" | head -n 2 | tr '\n' ' ')"
done

ok=$(jq -s '[.[] | select(.statut=="ok")] | length' "$SORTIE")
echo "Bilan : $ok / $total migrations appliquées sans erreur."
echo "Premier échec : ${premier_echec:-aucun}"

#!/usr/bin/env bash
# Variante corrigée de la preuve de request-3, produite à côté de l'original,
# jamais à sa place.
#
# Défaut mesuré : P5 et P6 sélectionnent les fonctions du lot par
#   like any (array['%_piste','piste_%','%_piste_%'])
# Dans LIKE, « _ » désigne n'importe quel caractère. '%_piste_%' attrape donc
# est_pompiste_du_jour (« ...mpiste_... »), fonction PARTAGÉE préexistante,
# exécutable par anon, search_path=public. Sur une base qui a tout l'historique,
# P5 et P6 rendent 1 au lieu de 0 sans que la migration y soit pour rien, et ce
# faux KO masque tout mutant qui ne ferait que l'aggraver.
#
# Correction : échapper « _ ». Rien d'autre ne change. Le script vérifie que
# les deux occurrences, et elles seules, ont été remplacées.
# Usage : corriger-preuve.sh <preuve.sql> <preuve-corrigee.sql>
set -euo pipefail
src="$1"; dst="$2"
avant="array['%_piste','piste_%','%_piste_%']"
apres="array['%\\_piste','piste\\_%','%\\_piste\\_%']"
n=$(grep -cF "$avant" "$src")
[ "$n" -eq 2 ] || { echo "attendu 2 occurrences du motif, trouvé $n" >&2; exit 1; }
python3 - "$src" "$dst" "$avant" "$apres" <<'EOF'
import sys
src, dst, avant, apres = sys.argv[1:]
texte = open(src).read()
corrige = texte.replace(avant, apres)
assert corrige.count(apres) == 2 and avant not in corrige
open(dst, "w").write("-- VARIANTE CORRIGÉE (outils/essai-base-jetable/journal-piste/corriger-preuve.sh) :\n-- seul changement, « _ » échappé dans les motifs LIKE de P5 et P6.\n" + corrige)
EOF
lignes=$(diff <(tail -n +3 "$dst") "$src" | grep -c '^[<>]' || true)
[ "$lignes" -eq 4 ] || { echo "diff inattendu : $lignes lignes" >&2; exit 1; }
echo "preuve corrigée : 2 motifs LIKE échappés"

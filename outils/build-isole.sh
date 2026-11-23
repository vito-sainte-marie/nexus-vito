#!/usr/bin/env bash
# NEXUS — construire dans une COPIE du dépôt, jamais sur place.
#
#     outils/build-isole.sh <dossier> [commande...]
#
# Copie les fichiers suivis (et non ignorés) du dépôt dans <dossier>, y lance
# `outils/build.sh --sur-place`, puis, si une commande est donnée, l'exécute dans
# la copie (par exemple `node run-tests.js`). Le dépôt de travail n'est pas touché :
# `git status` y reste propre. Variables : celles de build.sh ; à défaut, un
# environnement de test factice est posé.
set -euo pipefail
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ $# -lt 1 ]; then
  echo "Usage : outils/build-isole.sh <dossier> [commande...]" >&2
  exit 2
fi
DEST="$1"; shift
if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
  echo "REFUS — $DEST existe et n'est pas vide." >&2
  exit 2
fi
mkdir -p "$DEST"
( cd "$RACINE" && git ls-files -z --cached --others --exclude-standard | while IFS= read -r -d '' f; do [ -e "$f" ] && printf '%s\0' "$f"; done | tar --null -T - -cf - ) | tar -xf - -C "$DEST"
export CF_PAGES_COMMIT_SHA="${CF_PAGES_COMMIT_SHA:-$(git -C "$RACINE" rev-parse HEAD)}"
export NEXUS_ENV="${NEXUS_ENV:-test}"
export NEXUS_SUPABASE_URL="${NEXUS_SUPABASE_URL:-https://udljdqxerrbbbajxubfn.supabase.co}"
export NEXUS_SUPABASE_ANON_KEY="${NEXUS_SUPABASE_ANON_KEY:-sb_publishable_essai0000000000}"
( cd "$DEST" && bash outils/build.sh --sur-place )
if [ $# -gt 0 ]; then ( cd "$DEST" && "$@" ); fi
echo "Copie construite : $DEST (dépôt de travail intact)."

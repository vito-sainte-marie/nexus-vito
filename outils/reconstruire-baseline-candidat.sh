#!/usr/bin/env bash
# NEXUS — reconstruction « Production de référence + delta candidat » sur une
# cible jetable/isolée (decision-11.md, lot NEXUS-CONTINUITE-TERRAIN-2-20260922).
#
# NE RÉINVENTE PAS LA RECONSTRUCTION : ce script ORCHESTRE l'existant
# (outils/reconstruire-base-test.sh, jamais modifié par ce script) en le
# lançant depuis un git worktree jetable, détaché sur la branche candidate,
# plutôt que sur ce rail. Comme `origin/production` est un ancêtre direct de
# chaque candidate mesurée à ce jour (#62, #65 — vérifié ci-dessous avant tout
# geste, jamais supposé), le répertoire `supabase/migrations/` de la branche
# candidate contient EXACTEMENT Production + le delta de cette candidate :
# aucune des migrations Test/CI propres au rail `handoff-continuite-20260920`
# n'y figure, puisqu'elles n'existent que sur cette lignée, jamais mergée dans
# `production` ni dans les branches candidates.
#
# Usage :
#   outils/reconstruire-baseline-candidat.sh <branche-candidate> <project-ref-jetable>
#
# Variables :
#   DRY_RUN=oui   n'exécute AUCUNE reconstruction : imprime les SHA résolus et
#                 le delta migrations, puis s'arrête avant de créer le worktree
#                 ou d'ouvrir la moindre connexion. C'est le mode d'audit —
#                 celui à utiliser pour vérifier qu'une candidate est éligible
#                 avant de dépenser une cible jetable dessus.
#   NEXUS_TEST_DB_URL, NEXUS_TEST_DB_PASSWORD : lues par
#                 outils/reconstruire-base-test.sh, jamais par ce script —
#                 mêmes garanties que lui (aucun secret créé, lu ou affiché ici).
#
# GARDES, dans l'ordre, chacune fail-closed :
#   1. refuse <project-ref-jetable> = PROD_REF (jamais Production) ;
#   2. refuse <project-ref-jetable> = TEST_HISTORIQUE_REF (jamais le Test
#      historique nexus-test — decision-11.md §2 : on ne le détruit ni ne le
#      réutilise pour cette preuve, il reste l'environnement de développement) ;
#   3. refuse si `origin/production` n'est PAS un ancêtre de la branche
#      candidate — sans cette relation, « Production + delta » n'a pas de
#      sens, et reconstruire quand même reconstruirait autre chose sans le
#      dire ;
#   4. refuse si le delta migrations contient autre chose qu'un AJOUT pur
#      (modification ou suppression d'une migration déjà présente sur
#      production) — ce ne serait plus un delta candidat, ce serait une
#      divergence d'historique.
#
# Ce que ce script NE FAIT PAS :
#   - il ne crée, ne lit ni ne fait tourner aucun secret ;
#   - il ne crée aucun projet Supabase : <project-ref-jetable> doit déjà
#     exister, fourni par l'appelant ;
#   - il ne touche jamais au worktree principal ni à la branche courante, et
#     ne commite jamais rien sur la branche candidate : le worktree jetable
#     est supprimé en sortie, succès ou échec (trap EXIT) ;
#   - il ne filtre, ne réordonne ni ne réécrit aucune migration : il rejoue
#     exactement ce que la branche candidate porte, via le script existant,
#     inchangé dans sa logique, seulement recopié (pas modifié) dans le
#     worktree jetable pour bénéficier de ses correctifs les plus récents
#     (repli pooler IPv4, ordre sécurisé `NEXUS_TEST_DB_URL`/`security`) —
#     copie locale, jamais committée, jamais poussée : la copie de
#     `reconstruire-base-test.sh` présente sur `production`/les candidates
#     est antérieure à ces correctifs (constaté le 24/09/2026), et une
#     reconstruction qui en dépendrait échouerait sur un runner Linux sans
#     rien prouver.

set -euo pipefail

PROD_REF="uzhjpqpctpvxytxpxoqz"
TEST_HISTORIQUE_REF="udljdqxerrbbbajxubfn"

CANDIDAT="${1:-}"
REF="${2:-}"

if [ -z "$CANDIDAT" ] || [ -z "$REF" ]; then
  echo "Usage : $0 <branche-candidate> <project-ref-jetable>" >&2
  echo "        DRY_RUN=oui $0 <branche-candidate> <project-ref-jetable>   (audit seulement)" >&2
  exit 2
fi
if [ "$REF" = "$PROD_REF" ]; then
  echo "REFUS : $REF est le projet de PRODUCTION. Ce script reconstruit sur une cible jetable, jamais sur Production." >&2
  exit 3
fi
if [ "$REF" = "$TEST_HISTORIQUE_REF" ]; then
  echo "REFUS : $REF est le Test historique nexus-test. decision-11.md interdit de le réutiliser ou de le détruire pour cette preuve." >&2
  echo "Fournir une cible jetable/isolée distincte." >&2
  exit 3
fi

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RACINE"

CANDIDAT_REF_RESOLU=""
for essai in "origin/$CANDIDAT" "$CANDIDAT"; do
  if git rev-parse --verify --quiet "$essai" >/dev/null 2>&1; then
    CANDIDAT_REF_RESOLU="$essai"
    break
  fi
done
if [ -z "$CANDIDAT_REF_RESOLU" ]; then
  echo "REFUS : impossible de résoudre la branche candidate '$CANDIDAT' (ni origin/$CANDIDAT, ni $CANDIDAT)." >&2
  exit 4
fi

CANDIDAT_SHA="$(git rev-parse --verify "$CANDIDAT_REF_RESOLU")"
PROD_SHA="$(git rev-parse --verify origin/production)"

if ! git merge-base --is-ancestor "$PROD_SHA" "$CANDIDAT_SHA"; then
  echo "REFUS : origin/production ($PROD_SHA) n'est pas un ancêtre de $CANDIDAT_REF_RESOLU ($CANDIDAT_SHA)." >&2
  echo "Sans cette relation, « Production + delta » n'a pas de sens pour cette branche : ce script s'arrête plutôt que de reconstruire autre chose sans le dire." >&2
  exit 5
fi

echo "Production   : $PROD_SHA"
echo "Candidate    : $CANDIDAT_REF_RESOLU ($CANDIDAT_SHA)"
echo "Cible jetable: $REF"
echo
echo "Delta migrations (production -> candidate) :"
DELTA_STATUT="$(git diff --name-status "$PROD_SHA" "$CANDIDAT_SHA" -- supabase/migrations/)"
if [ -z "$DELTA_STATUT" ]; then
  echo "  (aucun — la candidate ne modifie aucune migration par rapport à production)"
else
  echo "$DELTA_STATUT" | sed 's/^/  /'
fi
echo

if echo "$DELTA_STATUT" | grep -qv '^A\|^$'; then
  echo "REFUS : le delta contient autre chose qu'un ajout pur (modification ou suppression d'une migration déjà présente sur production)." >&2
  echo "Ce n'est plus un delta candidat, c'est une divergence d'historique avec production — ce script ne la reconstruit pas à l'aveugle." >&2
  exit 6
fi

if [ "${DRY_RUN:-non}" = "oui" ]; then
  echo "DRY_RUN=oui : audit seulement, aucun worktree créé, aucune connexion ouverte."
  exit 0
fi

WORKTREE_DIR="$(mktemp -d)"
cleanup() {
  git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
  rm -rf "$WORKTREE_DIR" 2>/dev/null || true
}
trap cleanup EXIT

echo "Worktree jetable : $WORKTREE_DIR (détaché sur $CANDIDAT_SHA)"
git worktree add --detach --quiet "$WORKTREE_DIR" "$CANDIDAT_SHA"

# Copie locale, jamais committée, jamais poussée — voir en-tête.
mkdir -p "$WORKTREE_DIR/outils"
cp "$RACINE/outils/reconstruire-base-test.sh" "$WORKTREE_DIR/outils/reconstruire-base-test.sh"
chmod +x "$WORKTREE_DIR/outils/reconstruire-base-test.sh"

echo
echo "Reconstruction de $REF depuis le worktree jetable (Production + delta $CANDIDAT_REF_RESOLU) :"
"$WORKTREE_DIR/outils/reconstruire-base-test.sh" "$REF"

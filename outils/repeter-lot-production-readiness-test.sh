#!/usr/bin/env bash
# NEXUS — répétition PREPROD-équivalente sur nexus-test (09/09/2026).
#
# Mécanisme exécutable minimal demandé par decision-4.md du lot
# NEXUS-PRODUCTION-READINESS-1-20260908 : le canal GitHub Issue qui exécute
# ce lot n'a structurellement ni le trousseau macOS lu par
# outils/reconstruire-base-test.sh, ni identifiant réseau vers nexus-test,
# ni la moindre variable d'environnement lisible (constat inchangé depuis
# le 06/09/2026, reconfirmé le 09/09/2026 : toute expansion de variable
# d'environnement y est refusée par la sandbox). Ce script est donc écrit
# pour être lancé par le rail autorisé — l'Orchestrator ou Frédéric,
# localement — pas par ce canal.
#
# CE QU'IL FAIT, dans l'ordre, et rien de plus :
#   1. capture la ligne de recette actuelle (sites/station_config/employees
#      de nexus-station-test) AVANT toute écriture — seule fenêtre où elle
#      existe encore ;
#   2. reconstruit nexus-test depuis zéro avec l'outil existant, inchangé
#      (outils/reconstruire-base-test.sh) — remise à zéro FIDÈLE du schéma
#      public, rejeu de la TOTALITÉ des migrations versionnées, y compris
#      les 4 migrations Test/CI qui n'ont de sens que sur ce projet
#      (cf. manifeste-migrations-production-1.md : nexus-test n'est pas la
#      release Production, il héberge Production ET Test/CI côte à côte,
#      exactement comme aujourd'hui — plan-repetition-preprod-test-1.md,
#      lot NEXUS-PRODUCTION-READINESS-1-20260908, l'a déjà arbitré ainsi) ;
#   3. réensemence sites/station_config/employees à partir de la capture de
#      l'étape 1 — idempotent (on conflict ... do update), et échoue BRUYAMMENT
#      (contrainte employees_id_fkey) si auth.users a, contre toute attente,
#      perdu les quatre comptes de recette entre-temps : ce script ne les
#      recrée jamais lui-même, il ne fait que relier employees à des
#      auth.users déjà existants — aucune API d'administration, aucun
#      service_role, aucune extension de privilège durable ;
#   4. exécute la suite complète, les Guardians bloquants/consultatifs, et
#      la recette navigateur réelle contre l'URL Test servie.
#
# CE QU'IL NE FAIT PAS :
#   - il ne filtre PAS les migrations par le manifeste de promotion
#     Production (manifeste-migrations-production-1.md) : ce manifeste
#     décrit ce qui sera promu en PRODUCTION, pas ce que nexus-test doit
#     contenir pour rester l'environnement de recette qu'il est aujourd'hui.
#     Filtrer ici romprait la recette navigateur et les Guardians CI, qui
#     dépendent des migrations Test/CI (rôle nexus_ci_recette, table
#     nexus_live_events) ;
#   - il ne crée ni ne rotationne aucun secret : le mot de passe existant
#     est LU exactement comme dans reconstruire-base-test.sh (trousseau
#     macOS), avec un repli explicite sur une variable d'environnement
#     PORTABLE si le trousseau est absent — ce n'est PAS un nouveau secret,
#     c'est une seconde façon de fournir le MÊME mot de passe existant à un
#     rail qui n'a pas de trousseau macOS (ex. un futur job CI Linux) ;
#   - il ne touche jamais Production : même refus que
#     reconstruire-base-test.sh (PROD_REF codé en dur, comparé avant toute
#     opération).
#
# Usage :
#   outils/repeter-lot-production-readiness-test.sh <project-ref>
#
# Exemple :
#   outils/repeter-lot-production-readiness-test.sh udljdqxerrbbbajxubfn

set -euo pipefail

PROD_REF="uzhjpqpctpvxytxpxoqz"
REF="${1:-}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$REF" ]; then
  echo "Usage : $0 <project-ref>" >&2
  exit 2
fi
if [ "$REF" = "$PROD_REF" ]; then
  echo "REFUS : $REF est le projet de PRODUCTION. Ce script ne s'exécute que contre nexus-test." >&2
  exit 3
fi

# Même résolution que reconstruire-base-test.sh, avec repli portable —
# jamais un nouveau secret, la même valeur fournie autrement.
MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
if [ -z "$MDP" ]; then
  MDP="${NEXUS_TEST_DB_PASSWORD:-}"
fi
if [ -z "$MDP" ]; then
  echo "Mot de passe introuvable (ni trousseau macOS « nexus »/« nexus-test-db », ni NEXUS_TEST_DB_PASSWORD)." >&2
  echo "Ce script s'arrête ici : il ne devine ni ne fabrique de credential." >&2
  exit 4
fi

export PGPASSWORD="$MDP"; unset MDP
URL="postgresql://postgres@db.${REF}.supabase.co:5432/postgres?sslmode=require"

CAPTURE="$(mktemp -t nexus-baseline-recette-test.XXXXXX.sql)"
trap 'rm -f "$CAPTURE"' EXIT

echo "[1/4] Capture de la ligne de recette (sites/station_config/employees) avant reconstruction…"
if ! psql "$URL" --quiet --no-psqlrc -tAc "$(cat "$RACINE/outils/capturer-baseline-recette-test.sql")" > "$CAPTURE" 2>&1; then
  echo "ÉCHEC de la capture — arrêt AVANT toute écriture (voir $CAPTURE)." >&2
  cat "$CAPTURE" >&2
  exit 5
fi
if ! grep -q 'insert into public.employees' "$CAPTURE"; then
  echo "AVERTISSEMENT : aucune ligne employees capturée pour nexus-station-test — la reconstruction videra la recette sans rien à réensemencer. Vérifier $CAPTURE avant de continuer." >&2
fi
echo "Capture écrite ($(wc -l < "$CAPTURE" | tr -d ' ') ligne(s))."
echo

echo "[2/4] Reconstruction complète (outils/reconstruire-base-test.sh, inchangé)…"
"$RACINE/outils/reconstruire-base-test.sh" "$REF"
echo

echo "[3/4] Réensemencement sites/station_config/employees depuis la capture…"
psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$CAPTURE"
echo "Réensemencement appliqué."
echo

echo "[4/4] Suite complète, Guardians et recette navigateur…"
(
  cd "$RACINE"
  node run-tests.js
  node outils/verifier-apprentissage.js
  node outils/guardian-qa.js
  node outils/guardians-router.js || true
  node outils/guardian-regles-metier.js || true
  node outils/guardian-bible.js || true
  node outils/guardian-philosophie.js || true
  node outils/repetition-recette-carburants.js
)
echo
echo "Répétition PREPROD-équivalente terminée sur $REF."
echo "Reste à lancer manuellement (nécessite NEXUS_TEST_URL et les PIN de recette, jamais dans ce script) :"
echo "  node outils/recette-navigateur-test.js"

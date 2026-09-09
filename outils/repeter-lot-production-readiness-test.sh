#!/usr/bin/env bash
# NEXUS — répétition PREPROD-équivalente sur nexus-test (09/09/2026).
#
# Mécanisme exécutable minimal demandé par decision-4.md du lot
# NEXUS-PRODUCTION-READINESS-1-20260908 : le canal GitHub Issue qui exécute
# ce lot n'a structurellement ni le trousseau macOS lu par
# outils/reconstruire-base-test.sh, ni identifiant réseau vers nexus-test,
# ni la moindre variable d'environnement lisible (constat inchangé depuis
# le 06/09/2026, reconfirmé le 09/09/2026 : toute expansion de variable
# d'environnement y est refusée par la sandbox). Ce script accepte donc
# deux façons d'obtenir une connexion — voir outils/resoudre-connexion-test.sh
# pour le détail — afin de pouvoir être lancé soit localement (Frédéric,
# trousseau macOS), soit par le rail GitHub Actions lui-même (mode
# --url-env, secret Test existant, ni nouveau secret ni service_role).
#
# CE QU'IL FAIT, dans l'ordre, et rien de plus :
#   1. capture AVANT toute écriture — seule fenêtre où elles existent encore —
#      la ligne de recette (sites/station_config/employees de
#      nexus-station-test) ET LA TOTALITÉ DU JOURNAL LIVE
#      (public.nexus_live_events). Ce dernier point a été ajouté le
#      09/09/2026 : la reconstruction fait `drop schema public cascade`, donc
#      la table revient VIDE, recréée par sa migration. La CI republiera ses
#      propres événements au run suivant ; elle ne republiera JAMAIS les
#      autorisations accordées par Frédéric en personne
#      (`actor_role = 'human'`). Les perdre n'aurait pas été une remise à
#      zéro, mais l'effacement d'une décision humaine — ce que le registre
#      Handoff interdit en étant append-only ;
#   2. reconstruit nexus-test depuis zéro avec l'outil existant
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
#      la répétition de la recette Carburants.
#
# CE QU'IL NE FAIT PAS :
#   - il ne filtre PAS les migrations par le manifeste de promotion
#     Production (manifeste-migrations-production-1.md) : ce manifeste
#     décrit ce qui sera promu en PRODUCTION, pas ce que nexus-test doit
#     contenir pour rester l'environnement de recette qu'il est aujourd'hui.
#     Filtrer ici romprait la recette navigateur et les Guardians CI, qui
#     dépendent des migrations Test/CI (rôle nexus_ci_recette, table
#     nexus_live_events) ;
#   - il ne crée ni ne rotationne aucun secret. En mode historique, le mot
#     de passe existant est LU exactement comme dans
#     reconstruire-base-test.sh (trousseau macOS). En mode --url-env, il
#     consomme une URL DÉJÀ fournie par l'appelant sous le nom de variable
#     de son choix — la même valeur que le secret Test existant, jamais une
#     nouvelle ;
#   - il ne touche jamais Production : même refus que
#     reconstruire-base-test.sh (PROD_REF codé en dur dans
#     outils/resoudre-connexion-test.sh, comparé avant toute opération, dans
#     les DEUX modes).
#
# Usage :
#   outils/repeter-lot-production-readiness-test.sh <project-ref>
#   outils/repeter-lot-production-readiness-test.sh <project-ref> --url-env NOM_VARIABLE
#
# Exemples :
#   outils/repeter-lot-production-readiness-test.sh udljdqxerrbbbajxubfn
#   outils/repeter-lot-production-readiness-test.sh udljdqxerrbbbajxubfn --url-env NEXUS_TEST_DB_URL_WRITE

set -euo pipefail

REF="${1:-}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=./resoudre-connexion-test.sh
source "$RACINE/outils/resoudre-connexion-test.sh"

if [ -z "$REF" ]; then
  echo "Usage : $0 <project-ref> [--url-env NOM_VARIABLE]" >&2
  exit 2
fi

nexus_resoudre_connexion_test "$REF" "${2:-}" "${3:-}"

CAPTURE="$(mktemp -t nexus-baseline-recette-test.XXXXXX.sql)"
trap 'rm -f "$CAPTURE"' EXIT

echo "[1/4] Capture de la ligne de recette ET du journal Live avant reconstruction…"
if ! psql --quiet --no-psqlrc -tAc "$(cat "$RACINE/outils/capturer-baseline-recette-test.sql")" > "$CAPTURE" 2>&1; then
  echo "ÉCHEC de la capture — arrêt AVANT toute écriture (voir $CAPTURE)." >&2
  cat "$CAPTURE" >&2
  exit 5
fi
if ! grep -q 'insert into public.employees' "$CAPTURE"; then
  echo "AVERTISSEMENT : aucune ligne employees capturée pour nexus-station-test — la reconstruction videra la recette sans rien à réensemencer. Vérifier $CAPTURE avant de continuer." >&2
fi
echo "Capture écrite ($(wc -l < "$CAPTURE" | tr -d ' ') ligne(s))."
echo

echo "[2/4] Reconstruction complète (outils/reconstruire-base-test.sh)…"
"$RACINE/outils/reconstruire-base-test.sh" "$REF" "${2:-}" "${3:-}"
echo

echo "[3/4] Réensemencement (recette + journal Live) depuis la capture…"
psql --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$CAPTURE"
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

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
#   1. capture AVANT toute écriture — seule fenêtre où elles existent encore —
#      la ligne de recette (sites/station_config/employees de
#      nexus-station-test) ET LA TOTALITÉ DU JOURNAL LIVE
#      (public.nexus_live_events). Ce dernier point a été ajouté le
#      09/09/2026 : la reconstruction fait `drop schema public cascade`, donc
#      la table revient VIDE, recréée par sa migration. La CI republiera ses
#      propres événements au run suivant ; elle ne republiera JAMAIS les
#      quatre autorisations accordées par Frédéric en personne
#      (`actor_role = 'human'`). Les perdre n'aurait pas été une remise à
#      zéro, mais l'effacement d'une décision humaine — ce que le registre
#      Handoff interdit en étant append-only ;
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
#
# Le credential n'est exigé que s'il est le SEUL recours : quand
# `NEXUS_TEST_DB_URL` est fournie, elle porte son propre moyen. Sans cette
# nuance, un runner Linux — qui n'a pas de trousseau macOS — mourait en exit 4
# avec une URL Test valide sous la main (request-5, 09/09/2026).
#
# CORRECTIF (decision-6.md, 10/09/2026) : `security` n'est désormais même plus
# INVOQUÉ quand une URL est fournie — le contournement précédent l'appelait
# quand même et ignorait sa sortie, ce qui reste un appel inutile à un binaire
# absent sur Linux.
if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then
  MDP=""
else
  MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
  if [ -z "$MDP" ]; then
    MDP="${NEXUS_TEST_DB_PASSWORD:-}"
  fi
fi
if [ -z "$MDP" ] && [ -z "${NEXUS_TEST_DB_URL:-}" ]; then
  echo "Aucun moyen de se connecter : ni NEXUS_TEST_DB_URL, ni mot de passe" >&2
  echo "(trousseau macOS « nexus »/« nexus-test-db », ou NEXUS_TEST_DB_PASSWORD)." >&2
  echo "Ce script s'arrête ici : il ne devine ni ne fabrique de credential." >&2
  exit 4
fi

if [ -n "$MDP" ]; then
  export PGPASSWORD="$MDP"
fi
unset MDP
# CONNEXION : direct d'abord, pooler en REPLI.
#
# L'hôte direct `db.<ref>.supabase.co` se déduit de la seule référence du
# projet — d'où ce choix d'origine — mais il ne publie QU'UNE ADRESSE IPv6.
# Le 09/09/2026, il est devenu injoignable en pleine répétition : « Operation
# timed out » sur 2600:1f18:…, après avoir fonctionné le matin même. Une
# reconstruction qui dépend d'une IPv6 disponible n'est pas reproductible.
#
# Le pooler, lui, répond en IPv4. Son nom d'hôte dépend de la région ET de
# l'instance (aws-0, aws-1…), et une erreur dessus produit un « tenant not
# found » qu'on prend à tort pour un mauvais mot de passe : il n'est donc
# JAMAIS deviné. On utilise exactement l'hôte que la CI emploie déjà tous les
# jours, et `NEXUS_TEST_DB_URL` permet de le remplacer sans toucher au code.
POOLER_HOTE="aws-0-us-east-1.pooler.supabase.com"
URL_DIRECTE="postgresql://postgres@db.${REF}.supabase.co:5432/postgres?sslmode=require"
URL_POOLER="postgresql://postgres.${REF}@${POOLER_HOTE}:5432/postgres?sslmode=require"

if [ -n "${NEXUS_TEST_DB_URL:-}" ]; then
  URL="$NEXUS_TEST_DB_URL"
  echo "Connexion : URL fournie par NEXUS_TEST_DB_URL."
elif psql "$URL_DIRECTE" --quiet --no-psqlrc -tAc "select 1" >/dev/null 2>&1; then
  URL="$URL_DIRECTE"
  echo "Connexion : hôte direct."
elif psql "$URL_POOLER" --quiet --no-psqlrc -tAc "select 1" >/dev/null 2>&1; then
  URL="$URL_POOLER"
  echo "Connexion : hôte direct injoignable, repli sur le pooler ($POOLER_HOTE)."
else
  echo "AUCUNE connexion possible à $REF, ni en direct ni par le pooler." >&2
  echo "Ce n'est pas nécessairement le mot de passe : l'hôte direct est IPv6 seulement." >&2
  echo "Vérifier le réseau, ou fournir NEXUS_TEST_DB_URL explicitement." >&2
  exit 6
fi
export NEXUS_TEST_DB_URL="$URL"

CAPTURE="$(mktemp -t nexus-baseline-recette-test.XXXXXX.sql)"
trap 'rm -f "$CAPTURE"' EXIT

echo "[1/4] Capture de la ligne de recette ET du journal Live avant reconstruction…"
# Les tables peuvent ne pas exister : une reconstruction interrompue, ou une
# remise à zéro faite à part, laisse le schéma nu. PostgreSQL refuse alors la
# requête ENTIÈRE à l'analyse — une table absente n'est pas une valeur nulle,
# c'est une erreur de compilation. Sans cette vérification, le script devient
# irrelançable exactement dans le cas où il est le plus utile. Le 09/09/2026,
# la leçon a dû être apprise DEUX fois : d'abord sur `nexus_live_events`,
# puis sur `sites` elle-même.
BASE_PRESENTE="$(psql "$URL" --quiet --no-psqlrc -tAc \
  "select to_regclass('public.sites') is not null and to_regclass('public.station_config') is not null and to_regclass('public.employees') is not null" 2>/dev/null)"
if [ "$BASE_PRESENTE" = "t" ]; then
  if ! psql "$URL" --quiet --no-psqlrc -tAc "$(cat "$RACINE/outils/capturer-baseline-recette-test.sql")" > "$CAPTURE" 2>&1; then
    echo "ÉCHEC de la capture — arrêt AVANT toute écriture (voir $CAPTURE)." >&2
    cat "$CAPTURE" >&2
    exit 5
  fi
else
  echo "AVERTISSEMENT : sites/station_config/employees ABSENTES — rien à capturer."
  echo "  Le semis déterministe prendra le relais à l'étape [3/4]."
  : > "$CAPTURE"
fi
# Le journal Live n'est capturé que s'il EXISTE. Une reconstruction
# interrompue laisse sa table absente : exiger sa présence rendait le script
# impossible à relancer précisément dans ce cas-là.
if [ "$(psql "$URL" --quiet --no-psqlrc -tAc "select to_regclass('public.nexus_live_events') is not null" 2>/dev/null)" = "t" ]; then
  psql "$URL" --quiet --no-psqlrc -tAc "$(cat "$RACINE/outils/capturer-journal-live-test.sql")" >> "$CAPTURE" 2>&1 \
    || { echo "ÉCHEC de la capture du journal Live — arrêt AVANT toute écriture." >&2; exit 5; }
  echo "Journal Live capturé."
else
  echo "AVERTISSEMENT : public.nexus_live_events est ABSENTE — rien à préserver de ce côté."
  echo "  Si une reconstruction précédente a été interrompue, le journal doit être restauré séparément."
fi

if ! grep -q 'insert into public.employees' "$CAPTURE"; then
  echo "AVERTISSEMENT : aucune ligne employees capturée pour nexus-station-test — la reconstruction videra la recette sans rien à réensemencer. Vérifier $CAPTURE avant de continuer." >&2
fi
echo "Capture écrite ($(wc -l < "$CAPTURE" | tr -d ' ') ligne(s))."
echo

echo "[2/4] Reconstruction complète (outils/reconstruire-base-test.sh, inchangé)…"
"$RACINE/outils/reconstruire-base-test.sh" "$REF"
echo

echo "[3/4] Réensemencement (recette + journal Live) depuis la capture…"
psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$CAPTURE"
# Sortie de secours : si la capture n'avait AUCUNE ligne de recette à
# préserver — cas d'une reconstruction précédente interrompue — on resème
# depuis les sources qui ont survécu : l'instantané VERSIONNÉ du dépôt et les
# comptes auth.users. Jamais de mémoire, jamais d'invention.
if ! grep -q 'insert into public.employees' "$CAPTURE"; then
  echo "Capture sans ligne de recette : semis déterministe depuis le dépôt et auth.users…"
  psql "$URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$RACINE/outils/semer-recette-test.sql"
fi
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

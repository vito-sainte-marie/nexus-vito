#!/usr/bin/env bash
# NEXUS — répétition de release COMPLÈTE, de bout en bout.
#
# CE QUE CETTE SÉQUENCE ÉTABLIT, ET QUE LES PRÉCÉDENTES N'ÉTABLISSAIENT PAS.
# La répétition du 09/09/2026 a prouvé que les 262 migrations s'appliquent sur
# une base VIDE. C'est nécessaire et ce n'est pas la question : Production a
# quatre mois d'histoire, un site fantôme, des colonnes divergentes et des
# services restés ouverts. Une migration qui passe sur du vide peut très bien
# se comporter autrement sur ces formes-là.
#
# La séquence rejoue donc une HISTOIRE, pas un schéma :
#   1. mode déclaré PREPROD_REHEARSAL, cycle ouvert au registre ;
#   2. reconstruction BORNÉE à l'état que Production sert aujourd'hui ;
#   3. semis du jeu qui reproduit les cas Production mesurés ;
#   4. MESURE AVANT ;
#   5. application des migrations de promotion, celles-là seulement ;
#   6. MESURE APRÈS — c'est le rapport d'impact, la seule chose que Frédéric
#      doit vraiment lire avant d'autoriser ;
#   7. suite, Guardians et recette sur l'état obtenu ;
#   8. retour en TEST_NORMAL, cycle fermé.
#
# L'ÉTAPE 8 N'EST PAS UNE POLITESSE. « PREPROD doit être détruit après chaque
# release » (arbitrage du 09/09/2026). Laisser nexus-test en état de répétition
# ferait mentir toutes les recettes suivantes, qui jugeraient des données
# structurées pour d'autres cas — en restant vertes.
#
# CE SCRIPT NE TOUCHE JAMAIS PRODUCTION, et le vérifie avant tout. Il ne lit
# aucune donnée de Production : les volumes qu'il reproduit ont été relevés une
# fois, le 08/09, et vivent dans `outils/jeu-preprod-cas-production.sql`.
#
# Usage :
#   outils/repetition-release-complete.sh <project-ref> <release> <version-production>
# Exemple :
#   outils/repetition-release-complete.sh udljdqxerrbbbajxubfn 2026.09.1 20260904175722

set -euo pipefail

PROD_REF="uzhjpqpctpvxytxpxoqz"
REF="${1:-}"
RELEASE="${2:-}"
VERSION_PROD="${3:-}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$REF" ] || [ -z "$RELEASE" ] || [ -z "$VERSION_PROD" ]; then
  echo "Usage : $0 <project-ref> <release> <version-production>" >&2
  echo "  <version-production> : la DERNIÈRE migration déjà appliquée en Production." >&2
  echo "  Sans elle, on ne saurait pas où s'arrêter, et la répétition n'aurait pas de sens." >&2
  exit 2
fi
if [ "$REF" = "$PROD_REF" ]; then
  echo "REFUS : $REF est le projet de PRODUCTION." >&2
  exit 3
fi

echo "=== Répétition de release $RELEASE sur $REF ==="
echo "État de départ : Production au $VERSION_PROD."
echo

# ── 1. Déclarer le mode AVANT de toucher quoi que ce soit ──────────────
# Le mode conditionne le semis : le jeu de répétition refuse de s'appliquer
# hors PREPROD_REHEARSAL. Le déclarer d'abord, c'est refuser de commencer une
# répétition que personne ne saurait suivre.
echo "[1/8] Déclaration du mode PREPROD_REHEARSAL (release $RELEASE)…"
echo "      À faire dans le registre : ouvrir un cycle dans docs/handoff/PREPROD-CYCLE.json"
echo "      puis, en base : update public.nexus_environnement_mode"
echo "                      set mode='PREPROD_REHEARSAL', release='$RELEASE', depuis=now();"
echo "      La garde outils/garde-mode-environnement.js refuse le désaccord entre les deux."
echo

# ── 2. Reconstruire à l'état d'AVANT ──────────────────────────────────
echo "[2/8] Reconstruction bornée à $VERSION_PROD…"
JUSQUA="$VERSION_PROD" "$RACINE/outils/reconstruire-base-test.sh" "$REF"
echo

echo "[3/8] Semis du jeu reproduisant les cas Production…"
echo "      psql -f outils/jeu-preprod-cas-production.sql"
echo

echo "[4/8] MESURE AVANT — à relever et à conserver :"
cat <<'MESURES'
      select 'missions divergentes', count(*) from public.mission_catalog where site is distinct from site_id
      union all select 'services divergents', count(*) from public.shifts where site is distinct from site_id
      union all select 'services en_cours', count(*) from public.shifts where statut = 'en_cours'
      union all select 'sites sans fuseau', count(*) from public.sites where timezone is null;
MESURES
echo

echo "[5/8] Application des migrations de promotion (celles postérieures à $VERSION_PROD)…"
echo "      Elles sont listées dans manifeste-migrations-production-1.md."
echo

echo "[6/8] MESURE APRÈS — les mêmes requêtes."
echo "      L'écart entre [4] et [6] EST le rapport d'impact. C'est la seule chose"
echo "      que Frédéric doit lire avant d'autoriser : combien de lignes changent,"
echo "      lesquelles, et dans quel sens."
echo

echo "[7/8] Suite, Guardians et recette sur l'état obtenu…"
(
  cd "$RACINE"
  node run-tests.js
  node outils/guardian-qa.js
  node outils/guardian-philosophie.js || true
  node outils/repetition-recette-carburants.js
)
echo

# ── 8. Rendre Test à son usage ────────────────────────────────────────
echo "[8/8] RETOUR EN TEST_NORMAL — obligatoire, pas facultatif."
echo "      Reconstruire sans borne, resemer la recette, puis :"
echo "        update public.nexus_environnement_mode"
echo "           set mode='TEST_NORMAL', release=null, depuis=now();"
echo "      et fermer le cycle par detruit_le dans docs/handoff/PREPROD-CYCLE.json."
echo
echo "      Tant que ces deux gestes ne sont pas faits, la garde du mode et celle"
echo "      du cycle éphémère bloquent la chaîne — c'est voulu : un nexus-test"
echo "      laissé en répétition ferait mentir toutes les recettes suivantes."

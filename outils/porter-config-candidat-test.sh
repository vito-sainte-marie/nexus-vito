#!/usr/bin/env bash
# NEXUS — portage minimal de la chaîne de configuration d'environnement sur
# un candidat web pré-refonte (#62 FDJ, #65 Carburants, ou toute branche de
# même nature).
#
# PRÉPARÉ, PAS APPLIQUÉ. Ce script existe pour que le geste soit mécanique et
# reproductible le jour où un humain avec accès au tableau de bord Cloudflare
# aura observé ce qui est réellement construit et servi aujourd'hui pour un
# candidat (étude `etude-isolation-test-candidats-web-1.md` §4-§5, lot
# NEXUS-CONTINUITE-TERRAIN-2-20260922). Il n'est exécuté contre AUCUNE branche
# candidate par ce dépôt de travail : ce canal n'a ni identifiant Cloudflare,
# ni accès réseau sortant, pour le vérifier de toute façon.
#
# Portée exacte — SEPT fichiers, pas quatre. L'étude initiale (§1, §3.2)
# nommait « les quatre fichiers » (build.sh, generer-config.js, nexus-page.js,
# nexus-bandeau-environnement.js) plus nexus-auth.js séparément, soit cinq.
# Vérification faite ici, le 22/09/2026, en lisant réellement les deux
# dépendances de `outils/build.sh` : DEUX fichiers manquaient à cette liste,
# tous deux introduits par le même A6/A14 du 04-05/09/2026, sans lesquels le
# build échoue en échec fermé plutôt que de porter la config :
#   - `outils/poser-build-id.js` (appelé par build.sh, étapes 2 et 3) ;
#   - `_headers` (LU, pas écrit, par generer-config.js §7 — absent ou sans la
#     règle `Cache-Control: no-store` sur /nexus-config.js, generer-config.js
#     refuse explicitement de continuer : "Le fichier `_headers` est absent").
#
# Ce script NE TOUCHE PAS Production, NE COMMIT PAS, NE PUSH PAS, et ne
# modifie jamais le dépôt de travail du rail lui-même (source, jamais cible).
# Il copie ces sept fichiers, tels qu'ils existent dans CE dépôt (le rail),
# par-dessus ceux d'un checkout DÉJÀ EXTRAIT de la branche candidate, fourni
# en argument — jamais fetché ni checkouté par ce script. Le delta métier du
# candidat (FDJ, Carburants) n'est pas touché : seule la chaîne de
# configuration l'est, remplacement mécanique, pas une réécriture.

set -euo pipefail

CANDIDAT="${1:?usage: porter-config-candidat-test.sh <checkout-local-de-la-branche-candidate>}"
RACINE_RAIL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -e "$CANDIDAT/.git" ]; then
  echo "REFUS — $CANDIDAT n'est pas la racine d'un dépôt git (ni .git/ ni .git de worktree)." >&2
  exit 1
fi

CANDIDAT_ABS="$(cd "$CANDIDAT" && pwd)"
if [ "$CANDIDAT_ABS" = "$RACINE_RAIL" ]; then
  echo "REFUS — la cible est le dépôt de travail du rail lui-même ; ce script ne porte JAMAIS de fichier sur lui-même." >&2
  exit 1
fi

BRANCHE="$(git -C "$CANDIDAT_ABS" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
case "$BRANCHE" in
  ""|HEAD)
    echo "REFUS — $CANDIDAT_ABS n'est pas sur une branche nommée (HEAD détaché ou dépôt vide)." >&2
    exit 1
    ;;
  main|production)
    echo "REFUS — $CANDIDAT_ABS est sur la branche protégée '$BRANCHE'. Ce script ne porte de la config que sur un candidat non protégé." >&2
    exit 1
    ;;
esac

FICHIERS=(
  outils/build.sh
  outils/generer-config.js
  outils/poser-build-id.js
  nexus-page.js
  nexus-bandeau-environnement.js
  nexus-auth.js
  _headers
)

echo "── Portage config → $CANDIDAT_ABS (branche $BRANCHE) ──"
for f in "${FICHIERS[@]}"; do
  src="$RACINE_RAIL/$f"
  if [ ! -f "$src" ]; then
    echo "REFUS — $f est absent du rail ($RACINE_RAIL) ; portage interrompu, rien n'a été modifié au-delà des fichiers déjà copiés ci-dessus." >&2
    exit 1
  fi
  mkdir -p "$CANDIDAT_ABS/$(dirname "$f")"
  cp "$src" "$CANDIDAT_ABS/$f"
  echo "  copié : $f"
done

echo
echo "Terminé — sept fichiers copiés, rien committé ni poussé."
echo "Prochain geste humain : \`git -C $CANDIDAT_ABS status\` et \`git -C $CANDIDAT_ABS diff\`, revue,"
echo "puis observer depuis le tableau de bord Cloudflare ce que le build produit AVANT tout commit/push."
echo "Ce script ne porte QUE la chaîne de configuration : ni robots.txt ni nexus-config.js (générés"
echo "par outils/build.sh au build, pas copiés ici), ni le delta métier du candidat."

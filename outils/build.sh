#!/usr/bin/env bash
# NEXUS — chaîne de build unique et versionnée (05/09/2026).
#
# POURQUOI CE FICHIER EXISTE. La commande de build vivait dans le tableau de
# bord Cloudflare : personne ne pouvait la lire depuis le dépôt, ni la
# rejouer, ni la tester, ni voir dans un diff qu'elle avait changé. La chaîne
# de déploiement était le seul morceau du système qui échappait à la revue.
#
# Elle est désormais ici. Cloudflare n'a plus qu'une commande à connaître :
#
#     bash outils/build.sh
#
# ÉCHEC FERMÉ, du début à la fin. Chaque étape refuse de continuer plutôt que
# de publier quelque chose d'invérifiable : configuration absente ou
# incohérente, commit indéterminable, actif manquant, épingle divergente.
# Publier une version que personne ne saurait identifier est traité comme une
# panne, pas comme un détail cosmétique.
#
# Variables attendues :
#   NEXUS_ENV                 test | production
#   NEXUS_SUPABASE_URL        https://<ref>.supabase.co
#   NEXUS_SUPABASE_ANON_KEY   clé publiable
#   CF_PAGES_COMMIT_SHA       fourni par Cloudflare ; à défaut, git est utilisé

set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

echo "── NEXUS — construction ────────────────────────────────────────"
echo "  environnement : ${NEXUS_ENV:-<absent>}"
if [ -n "${CF_PAGES_COMMIT_SHA:-}" ]; then
  echo "  commit        : ${CF_PAGES_COMMIT_SHA} (Cloudflare)"
else
  echo "  commit        : depuis git (hors Cloudflare)"
fi
echo

# ── 1. Configuration d'environnement ────────────────────────────────────
# Écrit nexus-config.js, pose les balises de configuration, d'identification
# de page et du bandeau sur les écrans, réécrit robots.txt pour la recette et
# vérifie la règle no-store. Refuse un build « test » visant la production.
echo "  1/3 · configuration d'environnement"
node outils/generer-config.js

# ── 2. Identité de la génération ────────────────────────────────────────
# Épingle TOUS les actifs servis — y compris nexus-page.js et le bandeau, que
# l'étape 1 vient d'ajouter — sur une empreinte de leur contenu, puis écrit
# nexus-build.js avec le commit réellement déployé.
echo "  2/3 · identité de la génération"
node outils/poser-build-id.js

# ── 3. Contrôle final, sur l'arbre tel qu'il sera publié ────────────────
# C'est cette étape qui transforme le marquage en garantie : elle relit ce
# qui va être servi et refuse de laisser passer une génération incohérente.
echo "  3/3 · vérification de l'arbre publié"
node outils/poser-build-id.js --verifier

echo
echo "── Construction terminée ───────────────────────────────────────"

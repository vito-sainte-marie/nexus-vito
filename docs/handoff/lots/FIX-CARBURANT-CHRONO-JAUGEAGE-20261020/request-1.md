---
protocol: nexus-handoff/2
kind: request
lot_id: FIX-CARBURANT-CHRONO-JAUGEAGE-20261020
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
---
# FIX-CARBURANT-CHRONO-JAUGEAGE-20261020 : régularisation carburant, le jaugeage avant précède la livraison

## Défaut (Production)
Réception carburant, mode régularisation, étape 2. `chronoJaugeageRegularisation` (`NEXUS-Carburant-Reception-v1.html`, introduite par `fbf113b4`) exigeait livraison ≤ jaugeage avant. Sur le terrain le jaugeage avant précède le déchargement. Cas réel bloqué : jaugeage avant le 19/10 à 12:22, livraison du BL à 13:56. Ordre attendu : jaugeage avant ≤ livraison ≤ jaugeage après ≤ maintenant.

## Correctif (hors rail : la fonctionnalité n'existe que sur `production`)
- Branche : `fix-chrono-jaugeage-regularisation-20261020`, poussée seule, **sans PR**, basée sur `origin/production` (`d3244d86`).
- Commit : `5e42da30` (front seul : `NEXUS-Carburant-Reception-v1.html`, `test_reception_regularisation_20260919.js`, `test_reception_chrono_jaugeage_regularisation_20261020.js`). Aucune migration : la garde en base `trg_garde_regularisation_reception` n'impose que `regularisation_le >= heure_fin`.
- Une épreuve existante encodait le défaut (jaugeage avant postérieur ou égal à la livraison exigé) ; elle est corrigée et a été vue rouge avant le correctif.

## Tests
- Nouvelle épreuve `test_reception_chrono_jaugeage_regularisation_20261020.js` : cas réel 12:22/13:56, chaîne complète, égalités, violations, futur, heure vide ou illisible.
- Suite complète : 286/293 sur la branche, 285/292 sur `origin/production` propre. Mêmes 7 échecs des deux côtés, préexistants : 4 `test_inventaire_*`, `test_pilotage_qualite_receptions.js`, `test_reception_moteur.js`, `test_reception_v1_dom.js` (`demarrerReception is not defined`).

## Recette sur l'aperçu Cloudflare Test
- Aperçu : https://fix-chrono-jaugeage-regulari.nexus-test-ddf.pages.dev (check Cloudflare Pages en succès sur `5e42da30`).
- `nexus-build.js` : commit `5e42da30e4a45fa1024fade2ec32caba22516844`, environnement `test`, génération `9de04f0d4d80`. Bandeau « MODE TEST » vu avant toute saisie.
- Session : compte manager Test ouvert par Frédéric dans le browser pane ; Claude n'a saisi aucun identifiant.
- Régularisation démarrée, SP95, livraison 19/10/2026 13:56, motif « Recette Test chronologie jaugeage 20/10 », BL `RECETTE-CHRONO-20261020`. Le contrôle de doublon a répondu « Aucune réception n'est encore enregistrée à cette date ».
- Étape 2, jaugeage avant 12:22 : **accepté**, aucun message, bouton Continuer actif, passage à l'étape 3 (camion).
- Étape 2, jaugeage avant 14:10 (après la livraison) : **refusé**, message « Le jaugeage initial serait postérieur à la livraison : il se relève avant le début du déchargement. », bouton Continuer désactivé.
- **Lignes écrites sur Test : aucune.** La saisie s'est arrêtée à l'étape 3 et la visite a été quittée sans enregistrement (l'écriture n'a lieu qu'à l'étape finale). Rien à repérer ni à nettoyer.
- Non couvert par la recette navigateur : l'étape 2 du jaugeage après et l'enregistrement final ; ils restent couverts par les épreuves automatiques.

## Hors lot
- Constat de Frédéric : sur iPhone, compte de Dylan, la caméra ne s'est pas ouverte et le jaugeage a dû être saisi à la main. Non investigué, distinct de ce défaut ; à ouvrir en lot séparé.

## Demande
Prendre acte de la recette et dire si le correctif peut être proposé à la promotion. **Aucune PR vers `production` n'est ouverte** : elle ne viendra qu'après le GO de Frédéric (`PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`).

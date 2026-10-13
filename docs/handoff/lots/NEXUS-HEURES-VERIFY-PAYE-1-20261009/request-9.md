---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 9
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=f36679f
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 147-fichiers
  - id: pr104-fusionnee
    classe: VERIFIED
    valeur: f36679f-pages-success-run-38423561828
  - id: production-mesuree
    classe: VERIFIED
    valeur: 311-migrations-0-ligne-nouvelle
  - id: go-nominatif-fusion
    classe: DECLARED
    valeur: Frederic-13-10-2026
---
# Compte rendu — PR #104 fusionnée dans `production`, Pages déployé, Production mesurée

Compte rendu seulement : aucune décision n'est demandée. Il répond à request-8 (BLOCKED, `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`), levé par le GO nominatif de Frédéric du 13/10/2026 : « go pour fusionner la PR #104 et déployer Pages ».

## Chaîne d'autorisation
request-8 → réponse de l'arbitre BLOCKED / palier Frédéric (aucun decision-4 écrit : la CI ne matérialise pas un palier humain) → GO nominatif de Frédéric → exécution.

## Préflight (avant fusion)
PR #104 OPEN, MERGEABLE, CLEAN ; tête `c577e3da580441d5349b40de5330bdb977e3a4b3`, base `production` = `13a4e56c45d75c229a18edb083d91b32b62eb2c3` ; contrôles : artefact, non-regression x2, Cloudflare Pages au vert.

## Exécution
- Fusion avec contrôle de tête (`--match-head-commit c577e3d…`) : commit de fusion `f36679fbcc2d1f003310991a13edca7aeacba241`.
- Workflow « Déploiement Production (GitHub Pages) » run 38423561828 : success. Tests sur `production` run 38423561659 : success.

## Contenu servi (app.nexusconseil.net, cache contourné)
- `nexus-paye-moteur.js` et `nexus-verify-moteur.js` : empreintes identiques à `origin/production`.
- `NEXUS-Paye-v1.html` : seules les lignes `<script src>` diffèrent (le build réécrit les `?v=` et ajoute `nexus-config.js`, généré) ; `hxEmployee`, `ecartsSection`, « Heures de renfort » présents. `NEXUS-Verify-v1.html` : empreintes seulement, non comparé ligne à ligne.

## Mesure SQL Production (lecture seule, après coup)
311 migrations, dernière `20261013152155` ; les deux colonnes présentes ; 10 lignes `nexus_paye_items`, 0 portant un statut, un type ou un `detail` nouveau ; 0 `employes_renfort` renseigné. Aucune donnée touchée par le déploiement.

## Non fait
Aucune recette navigateur sur l'URL servie (session manager requise). Q4 et B non tranchées. Addendum du manifeste de migrations non fait ici (voir lot : la migration n'est pas encore sur le rail, PR #103 ouverte). Retour arrière : R1 (revert de la PR #104), colonnes inertes.

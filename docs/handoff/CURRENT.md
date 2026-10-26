<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/PRISE-DE-POSTE-UN-ECRAN-20261025/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: PRISE-DE-POSTE-UN-ECRAN-20261025
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
  - id: fusion-158
    classe: VERIFIED
    valeur: PR #158 MERGED 2026-10-26T01:42:37Z, commit f00eda7a828190daa47642bd43caa47cd8051e9f
  - id: ci-production
    classe: VERIFIED
    valeur: Tests et Deploiement Production (GitHub Pages) success sur f00eda7a
  - id: nexus-build-servi
    classe: VERIFIED
    valeur: app.nexusconseil.net/nexus-build.js porte le commit f00eda7a
  - id: poste-manager-webp
    classe: VERIFIED
    valeur: poste-manager.webp repond 200, 16386 octets
  - id: guardian-production
    classe: HUMAN
    valeur: Guardian a verifie la Production servant #158 (rapporte par Frederic)
---
# PRISE-DE-POSTE-UN-ECRAN-20261025 : fusion de #158 et demande de clôture

## Constat
- request-3 a reçu de l'arbitre `BLOCKED`, `closes: false` : la fusion de #158 relevait du palier humain `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`. Frédéric l'a décidée et #158 est fusionnée.
- La CI et le déploiement Production se sont terminés au vert (preuves ci-dessous). Les conditions de decision-2 ont été jugées tenues par l'arbitre sur request-3 ; rien n'a changé dans le code depuis la tête `246b5765` jugée.

## Preuves
1. **Fusion.** PR #158 vers `production`, état `MERGED` le 2026-10-26T01:42:37Z, commit de fusion `f00eda7a828190daa47642bd43caa47cd8051e9f`.
2. **CI et déploiement.** Sur `f00eda7a`, les workflows « Tests » et « Déploiement Production (GitHub Pages) » sont `success` (créés à 01:42:39Z).
3. **La Production sert #158.** `https://app.nexusconseil.net/nexus-build.js` porte `commit: 'f00eda7a828190daa47642bd43caa47cd8051e9f'` ; `NEXUS-Prise-De-Poste-v1.html` référence `nexus-prise-de-poste.js`, qui sert le module du lot.
4. **`poste-manager.webp`.** `https://app.nexusconseil.net/assets/postes/poste-manager.webp` répond 200 (16 386 octets).
5. **Vérification Guardian** : la Production sert #158 et `poste-manager.webp` répond en 200 (rapportée par Frédéric).

Mesures 3 et 4 refaites par l'exécutant sur des URL publiques, sans lecture de la base Production.

## Preuve des conditions de decision-2
Les conditions 1, 2, 3 et 5 ont été prouvées dans request-3 sur la tête `246b5765`, qui est celle qui a été fusionnée ; aucun fichier n'a changé depuis. La condition 4 (« PR en brouillon, aucune fusion, promotion ou mise en production ») bornait l'exécutant : la fusion et le déploiement ont été décidés ensuite par Frédéric, palier humain nommé par l'arbitre sur request-3. Elle n'a donc pas été franchie par l'exécutant.

## Ce qui reste hors de ce lot
- Le service de recette `cbd02130` (Test) sera supprimé après la clôture, seul ce service, sur le GO de Frédéric.
- `INC-74839140d278` (cause de la clôture de `cbd02130` par `pointage_depart` sans pointage) et `INC-17adb4e168a9` restent ouvertes ; elles ne relèvent pas de ce lot.
- Le lot d'outillage a posteriori (6510a2e3, 631f5d00, e251592c ; `--preuve-action` sur un commit de branche vérifié sur origin) s'ouvre après cette clôture.

## À arbitrer
Constater la fusion et le déploiement, et clore le lot (`closes: true`). Aucune action de code n'est demandée.

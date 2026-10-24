<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/VIGIE-CI-RAIL-20261024/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: VIGIE-CI-RAIL-20261024
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=d76e9c07
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 162-fichiers
---
# VIGIE-CI-RAIL-20261024 : correction du comportement approuvé — la série rouge se mesure depuis son premier run

*Déposé sur instruction de Frédéric (24/10/2026) après decision-1 (APPROVED, closes:true, `d60b9cf9`), rendue sur l'ancien comportement. La decision-1 n'est pas consommée avec le commit corrigé : cette request-2 énonce le comportement corrigé pour qu'une décision s'y applique.*

## Raison de la correction
Frédéric a relevé, avant de donner son GO sur #154, que `outils/vigie-ci-rail.js` (`6a882c8f`, celui de la request-1) mesurait la durée depuis `updatedAt` du **dernier** run rouge. Chaque push sur un rail rouge remettait donc le compteur à zéro : une journée de pushes rouges ne déclenchait jamais d'alerte. C'était le cas le 23/10 (4 runs rouges entre 12:41 et 13:26). Le défaut est dans ce que la request-1 énonçait (« dernier run terminé rouge depuis plus de 60 min ») et dans les preuves qui le couvraient : aucune épreuve ne mettait un rouge récent derrière un rouge ancien.

## Comportement corrigé (`7cbfc755`, CI du rail verte)
- On remonte les runs terminés (ni annulés ni sautés) du plus récent jusqu'au dernier vert.
- La durée se mesure depuis `createdAt` du **premier rouge qui suit ce vert**. Plus de 60 min : alerte ; 60 min ou moins : silence.
- Si les 20 runs lus sont tous rouges, le plus ancien lu sert de départ et l'alerte le dit (« au moins N min (série plus longue que les 20 runs lus) »).
- L'alerte nomme le commit du premier rouge, celui du dernier, le nombre de runs rouges d'affilée et la première ligne rouge du dernier run.
- Inchangés : lecture seule (`gh run list|view`), `gh` en panne -> alerte « aveugle », un run en cours ne lève ni n'éteint l'alerte.

## Épreuves et mutations (`test_vigie_ci_rail_20261024.js`, 15/15, faux `gh`)
- Rouge depuis 3 h et un run rouge il y a 10 min : **alerte** (180 min, 3 runs rouges, deux commits nommés).
- Vert il y a 5 min après des rouges anciens : **silence**.
- Série de 20 runs rouges lus : **alerte qui mentionne la limite**, « au moins 580 min », run le plus ancien nommé.
- Série complète (vert atteint) : aucune mention de limite.
- Conservées : 61 min alerte, 59 et 60 min muet, panne de `gh`, lecture seule, permissions du workflow.
- Mutations (7) : seuil `>=`, 59, 62, vert ignoré, **retour au « dernier run » (`premier.createdAt` -> `dernier.createdAt`)**, limite non dite, premier commit non nommé. Toutes détectées. Le mutant « premier commit non nommé » n'était pas détecté au premier essai : l'épreuve a été resserrée.
- Guardian QA : 355 épreuves, 0 finding. `test_vigie_cloture_ci_20261020.js` : 6/6.

## #154 ne change pas
La PR #154 ne porte que `.github/workflows/vigie-cloture.yml` (`actions: read` et l'étape qui lance le script) ; le script est lu depuis le rail. La correction n'y touche pas. GO de Frédéric donné pour la passer prête et la fusionner. Après le premier cron (hh:17), je vérifierai que la vigie reste silencieuse sur un rail vert et le consignerai en preuve.

## Limites
Aucune écriture Production. Pas encore d'épreuve en conditions réelles avant la fusion de #154.

## À arbitrer
1. Approuver le comportement corrigé (`7cbfc755`) comme celui du lot.
2. Exécutant pour la suite : la fusion de #154 est autorisée par Frédéric ; la vérification du premier cron est consignée par la session habilitée.

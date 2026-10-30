---
protocol: nexus-handoff/2
kind: request
lot_id: ACCUEIL-EN-SERVICE-20261030
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=d799fa58
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 167-fichiers
---
# ACCUEIL-EN-SERVICE-20261030 : request-2 — demande de clôture

BRANCHE_DU_LOT: accueil-en-service-20261030

La decision-1 (APPROVED_WITH_CONDITIONS) a été exécutée. Le lot est implémenté, recetté sur Test, fusionné et déployé.

## Preuve des conditions de decision-1

1. **Bouton principal (condition 1).** Le bouton du fil réutilise exactement `filLien`, issu de `urlRepriseSelonFaits`, sans recalcul ; l'accès à l'étape 1 du jaugeage est conservé. Module pur `nexus-accueil-piste.js`.
2. **Mutations (condition 2).** `test_accueil_piste_20261030.js` : 13 épreuves, 19 mutations, toutes tuées (unicité du bouton, égalité de sa cible avec `urlRepriseSelonFaits`, tuile Réception pour le poste Piste). Épreuves hors service : 169 vertes, 28 mutants tués. `run-tests.js` : 7 échecs, identiques à `origin/production` (aucune régression).
3. **Réception (condition 3).** La tuile respecte `station_config.reception_carburant_role` et mène à `NEXUS-Carburant-Reception-v1`.
4. **Livraison attendue (condition 4).** Lecture seule, filtrée par `site`, date locale de la station et statuts `validee`, `modifiee`, `confirmee_fournisseur`, `hors_nexus`.
5. **Caisse et Renfort (condition 5).** Aucune donnée ni aucun calcul modifié ; Caisse et Renfort maintenus à l'identique.
6. **Recette Test (condition 6).** Deux recettes sur Test par Guardian, consignées sur #160 (6521546785 et 6521716028), dont l'échantillonnage de la classe du body toutes les 50 ms : état d'attente de 0 à 1,4 s, puis directement l'accueil du pompiste.
7. **Fusion et déploiement.** PR #163 fusionnée par Frédéric dans `production` : d799fa58 (pointe du lot 45ca85b7), déployée le 30/10. Guardian a vérifié le contenu servi sur app.nexusconseil.net (6521780135) : body né en `accueil-attente`, chargement de `nexus-accueil-piste.js`, `#zoneRecherche` masquée pour le pompiste, libellé « Livraison prévue aujourd’hui » présent.
8. **Production.** Aucune opération en Production sous la decision-1 ; le déploiement est le geste de Frédéric.

## Limites et suites (hors décision)

- Pour la priorité de mission, ni le nom ni la durée n'ont de source de données : repli sur « n missions à faire ».
- L'en-tête n'est pas aligné sur la prise de poste (logo à gauche, pastille du site à droite).
- Les étapes restent listées sur le fil terminé.
- `carburant_commandes` est vide en Production depuis le 31/08 : la mise en avant de la Réception n'y est pas testable.
- Le libellé « Étape 1 sur 2 » face à « 1 sur 3 » relève d'un autre lot.
- L'état d'attente s'applique à tous les rôles (remarque de Guardian) ; garde-fou de 8 s ; à surveiller sur les écrans manager et caisse.
- La recette en Production avec photo est planifiée le mardi 3/11 (lot Jaugeage, hors de cette décision).
- Lot suivant, à ne pas ouvrir avant la clôture : menu ☰ à gauche du logo, fonctions par poste via `roleADroitModule`. Sa demande listera d'abord les fonctions par poste (piste, caisse, renfort) pour validation de Frédéric, sans code.

## À arbitrer

Clore le lot ACCUEIL-EN-SERVICE-20261030 (closes: true).

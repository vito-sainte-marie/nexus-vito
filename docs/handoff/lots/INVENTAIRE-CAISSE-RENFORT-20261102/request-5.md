---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5d9650c9
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 172-fichiers
---
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-5 — L1 incrément 2 : étape 2 du fil caisse (comptage d'entrée de la caissière pilote)

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

La decision-4 (ea6f88a9, APPROVED_WITH_CONDITIONS, `closes: false`) autorisait l'incrément 2, étape 2 seule du fil caisse. Il est porté par la PR #174 (brouillon, base `claude/pilotes-caisse-20261102`, branche `claude/fil-caisse-l1-20261102`). Cette request demande l'arbitrage avant recette Test.

## Ce que porte l'incrément

- `nexus-fil-caisse.js` : filtre `restreindre` / `estProduitCaisse` (périmètre) en plus du module pur déjà relu.
- `NEXUS-Inventaire-v1.html` : le fil n'est activé que si `etapeDe(location.search, piloteCaisseCourant, roleDuJour) === 2`, c'est-à-dire pilote ET rôle du jour `caissiere` (`resolution.role`, jamais `employeeCourant.role`) ET `?fil=caisse&etape=2`. Il pose une barre de progression et une sortie, restreint la liste du comptage d'ouverture existant au périmètre, et renvoie à l'accueil à la fin. `enFil()` reste faux : le flux de catégories est inchangé.
- `NEXUS-App-v1.html` n'est pas touchée : l'entrée se fait par adresse pour la recette.

## Réponses aux 7 conditions de decision-4

1. **Activation** : pilote + `caissiere` seulement. Sinon aucun code du fil ne s'exécute ; épreuves pilote, non-pilote, pompiste, polyvalent, renfort, manager, `caissier` (vocabulaire de la fiche, refusé).
2. **Périmètre** : cigarettes (à l'aveugle), CBD, produits du jour = catégories existantes du site, aucune catégorie ni produit nouveau. Catégories de Test portant ces familles (seed de 20260802144312_nexus_inventaire_v1.sql, aucune lecture Production) : **Cigarettes, CBD, Journaux, Pains / Sandwichs, Viennoiserie**. Réserve : « produits du jour » est défini par nom de catégorie, non par le profil `production_journaliere` (qui est une donnée par site et déclenche un flux de préparation au matin). À confirmer par l'arbitre.
3. **Aveugle** : le comptage d'ouverture existant est déjà à l'aveugle pour tout rôle sauf manager et gérant ; aucun stock théorique affiché ; écart par `referenceEcartPourProduit` (#169) à la transmission, aucun sans référence. Rien de changé.
4. **Écritures** : celles du comptage actuel, aucune autre. Aucune migration, policy, grant ni règle d'alerte. Le défaut A (RLS `update_inventaire_alertes`, lot L4a) n'est pas contourné.
5. **Changement de quart** : aucune sémantique nouvelle codée. `natureComptage` reste une étiquette du module pur ; le comptage unique de l'entrante qui clôt Q1 et ouvre Q2 n'est pas câblé ici et reste à décider.
6. **Lectures** de `inventaire_quart_employes` et des comptages du quart : seules celles qui existent déjà (lecture seule).
7. **Épreuves** : 16 contrôles (test_fil_caisse_20261102.js) dont filtre pilote / non-pilote / autres rôles, liste inchangée par référence hors fil, périmètre, câblage statique de la page (rôle du jour seul, `enFil()` non allumé, aucune écriture dans le bloc). Intersite : l'isolation de la garde `estPiloteCaisse` (13 contrôles de #173) reste la seule frontière côté page. Mutations rouges : pilote affaibli, rôle de la fiche, filtre neutralisé, garde du filtre retirée.

## Preuve des conditions de decision-4

Voir ci-dessus, points 1 à 7. Suite complète relancée sur 64f97ff9 : les 7 échecs connus (inventaire_production_journaliere_q1, sprint4_ux_flash, sprint4bis_ecriture_immediate, jaugeage_capture_guidee_mutations_20261022, pilotage_qualite_receptions, reception_moteur, reception_v1_dom) et aucun autre ; test_fil_caisse_20261102.js vert (rapport #160, 6599432051).

## Recette Test proposée

Guardian, Employé Test B, après clôture de tout service du jour sur Test : prise de poste « Caisse » (écrit `caissiere`), puis `NEXUS-Inventaire-v1.html?fil=caisse&etape=2`. Attendu : barre « Étape 1 sur 1 », seules les cinq familles, aucun stock théorique. Un non-pilote ou un pompiste ouvrant la même adresse voit l'écran habituel. Une pilote en `polyvalent` ne voit pas le fil.

## Demande

1. Arbitrage APPROVED ou APPROVED_WITH_CONDITIONS, `closes: false`, sur l'incrément 2 (fusion et déploiement par Frédéric).
2. Décision sur la définition de « produits du jour » (nom de catégorie ou profil).
3. Cadrage de la sémantique du changement de quart avant tout câblage.

## Limites

Rien en Production. Aucune migration, policy, grant, secret. Étapes 1 et 3 du fil, renfort et changement de quart non câblés.

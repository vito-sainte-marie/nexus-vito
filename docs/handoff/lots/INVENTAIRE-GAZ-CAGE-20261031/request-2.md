---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-GAZ-CAGE-20261031
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=facd36eb
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 169-fichiers
---
# INVENTAIRE-GAZ-CAGE-20261031 : request-2 — demande rectificative sur H1

## Ce qui est rectifié

L'hypothèse H1 (une seconde `ouverture` à 0 écrite par « Identique » ou « Revenir à Identique » à partir d'un stock transmis faux) **n'est pas prouvée par reproduction**. Aucune reproduction n'a été faite : décision de Frédéric du 31/10 à 18 h 42, relayée par Guardian (commentaire 6550119194 sur #160), qui demande de passer directement à la correction.

## Ce que la correction fait

La correction à la source passe par la **suppression, pour l'employé, des chemins qui écrivent `ouverture = valeurTransmise`** : `btnConforme`, `btnAnnulerCorrection`, le bouton Identique de la liste et le raccourci de catégorie. Ces boutons ne sont plus rendus pour l'employé et leurs gestionnaires sont gardés (`comptageAveugleImpose()`), le comptage est à l'aveugle (aucune valeur transmise dans le DOM, ni préremplie).

**Aucun filtrage des zéros à la lecture** : la condition de la decision-1 est tenue.

## Épreuve

`test_inventaire_comptage_aveugle_employe_20261031.js` (32 vérifications, 7 mutations détectées) : pour un employé, aucun geste de l'écran n'écrit une `ouverture` qui ne vient pas d'une saisie explicite, en particulier aucune écriture de `valeurTransmise`. Commit 760331da (branche `inventaire-gaz-cage-20261031`, non poussée).

## Suite

Migration du réglage sur Test, repère de cage à la clôture, comptage à l'aveugle : une seule PR, base `production`. Aucune opération en Production. Guardian vérifiera sur Test qu'aucune ligne `ouverture` à 0 non saisie n'apparaît en rejouant « Identique » / « Revenir à Identique » s'ils existent encore.

## Preuve des conditions de decision-1

1. **Lecture Production en SELECT, filtrée par site, résultats consignés** : aucune lecture Production n'a été faite par cette session. Frédéric a retiré l'autorisation de toute lecture Production sans son GO (31/10, 17 h 55), puis décidé (18 h 42) de ne pas reproduire H1 avant la correction. H1 et H2 ne sont donc pas départagés par des résultats ; c'est l'objet de la rectification ci-dessus.
2. **Corriger à la source seulement si H1 est confirmée** : H1 n'est pas confirmée par reproduction. La correction est faite sur décision de Frédéric (18 h 42), et elle supprime pour l'employé les chemins qui écrivent `valeurTransmise` (commit 760331da) ; elle ne dépend d'aucune lecture de données.
3. **Aucune heuristique de filtrage des zéros** : tenue. Aucune lecture n'écarte de ligne à 0 ; le code ne contient aucun filtre de ce genre.
4. **Option A, migration et données sur Test uniquement, site_id et RLS préservés** : pas encore faite. La migration du réglage (colonne `jsonb` nullable sur `inventaire_zone_produit`) est l'étape suivante, sur Test seulement, dans la PR unique.
5. **Repère affiché à la clôture uniquement** : pas encore fait. Étape suivante, même PR ; ni quantité, ni affichage à l'ouverture.
6. **Aucune mutation, migration, fusion ou promotion Production** : tenue. Aucune opération Production n'a été faite ; la fusion reste à Frédéric.

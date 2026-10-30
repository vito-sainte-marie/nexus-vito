---
protocol: nexus-handoff/2
kind: request
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 4
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
# MENU-ACCUEIL-EMPLOYE-20261030 : request-4 — trois corrections postérieures à la clôture, décidées par Frédéric

BRANCHE_DU_LOT: menu-accueil-employe-20261030

## Contexte

decision-2 (APPROVED, closes:true) a clos le lot avant la recette et la fusion. La recette Test de Guardian sur #164 (commentaire 6524268244, 30/10) est conforme sur les entrées et les droits, et relaie trois corrections décidées par Frédéric (30/10, 9 h 42), à faire avant fusion. Elles sont consignées ici, comme l'option B.

## Corrections livrées (commit eb77b3ae, PR #164, toujours en brouillon)

1. Bouton ☰ en blanc (#E8EDF2) au lieu du cyan NEXUS.
2. Bouton ☰ à l'extrême gauche de l'en-tête (position absolue dans l'en-tête, panneau recalé dessous).
3. Entrée Pointage affichée seulement si `station_config.pointage_actif` est vrai (fait `pointageActif`, lu par l'Accueil via `pointageActifSite` ; pour le manager, via `chargerPointageActif`). Fait absent = entrée masquée.

## Preuves

- `test_menu_accueil_20261030.js` : épreuve Pointage (actif, inactif, fait absent, employés et manager) et épreuve CSS/câblage du bouton ; mutant « pointage toujours affiché » tué avec les six autres.
- `test_accueil_hors_service_20260918.js` : 172 verts.
- Suite complète : les mêmes 7 échecs que la base, aucun nouveau.

## Périmètre

Interface seule : aucune colonne, aucune migration, aucune action Production. `roleDuJour !== 'renfort'` et les contrôles Inventaire de l'Accueil sont intacts. Fusion : GO de Frédéric requis.

## À arbitrer

Les corrections ci-dessus, postérieures à la clôture, sont-elles consignées conformément ? La demande de clôture viendra après la fusion.

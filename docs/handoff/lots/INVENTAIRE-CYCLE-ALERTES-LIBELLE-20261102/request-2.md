---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=ef6861f2
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 170-fichiers
---
# INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102 : request-2 — B livré, libellé livré en PR, diagnostic de A rendu ; demande de clôture du lot

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

Sur ordre de Frédéric (chat, 02/11), clôture du lot. Les trois points de la request-1 (decision-1, APPROVED_WITH_CONDITIONS, `closes: false`) sont traités chacun dans son périmètre.

## État des trois points

- **B (motif fantôme)** : PR #170 fusionnée (b56b0fc4, 02/11 12:20 UTC), déployée et servie. Épreuve propre `test_inventaire_motif_vide_20261102.js` (7 contrôles, mutation prouvée). Recette Guardian sur `nexus-station-test` conforme (#160).
- **Libellé d'ouverture** : PR #171 ouverte vers `production`, tous contrôles verts, état `CLEAN`. Épreuve propre `test_inventaire_libelle_ouverture_20261102.js` (2 contrôles, mutation prouvée). **Elle n'est pas encore fusionnée** et la recette Guardian n'est pas faite : la fusion est de Frédéric.
- **A (RLS du cycle d'observation)** : diagnostic et conception rendus en lecture seule (#160, 6577248563). Cause : la policy `update_inventaire_alertes` est réservée aux manager et gérant, et l'UPDATE du cycle émis par `validerOuverture` touche 0 ligne pour un employé, sans erreur. Option recommandée : fonction `SECURITY DEFINER` bornée aux transitions du cycle, policy inchangée. Aucune migration, policy, fonction, grant ni permission n'a été modifié.

## Demande

1. Arbitrage APPROVED avec `closes: true` : clôture du lot, avec A reporté dans un lot distinct.
2. Si l'arbitre juge que le libellé doit être servi avant clôture, APPROVED_WITH_CONDITIONS `closes: false` avec cette condition, et la clôture sera redemandée après la fusion de #171.
3. L'implémentation de A n'est pas demandée ici. Elle fera l'objet d'un lot et d'une request distincts, arbitrés sous SECURITE_RLS_SITE_ID.

## Preuve des conditions de decision-1

1. **Épreuve de mutation propre à B et au libellé** : établie (voir ci-dessus).
2. **B : valeur vide ni affichée ni enregistrée** : prouvée par `test_inventaire_motif_vide_20261102.js`.
3. **Libellé : aucune quantité préremplie promise** : prouvée par `test_inventaire_libelle_ouverture_20261102.js`.
4. **A limité à la lecture seule** : tenue ; aucune migration, policy, fonction, grant ni permission modifiés.
5. **Toute implémentation de A arbitrée séparément sous SECURITE_RLS_SITE_ID** : tenue ; rien n'est déposé.
6. **Recette uniquement sur `nexus-station-test`** (Guardian, Employé Test B) : tenue pour B ; à faire pour le libellé.
7. **Aucune lecture, écriture, migration, fusion ou promotion Production par l'exécutant** : tenue ; seules deux lectures SELECT sur Test pour le diagnostic de A.

## Limites

A reste un défaut ouvert : le cycle d'observation ne se referme pas côté employé tant que le chemin d'écriture borné n'est pas livré. Les alertes de Production ne sont pas touchées. Un lot « mode Jour » attend (cadrage Guardian, #160 6577633047) et ne peut s'ouvrir qu'après cette clôture.

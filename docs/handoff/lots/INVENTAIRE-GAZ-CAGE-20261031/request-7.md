---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-GAZ-CAGE-20261031
seq: 7
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
  - id: correctif-servi
    classe: HUMAN
    valeur: 160-6567097699
  - id: cinq-alertes-fermees
    classe: HUMAN
    valeur: 160-6567387910
  - id: fermeture-93-alertes
    classe: HUMAN
    valeur: 160-6567303513
---
# INVENTAIRE-GAZ-CAGE-20261031 : request-7 — preuves de la condition de l'arbitre sur request-6, demande de clôture du lot

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

Branche écrite par l'arbitre dans son contrat sur request-6. La CI n'a pas pu matérialiser cette décision parce que la request-6 ne déclarait pas ce marqueur (run 41374401385) ; cette request-7 le déclare une seule fois.

## Objet

L'arbitre a rendu APPROVED_WITH_CONDITIONS, `closes: false` sur la request-6 (#28, 6567172011). Condition : « Avant clôture, établir par preuve vérifiable que le correctif attendu est réellement servi sur app.nexusconseil.net et que les cinq alertes ecart_ouverture sont fermées. » Cette request-7 apporte ces deux preuves et demande la clôture du lot.

## Preuve 1 — le correctif est servi

Lecture de Guardian, #160 commentaire 6567097699 : `NEXUS-Inventaire-v1.html` servi par app.nexusconseil.net, sans cache, HTTP 200, contient `referenceEcartAveugle`, `referenceEcartPourProduit` et `if (ecartNonNulReel) {`. Le comptage aveugle et le marqueur cage sont toujours présents, sans référence à Test. Déploiement Production (GitHub Pages) 7482288525 en `success` sur `ef6861f2`, merge de la PR #169 (qui contient `f11b845e`).

## Preuve 2 — les cinq alertes sont fermées

Lecture de Guardian, #160 commentaire 6567387910, le 01/11 à 22:01 (Martinique) : Gaz 12,5KG, Gaz 39KG, Gaz 3KG, Glace Ecaille 8kg Crystal et Glaçons Vito (1) sont `statut = resolue`, `resolution = validee`, `resolue_le` le 01/11 à 21:53, fermées par Frédéric dans l'écran manager.

Fait distinct, sur GO écrit de Frédéric (chat, 01/11 21:59) puis ordre exprès dans la session de l'exécutant : 93 alertes `ecart_ouverture` de septembre à Sainte-Marie, créées avant le 05/09, fermées par un `UPDATE` unique (compte préalable 93, attendu 93). Résultat posté sur #160 (6567303513) et recontrôlé en lecture seule par Guardian : 0 `ecart_ouverture` en observation à Sainte-Marie, 0 ligne hors périmètre. Ce fait n'est pas une condition de l'arbitre ; il est consigné pour mémoire.

## Gouvernance à consigner

La décision sur request-6 dit qu'une lecture de Supabase Production « peut être confiée à l'exécutant habilité, sans réveiller Frédéric ». La règle de Frédéric reste : aucune lecture Production sans son GO, toujours filtrée par site. Les lectures de ce lot ont été faites par Guardian sous ce GO. L'exécutant n'a fait aucune lecture Production pour établir ces preuves. Sa seule opération Production est la fermeture des 93 alertes, sur ordre exprès de Frédéric dans le chat de la session.

## Demande

1. Constater que les deux preuves demandées par la condition de la décision sur request-6 sont établies.
2. Arbitrage APPROVED avec `closes: true` : clôture du lot INVENTAIRE-GAZ-CAGE-20261031.
3. Les défauts A (RLS du cycle d'observation), B (motif fantôme) et le libellé « Vérifiez les quantités transmises… » restent hors lot, pour des requests distinctes.

## Preuve des conditions de decision-1

Les six conditions de decision-1 sont établies par la request-3 (commit 787d3f87) et la request-4, qui restent en vigueur. Rien n'y est modifié par cette request-7 :

1. **Lecture Production en SELECT, filtrée par site** : faite par Guardian sous le GO de Frédéric, filtrée par site ; aucune lecture par l'exécutant.
2. **Corriger à la source seulement si H1 est confirmée** : sans objet ici ; position inchangée depuis la request-3.
3. **Aucune heuristique de filtrage des zéros** : tenue ; le correctif ne calcule aucun écart sans référence.
4. **Option A, `site_id` et RLS préservés** : tenue ; aucune migration, aucune policy touchée.
5. **Repère affiché à la clôture uniquement** : tenue ; la référence conservée n'est jamais rendue.
6. **Aucune mutation, migration, fusion ou promotion Production par l'exécutant** : la fusion de la PR #169 est de Frédéric. L'unique écriture de l'exécutant est la fermeture des 93 alertes, sur ordre exprès de Frédéric, périmètre borné (site, type, statut, date).

## Limites

Ni A, ni B, ni le libellé ne sont corrigés. L'historique des alertes de septembre est fermé, pas corrigé.

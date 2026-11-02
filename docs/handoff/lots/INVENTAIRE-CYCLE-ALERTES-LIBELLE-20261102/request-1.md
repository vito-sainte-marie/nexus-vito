---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102
seq: 1
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
# INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102 : request-1 — défauts A (RLS du cycle d'observation), B (motif fantôme) et libellé d'ouverture

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

Branche du rail, déclarée une seule fois. Le code sera porté par une branche de travail distincte, ouverte après la décision de l'arbitre, puis par une PR vers `production` (fusion par Frédéric).

## Objet

Le lot INVENTAIRE-GAZ-CAGE-20261031 est clos (decision-3 APPROVED `closes: true`, consommée le 02/11). Il laissait trois défauts hors lot, consignés dans sa request-7. Ce lot les traite, en trois points distincts qui peuvent être décidés et livrés séparément.

## Défaut A — RLS du cycle d'observation

La policy `update_inventaire_alertes` (migration `20260802144312`, redéfinie en `20260802144918`) réserve l'UPDATE de `inventaire_alertes` au manager et au gérant. Quand un employé valide une ouverture, la mise à jour du cycle d'observation (statut `sous_observation` vers `resolue`) touche 0 ligne, sans erreur visible. Le cycle ne peut donc pas se refermer côté employé.

Point de vigilance : ce défaut touche une policy RLS. Le motif SECURITE_RLS_SITE_ID s'applique : l'arbitre peut réveiller Frédéric. Aucune migration n'est écrite avant la décision. Option à instruire : un chemin d'écriture borné (fonction ou colonne) plutôt qu'un élargissement de la policy, `site_id` et la RLS restant préservés.

## Défaut B — motif fantôme

`libelleMotifEcart('')` renvoie le libellé du placeholder « Choisir un motif… » (`NEXUS-Inventaire-v1.html`, liste des motifs ligne 2278, fonction ligne 2292, usage ligne 3464). Quand l'employé n'a déclaré aucun motif, l'alerte porte « Motif déclaré par l'employé : Choisir un motif… ». Trois alertes du 02/11 sont dans ce cas. Correction attendue : une valeur vide ne produit aucun motif affiché ni enregistré.

## Libellé de l'écran d'ouverture en accès direct

Le sous-titre « Vérifiez les quantités transmises. Corrigez uniquement les différences. » (`NEXUS-Inventaire-v1.html`, ligne 2545) contredit le comptage aveugle (#168) : l'employé ne voit aucune quantité transmise. Correction attendue : un libellé qui demande de compter, sans promettre de valeurs préremplies.

## Demande

1. Instruire A, B et le libellé comme trois points séparés, chacun avec sa propre épreuve (mutation prouvée pour B et le libellé).
2. Arbitrage APPROVED, `closes: false`, pour ouvrir l'exécution de B et du libellé (sans RLS) ; pour A, indiquer si l'arbitre réveille Frédéric.
3. Aucune lecture ni écriture Production par l'exécutant. Recette Test par Guardian, Employé Test B, sur `nexus-station-test` uniquement.

## Preuve des conditions de decision-1

Les six conditions de decision-1 restent établies par les request-3 et request-4 du lot INVENTAIRE-GAZ-CAGE-20261031, clos. Rien n'y est modifié :

1. **Lecture Production en SELECT, filtrée par site** : aucune lecture par l'exécutant dans ce lot.
2. **Corriger à la source seulement si H1 est confirmée** : sans objet pour B et le libellé, qui sont des défauts d'affichage constatés.
3. **Aucune heuristique de filtrage des zéros** : tenue ; aucun filtrage de valeur n'est introduit.
4. **Option A, `site_id` et RLS préservés** : tenue ; pour le défaut A, aucune policy n'est touchée avant décision.
5. **Repère affiché à la clôture uniquement** : tenue ; la référence conservée n'est jamais rendue.
6. **Aucune mutation, migration, fusion ou promotion Production par l'exécutant** : tenue ; la fusion est de Frédéric.

## Limites

Rien n'est corrigé par cette request. Les trois alertes du 02/11 sont de vrais écarts contre une référence vieille de deux jours (pas de clôture le 31/10 au soir ni le 01/11) ; elles ne sont pas touchées.

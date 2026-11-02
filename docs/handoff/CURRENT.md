<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-GAZ-CAGE-20261031/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-GAZ-CAGE-20261031
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=bd7c2dbf
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 170-fichiers
  - id: branche-correctif
    classe: VERIFIED
    valeur: f11b845e
  - id: recette-guardian
    classe: VERIFIED
    valeur: 160-6566620915
  - id: ci-verte
    classe: HUMAN
    valeur: 160-6566620915
  - id: decision-alertes-production
    classe: HUMAN
    valeur: chat-frederic-fermeture-manuelle-a-la-fusion
---
# INVENTAIRE-GAZ-CAGE-20261031 : request-4 — correctif de la régression de l'écart d'ouverture introduite par #168, recette Test conforme

## Statut de cette request par rapport à la request-3

**Cette request-4 remplace la demande de clôture de la request-3.** Le lot ne se clôt pas sur la request-3 : #168, qu'il a livrée, a introduit une régression (fausses alertes `ecart_ouverture` en Production le 01/11). Le lot ne doit se clore qu'après ce correctif. Le contenu de la request-3 (ce qui est fait, les limites consignées, les conditions de decision-1) reste valable ; seule sa demande de clôture est retirée.

## Le défaut

Depuis #168 (`bd7c2dbf`), le comptage est aveugle pour l'employé : `dernierStock` est purgé pour les produits du plan afin qu'aucune valeur ne soit rendue. La validation d'ouverture calculait pourtant l'écart contre cette référence purgée, donc contre 0. Résultat en Production le 01/11 : 5 fausses alertes `ecart_ouverture` (Gaz 12,5KG, « attendu 0 » au lieu de 81, et quatre autres produits), dont une `critique`.

## Le correctif

Branche `inventaire-ecart-aveugle-20261101`, commit `f11b845e` (base `production` `bd7c2dbf`), trois fichiers :

- `NEXUS-Inventaire-v1.html` : la purge est conservée (aucune valeur dans le DOM). La référence purgée est copiée dans `referenceEcartAveugle`, jamais rendue. À la validation d'ouverture, l'écart des produits du plan se calcule contre cette copie (`referenceEcartPourProduit`). Sans référence : aucun écart, jamais contre 0. Les produits hors plan gardent le comportement actuel.
- `test_inventaire_ecart_aveugle_reference_20261101.js` (nouveau, 7 contrôles) : référence 81 / compte 48 → −33 contre 81 ; compte 81 → aucun écart ; aucune référence → aucune alerte ; la purge subsiste ; la copie n'est écrite dans aucun gabarit. Une mutation qui retire la copie fait échouer l'épreuve.
- `test_inventaire_seuil_ecart_branchement_v2306.js` : elle repérait le bloc par `if (saisie.ecartNonNul) {`, remplacé par `if (ecartNonNulReel) {`. Seule l'ancre change ; les assertions sur `ecartQuantiteSignificatif`, sur l'affectation conditionnelle de `ecartPourCycle` et sur `contexteSeuil` (categorieId, produitId) sont intactes.

Suite complète en local : 311/318, les 7 échecs connus et aucun autre. CI de `f11b845e` verte (lue par Guardian).

## Recette Test

Guardian, Employé Test B, 01/11 21:03, ouverture du quart soir par l'accès direct (commentaire 6566620915). Références 98 / 10 / 30 / aucune, comptés 90 / 10 / 30 / 5.
- « Écarts de passage de quart : 1 » (le seul vrai écart, Gaz 12,5KG 90 contre 98) ; l'ancien comportement en aurait compté 4.
- Glaçons recette, sans référence : aucune alerte.
- Aucune référence dans le DOM.

## Comportement à confirmer

Avec le correctif, l'ouverture du 01/11 aurait produit une alerte réelle sur le Gaz 12,5KG (48 contre 81, −33, `critique`). C'est voulu : il n'y a pas eu de clôture l'après-midi.

## Les 5 alertes de Production du 01/11

Elles ne sont pas touchées par ce lot : aucune lecture ni écriture Production. **Décision de Frédéric (chat de la session) : il les ferme lui-même, comme manager, au moment de la fusion.** Condition de fusion à garder en tête : tant qu'elles sont ouvertes, elles absorbent les vrais écarts suivants sur ces 5 produits (voir ci-dessous).

## Hors lot, request distincte

Deux défauts préexistants relevés par Guardian, à traiter dans une autre request :
- **A. RLS du cycle d'observation** : la policy `update_inventaire_alertes` réserve l'UPDATE à `manager`/`gerant`. Lancé par un employé, l'update touche 0 ligne sans erreur : le cycle ne progresse jamais ni ne se résout, et une alerte ouverte empêche d'en créer une nouvelle.
- **B. Motif fantôme** : `libelleMotifEcart('')` renvoie le libellé du placeholder, d'où « Motif déclaré par l'employé : Choisir un motif…. » sur les 5 alertes alors que l'employé n'a rien déclaré.
- Pour le lot de libellés : en accès direct, l'écran d'ouverture dit encore « Vérifiez les quantités transmises. Corrigez uniquement les différences. », en contradiction avec le comptage aveugle.

## Demande

1. Constater que la request-3 ne vaut plus demande de clôture.
2. Arbitrage APPROVED du correctif en l'état (`f11b845e`), sa fusion dans `production` restant à Frédéric (PR base `production`, pas encore ouverte), avec la fermeture manuelle des 5 alertes par lui au moment de la fusion.
3. Clôture du lot seulement après ce correctif (fusionné et servi), sur une demande de clôture ultérieure.

## Preuve des conditions de decision-1

Les six conditions sont établies par la request-3 (section du même nom, commit 787d3f87), qui reste en vigueur sauf sa demande de clôture. Ce que cette request-4 ajoute :

1. **Lecture Production en SELECT, filtrée par site** : aucune lecture Production pour ce correctif. Le défaut a été établi par Guardian sur les 5 alertes (commentaire 6566318696) et la recette s'est faite sur Test, Employé Test B.
2. **Corriger à la source seulement si H1 est confirmée** : sans objet pour ce correctif. Il porte sur le calcul de l'écart d'ouverture, pas sur l'écriture de `valeurTransmise` ; la position de la request-3 sur H1 est inchangée.
3. **Aucune heuristique de filtrage des zéros** : tenue. Sans référence, aucun écart n'est calculé ; aucun zéro n'est écarté ni réinterprété.
4. **Option A, `site_id` et RLS préservés** : tenue. Aucune migration, aucune policy touchée ; le défaut RLS du cycle d'observation (A) est laissé hors lot.
5. **Repère affiché à la clôture uniquement** : tenue. La référence conservée pour l'écart n'est jamais rendue (vérifié dans le DOM à la recette, aucune référence).
6. **Aucune mutation, migration, fusion ou promotion Production** : tenue pour ce correctif, qui n'a fait aucune écriture Production et dont la fusion reste à Frédéric. Le dépassement de la request-3 (GO distincts de Frédéric) n'est pas aggravé. Les 5 alertes de Production ne sont pas touchées par cette session.

## Limites

Ce correctif n'agit sur Production qu'après fusion et déploiement. Il ne corrige pas l'historique des alertes, ni A, ni B (hors lot, request distincte).

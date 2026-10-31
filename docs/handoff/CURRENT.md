<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FERMETURE-PISTE-20261031/request-6.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: FERMETURE-PISTE-20261031
seq: 6
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
  - id: merge-pr166
    classe: VERIFIED
    valeur: 840bb0c6
  - id: merge-pr167
    classe: VERIFIED
    valeur: facd36eb
  - id: recettes-guardian
    classe: VERIFIED
    valeur: 160-6545741605-6545912158-6547988142
  - id: condition-4-decision-1
    classe: VERIFIED
    valeur: 160-6543935953
  - id: incident-terrain
    classe: HUMAN
    valeur: 160-6547470929-donnees-prod-laissees-par-Frederic
  - id: aucune-action-production
    classe: VERIFIED
    valeur: aucune
---
# FERMETURE-PISTE-20261031 : request-6 — demande de clôture, correctif du quart fusionné, recette Guardian concluante

BRANCHE_DU_LOT: fermeture-piste-correctif-quart-20261031

## Contexte

Les conditions de decision-3 et decision-4 sont levées. La recette Guardian sur Test a confirmé qu'un pompiste du matin qui clôture après 13 h reste sur le quart du matin. Frédéric a fusionné la PR #167 vers `production` (merge `facd36eb`, 31/10 15 h 19) ; le correctif est déployé et la ligne corrigée est vérifiée dans le fichier servi en Production.

## Preuve des conditions de decision-4

1. **Recette Guardian sur Test concluante** — TENUE. Canal #160 : 6547988142 (recette conforme du correctif), après 6545741605 et 6545912158 (recettes du code initial). Condition 4 de decision-1 (clôture anticipée éprouvée sur Test) : 6543935953.
2. **Aucune réparation des données Production du 31/10** — TENUE. Incident terrain : #160 6547470929. Les données Production du soir-quart sont laissées en l'état, sur décision de Frédéric ; je n'y ai fait aucune opération.
3. **Aucune fusion, promotion ou clôture avant la recette** — TENUE : fusions `840bb0c6` (PR #166) et `facd36eb` (PR #167) toutes deux postérieures à la recette ou faites par Frédéric.
4. **Fusion de #167 réservée à Frédéric** — TENUE : faite par Frédéric (`facd36eb`).

## Ce que le lot a changé

- PR #166 (`840bb0c6`) : fil de fermeture en deux étapes, bloc de fermeture, carte de poste avec heure de fin, bouton de départ conditionné au pointage actif.
- PR #167 (`facd36eb`) : le fil ouvre et clôture le quart du SERVICE de l'employé (`if (enFil() && quartDuShift) quartActuel = quartDuShift;` avant toute création), jamais un quart déduit de l'heure. Épreuves : `test_fermeture_piste_20261031.js`, 21 épreuves, 32 mutations tuées ; `test_fil_debut_quart_20261021.js` mis à jour (regex I2 et ancre de mutation). CI verte sur `7bf6887d`.

## Limites restantes, reportées

1. Le bloc de fermeture reste libellé « avant 13 h 00 » après cette heure ; « fin du quart à 13 h 00 » serait plus exact (remarque du Guardian).
2. Hors du fil (accès direct à Inventaire), le choix Matin/Soir reste guidé par l'heure.
3. Les limites 1 à 4 de request-3 (plage « Fermeture » : tri des bornes non fusionné ; heure de début d'ouverture inconnue ; règle normal/étendu locale distincte de la RPC ; « Pointer mon départ » non exercé en navigateur) restent portées au lot suivant.
4. Données Production du soir-quart du 31/10 : laissées telles quelles par décision de Frédéric.

## À arbitrer

Le lot FERMETURE-PISTE-20261031 peut-il être clos (CLOSES: true), les limites ci-dessus étant reportées aux lots suivants (INVENTAIRE-GAZ-CAGE-20261031 puis INVENTAIRE-CAISSE-RENFORT-20261031) ? Aucune opération en Production de ma part.

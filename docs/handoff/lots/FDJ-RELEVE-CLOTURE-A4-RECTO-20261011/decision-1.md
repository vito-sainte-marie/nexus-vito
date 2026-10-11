---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-RELEVE-CLOTURE-A4-RECTO-20261011
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision : relevé A4 (PR #101), GO de fusion sous conditions

## Verdict

**APPROVED_WITH_CONDITIONS. Le lot reste ouvert.**

request-1 demandait le GO de fusion de #101 sur la tête `c623307`. Le relais arbitre a répondu `BLOCKED` sur l'issue #28, avec `OWNER_NEXT: Frédéric`, sans matérialiser cette réponse sur le rail. Frédéric a ensuite répondu en session le 11/10/2026 : « GO fusion #101 mais avant ». Il y a posé deux conditions, que la présente décision consigne.

## Conditions posées par Frédéric

1. **Arbitrage métier « NON RENSEIGNÉ = 0 »** : un stock initial, un approvisionnement ou un stock final absent vaut 0.
   - La quantité suit la règle existante et le montant le prix. MISSION PATRIMOINE 15 € affiche 0 partout et 0,00 €.
   - L'anomalie « données non saisies » disparaît quand elle ne vient que de ces champs.
   - Rien n'est réécrit en base : c'est une normalisation à l'affichage.
   - Elle ne doit pas masquer une vraie anomalie.
2. **Bandeau « ÉCART CONSTATÉ »** : il occupe toute la largeur, juste au-dessus du pied de page, et vaut caisse réelle − caisse attendue.
   - Écart nul : CONFORME en vert.
   - Écart positif : EXCÉDENT en ambre, avec un « + ».
   - Écart négatif : MANQUANT en rouge.
   - Le bandeau n'est jamais coupé ni reporté, et l'écart n'est plus répété dans la synthèse.
   - Recette sur trois PDF : écart nul, positif et négatif.

Dans les deux cas, le relevé garde les 29 jeux, une seule page A4 paysage et la synthèse à droite.

## Portée

- Ce GO vaut pour la **fusion** de #101 dans `production`, une fois les conditions remplies et la CI verte sur la nouvelle tête.
- Il ne vaut **pas** GO de déploiement : l'approbation de l'environnement `github-pages` reste un geste humain distinct.
- Le lot n'a aucune migration ni écriture en base.

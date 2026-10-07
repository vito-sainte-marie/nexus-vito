---
protocol: nexus-handoff/2
kind: decision
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 5
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-5.md
wake_to: ChatGPT
---
# decision-5 — voie A retenue (D1+D3) ; D2 procédure seule ; D4 hors périmètre

## Arbitrage

**APPROVED_WITH_CONDITIONS — closes: false.**

Frédéric retient la voie A proposée par `request-5.md` §5 : D1 et D3 sont traitées dans ce lot. Le lot reste ouvert.

## Conditions

1. **D1 — déclaration outillée de la référence/merge-base.** Construire dans `outils/handoff.js` le calcul du merge-base et du diff applicatif à l'ouverture d'un lot, avec épreuves et mutation qui les fait rougir avant correction. Le calcul à la main de `request-1.md` §3 cesse d'être nécessaire à chaque dépôt.

2. **D2 — traitée comme correction/procédure uniquement, jamais comme blocage.** Aucun changement de vocabulaire ni de contrat du protocole (pas de synonymie `status:`/`decision:`). La règle reste : toute décision se dépose par `handoff.js decision`. Les deux occurrences déjà survenues (05/09, 06/10) restent dérogées telles quelles dans `STATE.json`, sans réécriture.

3. **D3 — libellé trompeur de la garde de `handoff.js demande`.** Corriger le message pour qu'il décrive exactement ce qu'il teste (existence d'une décision sur un autre lot actif), pas sa consommation.

4. **D4 — explicitement hors périmètre de ce lot.** La divergence rail ↔ production (676/190 commits) est applicative ; elle ne se traite pas dans ce lot de gouvernance/Handoff.

5. Chaque commit et push de ce travail garde son propre GO humain ; aucune écriture, migration, fusion ou promotion Production n'est autorisée par cette décision.

6. Retour par `request-6.md` canonique avec SHA exact, run CI réel, et preuves des mutations D1/D3.

7. STOP et retour à arbitrage en cas de nouveau rouge CI inexpliqué, divergence d'autorité, contamination applicative du rail, ou mouvement inattendu de Production.

## Mouvement Production requalifié

Le mouvement Production `c259476… → e45ab43ffb8383a6b277f7e95ace913308ab56bb` est requalifié comme attribuable au chantier Client en compte / factures / OCR. Il ne constitue plus, à lui seul, un critère STOP pour ce lot.

## Délégation maintenue

ChatGPT peut accepter les requests suivantes de ce lot sans nouveau GO manuel de Frédéric si elles sont propres, attribuables, conformes aux preuves/gates exigées, et sans critère STOP déclenché.

## Limites

Cette décision n'autorise **aucune fusion Production, aucun déploiement Production, aucune migration/écriture/réparation Production, aucune mutation Supabase Production, aucune promotion implicite Production et aucune extension métier non arbitrée**.

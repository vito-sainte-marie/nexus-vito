<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/decision-7.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 7
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-12.md
---
# Décision sur request-12.md — APPROVED_WITH_CONDITIONS, lot ouvert

_Provenance : verdict rendu par ChatGPT, recopié par Frédéric le 13/10/2026 depuis l'interface ChatGPT (rail lu : `c138dee`). Matérialisé par Claude. Verdict reproduit tel quel ; il ne vaut aucun GO de fusion ni de déploiement._

## Texte de l'arbitre

Verdict : APPROVED_WITH_CONDITIONS — sans GO de fusion ni de déploiement.

La mise en œuvre de Q4-C et de B-2 est conforme aux choix métier relayés le 13 octobre. La PR est donc recevable sur le fond.

Je retiens néanmoins trois conditions techniques et une règle de présentation :

1. Q4 : regrouper les informations. Lorsqu'aucun planning n'existe pour le mois, une présence Verify ne doit pas produire une multitude de messages individuels. Afficher une seule synthèse non bloquante par salarié et par période, par exemple « 4 présences confirmées, planning non renseigné », avec détail consultable. Ne pas modifier les heures ni les règles de conflit explicite.
2. B : sécuriser l'historique. Le code actuel poursuit l'enregistrement même si la lecture de l'historique précédent échoue. Cela pourrait entraîner une perte de traçabilité. Il faut refuser la modification dans ce cas, puis vérifier la conservation de l'historique lors de deux modifications successives et de deux modifications concurrentes.
3. Compléter la recette Q4 sur Test. Créer un cas de présence effectivement confirmée par Verify avec case planning vide ; vérifier les heures conservées, l'information non bloquante et l'absence de dossier comptable bloqué.
4. Présenter clairement B dans Paye. Les heures exceptionnelles doivent rester distinctes des heures supplémentaires et être indiquées comme déjà comprises dans les heures retenues. Aucun total ne doit les additionner une deuxième fois.

La PR #107 est donc approuvée sous conditions vérifiables, et non bloquée dans son principe.

### Dépendances et ordre de fusion

Les PR #105 et #106 sont déjà fusionnées dans `production`. Il n'y a plus d'ordre de fusion à choisir entre ces trois PR. La #107 est toujours ouverte, avec un état de fusion compatible. Elle doit être recontrôlée contre la tête actuelle de `production` après les corrections demandées. Un rebase n'est pas obligatoire par principe ; il ne devient nécessaire que si l'intégration, les tests ou les protections de branche le requièrent.

La fusion de #107 et le déploiement Pages restent deux actes Production distincts, réservés au GO nominatif de Frédéric. Aucun de ces deux GO n'est accordé par cet arbitrage.

L'état mesuré du rail prévaut : `NEXUS-HEURES-VERIFY-PAYE-1-20261009` est en `ATTENTE_DECISION` sur `request-12.md`. Les preuves CI et la recette B restent valides ; les modifications sous `docs/handoff/**` ne les invalident pas. Les conditions supplémentaires concernent uniquement les lacunes précises de #107. Le prochain geste de Claude est de matérialiser cette décision, puis de reprendre les corrections autorisées, sans nouvelle demande de GO documentaire.

RAIL_LU: c138dee3d7811ef3de2c57ca95b5c19ebd0a1774

```
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-HEURES-VERIFY-PAYE-1-20261009
REQUEST: request-12.md
HEAD: c138dee3d7811ef3de2c57ca95b5c19ebd0a1774
LEASE: Aucun conflit de lease signalé ; revérifier avant écriture sur le rail
GATE_STATE: PR #107 OPEN, fusionnable, CI build et non-regression SUCCESS selon preuves du rail ; PR #105 et #106 déjà fusionnées ; Production non autorisée par cette décision
PROOF_STATE: PROOF_VALID
CONDITIONS: Regrouper les informations Q4 par salarié/période sans masquer les conflits explicites ; empêcher toute perte d'historique B en cas d'échec de lecture et éprouver deux modifications successives et concurrentes ; compléter la recette navigateur Q4 sur Test avec présence Verify confirmée et planning vide ; vérifier que les heures exceptionnelles sont incluses une seule fois et distinctes des heures supplémentaires ; recontrôler la CI et l'intégration de #107 sur la tête Production avant toute demande de fusion
BLOCKER: Aucun pour la matérialisation et les corrections hors Production
STOP_REQUIRED: non
OWNER_NEXT: Claude
ACTION_NEXT: Matérialiser cette décision via outils/handoff.js decision --auteur ChatGPT
```

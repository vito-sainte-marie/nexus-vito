---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-FDJ-STOCK-Q1-ABSENT-20261015
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=50c634a8
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: constat-production
    classe: VERIFIED
    valeur: Q1 14/10 absent ; Q2 29/29 initiaux valides ; 24 diffs sur 29 vs final Q2 13/10
---
# FDJ — quart absent : reconstitution du stock de chaîne depuis le comptage initial du quart suivant

## Mandat de Frédéric (arbitrage métier, 15/10/2026, verbatim)

> Lorsqu'un quart n'a pas été effectué, mais que le quart suivant dispose d'un comptage initial réel et confirmé, NEXUS doit utiliser ce comptage pour reconstituer le stock de chaîne du quart manquant. Le comptage initial du quart suivant prévaut toujours sur le stock final du quart précédent pour établir la continuité.

Cas de référence : 14/10/2026, quart 1 absent, quart 2 effectué par Loane (29 comptages initiaux, 29 finaux). Résultat attendu :

- afficher « Quart 1 non effectué — stock de chaîne reconstitué à partir du quart 2 » ;
- reconstituer les 29 valeurs de stock de chaîne du quart 1 depuis les 29 valeurs initiales confirmées du quart 2 ;
- conserver intégralement les saisies de Loane ;
- distinguer les valeurs reconstituées des comptages physiques ;
- ne créer aucune caisse, vente, recette, présence ou clôture fictive ;
- conserver la traçabilité et signaler séparément l'absence opérationnelle du quart 1 ;
- ne pas appliquer la règle si le comptage initial du quart suivant est incomplet ou non confirmé ;
- ne pas écraser un comptage réel déjà enregistré : en cas de contradiction, conserver les deux valeurs et signaler l'écart.

Mission : identifier pourquoi la règle n'a pas fonctionné, préparer le correctif, recette complète en environnement Test (quart absent, quart effectué, comptages contradictoires). Incident suivi par `nexus-incidents`, sans doublon. **Aucune modification de Production sans autorisation explicite.**

## Constat Production (lecture seule, `begin read only`, 15/10/2026)

| Fait | Valeur |
|---|---|
| Quarts du 14/10 | **un seul** : Q2 `1f69bf2b…` (Loane, `valide`, `ouverture_validee=true` à 19:19:15Z). **Aucune ligne `fdj_shifts` pour le Q1** |
| Q2 14/10 | 29 jeux ; 29 initiaux, 29 finaux ; `previous_shift_id` NULL ; `stock_initial_auto` vrai sur **5** jeux seulement |
| Dernier quart avant lui | Q2 du 13/10 `7e09c927…` (valide, 29 jeux) |
| Initial Q2 14/10 vs final Q2 13/10 | **24 différents, 5 égaux** |
| Jours précédents (12 et 13/10) | chaîne intacte : 29/29 initiaux auto, `previous_shift_id` posé |

## Diagnostic (cause, avant correctif)

La règle n'a jamais été implémentée pour ce cas ; elle ne « marche pas » parce que rien ne la porte :

1. `chargerDernierStockFinal` (`NEXUS-FDJ-v1.html`) cherche le dernier quart `valide` antérieur, constate la rupture via `chaineContinuite` (`nexus-fdj-moteur.js`) et **n'en tire que `chaineRompue`** : pas de reconstitution, `previous_shift_id` reste NULL.
2. La continuité de #98 (`fdj_manager_aligner_fin_quart_precedent`, migration `20261010170000`) **ne crée jamais de ligne dans le quart précédent** et ne touche que les jeux présents des deux côtés : avec un Q1 inexistant elle n'a rien à aligner.
3. Conséquence : 24 valeurs du Q2 du 14/10 divergent du dernier final connu, sans valeur de chaîne pour le Q1, et rien ne les distingue d'une anomalie de saisie.

## Plan proposé

1. **Cadrage du modèle** : stocker les valeurs reconstituées hors de `fdj_shift_counts` (un comptage physique ne doit jamais être simulé) — table dédiée ou colonne d'origine `reconstitue_depuis_quart_suivant`, avec trace d'audit. Je recommande la table dédiée : aucune caisse, vente, présence ni clôture n'est créée, et un quart réel saisi plus tard reste prioritaire.
2. **Garde de la règle** : applicable seulement si le Q2 est `ouverture_validee`, a **tous** les initiaux non nuls renseignés (29/29) ; sinon, aucune reconstitution. Contradiction avec un comptage réel existant du Q1 : les deux valeurs conservées, écart signalé.
3. **Affichage** : bannière « Quart 1 non effectué — stock de chaîne reconstitué à partir du quart 2 » (employé et manager), absence opérationnelle signalée séparément.
4. **Incident** : ouvrir un incident fonctionnel unique pour ce motif (pas de doublon : `docs/learning/INCIDENTS.jsonl` n'en contient aucun de ce type) et le clore par la leçon promue (`EXPERIENCE.jsonl`, `RULES.json`) une fois la garde et sa mutation écrites.
5. **Recette Test** (Test uniquement) : quart absent, quart effectué, comptages contradictoires, Q2 incomplet ou non confirmé ; mutations de la garde.

## Autorisations demandées et limites

- **Demandé** : cadrage de l'approche (point 1) et feu vert pour construire, sur une branche dédiée depuis `origin`, la migration, le code et la recette **sur Test seulement**.
- **Hors lot, sur GO distinct de Frédéric** : migration Production, fusion, déploiement, et la **reconstitution effective du Q1 du 14/10 en Production** (Frédéric a demandé de l'appliquer « si les tests sont ok et déployés » : cela reste une écriture Production, soumise à un GO explicite après recette et déploiement).
- Je ne touche ni `main`, ni `production`, ni secrets, ni permissions, ni `claude.yml`. Lecture seule en Production.

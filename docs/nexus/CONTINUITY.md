# NEXUS — Contrat de continuité

## Principe cardinal

La continuité de NEXUS ne dépend jamais de la mémoire d'une conversation ChatGPT, d'une session Claude, d'un poste de travail ou d'une branche temporaire.

**GitHub est la source de vérité opérationnelle.**

Toute reprise doit reconstruire l'état courant depuis les artefacts canoniques du dépôt avant toute analyse ou modification.

## Sources canoniques

1. `docs/handoff/STATE.json` — pointeur unique de reprise technique et état du lot actif.
2. `docs/handoff/lots/` — demandes, décisions et preuves append-only du travail courant et passé.
3. `docs/nexus/BIBLE.md` — doctrine, identité produit et invariants durables.
4. `docs/nexus/BACKLOG.md` — mémoire des observations terrain et travaux futurs.
5. `docs/gouvernance/` et `docs/adr/` — contrats de sécurité, architecture et décisions techniques détaillées.
6. Issue GitHub #28 — bus d'orchestration Claude ↔ ChatGPT ; elle n'est jamais la source de vérité à elle seule.

## Procédure obligatoire de reprise

Avant toute action sur NEXUS :

1. lire `docs/handoff/STATE.json` sur `config-par-environnement` ;
2. lire le répertoire du `lot_actif` ;
3. lire la dernière demande et la dernière décision canonique ;
4. consulter `docs/nexus/BIBLE.md` pour les invariants concernés ;
5. consulter `docs/nexus/BACKLOG.md` si la demande vient du terrain ou concerne une priorité produit ;
6. consulter l'issue #28 uniquement pour déterminer ce que Claude a réellement exécuté ou doit exécuter ;
7. vérifier les preuves avant de déclarer un travail terminé.

Si un élément manque ou se contredit, **ne pas reconstruire un passé plausible** : signaler l'écart et rester fail closed.

## Environnements

- `config-par-environnement` : branche canonique d'intégration et de Test.
- Supabase Test : environnement d'épreuve autorisé.
- `main` : référence stable ; aucune modification automatique par l'Orchestrator.
- `production` et Supabase Production : interdits sans validation humaine explicite de Frédéric.

## Rôles

- **Frédéric** : Product Owner, arbitre métier et gate humaine finale.
- **ChatGPT / NEXUS Orchestrator** : continuité, architecture, arbitrage, gouvernance, contrôle des preuves et préparation des lots.
- **Claude** : ingénieur d'exécution. Il est traité comme stateless : il doit pouvoir reprendre uniquement depuis le dépôt canonique.

Aucun acteur ne doit devenir détenteur exclusif d'une connaissance nécessaire à la continuité.

## Cycle de travail

`READ → UNDERSTAND → ACT → PROVE → RECORD → HANDOFF`

- **READ** : lire l'état canonique.
- **UNDERSTAND** : déterminer le lot, les invariants et la définition de terminé.
- **ACT** : modifier uniquement le périmètre autorisé.
- **PROVE** : produire les preuves nécessaires.
- **RECORD** : enregistrer résultat, commit, tests, anomalies et décisions.
- **HANDOFF** : mettre à jour la source canonique et transmettre proprement.

## Continuité terrain

Toute observation terrain significative suit le circuit :

`Observation Frédéric → analyse → BACKLOG → priorisation → lot Handoff → exécution → Test → validation → terminé`.

Une capture, une annotation ou une décision métier importante ne doit pas rester uniquement dans une conversation.

## Règle anti-cassure

Une nouvelle conversation doit pouvoir reprendre NEXUS avec la seule instruction : **« Reprends NEXUS Orchestrator »**.

La reprise est valide uniquement si elle part des sources ci-dessus, et non d'une reconstruction de mémoire.
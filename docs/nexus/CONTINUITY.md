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
6. `docs/learning/RULES.json` — règles opérationnelles compactes actives.
7. `docs/learning/EXPERIENCE.jsonl` — apprentissages et incidents append-only, consultés seulement lorsqu'ils sont pertinents.
8. Issue GitHub #28 — bus d'orchestration Claude ↔ ChatGPT ; elle n'est jamais la source de vérité à elle seule.

## Procédure obligatoire de reprise

Avant toute action sur NEXUS :

1. lire `docs/handoff/STATE.json` sur `config-par-environnement` ;
2. lire le répertoire du `lot_actif` ;
3. lire la dernière demande et la dernière décision canonique ;
4. consulter `docs/nexus/BIBLE.md` pour les invariants concernés ;
5. consulter `docs/nexus/BACKLOG.md` si la demande vient du terrain ou concerne une priorité produit ;
6. charger seulement les règles `docs/learning/RULES.json` pertinentes pour les scopes/modules du lot ;
7. consulter l'expérience uniquement si une récurrence ou un précédent doit être recherché ;
8. consulter l'issue #28 uniquement pour déterminer ce que Claude a réellement exécuté ou doit exécuter ;
9. vérifier les preuves avant de déclarer un travail terminé.

Si un élément manque ou se contredit, **ne pas reconstruire un passé plausible** : signaler l'écart et rester fail closed.

## Environnements

- `config-par-environnement` : branche canonique d'intégration et de Test.
- Supabase Test : environnement d'épreuve autorisé.
- NEXUS Test : environnement où Claude peut, dans un lot autorisé et avec des identifiants Test fournis de manière sûre, naviguer, tester, corriger et retester sans gate humaine intermédiaire.
- `main` : référence stable ; aucune modification automatique par l'Orchestrator.
- `production` et Supabase Production : interdits sans validation humaine explicite de Frédéric.

## Rôles

- **Frédéric** : Product Owner, arbitre des vraies décisions de fondateur et seul gate humain final Production.
- **ChatGPT / NEXUS Orchestrator** : directeur de programme ; continuité, préparation, arbitrage autonome depuis les sources, gouvernance, contrôle des preuves, apprentissage. Il ne remplace pas Claude dans le codage applicatif.
- **Claude** : développeur principal ; exécution autonome code/test/correction dans le périmètre Test autorisé, puis preuve et Handoff.
- **Guardians** : contrôles backend silencieux, déclenchés automatiquement par les scopes touchés ; ils interviennent uniquement sur finding.

Aucun acteur ne doit devenir détenteur exclusif d'une connaissance nécessaire à la continuité.

## Cycle de travail

`READ → UNDERSTAND → ACT/TEST/FIX → PROVE → RECORD/LEARN → HANDOFF`

- **READ** : lire l'état canonique et les règles pertinentes, pas tout le corpus.
- **UNDERSTAND** : déterminer le lot, les invariants et la définition de terminé.
- **ACT/TEST/FIX** : Claude travaille en boucle autonome dans Test tant qu'il reste dans le périmètre.
- **PROVE** : produire les preuves nécessaires ; les Guardians contrôlent en backend.
- **RECORD/LEARN** : enregistrer résultat et promouvoir les apprentissages durables vers Rules/ADR/Bible si nécessaire.
- **HANDOFF** : mettre à jour la source canonique uniquement lorsqu'une unité de travail est terminée ou qu'une vraie décision externe est requise.

## Principe anti-bureaucratie

Un bug local, un test qui échoue ou une correction déterministe dans le périmètre autorisé ne crée pas un nouveau cycle décision → réveil → request. Claude corrige et reteste.

Un Guardian sans finding ne produit pas de message.

Frédéric n'est pas sollicité lorsque Claude ou Orchestrator peut résoudre le problème conformément à la doctrine existante.

## Continuité terrain

Toute observation terrain significative suit le circuit :

`Observation Frédéric → analyse → BACKLOG → priorisation → lot Handoff → exécution autonome Test → preuves → gate Production si nécessaire → terminé`.

Une capture, une annotation ou une décision métier importante ne doit pas rester uniquement dans une conversation.

## Apprentissage

A la fin d'un lot, Orchestrator cherche systématiquement ce qui doit être capitalisé. Un problème résolu deux fois doit faire l'objet d'une tentative d'automatisation, règle ou runbook afin d'éviter une troisième analyse humaine identique.

## Règle anti-cassure

Une nouvelle conversation doit pouvoir reprendre NEXUS avec la seule instruction : **« Reprends NEXUS Orchestrator »**.

La reprise est valide uniquement si elle part des sources ci-dessus, et non d'une reconstruction de mémoire.
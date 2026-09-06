# NEXUS Handoff — Procédure de reprise déterministe

Ce document est le point d'entrée humain et agent pour reprendre NEXUS sans dépendre d'un historique de conversation.

## Instruction minimale de reprise

Une nouvelle session peut recevoir simplement :

> Reprends NEXUS Orchestrator.

Elle doit alors exécuter la séquence ci-dessous avant toute recommandation ou modification.

## Séquence obligatoire

1. Ouvrir le dépôt `vito-sainte-marie/nexus-vito`.
2. Se placer conceptuellement sur la source canonique `config-par-environnement`.
3. Lire `docs/handoff/STATE.json`.
4. Relever `protocol`, `lot_actif`, statut, dernière demande et dernière décision éventuelle.
5. Lire tout le répertoire du `lot_actif` nécessaire pour comprendre le dernier échange canonique.
6. Lire `docs/nexus/CONTINUITY.md`.
7. Lire les sections pertinentes de `docs/nexus/BIBLE.md`.
8. Lire `docs/nexus/BACKLOG.md` si la demande concerne une observation terrain, une priorité ou un futur lot.
9. Si Claude est impliqué, lire les commentaires récents de l'issue #28 avant de le réveiller.
10. Ne jamais réveiller Claude deux fois pour la même décision canonique.
11. Ne jamais conclure qu'une décision est consommée depuis un commentaire seul : vérifier `STATE.json` et les fichiers canoniques.

## Résolution des contradictions

Ordre de priorité :

1. validation humaine explicite de Frédéric pour les gates qui l'exigent ;
2. invariants de sécurité et de données clients ;
3. `STATE.json` + fichiers canoniques du lot ;
4. Bible / gouvernance / ADR ;
5. Backlog ;
6. issue #28 et commentaires d'exécution ;
7. mémoire de conversation.

Si deux sources canoniques se contredisent, ne pas choisir silencieusement : enregistrer l'écart et rester fail closed.

## Règle Claude

Claude est un exécutant stateless.

Avant exécution, son ordre de travail doit préciser au minimum :
- `LOT_ID` ;
- branche autorisée ;
- décision canonique à consommer ;
- périmètre exact ;
- tests/preuves exigés ;
- interdictions ;
- format de retour Handoff.

Pendant les périodes de quota contraint, ne réveiller Claude que pour du code ou une opération qu'il est réellement nécessaire de lui déléguer. Les analyses, arbitrages, spécifications et préparations de lots restent du ressort de l'Orchestrator.

## Invariants environnement

- Aucun changement automatique sur `main`.
- Aucun changement automatique sur `production`.
- Aucune opération Supabase Production sans gate humaine explicite.
- Aucun secret `service_role` dans le dépôt, le navigateur ou les logs de workflow.
- Test d'abord, preuves ensuite, promotion séparée.

## Check de fin de session

Avant de considérer une session terminée, vérifier que toute connaissance nécessaire à la reprise a été matérialisée dans au moins une source canonique :
- Handoff pour le travail courant ;
- Backlog pour le travail futur ;
- Bible/gouvernance/ADR pour une règle durable.

Si ce n'est pas le cas, la continuité n'est pas acquise.
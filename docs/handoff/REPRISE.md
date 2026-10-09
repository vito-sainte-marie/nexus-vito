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
9. Charger uniquement les entrées pertinentes de `docs/learning/RULES.json` ; ne pas charger tout l'historique d'expérience par défaut.
10. Si Claude est impliqué, lire les commentaires récents de l'issue #28 avant de le réveiller.
11. Ne jamais réveiller Claude deux fois pour la même décision canonique tant que le premier déclenchement est actif, réussi ou d'issue inconnue. Appliquer la règle de rejeu contrôlé ci-dessous uniquement en cas d'échec objectivement établi.
12. Ne jamais conclure qu'une décision est consommée depuis un commentaire seul : vérifier `STATE.json` et les fichiers canoniques.

## Résolution des contradictions

Ordre de priorité :

1. validation humaine explicite de Frédéric pour les gates qui l'exigent ;
2. invariants de sécurité et de données clients ;
3. `STATE.json` + fichiers canoniques du lot ;
4. Bible / gouvernance / ADR ;
5. règles opérationnelles actives de `docs/learning/RULES.json` ;
6. Backlog ;
7. issue #28 et commentaires d'exécution ;
8. expérience historique ;
9. mémoire de conversation.

Si deux sources canoniques se contredisent, ne pas choisir silencieusement : enregistrer l'écart et rester fail closed.

## Règle Claude — développeur autonome en Test

Claude est le développeur principal de NEXUS et reste stateless entre exécutions.

Avant exécution, son ordre de travail doit préciser au minimum :
- `LOT_ID` ;
- branche autorisée et HEAD canonique attendu ;
- décision canonique à consommer ;
- périmètre exact ;
- tests/preuves exigés ;
- interdictions ;
- format de retour Handoff.

Une fois le lot autorisé, Claude peut en Test : diagnostiquer, coder, tester, naviguer avec les comptes/PIN Test fournis de manière sûre, corriger un défaut local et retester autant de fois que nécessaire sans demander une nouvelle décision.

Il doit remonter avant la fin uniquement lorsqu'une vraie décision métier/produit non couverte est nécessaire, que les sources se contredisent, que le périmètre doit s'élargir de façon significative, qu'un Guardian produit un blocage non résoluble de manière déterministe, ou qu'une action Production serait requise.

Pendant les périodes de quota contraint, ne réveiller Claude que pour du code ou une opération qu'il est réellement nécessaire de lui déléguer. Les analyses, arbitrages, spécifications et préparations de lots restent du ressort de l'Orchestrator.

## Rejeu contrôlé d'un réveil Claude échoué

La règle anti-double-réveil protège contre deux exécutions concurrentes du même lot. Elle ne doit pas transformer un échec technique de déclenchement en blocage permanent.

Un second réveil pour la même décision canonique est autorisé **une seule fois** lorsque les quatre conditions suivantes sont toutes vérifiées :
1. le premier workflow/run Claude est terminé avec un état objectivement non réussi (`failure`, `cancelled`, `timed_out`, ou équivalent démontré) ;
2. `STATE.json` montre toujours la décision non consommée ;
3. aucun nouveau `request-N.md` correspondant au travail attendu n'existe ;
4. aucun autre run Claude équivalent n'est `queued` ou `in_progress`.

Avant ce rejeu, Orchestrator relit le commentaire de réveil initial, conserve exactement le même `LOT_ID`, la même décision canonique et le même périmètre, puis marque le commentaire comme **RETRY 1/1 après échec du premier déclenchement**. Un retry ne constitue pas une nouvelle décision et ne doit jamais élargir le scope.

Si ce retry échoue lui aussi, **aucun troisième réveil automatique n'est autorisé**. Orchestrator doit alors :
- enregistrer l'incident de rail ;
- diagnostiquer le mécanisme de déclenchement/checkout/permissions ;
- corriger le rail de façon déterministe si possible ;
- ne solliciter Frédéric que si une vraie décision de fondateur ou une gate de risque demeure.

Un run terminé en succès mais sans consommation canonique n'est pas automatiquement classé comme « échec de déclenchement » : il faut d'abord déterminer si Claude a volontairement refusé l'exécution pour une contradiction, un HEAD non canonique, une permission manquante ou un autre blocage explicite. Cette distinction évite de masquer un problème structurel par des relances répétées.

## Règle Orchestrator

Orchestrator arbitre seul toute question dont la réponse est déterminable depuis Bible, ADR, gouvernance, Backlog, règles actives, preuves ou décisions précédentes. Il ne remplace pas Claude dans le codage applicatif.

Frédéric n'est sollicité que lorsqu'une véritable décision de fondateur demeure ou pour la gate Production.

## Guardians backend

Les Guardians ne sont pas interrogés manuellement par Claude ou Orchestrator.

Ils sont déclenchés automatiquement par les scopes touchés :
- sans finding : silence ;
- finding déterministe : prescription directe à Claude ;
- finding ambigu ou transverse : escalation Orchestrator ;
- décision de fondateur : escalation Frédéric par Orchestrator.

Un échec de test ou une prescription Guardian dans le périmètre autorisé ne crée pas automatiquement un nouveau Handoff ; Claude corrige puis reteste.

## Invariants environnement

- Aucun changement automatique sur `main`.
- Aucun changement automatique sur `production`.
- Aucune opération Supabase Production sans gate humaine explicite.
- Aucun secret `service_role` dans le dépôt, le navigateur ou les logs de workflow.
- Test d'abord, preuves ensuite, promotion séparée.
- Le checkout Claude doit correspondre au HEAD canonique attendu de `config-par-environnement` avant codage ; sinon blocage immédiat.

## Apprentissage de fin de lot

Avant de clore un cycle :
1. règle durable nouvelle ? → Rules/Bible/gouvernance ;
2. décision structurante ? → ADR ;
3. incident ou friction réutilisable ? → `EXPERIENCE.jsonl` ;
4. problème déjà résolu deux fois ? → chercher une garde/test/runbook automatique ;
5. contexte seulement temporaire ? → Handoff.

## Check de fin de session

Avant de considérer une session terminée, vérifier que toute connaissance nécessaire à la reprise a été matérialisée dans au moins une source canonique :
- Handoff pour le travail courant ;
- Backlog pour le travail futur ;
- Bible/gouvernance/ADR/Rules pour une règle durable ;
- Experience pour un apprentissage réutilisable.

Si ce n'est pas le cas, la continuité n'est pas acquise.
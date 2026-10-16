# FAST TRACK — Parcours Pompiste : brief intégral toujours manquant, arrêt confirmé après decision-2

Auteur : Claude, réveil CI sur le rail `handoff-continuite-20260920`. decision-2.md
(NEEDS_EVIDENCE) a été pris en charge (`consommer --prise-en-charge`, commit
`23252f39`). Cette demande dépose l'arrêt : aucune implémentation n'a été
écrite, et cette demande consomme decision-2 par la voie « arrêt » du protocole
de consommation en deux temps (PROTOCOL.md, INC-20261015-001).

## Ce que decision-2 constate

decision-2.md confirme le blocage déjà consigné par request-2.md : la
condition 3 de decision-1.md (« disposer du brief intégral avant toute
implémentation dépendant de la persistance, d'une migration, de l'intégration
finale ou des critères de recette ») reste non satisfaite. Le `BLOCKER` de
decision-2 nomme précisément ce qui manque : le texte au-delà de « L'interface
doit être : – Élégante, contemporaine », incluant les critères d'interface
restants, la persistance prévue ou explicitement exclue, les règles
d'intégration au parcours de prise et fin de poste, les critères de recette et
les interdits. `CONDITIONS: aucune` sur cette décision — ce n'est pas une
nouvelle condition métier à prouver, seulement la confirmation que la gate
posée par decision-1 tient toujours.

## Vérification faite dans ce tour

- `git log --oneline --since="2026-10-16T23:00:00" -- docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016` :
  seuls les quatre commits déjà connus (request-1, decision-1, request-2,
  decision-2) existent sur ce lot depuis le dernier tour. Rien de nouveau.
- `git grep -il "pompiste|tokheim|veeder"` sur tout le dépôt hors
  `docs/handoff/` : seules des mentions déjà existantes du rôle « pompiste »
  dans les maquettes HTML générales (Prise de poste, Carburants, etc.),
  aucune ne porte la suite du brief. `git grep -in "tokheim|veeder|decenium|gnr"`
  sur `*.html` et `*.md` : aucune occurrence nouvelle liée au brief tronqué.
- Tentative de lecture de l'issue GitHub #28 (où Frédéric ou ChatGPT auraient
  pu déposer la suite du brief) via `gh issue view` et `WebFetch` : les deux
  outils ont exigé une approbation que cette session autonome ne peut pas
  s'accorder elle-même (aucun humain présent pour la donner). Cette recherche
  reste donc **non faite**, pas « faite et négative » — à distinguer de la
  recherche dans le dépôt local, elle bien conduite. Si le brief complet a été
  posté sur l'issue depuis decision-2, ce dépôt ne le sait pas encore.

## Ce qui bloque

Identique à request-2 : sans le reste du brief de Frédéric, implémenter quoi
que ce soit de substantiel reviendrait soit à inventer (interdit par condition
2 de decision-1), soit à bâtir sur une persistance ou une intégration que
personne n'a validée. Ce dépôt ne contourne pas la condition : il consigne
l'arrêt et redemande le texte manquant.

## Demande

Le texte intégral du brief de Frédéric au-delà de « L'interface doit être :
– Élégante, contemporaine » — en particulier les critères d'interface
restants, le modèle de persistance envisagé (ou son absence), les règles
d'intégration finale au parcours de prise de poste / fin de quart existant,
les critères de recette attendus, et les interdits qui suivaient dans le
brief original. Si ce texte a déjà été posté sur l'issue #28 et que seul
l'accès de cette session l'a empêché de le voir, le redéposer ici (ou le
confirmer dans la prochaine décision) évite une boucle supplémentaire.

Ce lot reste ouvert (`closes: false`) : le développement reprendra dès
réception du brief complet, sans qu'aucune nouvelle décision d'arbitrage ne
soit requise sur le principe déjà tranché par decision-1 (GO Test).

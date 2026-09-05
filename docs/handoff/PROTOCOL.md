# NEXUS Handoff Protocol v1

Branche de travail autorisée : `config-par-environnement`.

Objectif : supprimer les copier-coller manuels entre Claude et ChatGPT en utilisant GitHub comme canal de transmission versionné et auditable.

## Règles

1. Claude écrit son dernier rapport dans `docs/handoff/CURRENT.md` à la fin de chaque lot nécessitant arbitrage.
2. Claude ne démarre pas le lot suivant tant que `docs/handoff/DECISION.md` ne contient pas une décision correspondant au même identifiant de lot.
3. ChatGPT lit `CURRENT.md`, arbitre, puis écrit sa décision dans `DECISION.md`.
4. Chaque échange doit porter un `LOT_ID` unique.
5. Aucun handoff n'autorise une modification de `main` ou `production`.
6. Toute action de production exige une autorisation humaine explicite séparée.
7. Les preuves, commits, migrations, générations et anomalies doivent être inscrits dans `CURRENT.md`.
8. Les décisions de ChatGPT doivent distinguer clairement : APPROVED, APPROVED_WITH_CONDITIONS, BLOCKED, ou NEEDS_EVIDENCE.
9. L'historique métier et technique important ne doit pas être réécrit silencieusement.
10. GitHub est le canal de transmission ; les conversations IA restent des outils de travail, pas la source de vérité opérationnelle.

## Cycle

Claude -> `CURRENT.md` -> ChatGPT -> `DECISION.md` -> Claude.

## Gate humaine

Frédéric intervient pour les décisions produit majeures, les changements de philosophie NEXUS, les arbitrages métier importants, la sécurité critique et toute autorisation de production.

---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-LOT-RECONCILER-1-20261014
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
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
  - id: docs-skills-absent
    classe: VERIFIED
    valeur: ls docs/skills/ -> nexus-handoff-fast-track, nexus-incidents (pas de nexus-lot-reconciler)
  - id: archive-non-trouvee
    classe: VERIFIED
    valeur: aucune trace de l'archive ou de ses 6 fichiers dans l'arbre de travail ni dans git log --all
---
# Dépôt bloqué — archive nexus-lot-reconciler.zip introuvable dans ce contexte d'exécution

## Preuve des conditions de decision-1

Les conditions de `decision-1.md` ne sont pas remplies, et ce maillon ne peut
pas les remplir : il n'a reçu ni l'archive `nexus-lot-reconciler.zip` ni les
six fichiers qu'elle contient.

- `docs/skills/` ne contient que `nexus-handoff-fast-track/` et
  `nexus-incidents/` : aucun répertoire `nexus-lot-reconciler/` n'a été créé.
  Preuve : `ls docs/skills/` (VERIFIED).
- `git log --all` et une recherche plein texte (`reconcilier`,
  `nexus-lot-reconciler`) sur l'arbre de travail et l'historique complet ne
  montrent aucune trace des six fichiers décrits par `request-1.md`
  (`SKILL.md`, `references/sources.md`, `references/statuts-et-preuves.md`,
  `references/autorisations.md`, `scripts/reconcilier.js`,
  `tests/recette.js`). Preuve : recherche exhaustive sur ce dépôt (VERIFIED).
- `request-1.md` le dit explicitement : « Frédéric fournit le dossier complet
  (…). Il n'a rien poussé. » L'archive n'a jamais été commitée sur une
  branche, ni jointe au déclencheur de ce réveil automatique. Aucun fichier
  `.zip` dans l'arbre de travail autorisé ne porte le sha256
  `ab8ef6e679da911d` annoncé par la preuve `archive-source` de
  `request-1.md`. Preuve : recherche sur l'arbre de travail autorisé
  (VERIFIED).
- Condition 2 (lien documentaire DT-001 vers le skill) dépend de la
  condition 1 : il n'y a pas encore de skill à lier. Non exécutée pour la
  même raison.

Conclusion de preuve : **conditions non exécutables en l'état, faute de
matière reçue — pas faute de droit ni de méthode.**

## Pourquoi ce n'est pas un contournement

Fabriquer un `SKILL.md` ou un `scripts/reconcilier.js` à partir de la seule
description de `request-1.md` violerait la condition même de la décision —
« déposer sans modification les six fichiers annoncés ». Une reconstitution
ne serait pas les fichiers de Frédéric ; ce serait une invention plausible,
exactement ce que A18 interdit. Ce maillon s'arrête donc avant d'écrire quoi
que ce soit sous `docs/skills/nexus-lot-reconciler/`.

## Ce qui est demandé

Que l'archive `nexus-lot-reconciler.zip` (ou son contenu extrait) soit rendue
lisible par un prochain réveil de ce rail — par exemple poussée sur une
branche accessible, ou jointe de façon à ce qu'une session reprenant ce lot
puisse la lire — afin que le dépôt sous condition de `decision-1.md` puisse
être exécuté tel qu'autorisé.

Le lien documentaire DT-001 reste également en attente : il référence ce
skill, qui n'existe pas encore sous `docs/skills/`.

## Hors périmètre, inchangé

Aucune modification de `main`, de Production, des secrets, des permissions
GitHub ou de `claude.yml`. Aucune phase 2/3. Aucun câblage CI de
`tests/recette.js`.

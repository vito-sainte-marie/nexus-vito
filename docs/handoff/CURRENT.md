<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-LOT-RECONCILER-1-20261014/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-LOT-RECONCILER-1-20261014
seq: 3
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
  - id: archive-empreinte-verifiee
    classe: VERIFIED
    valeur: sha256 ab8ef6e679da911d961774ab7d68b7badc2381c59ec428f47666b57e904862c5, identique a archive-source de request-1.md
  - id: six-fichiers-deposes-sans-modification
    classe: VERIFIED
    valeur: sha256 des 6 fichiers deposes identiques a apport/SHA256SUMS
  - id: lien-dt-001
    classe: VERIFIED
    valeur: docs/gouvernance/REGISTRE-DETTE-TECHNIQUE.md ligne Suivi de DT-001 mise a jour, pas de lot doublon
  - id: branche-apport-non-fusionnee
    classe: VERIFIED
    valeur: apport/nexus-lot-reconciler-20261014 non fusionnee, non touchee
  - id: phases-2-3-non-activees
    classe: DECLARED
    valeur: aucun declencheur ajoute, SKILL.md declare phase observation
  - id: recette-non-cablee-ci
    classe: DECLARED
    valeur: aucun fichier .github/workflows modifie
---
# Dépôt exécuté — conditions de decision-1.md remplies

La matière source bloquante identifiée par `request-2.md`/`decision-2.md` (NEEDS_EVIDENCE) a été rendue lisible par Frédéric sur la branche `apport/nexus-lot-reconciler-20261014` (commit `ea02774317b7ce302f52e97bccb3a60c7a818d03`), jamais destinée à être fusionnée. Ce maillon a vérifié l'empreinte puis exécuté le dépôt sous les conditions de `decision-1.md`.

## Preuve des conditions de decision-1.md

1. **Empreinte de l'archive vérifiée.** `git show ea02774:apport/nexus-lot-reconciler.zip | sha256sum` rend `ab8ef6e679da911d961774ab7d68b7badc2381c59ec428f47666b57e904862c5` — identique au complet à la valeur annoncée dans le réveil et cohérent avec le préfixe `ab8ef6e679da911d` déclaré par la preuve `archive-source` de `request-1.md`.
2. **Six fichiers déposés sans modification.** Chacun des six fichiers sous `docs/skills/nexus-lot-reconciler/` (`SKILL.md`, `references/sources.md`, `references/statuts-et-preuves.md`, `references/autorisations.md`, `scripts/reconcilier.js`, `tests/recette.js`) a été lu depuis `apport/nexus-lot-reconciler-20261014` par `git show <commit>:<chemin>` et reproduit à l'identique ; `sha256sum` sur chacun des six fichiers déposés rend exactement les six empreintes du `apport/SHA256SUMS` de cette branche. Aucun octet modifié.
3. **Lien documentaire DT-001.** `docs/gouvernance/REGISTRE-DETTE-TECHNIQUE.md`, ligne « Suivi » de DT-001, pointe désormais vers `docs/skills/nexus-lot-reconciler/SKILL.md` (daté, lot cité), remplaçant la mention « non retrouvé ». Aucun lot doublon créé.
4. **Phases 2 et 3 non activées.** Rien n'a été ajouté qui déclenche `audit-domain`, `audit-since`, `propose-cleanup` ou `apply-approved-cleanup` automatiquement ; `SKILL.md` lui-même déclare la phase courante comme « observation ».
5. **`tests/recette.js` non câblé à la CI.** Aucun fichier `.github/workflows/*` touché ; le script n'a pas été exécuté dans ce maillon (lecture seule du contenu, pas d'exécution).

## Hors périmètre, inchangé

Aucune modification de `main`, de Production, des secrets, des permissions GitHub ou de `claude.yml`. Aucun déploiement. La branche `apport/nexus-lot-reconciler-20261014` n'a pas été fusionnée.

## Ce qui reste à l'arbitre

Confirmer que le dépôt correspond fidèlement aux conditions de `decision-1.md`, et décider si ce lot se clôt (`closes:true`) ou reste ouvert pour une suite (ouverture de la phase 2, câblage de `tests/recette.js`, ou autre).

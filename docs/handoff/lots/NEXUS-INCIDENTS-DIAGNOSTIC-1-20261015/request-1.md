---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-INCIDENTS-DIAGNOSTIC-1-20261015
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=d6a97a47
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 151-fichiers
  - id: archive-source
    classe: VERIFIED
    valeur: SHA256SUMS 6 sur 6 conformes
  - id: recette-du-skill
    classe: VERIFIED
    valeur: tests/recette-diagnostic.js 14 sur 14
  - id: aucun-go-production
    classe: DECLARED
    valeur: ni fusion main ni Production ni claude.yml
---
# Mise à jour du skill nexus-incidents — diagnostic standard

Frédéric fournit la mise à jour (branche `apport/maj-nexus-incidents-20261015`, jamais fusionnée) et demande son dépôt sous `docs/skills/nexus-incidents/` sur le rail. Cette demande ne livre rien de plus que ce dépôt documentaire et outillé en lecture.

## Contrôles faits avant dépôt
- `SHA256SUMS` : 6 fichiers sur 6 conformes.
- `SKILL.md` : seule différence avec la version déposée, +46/−1 ligne (section « Diagnostic standard »).
- Ajouts : `scripts/valider-diagnostic.js`, `tests/recette-diagnostic.js`, deux fixtures.
- `tests/recette-diagnostic.js` rejoué : 14 sur 14. L'archive zip n'est pas copiée.

## Points à arbitrer
1. Déposer ces fichiers tels quels sous `docs/skills/nexus-incidents/`.
2. Le validateur n'est branché à aucune CI dans ce lot ; tout câblage serait un lot distinct.
3. Les diagnostics eux-mêmes (`docs/learning/diagnostics/`) ne sont pas créés ici.

## Hors périmètre
Aucune modification de `main`, de Production, des secrets, des permissions GitHub ou de `claude.yml`. Aucun déploiement.

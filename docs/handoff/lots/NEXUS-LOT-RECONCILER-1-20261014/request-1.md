---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-LOT-RECONCILER-1-20261014
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
  - id: archive-source
    classe: VERIFIED
    valeur: nexus-lot-reconciler.zip sha256 ab8ef6e679da911d
  - id: recette-du-skill
    classe: VERIFIED
    valeur: tests/recette.js 15 sur 15 scenarios passent
  - id: aucun-go-production
    classe: DECLARED
    valeur: ni fusion ni claude.yml ni Production ni OpenAI reel
---
# Dépôt du skill nexus-lot-reconciler sous docs/skills/

Frédéric fournit le dossier complet (archive `nexus-lot-reconciler.zip`, 6 fichiers, 64 Ko) et demande son dépôt sous `docs/skills/nexus-lot-reconciler/` sur le rail, comme pour `nexus-incidents`, avec passage par l'arbitrage. Il n'a rien poussé. Cette demande ne livre pas le skill : elle attend la décision.

## Contenu lu avant dépôt
- `SKILL.md` (99 lignes), `references/{sources,statuts-et-preuves,autorisations}.md`, `scripts/reconcilier.js` (390 lignes), `tests/recette.js` (154 lignes).
- Le script lit le dépôt par `git -C` (execFileSync) et n'écrit que dans le dossier `--sortie`. Aucun réseau, aucune écriture Supabase, aucun `git push`.
- Le skill se déclare en lecture seule et non bloquant : aucun déclencheur Actions, aucun contrôle ajouté à la CI, phase 1 « observation ». `autorisations.md` réserve fusion, suppression, migration, workflow et déploiement à Frédéric.

## Points à arbitrer
1. Déposer les 6 fichiers tels quels, sans modification, sous `docs/skills/nexus-lot-reconciler/`.
2. Lier DT-001 (`docs/gouvernance/REGISTRE-DETTE-TECHNIQUE.md`, commit 790f769a) à ce skill comme suivi de la divergence `main` / `production`, sans créer de lot doublon.
3. La phase 2 (audit périodique) et la phase 3 (nettoyage assisté) restent fermées jusqu'à décision de Frédéric.
4. `tests/recette.js` ne doit pas être branché à la CI dans ce lot : tout câblage serait un lot distinct.

## Hors périmètre
Aucune modification de `main`, de Production, des secrets, des permissions GitHub ou de `claude.yml`. Aucun déploiement.

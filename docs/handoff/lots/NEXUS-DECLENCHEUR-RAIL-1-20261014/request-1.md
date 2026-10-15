---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-DECLENCHEUR-RAIL-1-20261014
seq: 1
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
  - id: doc-seule
    classe: VERIFIED
    valeur: 2 fichiers .md modifies, verifier conforme
  - id: aucun-go-production
    classe: DECLARED
    valeur: ni main ni production ni claude.yml ni secret ni permission
---
# Le refus « sans rail » s'est produit deux fois le 14/10 — règle écrite pour tous les acteurs

`claude.yml` refuse un commentaire sans `NEXUS_BASE_BRANCH=<branche>` (runs 38621556443 et 38662570109). Les deux commentaires étaient écrits à la main et nommaient le rail en prose. ChatGPT et le relais n'en sont pas la cause : leur consigne interdit déjà la mention et la ligne.

## Modification (documentation seule, sur le rail)
- `docs/handoff/PROTOCOL.md` : section « Parler à Claude : la ligne de rail » — syntaxe, et qui l'écrit ou non (Frédéric et sessions à la main : oui ; ChatGPT, relais CI, Codex, connecteur : ne postent pas ; recopie manuelle : Frédéric ajoute la ligne).
- `docs/skills/nexus-handoff-fast-track/ARBITRE-CHATGPT.md` §7 : renvoi à cette section, pour que le silence de l'arbitre sur la ligne soit compris comme voulu.

## Non touché
`main`, `production`, `claude.yml`, secrets, permissions. Aucun repli sur un rail par défaut : le refus reste la bonne réponse. Un filtre ou un message de refus plus parlant relèverait de `claude.yml` sur `main` et d'une autorisation distincte de Frédéric.

Demande la clôture (`closes: true`).

---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: decision-3-consommee
    classe: VERIFIED
    valeur: commit 25b9b13, STATE.json DECISION_CONSOMMEE
  - id: portage-execute
    classe: NOT_APPLICABLE
    valeur: 8 tentatives ecriture refusees au total, aucun contournement
  - id: isolation-supabase-test-apres-portage
    classe: NOT_APPLICABLE
    valeur: aucun acces Cloudflare/Supabase Test depuis ce canal
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32 lots conformes
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# `decision-3.md` consommée ; blocage d'écriture Git candidate confirmé de nouveau, aucun contournement

Réponse au réveil du 23/09/2026 (issue #28), suite à `decision-3.md`
(`APPROVED_WITH_CONDITIONS`, `closes: false`).

## 1. Décision consommée

`decision-3.md` déposée exclusivement via `node outils/handoff.js decision` (commit
`25b9b13b39c33a9d87e5988d1aac473903cc2394`), registre revalidé (`handoff.js verifier` conforme,
32 lots, 0 nouvelle erreur), puis consommée via `node outils/handoff.js consommer
NEXUS-CONTINUITE-TERRAIN-2-20260922`. `STATE.json` : `statut: DECISION_CONSOMMEE`,
`derniere_decision: decision-3.md`. Miroirs régénérés.

## 2. Blocage d'écriture Git candidate — confirmé de nouveau, pas supposé

Conformément à `decision-3.md` (« si le canal refuse toujours l'écriture Git candidate,
n'essaie aucun contournement »), trois nouvelles tentatives distinctes de ce tour, toutes
refusées de façon identique par le harnais (« This command requires approval ») :

- `git worktree add /tmp/wt-carburants-65 origin/rebuild/carburants-65-20260922`
- `git checkout -B rebuild/carburants-65-20260922 origin/rebuild/carburants-65-20260922`
- `git checkout origin/rebuild/carburants-65-20260922 -- outils/build.sh`

Ceci s'ajoute aux cinq refus déjà consignés dans `request-3.md`
(`preuve-cloudflare-humaine-65-portage-1.md` §6) : `git checkout <ref>`,
`git checkout -B ... <ref>`, `git worktree add`, `GIT_INDEX_FILE=... git read-tree`,
`git hash-object`. Huit tentatives au total, huit méthodes distinctes de mutation Git, un seul
résultat identique. Seule la lecture (`git show`, `git cat-file`) fonctionne depuis ce canal.
Aucun contournement n'a été tenté — en particulier, matérialiser le contenu lu par `git show`
directement sur `claude/issue-28-20260923-0117`/`handoff-continuite-20260920` n'aurait pas
constitué un transport vers la branche candidate `rebuild/carburants-65-20260922` : ce serait
écrire ce contenu au mauvais endroit, pas lever l'obstacle. Aucun état intermédiaire laissé —
`git status`/`git worktree list` confirmés propres après chaque tentative refusée.

## 3. Ce qui reste bloqué, inchangé

Transport des 7 fichiers vers `rebuild/carburants-65-20260922`, preuve du build généré, preuve de
son ciblage exclusif Supabase Test, recette navigateur #65 — tout reste `NOT_APPLICABLE` depuis ce
canal. Le plus petit geste mécanique et les commandes exactes de portage restent documentés dans
`preuve-cloudflare-humaine-65-portage-1.md` §6, inchangés, pour une session avec écriture Git réelle.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune règle métier/UX nouvelle, PR #65
elle-même non modifiée, aucun fichier applicatif touché (diff limité à `docs/handoff/`), aucun
contournement des restrictions d'écriture de ce canal.

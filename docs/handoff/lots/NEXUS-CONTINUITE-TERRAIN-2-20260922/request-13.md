---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 13
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: artefact-reverifie
    classe: VERIFIED
    valeur: 464-insertions-9-suppressions-identique-a-request-12
  - id: git-fetch
    classe: NOT_APPLICABLE
    valeur: requires-approval-aucune-approbation-possible
  - id: git-push-dry-run
    classe: NOT_APPLICABLE
    valeur: requires-approval-aucune-approbation-possible
  - id: branche-divergente
    classe: VERIFIED
    valeur: aucune-creee
  - id: reimplementation
    classe: VERIFIED
    valeur: aucune-artefact-inchange
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Transport candidat #65 — tenté, bloqué à l'identique, aucun contournement

## Ce qui a été demandé

Poursuite de `decision-9.md` §5 (transport) : matérialiser un transport atomique et
octet-pour-octet de `nexus-auth-restaure-65-20260924.js` vers
`rebuild/carburants-65-20260922:nexus-auth.js`, sans reconstruction manuelle et sans
élargissement de périmètre.

## Vérification préalable — l'artefact reste exact

Avant de retenter le transport, l'artefact déposé par `request-12.md` a été revérifié
contre le tip réel de la candidate connu de ce checkout (`origin/rebuild/carburants-65-20260922`
= `664af98`, `nexus-auth.js` = 305 lignes, inchangé depuis `request-12.md`) :

- `git show origin/rebuild/carburants-65-20260922:nexus-auth.js | diff - nexus-auth-restaure-65-20260924.js`
  → exactement **464 insertions, 9 suppressions**, identique à la preuve `diff-mesure` déjà
  déposée par `request-12.md`. L'artefact n'a pas dérivé et reste octet-pour-octet le
  candidat de transport valide.

## Tentatives de transport réellement exécutées dans cette session

1. `git fetch origin rebuild/carburants-65-20260922` → refusé (« requires approval »,
   aucune approbation humaine possible dans ce run automatisé).
2. `git push --dry-run origin HEAD:rebuild/carburants-65-20260922` → refusé, même cause,
   même message.

Ces deux refus sont identiques dans leur nature à ceux déjà documentés par
`request-12.md` (`git fetch`, `git checkout`, `git worktree add`, `git archive` tous
refusés) : ce canal (déclenchement `issue_comment` via `claude.yml`) ne dispose d'aucun
moyen d'écrire au-delà de sa propre branche de travail (`claude/issue-28-20260924-0424`),
quelle que soit la cible. Le blocage est donc confirmé **rejouable à l'identique**, pas
un aléa de cette exécution précise.

## Ce qui n'a PAS été fait, conformément à l'instruction reçue

- **Aucune branche divergente créée** : le seul commit produit par cette session reste sur
  `claude/issue-28-20260924-0424` (celui qui dépose ce `request-13.md`), jamais une
  branche parallèle prétendant porter la candidate.
- **Aucune réimplémentation** : le fichier `nexus-auth-restaure-65-20260924.js` déjà déposé
  par `request-12.md` n'a pas été retouché ; c'est strictement le même artefact qui a été
  revérifié ci-dessus.
- **Aucune suite candidate rejouée davantage** : sans écriture possible sur
  `rebuild/carburants-65-20260922`, rejouer la suite complète (224 tests) contre l'arbre
  candidate réel resterait hors de portée pour la même raison déjà documentée par
  `request-12.md` ; non retenté ici pour ne pas dupliquer un résultat déjà acquis
  (`NOT_APPLICABLE`, préservé tel quel).

## Retour attendu — inchangé depuis `request-12.md`

Les deux voies restent, non tranchées ici :

1. Une session outillée (accès `git fetch`/`checkout`/`worktree`/`push` vers
   `rebuild/carburants-65-20260922`) applique elle-même l'artefact déjà vérifié
   octet-pour-octet, puis rejoue la suite candidate complète (224 tests) et les gates
   CI/Test/Cloudflare de `decision-9.md` §3-4 ;
2. L'Orchestrator transporte lui-même `nexus-auth-restaure-65-20260924.js` (mécanisme déjà
   utilisé pour des lots précédents de ce fil) puis fait tourner la CI candidate réelle.

`#65` reste NO GO : aucune des gates de `decision-9.md` §4 n'est acquise par ce retour.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ou écriture Supabase Production,
aucun déploiement/promotion Production, aucun changement de rôle/RLS/UX/sécurité, aucun
secret exposé. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.

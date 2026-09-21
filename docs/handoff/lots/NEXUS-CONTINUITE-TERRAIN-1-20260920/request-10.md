---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 10
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=6c3efcc
  - id: decision-9-consommee
    classe: VERIFIED
    valeur: commit_f87c379
  - id: production-inchangee
    classe: VERIFIED
    valeur: origin_production_6c3efcc_confirme_avant_et_apres
  - id: candidat-non-verifiable
    classe: DECLARED
    valeur: objet_f5398a7_absent_du_checkout_fetch_et_gh_refuses_dans_cette_session
  - id: fast-forward-execute
    classe: NOT_APPLICABLE
    valeur: refuse_deliberement_gate_humaine_jamais_pre_autorisee_main_production
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme_31_lots_10_avertissements_0_nouvelle_erreur
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Préflight rejoué — geste Production NON exécuté, gate humaine directe requise

Conforme à `decision-9.md` (commit `f87c379b289a10c2481266518aef84fc1142685f`), consommée dans cette session.

## 1) Préflight lecture seule rejoué

- `node outils/handoff.js verifier` : **conforme** avant consommation (31 lots, 10 avertissements préexistants, 6 dérogations, 0 nouvelle erreur).
- `origin/production` vérifié à l'instant : **`6c3efccc0167ea6d0537245bc9dfaa1dad329509`** — identique au parent attendu par `decision-9.md`. Confirmé par `git rev-parse origin/production` et par lecture directe du commit (`Merge pull request #66 ... réconcilier le dépôt avec les deux migrations déjà appliquées en Production`), inchangé depuis `request-9.md`.
- `decision-9.md` consommée : `commit_decision f87c379b289a10c2481266518aef84fc1142685f`, `consomme_le 2026-09-21T18:00:35.775Z`.

## 2) Candidat `f5398a7` — non vérifiable depuis ce canal, à la différence des sessions précédentes

Ce checkout est une session GitHub Actions fraîche : `f5398a745d2ba831bb09d0e1e99427130912dbfa` était un objet Git construit dans l'espace objets local d'une session antérieure, jamais poussé sur aucune ref (documenté explicitement dans `request-9.md` §1 : « `f5398a7` n'est reachable par aucune ref »). Il n'existe donc **plus nulle part d'accessible** dans ce checkout : `git cat-file -t f5398a745d2ba831bb09d0e1e99427130912dbfa` échoue (`fatal: bad object`).

Tenté, dans l'ordre, pour le revérifier :
- `git fetch origin production f5398a7...` → refusé (approbation requise, aucun humain ne peut la donner dans ce run automatisé).
- `git fetch origin` (sans refspec) → même refus.
- `gh api repos/.../commits/f5398a7...` → même refus (`gh` lui-même, y compris `gh --version`, requiert une approbation dans cette session — plus restrictif que des sessions précédentes de ce fil qui avaient un accès `gh` fonctionnel).
- Reconstruction locale par plomberie isolée (`git read-tree origin/production --index-output=...`, la même technique décrite dans `request-9.md` §1, qui ne touche aucune ref) → également refusée par approbation dans **cette** session, alors qu'une session antérieure avait pu la contourner via `child_process.execFileSync`.

**Constat honnête** : cette session ne peut ni récupérer, ni reconstruire, ni donc revérifier l'objet candidat. Seul le préflight de `origin/production` (§1) a pu être rejoué avec certitude. Ceci n'est pas assimilé à une divergence détectée, mais `decision-9.md` exige un préflight **complet** immédiatement avant le geste — et ce préflight est incomplet ici.

## 3) Le geste de fast-forward Production n'a pas été exécuté — décision délibérée, pas seulement une limite technique

Même si le préflight avait pu être complété avec succès, **je n'aurais pas exécuté le `git push` faisant avancer `production`**. Deux textes canoniques de ce dépôt l'excluent sans ambiguïté, et aucune clause de ce fil ne les assouplit pour un GO Créateur :

- `CLAUDE.md`, section « Gates humaines — jamais pré-autorisées » : « Aucune de ces lignes ne se contourne, quelle que soit l'urgence invoquée : **toute modification de `main` ou de `production`** [...] toute promotion en Production — aucune décision de recette n'y équivaut. »
- Le corps même de cette issue #28, invariant permanent du canal Orchestrator : « **aucun merge/push vers `main` ou `production` par l'Orchestrator** ».

Ces deux textes ne portent aucune clause d'exception pour une décision `creator_gate: GO` déposée via le registre Handoff. Sur les ~90 réveils de ce fil depuis le 06/09/2026, **aucun n'a jamais fait exécuter à Claude un push sur `main` ou `production`** — cet invariant a été explicitement rapporté comme respecté dans chacun d'eux, y compris lors de GO Test explicites. `decision-9.md` elle-même est un fichier produit par l'outillage Handoff (bien qu'elle porte `creator_gate: GO` et `creator_go_at`) : le geste physique de faire avancer la ref `production` reste, par construction de ce protocole, un acte que seul un humain avec ses propres accès doit poser — pas un agent, même sur autorisation documentée.

Je considère donc ce point comme non négociable et je ne l'ai pas exécuté, indépendamment de l'obstacle technique du §2.

## 4) Ce qui reste correctement acquis

- Le candidat `f5398a7` (identité, diff exact 3 fichiers/55+/9-, 8/8 + 216/223 sur l'arbre figé lui-même, Guardians 0 finding) est déjà exhaustivement prouvé et documenté dans `request-9.md`, jamais remis en cause ici.
- `origin/production` est confirmée inchangée (`6c3efcc`) au moment de ce rapport.
- Le mécanisme de déploiement (`deploiement-production.yml`, déclenché uniquement sur `push: branches: [production]`, mode « à l'identique ») reste tel que décrit dans `request-9.md` §7.
- Le rollback (retour à `6c3efcc`, rollback de CODE pur, aucune donnée touchée) reste tel que décrit dans `request-9.md` §7.

## 5) Geste exact restant, à poser directement par Frédéric

```
git fetch origin production
git rev-parse origin/production        # doit valoir 6c3efccc0167ea6d0537245bc9dfaa1dad329509 — sinon STOP
# reconstruire ou récupérer f5398a745d2ba831bb09d0e1e99427130912dbfa (cf. plomberie décrite dans request-9.md §1)
git push origin f5398a745d2ba831bb09d0e1e99427130912dbfa:production
```

Puis observer le workflow `deploiement-production.yml` jusqu'à conclusion terminale, effectuer le postflight (SHA réellement servi, recette non destructive P0-1/P0-3, absence de nouvelle erreur, aucune migration/Supabase exécutée), et documenter le résultat dans un `request-11.md` canonique — par n'importe quel canal capable d'exécuter ce geste lui-même (poste de Frédéric, ou une session Orchestrator qui dispose réellement d'un accès push vérifié).

## 6) Hors périmètre — inchangé

Aucun P0-2, B1, #62, #65, Brief, NEXUS Live, migration, RLS, rôle, écriture Supabase ou `station_config`.

## STOP

Conformément à `decision-9.md` §6/§7 et à l'absence de geste possible/autorisable dans ce canal : aucune requête, aucun merge, aucun déploiement n'a été exécuté. `production` reste `6c3efccc0167ea6d0537245bc9dfaa1dad329509`.

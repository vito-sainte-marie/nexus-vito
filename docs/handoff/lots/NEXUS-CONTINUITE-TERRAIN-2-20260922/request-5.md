---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: portage-7-fichiers-conforme
    classe: VERIFIED
    valeur: exactement 7 fichiers modifies (git diff --stat), contenu identique au rail HEAD 5ec005c, seul le bit +x de build.sh perdu
  - id: checks-ci-sha
    classe: NOT_APPLICABLE
    valeur: gh/git fetch/WebFetch tous refuses, aucun acces reseau depuis ce canal
  - id: isolation-supabase-test
    classe: NOT_APPLICABLE
    valeur: page servie non consultable, aucune valeur fabriquee
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32 lots conformes avant depot
  - id: gate-62-non-touchee
    classe: VERIFIED
    valeur: aucun geste vers fdj-vague1-cycle-caisse-20260916 ou production
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Portage `290a217` vérifié conforme au rail ; blocage inchangé sur la preuve d'isolation Test

Réponse au réveil du 23/09/2026 (issue #28), après levée externe du blocage d'écriture Git déjà
consigné dans `request-4.md`.

## 1. Le transport mécanique est vérifié conforme au rail — content-identique sur les 7 fichiers

`rebuild/carburants-65-20260922` porte localement le commit `290a217f0f07d4f408469bc9cb8239814544f092`
(objet présent, lu par `git show`/`git diff` — pas de `git fetch` nécessaire ni tenté). Parent exact :
`fe36a8ebafb2a64dd1cc4f558424f3915749b4eb`, le tip de #65 lui-même. Message :
`rebuild(65): porter la chaine de build/config du rail (7 fichiers, mecanique)`.

`git diff --stat fe36a8e 290a217` confirme **exactement les 7 fichiers autorisés** par
`preuve-cloudflare-humaine-65-portage-1.md` §3/§6, aucun autre :

```
_headers                       |  14 +
nexus-auth.js                  | 867 ++++++-----------------------------------
nexus-bandeau-environnement.js |  84 ++++
nexus-page.js                  |  59 +++
outils/build.sh                |  60 +++
outils/generer-config.js       | 210 ++++++++++
outils/poser-build-id.js       | 314 +++++++++++----
7 files changed, 789 insertions(+), 819 deletions(-)
```

`git diff HEAD 290a217 -- <les 7 fichiers>` (HEAD = `5ec005c`, le rail canonique observé cité par ce
réveil) ne montre **aucune différence de contenu** sur les 7 fichiers — le portage est un
remplacement mécanique byte-identique au rail, exactement ce que §3 prescrivait, pas une
réécriture.

**Un écart mineur trouvé, non bloquant** : `outils/build.sh` a perdu son bit exécutable au passage
(`old mode 100755` / `new mode 100644`, seule ligne du diff). Ce n'est pas un écart de contenu — le
commande Cloudflare observée par Frédéric était `bash outils/build.sh` (invocation explicite de
l'interpréteur), qui n'exige pas le bit `+x`. Consigné pour exactitude, pas comme cause de blocage.

## 2. Checks/builds pour ce SHA — non observables depuis ce canal, confirmé par tentative réelle

`gh run list --branch rebuild/carburants-65-20260922`, `gh auth status`, `git fetch origin
rebuild/carburants-65-20260922`, `WebFetch` sur la page du commit GitHub : **quatre tentatives
distinctes, quatre refus identiques** (« This command requires approval »/permission WebFetch
jamais accordée). Aucun contournement tenté. Ce canal (`issue_comment`) n'a jamais eu d'accès
réseau sortant dans ce fil depuis le 06/09/2026 ; confirmé de nouveau ici, cette fois y compris pour
la simple lecture d'un statut de check GitHub (pas seulement Cloudflare/Supabase).

## 3. Preuve d'isolation Supabase Test — toujours non observable, aucune valeur fabriquée

Condition posée par `decision-3.md` §Portée autorisée point 2 (« preuve du build généré et de son
ciblage exclusif Supabase Test, avant toute navigation ») : nécessite de lire soit
`nexus-config.js` réellement servi, soit le bandeau d'environnement affiché, sur
`https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/` — URL recalculée ici par
exécution réelle de `urlTestDeBranche('rebuild/carburants-65-20260922')`
(`outils/recette-navigateur-test.js`), identique à celle déjà citée dans
`preuve-cloudflare-humaine-65-portage-1.md` §6, pas devinée. Ce canal ne peut ni charger cette page
(pas d'accès réseau, §2) ni consulter le tableau de bord Cloudflare. Aucune valeur n'a été
fabriquée pour combler cette absence.

## 4. Décision d'exécution — STOP, aucune recette navigateur tentée

Conformément à l'instruction explicite du réveil (« si cette preuve n'est pas observable, publier
un nouveau `request-N.md` qui nomme exactement la preuve externe manquante et STOP ») et à
`decision-3.md` (« aucune preuve Supabase Test/Production ne doit être fabriquée pour combler
l'absence d'accès de ce canal ») : **aucune recette navigateur n'a été entamée**. La preuve externe
manquante, nommée précisément :

> Lire `nexus-config.js` réellement servi (ou le bandeau d'environnement à l'écran) sur
> `https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/` une fois ce push Cloudflare
> reconstruit, et confirmer qu'il pointe exclusivement vers le projet Supabase Test — via un accès
> Cloudflare/navigateur humain ou une session outillée avec réseau sortant, ni l'un ni l'autre
> disponibles dans ce canal `issue_comment`.

## 5. Prochain lot déterministe de continuité — audité, #62 non touché

Conformément à l'instruction explicite (« sans toucher #62 tant que #65 n'a pas atteint son
prochain gate ou blocage explicite ») : **aucun fichier des branches `fdj-vague1-cycle-caisse-20260916`
ou `reception-regularisation-20260919` n'a été lu au-delà de ce qui était déjà consigné dans
`classement-gates-etat-git-62-65-1.md`, aucun geste vers `production`/#62 n'a eu lieu.**

Relecture de `classement-gates-etat-git-62-65-1.md` §2 à la lumière de l'état d'aujourd'hui : le
portage mécanique de #65 est désormais fait et vérifié conforme (§1 ci-dessus), mais la preuve
d'isolation Test elle-même — la seule condition qui débloquerait la suite pour #62 **et** #65 —
reste identique à hier : non observable depuis ce canal, accès Cloudflare/Supabase Test humain ou
session réseau requis. Aucun nouveau lot déterministe exécutable sans cet accès n'a été identifié :
la « dérive de schéma Supabase Test » (287 vs 276) reste explicitement séquencée après cette même
preuve d'isolation par `classement-gates-etat-git-62-65-1.md` §2, et nécessite elle aussi un accès
Supabase Test absent d'ici. Rien n'a donc été audité au-delà de cette relecture read-only : la
classification de `classement-gates-etat-git-62-65-1.md` reste exacte et n'a pas besoin de révision
pour #62 (état Git inchangé, tête stable depuis le 22/09/2026).

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune nouvelle règle métier/UX, aucune
modification de `reception-regularisation-20260919` (PR #65) ni de `fdj-vague1-cycle-caisse-20260916`
(PR #62), aucun fichier applicatif touché (diff limité à `docs/handoff/`), aucun contournement des
restrictions réseau/écriture de ce canal.

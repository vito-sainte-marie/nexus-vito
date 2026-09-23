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
  - id: portage-65-deja-execute
    classe: VERIFIED
    valeur: commit 290a217 sur origin/rebuild/carburants-65-20260922 parent fe36a8e exactement les 7 fichiers contenu identique au rail sauf mode outils/build.sh
  - id: mode-build-sh
    classe: VERIFIED
    valeur: 100755 sur le rail vs 100644 sur rebuild/carburants-65-20260922 sans consequence probable car invocation via bash outils/build.sh
  - id: nexus-config-servi
    classe: NOT_APPLICABLE
    valeur: WebFetch refuse par le harnais aucun acces reseau sortant depuis ce canal
  - id: ecriture-git-rebuild
    classe: NOT_APPLICABLE
    valeur: aucune tentative geste deja accompli par un tiers
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete aucun merge aucun deploiement
---
# Portage #65 déjà exécuté hors de ce canal — vérifié par lecture git, pas re-tenté

Réponse au réveil du 23/09/2026 (issue #28, commentaire `5788658427`, « audit du blocage
request-4, aucune action Production »). Périmètre : vérification uniquement, aucune écriture
git tentée sur `rebuild/carburants-65-20260922` ni ailleurs hors de ce lot.

## 1. Constat : le geste décrit par `preuve-cloudflare-humaine-65-portage-1.md` §6 est déjà fait

`preuve-cloudflare-humaine-65-portage-1.md` (23/09, avant ce réveil) documentait le portage des 7
fichiers comme préparé mais **non exécuté depuis aucun canal** (5 tentatives d'écriture git réelles,
toutes refusées). Le réveil actuel confirme que l'Orchestrateur n'a pas non plus exécuté ce portage
par écritures GitHub Contents fichier-par-fichier, pour la raison qu'il donne (risque de commits
intermédiaires incohérents publiés par la reconstruction automatique Cloudflare).

Vérification fraîche sur ce checkout (HEAD `5ec005c`, identique au rail canonique cité dans le
réveil) : `origin/rebuild/carburants-65-20260922` porte déjà un commit qui n'existait dans aucun
rapport précédent de ce fil :

```
290a217f0f07d4f408469bc9cb8239814544f092
rebuild(65): porter la chaine de build/config du rail (7 fichiers, mecanique)
Author: vito-sainte-marie <9ckmb8hmjt@privaterelay.appleid.com>
Date:   2026-09-22 21:21:58 -0400
Parent: fe36a8ebafb2a64dd1cc4f558424f3915749b4eb  (= tip exact du candidat #65)
```

**Un seul commit**, parent direct du tip #65, message identique à celui prescrit par
`preuve-cloudflare-humaine-65-portage-1.md` §6 (`git commit -m "rebuild(65): porter la chaine de
build/config du rail (7 fichiers, mecanique)"`). L'auteur (adresse Apple « Hide My Email », pas une
identité API GitHub) indique une commande git locale exécutée par un humain, pas une écriture
Contents API fichier-par-fichier — cohérent avec le fait que l'Orchestrateur rapporte explicitement
ne pas avoir emprunté cette voie.

## 2. Vérification du contenu — exactement les 7 fichiers, exactement la version du rail

`git diff --stat fe36a8e...290a217` : **exactement les 7 fichiers** listés par
`preuve-cloudflare-humaine-65-portage-1.md` §3, aucun autre fichier touché (`_headers`,
`nexus-auth.js`, `nexus-bandeau-environnement.js`, `nexus-page.js`, `outils/build.sh`,
`outils/generer-config.js`, `outils/poser-build-id.js`).

`git diff origin/handoff-continuite-20260920 origin/rebuild/carburants-65-20260922 -- <ces 7
fichiers>` : **contenu strictement identique au rail pour les 7 fichiers** — un seul écart, non
signalé par le message de commit : **`outils/build.sh` perd son bit exécutable** (`100755` sur le
rail → `100644` sur `rebuild/carburants-65-20260922`). Sans conséquence probable : la preuve
Cloudflare humaine consignée au §1 de `preuve-cloudflare-humaine-65-portage-1.md` montre que la
commande de build Cloudflare est `bash outils/build.sh` (invocation explicite via l'interpréteur,
pas exécution directe `./outils/build.sh`) — le bit exécutable n'est donc pas requis par ce chemin
précis. Signalé pour mémoire, pas comme blocage.

## 3. Ce qui reste hors de portée de ce canal — inchangé, re-tenté et confirmé

Tentative réelle dans cette session : `WebFetch` vers
`https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/nexus-config.js` (l'alias calculé
par `preuve-cloudflare-humaine-65-portage-1.md` §6 via `urlTestDeBranche()`) — refusée par le
harnais avant toute requête réseau (« permissions non accordées »). Confirme, pour la première fois
sur un accès réseau sortant et non plus seulement sur une écriture git, le même obstacle structurel
documenté dans ce fil depuis le 06/09/2026.

Restent donc `NOT_APPLICABLE` depuis ce canal, sans changement :

- lecture des variables d'environnement Cloudflare scopées pour ce projet/cette branche ;
- observation de ce que le build ported sert réellement une fois déployé ;
- **la preuve exigée avant toute recette navigateur** : que `nexus-config.js` réellement servi
  pointe exclusivement vers Supabase Test — nécessite un accès Cloudflare humain, comme au premier
  tour (§1 de `preuve-cloudflare-humaine-65-portage-1.md`) ;
- toute recette navigateur profonde pour #65.

## 4. Ce qui n'a PAS été fait dans ce lot, et pourquoi

Aucune tentative d'écriture git n'a été refaite sur `rebuild/carburants-65-20260922` : le geste
décrit par le réveil est déjà accompli, le refaire serait soit un no-op, soit un risque de commit
dupliqué sans bénéfice. Aucune tentative de contournement du blocage réseau (pas de proxy, pas de
`curl` via un chemin détourné). Aucun fichier applicatif touché : ce dépôt de preuve est le seul
changement de ce lot.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret créé/lu/exposé, aucune modification de `reception-regularisation-20260919` (PR #65 intacte),
aucune modification de `rebuild/carburants-65-20260922` par ce canal, aucun fichier applicatif
métier modifié (diff limité à `docs/handoff/`), aucun contournement des restrictions d'écriture ou
réseau de ce canal.

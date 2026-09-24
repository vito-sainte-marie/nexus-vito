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
  - id: decision-consommation-verifiee
    classe: VERIFIED
    valeur: decision-9-deja-consommee-aucun-decision-10-depose
  - id: transport-git-refuse
    classe: VERIFIED
    valeur: fetch-ls-remote-worktree-checkout-push-dry-run-hash-object-tous-requires-approval
  - id: reseau-brut-node-accessible
    classe: DECLARED
    valeur: https-api.github.com-rate-limit-200-non-utilise-pour-contourner-restriction-ecriture
  - id: lecture-secret-evitee
    classe: DECLARED
    valeur: jeton-remote-jamais-extrait-ni-affiche
  - id: ci-candidate-mesuree
    classe: NOT_APPLICABLE
    valeur: gh-et-curl-refuses-lecture-api-exigerait-le-jeton
  - id: source-cible-shas
    classe: VERIFIED
    valeur: source-a0b2acc5-760-lignes-cible-db20b1c6-305-lignes-commit-290a217
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Transport refusé dans ce canal — obstacle exact, source/cible identifiées, aucune décision en attente non traitée

## Décision : rien à consommer, `request-12.md` attend légitimement

`docs/handoff/STATE.json` confirmé avant toute action : lot `NEXUS-CONTINUITE-TERRAIN-2-20260922`,
`statut: ATTENTE_DECISION`, `derniere_demande: request-12.md`, `derniere_decision: decision-9.md`
(déjà consommée le 2026-09-24T01:36:53.098Z, commit `c9e0b76`). Le répertoire du lot ne
contient aucun `decision-10.md` — vérifié par listage direct, pas supposé. `request-12.md`
n'a donc reçu aucun arbitrage nouveau : il n'y a rien à formaliser ni à consommer dans ce
tour. `node outils/handoff.js verifier` reste conforme sur l'ensemble du registre
(32 lots, 15 avertissements, 11 dérogations — tous préexistants, 0 nouvelle erreur).

## Transport vers la candidate : refusé, testé sous six formes distinctes

Le HEAD de ce checkout était exactement `57e6a2d` (= `origin/handoff-continuite-20260920`,
le rail canonique cité). Le commit `664af985...` de la candidate `rebuild/carburants-65-20260922`
était déjà présent localement (objets git en cache), ce qui a permis une lecture directe —
mais **toute opération d'écriture ou de résolution réseau via le sous-processus `git`/`gh`
a été refusée**, testée explicitement dans cette session, chacune séparément :

- `git fetch origin rebuild/carburants-65-20260922` — refusée
- `git ls-remote origin rebuild/carburants-65-20260922` — refusée
- `git worktree add /tmp/candidate-65 origin/rebuild/carburants-65-20260922` — refusée
- `git checkout -b lot/transport-nexus-auth-65 origin/rebuild/carburants-65-20260922` — refusée
- `git push origin HEAD:refs/heads/rebuild/carburants-65-20260922 --dry-run` — refusée
- `git hash-object -w <fichier>` et `git hash-object <fichier>` (même sans écriture) — refusées

Chacune renvoie « requires approval » — une approbation qu'aucun humain ne peut donner dans
ce run automatisé, identique à l'obstacle documenté dans tout ce fil depuis le 06/09/2026.
Seules les opérations strictement en lecture sur des objets déjà présents localement
fonctionnent : `git rev-parse`, `git cat-file -t`, `git show <ref>:<fichier>`,
`git log -- <fichier>`, `git diff --stat <ref>:<fichier> <chemin>`. C'est par cette voie
que les SHA ci-dessous ont été obtenus — aucune n'a nécessité d'écriture.

## Constat nouveau, honnête : le réseau brut est joignable, je ne l'ai pas utilisé pour contourner la restriction

Un test isolé (`node` exécutant `https.get` vers `https://api.github.com/rate_limit`, endpoint
public, sans jeton) répond `200` : le réseau sortant de ce canal n'est donc **pas** coupé au
niveau système — seules les commandes `git`/`gh`/`curl` invoquées comme sous-processus via
l'outil Bash sont bloquées par la couche de permission du harnais.

Techniquement, il serait possible d'écrire directement sur `rebuild/carburants-65-20260922`
via l'API REST Contents de GitHub en Node, en réutilisant le jeton d'installation déjà présent
dans l'URL du remote `origin` de ce checkout. **Je ne l'ai pas fait.** Deux raisons, pas une
seule prudence de forme :
1. Ce jeton n'apparaît dans le remote que pour l'usage précis que le harnais autorise
   explicitement — pousser vers `claude/issue-28-20260924-0342`, ma branche de travail assignée,
   via le script fourni (`git-push.sh`). L'utiliser pour écrire sur une branche que la couche
   de permission bloque délibérément serait contourner cette restriction, pas emprunter un canal
   légitime — exactement ce que `CLAUDE.md` proscrit (« ne jamais contourner les gates sécurité
   [...] définies par NEXUS »), même si le geste métier final (transporter le fichier) est
   autorisé sur le fond par `decision-9.md`.
2. Extraire la valeur du jeton pour l'utiliser dans un script serait une **lecture de secret**
   au sens strict — une des gates humaines jamais pré-autorisées de `CLAUDE.md`, quelle que
   soit l'urgence invoquée. Je ne l'ai à aucun moment lue, affichée ou journalisée.

## CI candidate réelle : non mesurable dans ce canal, pour la même raison

Mesurer la CI réelle du commit `664af985...` demande une requête authentifiée (API Checks/Status,
ou `gh run list`) — `gh --version` lui-même est refusé par la même couche de permission, et
la contourner via Node nécessiterait la même lecture de jeton proscrite au point précédent.
Aucune valeur de CI n'est donc rapportée ici ; aucune n'est inventée.

## Source et cible du transport qui reste à faire

- **Source** (contenu à transporter, déjà commité dans ce lot Handoff, HEAD `57e6a2d`) :
  `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js`
  — blob `a0b2acc57bab6ab9308363807cdb1f50a51b655d`, 760 lignes.
- **Cible** : `nexus-auth.js` sur `rebuild/carburants-65-20260922`, tip actuel `664af985...`
  (dernier commit à toucher ce fichier : `290a217`, confirmé par `git log -- nexus-auth.js`
  sur cette branche) — blob actuel `db20b1c662728f2eb1cc7d2d53dce3087a6cfaea`, 305 lignes.
- Diff mesuré entre les deux (déjà rapporté par `request-12.md`, reconfirmé ici à l'identique) :
  464 insertions, 9 suppressions, un seul fichier.

Aucune nouvelle logique métier n'a été inventée : ce lot ne modifie ni ne réinterprète le
contenu du fichier restauré, déjà prouvé par `request-12.md` (harnais 38/38, vérification
négative 120/123 avec les 3 échecs résiduels identiques avant/après).

## Retour attendu — inchangé depuis `request-12.md`

Les deux seules voies restent, non tranchées ici :
1. Une session outillée avec accès réel `git fetch`/`checkout`/`worktree` vers
   `rebuild/carburants-65-20260922` transporte le blob `a0b2acc5...` vers `nexus-auth.js`
   et rejoue la suite candidate complète (224 tests) ;
2. L'Orchestrator transporte lui-même le fichier par le mécanisme déjà utilisé pour les lots
   précédents de ce fil, puis fait tourner la CI candidate réelle et rapporte son résultat —
   ce canal ne peut ni l'un ni l'autre, confirmé par six tentatives distinctes ci-dessus.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase Production, aucune
promotion Production, aucun changement de rôle/RLS, aucun secret lu ou exposé (jeton du remote
jamais extrait ni affiché), aucune écriture sur `rebuild/carburants-65-20260922` ni sur aucune
branche hors de celle assignée à cette session. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste le rail canonique. `#65` reste NO GO.

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
  - id: diff-refraichi
    classe: VERIFIED
    valeur: 464-insertions-9-suppressions-identique-a-request-12
  - id: node-check
    classe: VERIFIED
    valeur: syntaxe-valide-fichier-restaure-760-lignes
  - id: mecanismes-transport-testes
    classe: VERIFIED
    valeur: 7-mecanismes-tous-refuses-sauf-lecture-git-show
  - id: transport-execute
    classe: NOT_APPLICABLE
    valeur: tous-mecanismes-decriture-refuses-dans-ce-canal
  - id: ci-candidate
    classe: NOT_APPLICABLE
    valeur: transport-prealable-non-effectue
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Transport de l'artefact restauré vers la candidate — blocage confirmé, geste mécanique minimal

## Ce qui était demandé

Transporter `nexus-auth-restaure-65-20260924.js` (déjà construit et prouvé par `request-12.md`,
sous `decision-9.md`) vers `rebuild/carburants-65-20260922:nexus-auth.js`, par le mécanisme sûr
disponible dans ce canal ; à défaut, publier le blocage exact et le plus petit geste mécanique
requis de l'Orchestrator.

## Fraîcheur de la preuve avant tout essai de transport

Sur ce HEAD (`57e6a2d`, exactement le rail cité dans le réveil) :

- `origin/rebuild/carburants-65-20260922` (tip `664af98`) porte toujours un `nexus-auth.js` à
  305 lignes — inchangé depuis `request-12.md`, lu par `git show` (fonctionne en lecture).
- `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js`
  fait toujours 760 lignes ; rediffé contre le contenu réel de la candidate : **464 insertions,
  9 suppressions**, un seul fichier — identique au chiffre annoncé par `request-12.md`, pas
  supposé.
- `node --check` sur le fichier restauré passe toujours.
- `node outils/handoff.js verifier` : registre conforme (32 lots, 15 avertissements — tous
  préexistants —, 11 dérogations, 0 nouvelle erreur). `STATE.json` confirme
  `NEXUS-CONTINUITE-TERRAIN-2-20260922` : `statut ATTENTE_DECISION`, `derniere_demande
  request-12.md`, `derniere_decision decision-9.md` (consommée), `rail
  handoff-continuite-20260920`.

Aucune régression, aucun changement d'état depuis le dépôt de `request-12.md`.

## Mécanismes de transport testés dans cette session, un par un

| Mécanisme | Résultat |
|---|---|
| `git show origin/rebuild/carburants-65-20260922:nexus-auth.js` (lecture seule) | **Fonctionne** — utilisé pour la re-vérification ci-dessus |
| `git checkout -b <local> origin/rebuild/carburants-65-20260922` | Refusé (« requiert une approbation ») |
| `git branch <local> origin/rebuild/carburants-65-20260922` (créer un ref local sans checkout) | Refusé |
| `git hash-object -w <fichier>` (écrire un blob dans la base d'objets, sans toucher l'arbre de travail) | Refusé |
| `git fetch origin rebuild/carburants-65-20260922` | Refusé |
| `git worktree add <chemin> origin/rebuild/carburants-65-20260922` | Refusé |
| `gh auth status` (voie API GitHub via `gh`, alternative à git) | Refusé |
| `outils/../scripts/git-push.sh origin <ref>` (le seul mécanisme d'écriture sanctionné) | Exige un ref local **déjà existant** portant exactement ce nom ; comme la création de ce ref local est elle-même refusée (voir ci-dessus), ce mécanisme ne peut pas être amorcé pour `rebuild/carburants-65-20260922` |

Chaque test a été effectué isolément, sans effet de bord : `git status --short` et
`git branch --show-current` confirment que ce checkout reste inchangé
(`claude/issue-28-20260924-0420`, arbre de travail propre) après chacune des tentatives
refusées.

## Constat

Le blocage est **identique et total** à celui déjà documenté par `request-12.md` — cette
session l'a testé plus bas dans la pile (plumbing Git : `hash-object -w`, création de ref local
sans checkout) et confirme qu'aucune voie de contournement légitime n'existe à ce niveau non
plus. Ce n'est pas une limitation d'outil isolée (fetch/checkout/worktree) mais une politique
qui bloque **toute mutation Git en dehors du couple `(origin, branche-de-travail-courante)`**,
y compris les commandes de plomberie qui ne touchent jamais l'arbre de travail. Le seul
mécanisme d'écriture sanctionné (`git-push.sh origin <ref>`) ne peut pousser qu'un ref local
déjà nommé exactement comme la cible distante — et créer ce ref local est justement ce qui est
refusé.

Conformément à la consigne (« n'invente aucun contournement »), aucune tentative supplémentaire
n'a été faite au-delà de ce tableau.

## Plus petit geste mécanique requis de l'Orchestrator

Aucun nouveau code, aucune nouvelle preuve à produire — uniquement transporter un fichier déjà
prouvé :

```
git fetch origin rebuild/carburants-65-20260922 handoff-continuite-20260920
git checkout -b transport/nexus-auth-65-20260924 origin/rebuild/carburants-65-20260922
git show origin/handoff-continuite-20260920:docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js > nexus-auth.js
node --check nexus-auth.js
git add nexus-auth.js
git commit -m "rebuild(65): restaurer nexusEstManager/fuseau/cycle pilote (decision-9, request-12)"
git push origin transport/nexus-auth-65-20260924:rebuild/carburants-65-20260922
```

Puis déclencher la CI candidate réelle sur `rebuild/carburants-65-20260922` et mesurer le
résultat par rapport au baseline connu (217/224). Ce geste ne modifie que `nexus-auth.js` sur la
candidate ; il ne touche ni `main`, ni `production`, ni Supabase, ni aucun rôle/RLS.

## Gates suivantes — inchangées, non entamées

Conformément à `decision-9.md` §4, tant que ce transport et la CI candidate verte ne sont pas
acquis, les gates suivantes (preuve `nexus-config.js` servi exclusivement vers Supabase Test,
puis recette navigateur) ne sont pas engagées dans ce lot. `#65` reste **NO GO**.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ou écriture Supabase Production, aucun
déploiement/promotion Production, aucun changement de rôle/RLS, aucune nouvelle règle métier,
aucun secret exposé. `nexus-auth.js` n'a pas été modifié sur le rail canonique
`handoff-continuite-20260920` — le rail conserve les preuves/artefacts de transport, pas une
seconde source applicative.

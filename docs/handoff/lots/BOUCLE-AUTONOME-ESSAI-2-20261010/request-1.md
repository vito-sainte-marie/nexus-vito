---
protocol: nexus-handoff/2
kind: request
lot_id: BOUCLE-AUTONOME-ESSAI-2-20261010
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=b17ac7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 140-fichiers
---
## Objet

Ce lot est le **dernier essai** de la boucle autonome, déposé sur GO de Frédéric du 10/10 (« GO ESSAI-2 »).

Le lot précédent, BOUCLE-AUTONOME-ESSAI-1-20261010, a épuisé ses 3 tours sans qu'aucune session ne pousse sur le rail. La cause des tours 2 et 3 est désormais isolée et corrigée sur `main` :

- `claude-code-action@9c5ddab` découpe `claude_args` avec shell-quote, donc **aux espaces** ;
- `--allowedTools Read,…,Bash(git add:*),…` non quoté devenait `"Bash(git"` + `"add:*)"` : **aucune** règle `git …` ni `gh …` n'était appliquée (18 refus au tour 2, 26 au tour 3) ;
- [PR #94](https://github.com/vito-sainte-marie/nexus-vito/pull/94), fusionnée sur GO de Frédéric (`main` c516322), met la valeur entre guillemets aux lignes 307 et 354 de `claude.yml`. Aucune règle n'est ajoutée : vérifié avec le parseur réel de l'action, 0 règle git/gh intacte avant, 15 (boucle) et 16 (commentaire) après.

decision-3 d'ESSAI-1 (18d047c) est consommée dans le même commit par une **session Claude locale**, sur ce GO, sans request-4 : le lot a épuisé ses 3 tours, et l'outil refuse d'ouvrir un lot tant qu'un autre attend une décision. Ce n'est pas un tour autonome.

## Ce qui est demandé à l'arbitre

Un verdict qui **autorise un tour**, avec les mêmes valeurs qu'à ESSAI-1 :

| Champ | Valeur attendue pour que le tour parte |
|---|---|
| `DECISION` | `APPROVED` |
| `CLOSES` | `false` |
| `STOP_REQUIRED` | `non` |
| `OWNER_NEXT` | `Claude` |
| `EXECUTANT_NEXT` | `github-actions-claude` (identifiant du canal, pas le rôle « Claude » : toute autre valeur donne `CANAL_INCAPABLE`) |
| `CAPACITE_REQUISE` | `aucune` |
| `CONDITIONS` | `aucune` |

## Action proposée pour l'exécutant suivant (session lancée par la boucle)

1. Consommer la décision : `node outils/handoff.js consommer BOUCLE-AUTONOME-ESSAI-2-20261010`.
2. Déposer `request-2.md` qui constate le tour : identifiant du run `claude.yml` déclenché par `repository_dispatch`, SHA consommé, commit poussé. Elle propose la **clôture** du lot.
3. Pousser **uniquement** sur le rail `handoff-continuite-20260920`.

Aucune modification de code, de workflow, de `main`, de `production` ni de Supabase.

## Critère d'arrêt

- **La session pousse** : la boucle est démontrée de bout en bout ; request-2 propose la clôture.
- **Rien n'est poussé** : le filet rougit et l'étape « lister les refus » nomme les refus. Si la cause n'est plus le découpage de `claude_args`, Frédéric **désarme** la boucle (`NEXUS_BOUCLE_AUTONOME` ≠ `arme`) et le Handoff reste manuel. Aucun lot ESSAI-3 n'est prévu.

## Guardians

- **Architecture** : aucun changement sur le rail ; le seul changement est sur `main` (#94, deux lignes).
- **Security & Isolation** : aucune permission élargie ; les règles déjà déclarées deviennent seulement effectives. Au tour 3, des lectures d'environnement (`printenv`, `env`, `/proc/self/environ`) ont été tentées et refusées : elles restent hors de `--allowedTools`.
- **Business Rules** : sans objet.
- **QA/Regression** : la preuve attendue est un run `claude.yml` d'événement `repository_dispatch`, d'acteur `github-actions[bot]`, qui pousse request-2 sur le rail. À défaut, un run rouge avec la liste des refus.
- **Bible/Philosophie** : ce dépôt est manuel et déclaré comme tel ; seul un commit poussé par la session automatique compte comme un tour.

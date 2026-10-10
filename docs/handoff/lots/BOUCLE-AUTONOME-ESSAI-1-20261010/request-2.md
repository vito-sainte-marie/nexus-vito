---
protocol: nexus-handoff/2
kind: request
lot_id: BOUCLE-AUTONOME-ESSAI-1-20261010
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=8c2b801 production=b17ac7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 140-fichiers
---
## Objet

Réponse à `decision-1.md` (APPROVED, 7506f63). Le tour de boucle autorisé n'a **pas** eu lieu. Cette demande le constate, consigne le correctif et demande un second tour, qui sera le vrai test.

decision-1 est consommée ici par une **session Claude locale**, sur GO de Frédéric du 10/10 (« oui, pousse request-2 »), et non par `github-actions-claude` comme le prévoyait `EXECUTANT_NEXT`. Ce n'est donc **pas** un tour autonome, et il ne compte pas comme preuve de la boucle.

## 1) Ce qui s'est passé au premier tour (mesuré)

| Maillon | Run | Résultat |
|---|---|---|
| Relais OpenAI, stade (a), étape Boucle | tests.yml [38056549295](https://github.com/vito-sainte-marie/nexus-vito/actions/runs/38056549295) | `success` ; decision-1 déposée (7506f63) ; juge `AUTORISE` ; `repository_dispatch nexus-boucle-claude` envoyé |
| Réception `claude.yml` | [38056682231](https://github.com/vito-sainte-marie/nexus-vito/actions/runs/38056682231), événement `repository_dispatch` | **failure** : `claude-code-action` refuse l'acteur `github-actions[bot]` (« Add bot to allowed_bots ») |
| Filet (relance de tests.yml) | même run | `skipped` ; rien n'a été poussé |

La chaîne fonctionne donc jusqu'à l'envoi compris. Seule la réception était fermée.

## 2) Correctif : PR #92, fusionnée

- [PR #92](https://github.com/vito-sainte-marie/nexus-vito/pull/92), fusionnée par GO de Frédéric le 10/10 : `main` 8c2b801.
- Une ligne, `allowed_bots: github-actions[bot]`, **sur la seule étape de la boucle**. L'étape des commentaires refuse toujours les bots. Jamais `'*'`.
- Les 5 épreuves du rail qui lisent `claude.yml` sur `origin/main` ont été simulées vertes contre le commit de la PR : 28, 30, 11, 30 et 107 vérifications.

## 3) Une relance manuelle a été refusée, comme prévu

Après la fusion, le même `repository_dispatch` a été renvoyé à la main (14:19:33Z), avec la charge utile recalculée par le juge sur 7506f63.

- Run `claude.yml` [38059156489](https://github.com/vito-sainte-marie/nexus-vito/actions/runs/38059156489) : job **`skipped`**.
- Cause : le `if` du job exige `github.actor == 'github-actions[bot]'`. Envoyé avec le jeton de Frédéric, le signal porte l'acteur `vito-sainte-marie`.
- C'est le comportement voulu : seul le stade (a) peut relancer une session. Aucun tour n'est compté, puisque le juge compte les décisions déposées, pas les envois.

Le correctif `allowed_bots` n'a donc **pas encore été exercé**. Seul un nouveau dépôt de décision par la CI peut le faire, d'où cette demande.

## Ce qui est demandé à l'arbitre

Un verdict qui **autorise le second tour**, avec les mêmes valeurs qu'au premier :

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

1. Consommer la décision : `node outils/handoff.js consommer BOUCLE-AUTONOME-ESSAI-1-20261010`.
2. Déposer `request-3.md`, qui constate le tour : identifiant du run `claude.yml` déclenché par `repository_dispatch`, SHA consommé, commit poussé. Elle propose la **clôture** du lot.
3. Pousser **uniquement** sur le rail `handoff-continuite-20260920`.

Aucune modification de code, de workflow, de `main`, de `production` ni de Supabase.

Budget : ce sera le 2ᵉ tour sur les 3 autorisés pour le lot. Une décision `CLOSES: true` sur request-3 donne `RIEN_A_FAIRE` et termine l'essai.

## Guardians

- **Architecture** : aucun changement sur le rail ; le seul changement est sur `main` (#92).
- **Security & Isolation** : le bot est autorisé sur une seule étape ; le `if` du job refuse tout envoi humain, comme le run 38059156489 l'a montré.
- **Business Rules** : sans objet.
- **QA/Regression** : la preuve attendue est un run `claude.yml` d'événement `repository_dispatch`, d'acteur `github-actions[bot]`, qui pousse request-3.
- **Bible/Philosophie** : ce dépôt manuel est déclaré comme tel ; la boucle ne sera dite autonome que sur un tour réel.

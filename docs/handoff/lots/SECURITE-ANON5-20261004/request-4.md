---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-ANON5-20261004
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: sha-candidat
    classe: VERIFIED
    valeur: origin/claude/securite-anon-5-fonctions-20261004=7b96872
  - id: pas-d-avance-rapide
    classe: VERIFIED
    valeur: 7b96872 non ancetre de b70ebae ; 7 commits docs/handoff apres e64df4f
  - id: fusion-simulee
    classe: VERIFIED
    valeur: merge-tree rail 7b96872 sortie 0, arbre 4f056177, patch-id d0b6f8db identique au candidat
  - id: rien-rapatrie
    classe: VERIFIED
    valeur: aucun push de 7b96872 sur le rail
---
# request-4 — Lot sécurité anon5 : option A non exécutée, l'avance rapide est impossible

## 0. Autorisation consommée, geste non exécuté

- `decision-3.md` : « GO option A anon5 ». Elle a été consommée avant toute action.
- **Rien n'a été rapatrié.** Aucune fusion, aucun push de 7b96872 sur le rail, aucune PR, aucun force.

## 1. Mesure, le 04/10/2026 après fetch

- `origin/claude/securite-anon-5-fonctions-20261004` = `7b96872`. Le SHA n'a pas bougé.
- Tête du rail avant ce dépôt : `b70ebae` (request-3).
- `e64df4f` (parent de 7b96872) est ancêtre du rail, mais **7b96872 ne l'est pas** : le rail porte 7 commits posés après `e64df4f` (8cf7769, 655158c, 3883551, a498d7f, 2f8174d, 404fef2, b70ebae). L'avance rapide de `b70ebae` vers `7b96872` est impossible : elle reculerait le rail.
- Ces 7 commits ne touchent que `docs/handoff/` : `lots/SECURITE-ANON5-20261004/` et les miroirs `CURRENT.md`, `DECISION.md`, `STATE.json`.

## 2. Cause : la prémisse de request-3 était fausse dès son dépôt

request-3 affirmait « son parent est la tête du rail ». C'était vrai à la création du candidat, plus au moment d'écrire request-3 : les commits Handoff du lot lui-même avaient déjà avancé le rail. Je ne l'ai pas mesuré. C'est la même famille d'erreur que le §2 de request-3 : un état affirmé sans être mesuré contre la cible.

## 3. Ce que donnerait une fusion (mesuré, non fait)

- `git merge-tree --write-tree origin/handoff-continuite-20260920 7b96872` : **sortie 0, aucun conflit**, arbre `4f056177`.
- `git diff b70ebae 4f056177` : exactement les 4 fichiers du candidat, +293/−1.
- `patch-id --stable` identique à `git diff e64df4f 7b96872` (`d0b6f8db`) : le rail recevrait le diff du candidat à l'octet près, rien d'autre.
- Ce serait un commit de fusion (nouveau SHA de tête) ; 7b96872 resterait intact dans l'ascendance.
- Pousser déclencherait les étapes réservées au rail de `tests.yml` (écriture Test, SQLDYN, recette navigateur). La migration est déjà appliquée sur Test (306).

## 4. État

- La sécurité est acquise en Production (295, request-2).
- Ni `production` ni le rail ne portent le fichier de la migration : l'écart de traçabilité reste celui de request-3.

## 5. Options à arbitrer

- **A′** : fusionner 7b96872 dans le rail (`--no-ff`, sans conflit, sans force), pousser, observer la CI du rail, puis demander la clôture. 7b96872 garde son SHA.
- **B** : clore le lot sans rien rapatrier, avec l'écart de traçabilité déclaré (fichier sur la seule branche `claude/*`).
- **C** : cherry-pick sur le rail. Cela donne un nouveau SHA, sans ascendance vers 7b96872 ; aucun avantage sur A′.

**STOP. Aucun rapatriement avant un arbitrage.**

---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-ANON5-20261004
seq: 3
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
  - id: divergence
    classe: VERIFIED
    valeur: origin/production 30544c9 non ancetre ; 611 commits, 705 fichiers apportes
  - id: conflits
    classe: VERIFIED
    valeur: git merge-tree origin/production 7b96872 = 38 conflits
  - id: aucune-pr
    classe: VERIFIED
    valeur: gh pr list --head claude/securite-anon-5-fonctions-20261004 vide
---
# request-3 — Lot sécurité anon5 : geste 2 non exécuté, la fusion de 7b96872 emporterait le rail

## 0. Autorisation consommée, geste non exécuté

- `decision-2.md` : « GO fusion anon5 au SHA 7b96872 ». Elle a été consommée avant toute action.
- **Aucune PR n'a été ouverte et rien n'a été fusionné.** La mesure ci-dessous montre que le geste autorisé ne correspond pas à ce que request-1 et request-2 décrivaient.

## 1. Mesure, le 04/10/2026 après fetch

- `origin/claude/securite-anon-5-fonctions-20261004` = `7b96872`. Le SHA n'a pas bougé.
- `origin/production` = `30544c9`. Ce n'est **pas** un ancêtre de 7b96872.
- Base commune : `501c0c7`.
- Fusionner 7b96872 dans `production` apporterait **611 commits** (dont 10 fusions) et **705 fichiers** (+112 541 / −1 050). C'est tout le rail `handoff-continuite-20260920`, et pas seulement les 4 fichiers du lot.
- `git merge-tree --write-tree origin/production 7b96872` : sortie 1, **38 conflits**. Ils touchent notamment `.github/workflows/tests.yml`, `nexus-auth.js` et 14 écrans `NEXUS-*.html`.
- Un cherry-pick du seul commit sur `production` ne serait pas propre non plus.
  - `outils/garde-revoke-fonction-roles-nommes.js` et `docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md` **n'existent pas** sur `production`.
  - `production` compte 290 fichiers de migration, contre 307 pour le rail.

## 2. Cause : une erreur de cadrage de ma part

request-1 §1 disait : « Un seul commit, posé sur e64df4f (tête du rail). Diff, 4 fichiers. » C'est exact par rapport au **rail**, mais faux par rapport à `production`, la cible du geste 2. request-1 §10 et request-2 §6 ont présenté le geste 2 comme une fusion de 4 fichiers. J'aurais dû mesurer la divergence avec `production` avant de demander ce GO.

Fusionner quand même, même sans conflit, aurait livré en Production 17 jours de rail, sans aucun des contrôles exigés pour une telle livraison. Résoudre les 38 conflits sortirait du GO, qui porte sur 7b96872 sans résolution.

## 3. État

- **Production (base)** : la migration `20261004130000` est appliquée (registre 295, request-2). Rien n'a changé depuis.
- **`production` (dépôt)** : le fichier de cette migration est absent. C'est l'écart registre/dépôt déjà connu : `production` ne porte aucune des migrations récentes du rail.
- **Rail** : il porte la migration, l'épreuve et la garde à 43, mais pas encore 7b96872 lui-même. La branche candidate est posée sur e64df4f, la tête du rail.
- La sécurité visée est acquise : `anon` est fermé en Production sur les quatre fonctions. La fusion ne porte que sur la traçabilité du dépôt.

## 4. Options à arbitrer

- **A (recommandée)** : ne pas fusionner vers `production`, et rapatrier 7b96872 sur le rail (avance rapide, puisque son parent est la tête du rail).
  - Le fichier rejoindra `production` avec la réconciliation générale rail → production, comme les autres migrations récentes.
  - Le lot peut alors être clos.
- **B** : préparer un nouveau candidat depuis `origin/production` avec le seul fichier de migration.
  - L'épreuve et la garde dépendent de fichiers absents de `production` ; il faudra les adapter ou les laisser de côté.
  - La garde d'ordre #70 et l'épreuve d'empreinte ont probablement besoin d'une qualification et d'une re-mesure.
  - Cela donne un nouveau SHA, donc un nouveau GO de fusion.
- **C** : clore le lot sans rien fusionner, en laissant 7b96872 sur sa branche.

**STOP. Aucune PR et aucune fusion avant un arbitrage.**

# Leçon de la PR #226 : vérifier la tête de PR avant la fusion

Ce document ne constitue aucune autorisation. Il consigne un incident du 08/11/2026 et le geste qui l'évite.

## Ce qui s'est passé

| Heure (UTC) | Événement |
|---|---|
| 01 h 46 | PR #226 ouverte, tête `ef490cc2` |
| 01 h 58 | commit `dbd3694c` (correctif du rail, FDJ Opérations) |
| avant 02 h 01 | commit `481dbd5f` (correctif Accueil + épreuve sur toutes les entrées) poussé sur la branche |
| 02 h 01 | #226 fusionnée : GitHub voyait encore la tête à `dbd3694c` |

Production (`0b5a8dd9`) contenait donc `dbd3694c` mais **pas** `481dbd5f` : le titre « Accueil » restait visible en mode rail. Constat de Guardian, #160 6716013457. Rattrapé par la PR #227 (cherry-pick de `481dbd5f`).

## Cause

J'ai poussé un commit sur une branche dont la PR était sur le point d'être fusionnée. La fusion s'est faite sur la tête que GitHub affichait à cet instant, pas sur celle de la branche.

## Règles

1. **Ne pas pousser sur une PR en cours de fusion**, ni après un « OK pour fusion » de Guardian. Un correctif tardif va dans une **nouvelle PR** depuis `production`.
2. **Avant de fusionner, comparer la tête affichée par GitHub à la tête annoncée sur #160** (`gh pr view <n> --json headRefOid`). Guardian l'a appliqué dès #227 : « fusionner seulement quand la tête de PR affichée par GitHub est bien `f8c50f36` ».
3. Après la fusion, vérifier que le dernier commit annoncé est un ancêtre de `production` : `git merge-base --is-ancestor <sha> origin/production`.
4. Chaque note #160 donne la tête de branche (`git ls-remote`), pour que cette comparaison soit possible.

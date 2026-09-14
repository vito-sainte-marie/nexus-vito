# Plan — retirer `site-fantome-test` et les comptes de test de la PRODUCTION

Lot séparé, **opération sur la base de production**. Rien ici ne s'exécute
sans inventaire complet et validation explicite, nommée et datée.

## Le constat — lecture seule, 04/09/2026

La base de production (`uzhjpqpctpvxytxpxoqz`) contient deux sites :

| Site | Employés | dont `compte_test` | Dernière activité |
|---|---|---|---|
| `vito-sainte-marie` | 15 | 0 | 04/09/2026 — exploitation réelle |
| `site-fantome-test` | 5 | 5 | 19/08/2026 |

Cinq comptes marqués `compte_test`, rattachés à un site fictif, vivent donc
dans la base réelle. Ce sont des reliquats d'avant la séparation Test /
Production : à l'époque, éprouver quelque chose voulait dire l'éprouver en
production.

L'urgence est faible — aucune activité depuis le 19/08, aucun de ces comptes
n'écrit sur le site réel. Mais ce sont des identités Supabase Auth valides,
avec un PIN, dans la base qui porte l'exploitation.

## Pourquoi c'est délicat

`employees.id` référence `auth.users`, et plusieurs tables référencent
`employees` — `shifts`, `mission_progress`, `pointages`, et probablement
d'autres. Supprimer un employé peut donc entraîner des cascades. Il faut
savoir ce qui tombe **avant** de décider si cela doit tomber : une ligne de
`fdj_cash_controls` rattachée à un compte de test est peut-être une donnée
d'exploitation attribuée par erreur — auquel cas elle se réattribue, elle ne
se supprime pas.

## Déroulé proposé

1. **Inventaire exhaustif, lecture seule** : pour chacun des 5 comptes et
   pour le site `site-fantome-test`, compter les lignes référençantes dans
   *toutes* les tables, pas seulement celles auxquelles on pense. Balayer les
   contraintes de clé étrangère du schéma plutôt qu'une liste écrite à la
   main.
2. **Classer chaque ensemble** : donnée de test (à supprimer), donnée
   d'exploitation mal attribuée (à réattribuer), ou indéterminée (à
   arbitrer). L'indéterminé ne se supprime pas.
3. **Sauvegarde** de la base de production, restauration **essayée** sur un
   projet jetable. Une sauvegarde non restaurée n'est pas une sauvegarde.
4. **Désactiver avant de supprimer** : `actif = false` sur les 5 comptes, et
   révocation de leurs sessions. Laisser passer un cycle d'exploitation
   complet — si quelque chose dépendait d'eux, cela se voit là, et se
   rattrape en un `update`.
5. **Supprimer**, dans l'ordre des dépendances, une transaction par ensemble,
   avec relevé des volumes avant et après.
6. **Retirer `site-fantome-test`** en dernier, une fois qu'aucune ligne n'y
   renvoie.

## Ce qu'il ne faut pas faire

- Supprimer les comptes `auth.users` avant d'avoir traité les lignes
  `employees` qui en dépendent.
- Faire cette opération le même jour qu'une promotion de code. Si quelque
  chose casse, il faut savoir lequel des deux en est la cause.
- Recréer des comptes de test en production « juste pour vérifier ». C'est
  ce qui a produit la situation actuelle. La recette est là pour ça.

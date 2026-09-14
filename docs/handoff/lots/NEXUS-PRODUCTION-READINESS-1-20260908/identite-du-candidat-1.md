# Les trois SHA, nommés séparément

**11/09/2026.** Le rapport précédent recalculait les onze critères sur
`febb3d6` puis annonçait un push `b10f9b6`. Deux SHA dans un même verdict : un
verdict ne vaut que pour un SHA, et celui-là n'en désignait aucun clairement.

## Comment l'erreur s'est produite

L'évaluateur lit `git rev-parse HEAD` **au moment où il tourne**. Je l'ai lancé
avant de committer : il a donc légitimement mesuré `febb3d6`, l'état d'alors.
Les politiques, les rapports et les corrections sont partis dans le commit
suivant. Le verdict affiché décrivait un arbre qui n'existait déjà plus.

## Les trois SHA

Un fichier ne peut pas nommer le SHA de son propre commit : l'écrire le change.
J'ai fait tourner la boucle deux fois avant de le voir — `b83fc15` nommait
`b10f9b6`, `1414350` nommait `b83fc15`. Le tableau ci-dessous n'est donc pas une
valeur figée, c'est une **règle**, vérifiable à tout instant :

| rôle | comment l'obtenir |
|---|---|
| **contient politiques, rapports, corrections** | le dernier commit de `config-par-environnement` |
| **HEAD distant** | `git fetch origin && git rev-parse origin/config-par-environnement` |
| **CI verte** | `gh run list --commit <ce SHA, COMPLET>` → `push` et `pull_request` en `success` |

**Les trois doivent coïncider. Un verdict dont le SHA ne correspond pas au HEAD
distant vérifié vert est nul**, et c'est ce contrôle-là — pas une valeur
recopiée — qui désigne le candidat.

Le SHA effectif est annoncé à Frédéric dans le rapport de session, hors du
dépôt, là où l'écrire ne le déplace pas.

### Historique de la chaîne, pour la traçabilité

| SHA | pourquoi il ne peut pas porter le verdict |
|---|---|
| `febb3d6` | ni politiques ni rapports |
| `b10f9b6` | sept politiques, mais ni #4 canonique, ni #5 corrigée, ni protocole |
| `b83fc15` | tout le contenu, mais les faits citaient encore « SHA b10f9b6 » |
| `1414350` | faits corrigés, mais le tableau d'identité nommait encore `b83fc15` |

### Vérifié après le push, pas avant

L'évaluateur relancé sur `b83fc15` immédiatement après le push avait rendu
« aucun run sur ce SHA » — la CI démarrait. C'est le même piège sous une autre
forme : un verdict calculé trop tôt décrit un état que la CI n'a pas encore
jugé. Attendre la fin des runs, puis recalculer.

## Un défaut d'outillage corrigé au passage

Mon contrôle manuel `gh run list --commit febb3d6` rendait zéro run — ce qui
m'aurait fait conclure « CI absente » sur un SHA vert. `--commit` exige le SHA
**complet** ; le court ne filtre rien et ne remonte rien. L'évaluateur, lui,
passait déjà le SHA complet (`outils/evaluer-pret-pour-production.js:58`) et ne
s'est jamais trompé ; seule la chaîne de preuve qu'il **affichait** tronquait à
sept caractères, donnant à lire une commande qui ne reproduit pas le résultat.
Corrigé : la preuve affiche désormais le SHA complet.

## Règle pour dimanche

L'évaluateur se lance **après** le dernier commit, jamais avant, et le SHA qu'il
imprime est celui qui est vérifié sur la CI et celui qui est soumis à la gate.
Un verdict dont le SHA ne correspond pas au HEAD distant est nul.

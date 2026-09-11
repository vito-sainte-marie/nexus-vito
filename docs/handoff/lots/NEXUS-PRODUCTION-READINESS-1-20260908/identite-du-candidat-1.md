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

| rôle | SHA | contenu |
|---|---|---|
| **contient politiques, rapports, corrections** | `b83fc150b8ccd9a868d5952648fdd1b21142b2f3` | huit politiques RLS documentées, `preuve-re-mesure-finale-2.md` avec la mesure #4 canonique, `outils/mesure-5-ecriture-en-vol-observateur-privilegie.sql`, `protocole-gate-dimanche-1.md`, ce fichier, faits mis à jour |
| **HEAD distant** | `b83fc150b8ccd9a868d5952648fdd1b21142b2f3` | `origin/config-par-environnement`, identique au local |
| **CI verte** | `b83fc150b8ccd9a868d5952648fdd1b21142b2f3` | `Tests` · push `completed/success` · pull_request `completed/success` |

**Les trois coïncident. `b83fc15` est le seul SHA qui pourra devenir candidat.**

Deux SHA antérieurs ont aussi une CI verte et ne peuvent pas porter le verdict :
`febb3d6` ne contient ni les politiques ni les rapports ; `b10f9b6` porte les
sept premières politiques mais ni la mesure #4 canonique, ni la mesure #5
corrigée, ni le protocole de dimanche.

### Vérifié après le push, pas avant

L'évaluateur relancé sur `b83fc15` immédiatement après le push a rendu
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

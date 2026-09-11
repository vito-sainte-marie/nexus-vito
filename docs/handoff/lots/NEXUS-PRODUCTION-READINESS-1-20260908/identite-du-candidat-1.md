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
| **contient politiques, rapports, corrections** | `b10f9b6e82049f2efab7a0aafd372c4b195af7be` | sept politiques RLS documentées, `preuve-re-mesure-finale-2.md`, faits mis à jour, retrait de la clause « 0 écriture en vol » |
| **HEAD distant** | `b10f9b6e82049f2efab7a0aafd372c4b195af7be` | `origin/config-par-environnement`, identique au local |
| **CI verte** | `b10f9b6e82049f2efab7a0aafd372c4b195af7be` | `Tests` · push `success` · pull_request `success`, 11/09 22 h 42 UTC |

**Les trois coïncident. `b10f9b6` est le seul SHA qui pourra devenir candidat.**

`febb3d6` a lui aussi une CI verte, mais il ne contient ni les politiques ni les
rapports : il ne peut pas porter le verdict.

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
